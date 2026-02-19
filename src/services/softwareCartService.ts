import { pool } from "../config/db";
import { HttpError } from "../utils/errors";
import type { SoftwareCart, SoftwareCartItem, SoftwarePlan } from "../models/softwareModels";

/* ==================== CART SERVICES ==================== */

// Get or create active cart for user
export async function getOrCreateCart(user_id: string) {
  // Check if user has an active cart
  let q = `SELECT * FROM software_carts WHERE user_id = $1 AND status = 'active';`;
  let result = await pool.query<SoftwareCart>(q, [user_id]);

  if (result.rows[0]) {
    return result.rows[0];
  }

  // Create new cart
  q = `INSERT INTO software_carts (user_id, status) VALUES ($1, 'active') RETURNING *;`;
  result = await pool.query<SoftwareCart>(q, [user_id]);
  return result.rows[0];
}

// Get existing cart without creating one
export async function getExistingCart(user_id: string) {
  const q = `SELECT * FROM software_carts WHERE user_id = $1 AND status = 'active';`;
  const result = await pool.query<SoftwareCart>(q, [user_id]);
  return result.rows[0] || null;
}

// Get cart with items (with plan details)
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
      ci.software_plan_id,
      ci.unit_price,
      ci.quantity,
      ci.created_at,
      pl.plan_name,
      pl.duration_type,
      pl.price as current_price,
      pl.special_price as current_special_price,
      p.name as product_name,
      b.name as brand_name
    FROM software_cart_items ci
    JOIN software_plans pl ON ci.software_plan_id = pl.id
    JOIN software_products p ON pl.software_product_id = p.id
    JOIN software_brands b ON p.brand_id = b.id
    WHERE ci.cart_id = $1
    ORDER BY ci.created_at DESC;
  `;

  const result = await pool.query(q, [cart.id]);

  // Calculate totals with role-based pricing
  const items = result.rows.map((item: any) => {
    const isDistributor = userRole === "distributor";
    const currentPrice = isDistributor && item.current_special_price !== null 
      ? item.current_special_price 
      : item.current_price;

    // Build response object - hide special_price from non-distributors
    const itemResponse: any = {
      id: item.id,
      cart_id: item.cart_id,
      software_plan_id: item.software_plan_id,
      plan_name: item.plan_name,
      duration_type: item.duration_type,
      product_name: item.product_name,
      brand_name: item.brand_name,
      unit_price: item.unit_price,
      quantity: item.quantity,
      subtotal: item.unit_price * item.quantity,
      current_price: currentPrice,
      price_changed: item.unit_price !== currentPrice,
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

// Calculate prorated price based on remaining time
function calculateProratedPrice(plan: SoftwarePlan, basePrice: number): number {
  if (!plan.expiry_date) {
    return basePrice;
  }

  const now = new Date();
  const expiryDate = new Date(plan.expiry_date + 'T00:00:00Z'); // Parse as UTC to avoid timezone issues
  
  // If expired, throw error
  if (expiryDate <= now) {
    throw new HttpError(400, "This plan has expired and cannot be purchased.");
  }

  // If no start date, use current date
  const startDate = plan.start_date 
    ? new Date(plan.start_date + 'T00:00:00Z') 
    : now;
  
  // Validate dates
  if (startDate >= expiryDate) {
    throw new HttpError(400, "Invalid plan dates: start date must be before expiry date.");
  }
  
  // If start date is in the future, use start date as reference
  const referenceDate = startDate > now ? startDate : now;
  
  // Calculate days (more accurate than months)
  const totalDays = Math.ceil((expiryDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const remainingDays = Math.ceil((expiryDate.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Only prorate if there's a meaningful difference (at least 1 day less)
  if (totalDays > 0 && remainingDays > 0 && remainingDays < totalDays) {
    const proratedPrice = (basePrice / totalDays) * remainingDays;
    return Math.round(proratedPrice * 100) / 100; // Round to 2 decimals
  }
  
  return basePrice;
}

// Add item to cart (with role-based pricing)
export async function addToCart(input: {
  user_id: string;
  software_plan_id: string;
  quantity: number;
  userRole?: string;
}) {
  const { user_id, software_plan_id, quantity, userRole } = input;

  if (quantity < 1) throw new HttpError(400, "Quantity must be at least 1.");

  // Get plan and check if active
  const planQuery = `SELECT * FROM software_plans WHERE id = $1 AND is_active = true;`;
  const planResult = await pool.query<SoftwarePlan>(planQuery, [software_plan_id]);
  const plan = planResult.rows[0];

  if (!plan) throw new HttpError(404, "Plan not found or inactive.");

  // Determine base price based on user role
  const isDistributor = userRole === "distributor";
  const basePrice = isDistributor && plan.special_price !== null 
    ? plan.special_price 
    : plan.price;

  // Calculate prorated price if expiry date is set
  const unit_price = calculateProratedPrice(plan, basePrice);

  // Use transaction for cart creation and item upsert
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get or create cart within transaction (handles race condition with unique index)
    let cartQuery = `SELECT * FROM software_carts WHERE user_id = $1 AND status = 'active' FOR UPDATE;`;
    let cartResult = await client.query<SoftwareCart>(cartQuery, [user_id]);
    
    let cart = cartResult.rows[0];
    if (!cart) {
      // Try to create cart - if another transaction created it, this will fail and we'll retry
      try {
        const createCartQuery = `INSERT INTO software_carts (user_id, status) VALUES ($1, 'active') RETURNING *;`;
        cartResult = await client.query<SoftwareCart>(createCartQuery, [user_id]);
        cart = cartResult.rows[0];
      } catch (err: any) {
        // If unique constraint violation, another transaction created the cart - fetch it
        if (err.code === '23505') {
          cartQuery = `SELECT * FROM software_carts WHERE user_id = $1 AND status = 'active' FOR UPDATE;`;
          cartResult = await client.query<SoftwareCart>(cartQuery, [user_id]);
          cart = cartResult.rows[0];
        } else {
          throw err;
        }
      }
    }

    // Use UPSERT to handle concurrent inserts safely
    // ON CONFLICT will update if item exists, insert if it doesn't
    const upsertQuery = `
      INSERT INTO software_cart_items (cart_id, software_plan_id, unit_price, quantity)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (cart_id, software_plan_id) 
      DO UPDATE SET 
        quantity = software_cart_items.quantity + EXCLUDED.quantity,
        unit_price = EXCLUDED.unit_price,
        updated_at = NOW()
      RETURNING *;
    `;
    
    const result = await client.query<SoftwareCartItem>(upsertQuery, [cart.id, software_plan_id, unit_price, quantity]);
    
    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Update cart item quantity
export async function updateCartItem(input: {
  user_id: string;
  cart_item_id: string;
  quantity: number;
}) {
  const { user_id, cart_item_id, quantity } = input;

  if (quantity < 1) throw new HttpError(400, "Quantity must be at least 1.");

  // Verify item belongs to user's cart
  const q = `
    UPDATE software_cart_items ci
    SET quantity = $1, updated_at = NOW()
    FROM software_carts c
    WHERE ci.id = $2 AND ci.cart_id = c.id AND c.user_id = $3 AND c.status = 'active'
    RETURNING ci.*;
  `;

  const result = await pool.query<SoftwareCartItem>(q, [quantity, cart_item_id, user_id]);

  if (!result.rows[0]) throw new HttpError(404, "Cart item not found.");

  return result.rows[0];
}

// Remove item from cart
export async function removeCartItem(user_id: string, cart_item_id: string) {
  const q = `
    DELETE FROM software_cart_items ci
    USING software_carts c
    WHERE ci.id = $1 AND ci.cart_id = c.id AND c.user_id = $2 AND c.status = 'active'
    RETURNING ci.*;
  `;

  const result = await pool.query<SoftwareCartItem>(q, [cart_item_id, user_id]);

  if (!result.rows[0]) throw new HttpError(404, "Cart item not found.");

  return result.rows[0];
}

// Clear cart
export async function clearCart(user_id: string) {
  const cart = await getExistingCart(user_id);
  
  if (!cart) {
    return { message: "Cart is already empty." };
  }

  const q = `DELETE FROM software_cart_items WHERE cart_id = $1;`;
  await pool.query(q, [cart.id]);

  return { message: "Cart cleared." };
}

// Sync cart from frontend (when user logs in)
export async function syncCart(input: {
  user_id: string;
  items: Array<{ software_plan_id: string; quantity: number | string }>;
  userRole?: string;
}) {
  const { user_id, items, userRole } = input;

  // Validate each item
  for (const item of items) {
    if (!item.software_plan_id || typeof item.software_plan_id !== 'string') {
      throw new HttpError(400, "Each item must have a valid software_plan_id.");
    }
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(item.software_plan_id)) {
      throw new HttpError(400, `Invalid UUID format for software_plan_id: ${item.software_plan_id}`);
    }
    
    // Convert quantity to number if it's a string
    const qty = typeof item.quantity === 'string' ? Number(item.quantity) : item.quantity;
    
    if (isNaN(qty) || qty < 1 || !Number.isInteger(qty)) {
      throw new HttpError(400, `Each item must have a valid quantity (positive integer). Got: ${item.quantity}`);
    }
    
    // Update the item with parsed quantity
    item.quantity = qty;
  }

  // Add each item to cart (will merge with existing)
  for (const item of items) {
    await addToCart({
      user_id,
      software_plan_id: item.software_plan_id,
      quantity: item.quantity as number,
      userRole,
    });
  }

  return getCartWithItems(user_id, userRole);
}
