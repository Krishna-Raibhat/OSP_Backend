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

// Get cart with items (with plan details)
export async function getCartWithItems(user_id: string, userRole?: string) {
  const cart = await getOrCreateCart(user_id);

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

    return {
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
      current_price: currentPrice, // Show current price for reference
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
  let basePrice = isDistributor && plan.special_price !== null 
    ? plan.special_price 
    : plan.price;

  // Calculate prorated price if expiry date is set
  let unit_price = basePrice;
  if (plan.expiry_date) {
    const now = new Date();
    const expiryDate = new Date(plan.expiry_date);
    
    // Only prorate if expiry is in the future
    if (expiryDate > now) {
      const startDate = plan.start_date ? new Date(plan.start_date) : now;
      
      // Calculate remaining months
      const totalMonths = (expiryDate.getFullYear() - startDate.getFullYear()) * 12 + 
                         (expiryDate.getMonth() - startDate.getMonth());
      const remainingMonths = (expiryDate.getFullYear() - now.getFullYear()) * 12 + 
                             (expiryDate.getMonth() - now.getMonth()) + 1; // +1 to include current month
      
      if (totalMonths > 0 && remainingMonths > 0 && remainingMonths < totalMonths) {
        // Prorate the price based on remaining months
        unit_price = (basePrice / totalMonths) * remainingMonths;
        unit_price = Math.round(unit_price * 100) / 100; // Round to 2 decimals
      }
    } else {
      throw new HttpError(400, "This plan has expired and cannot be purchased.");
    }
  }

  // Get or create cart
  const cart = await getOrCreateCart(user_id);

  // Check if item already exists in cart
  const checkQuery = `SELECT * FROM software_cart_items WHERE cart_id = $1 AND software_plan_id = $2;`;
  const checkResult = await pool.query<SoftwareCartItem>(checkQuery, [cart.id, software_plan_id]);

  if (checkResult.rows[0]) {
    // Update quantity
    const newQuantity = checkResult.rows[0].quantity + quantity;
    const updateQuery = `
      UPDATE software_cart_items 
      SET quantity = $1, unit_price = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *;
    `;
    const result = await pool.query<SoftwareCartItem>(updateQuery, [newQuantity, unit_price, checkResult.rows[0].id]);
    return result.rows[0];
  }

  // Add new item
  const insertQuery = `
    INSERT INTO software_cart_items (cart_id, software_plan_id, unit_price, quantity)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;
  const result = await pool.query<SoftwareCartItem>(insertQuery, [cart.id, software_plan_id, unit_price, quantity]);
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

  return { message: "Item removed from cart." };
}

// Clear cart
export async function clearCart(user_id: string) {
  const cart = await getOrCreateCart(user_id);

  const q = `DELETE FROM software_cart_items WHERE cart_id = $1;`;
  await pool.query(q, [cart.id]);

  return { message: "Cart cleared." };
}

// Sync cart from frontend (when user logs in)
export async function syncCart(input: {
  user_id: string;
  items: Array<{ software_plan_id: string; quantity: number }>;
  userRole?: string;
}) {
  const { user_id, items, userRole } = input;

  // Add each item to cart (will merge with existing)
  for (const item of items) {
    await addToCart({
      user_id,
      software_plan_id: item.software_plan_id,
      quantity: item.quantity,
      userRole,
    });
  }

  return getCartWithItems(user_id, userRole);
}
