import { pool } from "../config/db";
import { HttpError, validateQuantity } from "../utils/errors";
import type { CartridgeCart, CartridgeCartItem, CartridgeProduct } from "../models/cartridgeModels";

/* ==================== CARTRIDGE CART SERVICES ==================== */

// Get or create active cart for user
export async function getOrCreateCart(user_id: string) {
  let q = `SELECT * FROM cartridge_carts WHERE user_id = $1 AND status = 'active';`;
  let result = await pool.query<CartridgeCart>(q, [user_id]);

  if (result.rows[0]) {
    return result.rows[0];
  }

  q = `INSERT INTO cartridge_carts (user_id, status) VALUES ($1, 'active') RETURNING *;`;
  result = await pool.query<CartridgeCart>(q, [user_id]);
  return result.rows[0];
}

// Get existing cart without creating one
export async function getExistingCart(user_id: string) {
  const q = `SELECT * FROM cartridge_carts WHERE user_id = $1 AND status = 'active';`;
  const result = await pool.query<CartridgeCart>(q, [user_id]);
  return result.rows[0] || null;
}

// Get cart with items (does NOT auto-create)
export async function getCartWithItems(user_id: string, userRole?: string) {
  // Don't auto-create cart on GET - only return if exists
  const cart = await getExistingCart(user_id);
  
  if (!cart) {
    return {
      cart: null,
      items: [],
      total: 0,
      item_count: 0,
    };
  }

  const q = `
    SELECT 
      ci.id,
      ci.cart_id,
      ci.cartridge_product_id,
      ci.unit_price,
      ci.quantity,
      ci.created_at,
      p.product_name,
      p.model_number,
      p.unit_price as current_price,
      p.special_price as current_special_price,
      p.quantity as available_stock,
      b.name as brand_name,
      c.name as category_name
    FROM cartridge_cart_items ci
    JOIN cartridge_products p ON ci.cartridge_product_id = p.id
    JOIN cartridge_brands b ON p.brand_id = b.id
    JOIN cartridge_categories c ON p.category_id = c.id
    WHERE ci.cart_id = $1
    ORDER BY ci.created_at DESC;
  `;

  const result = await pool.query(q, [cart.id]);

  const items = result.rows.map((item: any) => {
    const isDistributor = userRole === "distributor";
    const currentPrice = isDistributor && item.current_special_price !== null 
      ? item.current_special_price 
      : item.current_price;

    // Build response - hide special_price from non-distributors
    const itemResponse: any = {
      id: item.id,
      cart_id: item.cart_id,
      cartridge_product_id: item.cartridge_product_id,
      product_name: item.product_name,
      model_number: item.model_number,
      brand_name: item.brand_name,
      category_name: item.category_name,
      unit_price: item.unit_price,
      quantity: item.quantity,
      subtotal: item.unit_price * item.quantity,
      current_price: currentPrice,
      price_changed: item.unit_price !== currentPrice,
      available_stock: item.available_stock,
      stock_sufficient: item.available_stock >= item.quantity,
    };

    // Only show special price info to distributors
    if (isDistributor && item.current_special_price !== null) {
      itemResponse.current_special_price = item.current_special_price;
    }

    return itemResponse;
  });

  const total = items.reduce((sum, item) => sum + item.subtotal, 0);

  return {
    cart,
    items,
    total,
    item_count: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

// Add item to cart with transaction and stock locking
export async function addToCart(input: {
  user_id: string;
  cartridge_product_id: string;
  quantity: number | string; // Accept both types
  userRole?: string;
}) {
  const { user_id, cartridge_product_id, quantity, userRole } = input;

  // Validate quantity (handles both string and number)
  const validatedQty = validateQuantity(quantity, "Quantity");

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock product row and check stock (prevents race condition)
    const productQuery = `
      SELECT * FROM cartridge_products 
      WHERE id = $1 AND is_active = true 
      FOR UPDATE;
    `;
    const productResult = await client.query<CartridgeProduct>(productQuery, [cartridge_product_id]);
    const product = productResult.rows[0];

    if (!product) {
      throw new HttpError(404, "Product not found or inactive.");
    }

    // Get or create cart within transaction
    let cartQuery = `SELECT * FROM cartridge_carts WHERE user_id = $1 AND status = 'active' FOR UPDATE;`;
    let cartResult = await client.query<CartridgeCart>(cartQuery, [user_id]);
    
    let cart = cartResult.rows[0];
    if (!cart) {
      try {
        const createCartQuery = `INSERT INTO cartridge_carts (user_id, status) VALUES ($1, 'active') RETURNING *;`;
        cartResult = await client.query<CartridgeCart>(createCartQuery, [user_id]);
        cart = cartResult.rows[0];
      } catch (err: any) {
        // If unique constraint violation, fetch the cart
        if (err.code === '23505') {
          cartQuery = `SELECT * FROM cartridge_carts WHERE user_id = $1 AND status = 'active' FOR UPDATE;`;
          cartResult = await client.query<CartridgeCart>(cartQuery, [user_id]);
          cart = cartResult.rows[0];
        } else {
          throw err;
        }
      }
    }

    // Check if item already in cart
    const checkQuery = `
      SELECT * FROM cartridge_cart_items 
      WHERE cart_id = $1 AND cartridge_product_id = $2 
      FOR UPDATE;
    `;
    const checkResult = await client.query<CartridgeCartItem>(checkQuery, [cart.id, cartridge_product_id]);
    
    const existingItem = checkResult.rows[0];
    const finalQuantity = existingItem ? existingItem.quantity + validatedQty : validatedQty;

    // Check stock availability with locked row
    if (product.quantity < finalQuantity) {
      throw new HttpError(
        400, 
        `Insufficient stock for "${product.product_name}". Available: ${product.quantity}, Requested: ${finalQuantity}`
      );
    }

    // Calculate price based on role
    const isDistributor = userRole === "distributor";
    const unit_price = isDistributor && product.special_price !== null 
      ? product.special_price 
      : product.unit_price;

    // Use UPSERT to handle concurrent inserts
    const upsertQuery = `
      INSERT INTO cartridge_cart_items (cart_id, cartridge_product_id, unit_price, quantity)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (cart_id, cartridge_product_id) 
      DO UPDATE SET 
        quantity = cartridge_cart_items.quantity + EXCLUDED.quantity,
        unit_price = EXCLUDED.unit_price,
        updated_at = NOW()
      RETURNING *;
    `;
    
    const result = await client.query<CartridgeCartItem>(upsertQuery, [
      cart.id, 
      cartridge_product_id, 
      unit_price, 
      validatedQty
    ]);

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Update cart item quantity with stock check and price update
export async function updateCartItem(input: {
  user_id: string;
  cart_item_id: string;
  quantity: number | string; // Accept both types
  userRole?: string;
}) {
  const { user_id, cart_item_id, quantity, userRole } = input;

  // Validate quantity (handles both string and number)
  const validatedQty = validateQuantity(quantity, "Quantity");

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get cart item with product info and lock both rows
    const itemQuery = `
      SELECT 
        ci.*,
        p.quantity as available_stock,
        p.product_name,
        p.unit_price as current_price,
        p.special_price as current_special_price,
        c.user_id
      FROM cartridge_cart_items ci
      JOIN cartridge_products p ON ci.cartridge_product_id = p.id
      JOIN cartridge_carts c ON ci.cart_id = c.id
      WHERE ci.id = $1 AND c.user_id = $2 AND c.status = 'active'
      FOR UPDATE OF ci, p;
    `;
    
    const itemResult = await client.query(itemQuery, [cart_item_id, user_id]);
    const item = itemResult.rows[0];

    if (!item) {
      throw new HttpError(404, "Cart item not found.");
    }

    // Check stock availability
    if (item.available_stock < validatedQty) {
      throw new HttpError(
        400,
        `Insufficient stock for "${item.product_name}". Available: ${item.available_stock}, Requested: ${validatedQty}`
      );
    }

    // Calculate current price based on role
    const isDistributor = userRole === "distributor";
    const unit_price = isDistributor && item.current_special_price !== null 
      ? item.current_special_price 
      : item.current_price;

    // Update quantity AND price
    const updateQuery = `
      UPDATE cartridge_cart_items 
      SET quantity = $1, unit_price = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *;
    `;

    const result = await client.query<CartridgeCartItem>(updateQuery, [validatedQty, unit_price, cart_item_id]);

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Remove item from cart
export async function removeCartItem(user_id: string, cart_item_id: string) {
  const q = `
    DELETE FROM cartridge_cart_items ci
    USING cartridge_carts c
    WHERE ci.id = $1 AND ci.cart_id = c.id AND c.user_id = $2 AND c.status = 'active'
    RETURNING ci.*;
  `;

  const result = await pool.query<CartridgeCartItem>(q, [cart_item_id, user_id]);

  if (!result.rows[0]) throw new HttpError(404, "Cart item not found.");

  return result.rows[0];
}

// Clear cart
export async function clearCart(user_id: string) {
  const cart = await getExistingCart(user_id);
  
  if (!cart) {
    return { message: "Cart is already empty." };
  }

  const q = `DELETE FROM cartridge_cart_items WHERE cart_id = $1;`;
  await pool.query(q, [cart.id]);

  return { message: "Cart cleared." };
}

// Sync cart from frontend with validation
export async function syncCart(input: {
  user_id: string;
  items: Array<{ cartridge_product_id: string; quantity: number | string }>;
  userRole?: string;
}) {
  const { user_id, items, userRole } = input;

  // Validate each item
  for (const item of items) {
    if (!item.cartridge_product_id || typeof item.cartridge_product_id !== 'string') {
      throw new HttpError(400, "Each item must have a valid cartridge_product_id.");
    }
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(item.cartridge_product_id)) {
      throw new HttpError(400, `Invalid UUID format for cartridge_product_id: ${item.cartridge_product_id}`);
    }
    
    // Validate and convert quantity
    const qty = validateQuantity(item.quantity, "Item quantity");
    item.quantity = qty;
  }

  // Add each item to cart
  for (const item of items) {
    await addToCart({
      user_id,
      cartridge_product_id: item.cartridge_product_id,
      quantity: item.quantity as number,
      userRole,
    });
  }

  return getCartWithItems(user_id, userRole);
}
