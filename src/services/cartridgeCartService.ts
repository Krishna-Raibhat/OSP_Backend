import { pool } from "../config/db";
import { HttpError } from "../utils/errors";
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

// Get cart with items
export async function getCartWithItems(user_id: string, userRole?: string) {
  const cart = await getOrCreateCart(user_id);

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

    return {
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
    };
  });

  const total = items.reduce((sum, item) => sum + item.subtotal, 0);

  return {
    cart,
    items,
    total,
    item_count: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

// Add item to cart
export async function addToCart(input: {
  user_id: string;
  cartridge_product_id: string;
  quantity: number;
  userRole?: string;
}) {
  const { user_id, cartridge_product_id, quantity, userRole } = input;

  if (quantity < 1) throw new HttpError(400, "Quantity must be at least 1.");

  const productQuery = `SELECT * FROM cartridge_products WHERE id = $1 AND is_active = true;`;
  const productResult = await pool.query<CartridgeProduct>(productQuery, [cartridge_product_id]);
  const product = productResult.rows[0];

  if (!product) throw new HttpError(404, "Product not found or inactive.");

  const isDistributor = userRole === "distributor";
  const unit_price = isDistributor && product.special_price !== null 
    ? product.special_price 
    : product.unit_price;

  const cart = await getOrCreateCart(user_id);

  const checkQuery = `SELECT * FROM cartridge_cart_items WHERE cart_id = $1 AND cartridge_product_id = $2;`;
  const checkResult = await pool.query<CartridgeCartItem>(checkQuery, [cart.id, cartridge_product_id]);

  if (checkResult.rows[0]) {
    const newQuantity = checkResult.rows[0].quantity + quantity;
    const updateQuery = `
      UPDATE cartridge_cart_items 
      SET quantity = $1, unit_price = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *;
    `;
    const result = await pool.query<CartridgeCartItem>(updateQuery, [newQuantity, unit_price, checkResult.rows[0].id]);
    return result.rows[0];
  }

  const insertQuery = `
    INSERT INTO cartridge_cart_items (cart_id, cartridge_product_id, unit_price, quantity)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;
  const result = await pool.query<CartridgeCartItem>(insertQuery, [cart.id, cartridge_product_id, unit_price, quantity]);
  return result.rows[0];
}

// Update cart item quantity
export async function updateCartItem(input: {
  user_id: string;
  cart_item_id: string;
  quantity: number;
}) {
  const { user_id, cart_item_id, quantity } = input;

  if (quantity < 1) throw new HttpError(400, "Quantity must be at least 1.");

  const q = `
    UPDATE cartridge_cart_items ci
    SET quantity = $1, updated_at = NOW()
    FROM cartridge_carts c
    WHERE ci.id = $2 AND ci.cart_id = c.id AND c.user_id = $3 AND c.status = 'active'
    RETURNING ci.*;
  `;

  const result = await pool.query<CartridgeCartItem>(q, [quantity, cart_item_id, user_id]);

  if (!result.rows[0]) throw new HttpError(404, "Cart item not found.");

  return result.rows[0];
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

  return { message: "Item removed from cart." };
}

// Clear cart
export async function clearCart(user_id: string) {
  const cart = await getOrCreateCart(user_id);

  const q = `DELETE FROM cartridge_cart_items WHERE cart_id = $1;`;
  await pool.query(q, [cart.id]);

  return { message: "Cart cleared." };
}

// Sync cart from frontend
export async function syncCart(input: {
  user_id: string;
  items: Array<{ cartridge_product_id: string; quantity: number }>;
  userRole?: string;
}) {
  const { user_id, items, userRole } = input;

  for (const item of items) {
    await addToCart({
      user_id,
      cartridge_product_id: item.cartridge_product_id,
      quantity: item.quantity,
      userRole,
    });
  }

  return getCartWithItems(user_id, userRole);
}
