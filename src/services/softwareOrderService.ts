import { pool } from "../config/db";
import { HttpError } from "../utils/errors";
import type { SoftwareOrder, SoftwareOrderItem, SoftwareCartItem } from "../models/softwareModels";

/* ==================== ORDER SERVICES ==================== */

interface BillingInfo {
  full_name: string;
  email: string;
  phone: string;
  address: string;
}

interface CreateOrderInput {
  user_id?: string; // Optional for guest orders
  billing_info: BillingInfo;
  items: Array<{
    software_plan_id: string;
    quantity: number;
    unit_price: number;
  }>;
  payment_method: "gateway" | "manual" | "cod"; // ✅ Added COD
}

// Create order from cart or direct checkout (with payment)
export async function createOrder(input: CreateOrderInput) {
  const { user_id, billing_info, items, payment_method } = input;

  // Validate billing info
  if (!billing_info.full_name || !billing_info.email || !billing_info.phone || !billing_info.address) {
    throw new HttpError(400, "All billing information fields are required.");
  }

  if (items.length === 0) {
    throw new HttpError(400, "Order must have at least one item.");
  }

  // Calculate total
  const total = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Create order
    const orderQuery = `
      INSERT INTO software_orders (
        buyer_user_id,
        billing_full_name,
        billing_email,
        billing_phone,
        billing_address,
        status,
        total
      )
      VALUES ($1, $2, $3, $4, $5, 'pending', $6)
      RETURNING *;
    `;

    const orderResult = await client.query<SoftwareOrder>(orderQuery, [
      user_id || null,
      billing_info.full_name,
      billing_info.email,
      billing_info.phone,
      billing_info.address,
      total,
    ]);

    const order = orderResult.rows[0];

    // Create order items (1 row per license based on quantity)
    for (const item of items) {
      // Create multiple rows based on quantity (1 row = 1 license)
      for (let i = 0; i < item.quantity; i++) {
        const itemQuery = `
          INSERT INTO software_order_items (
            order_id,
            software_plan_id,
            unit_price,
            serial_number,
            barcode_value,
            issued_at,
            expires_at
          )
          VALUES ($1, $2, $3, NULL, NULL, NULL, NULL)
          RETURNING *;
        `;

        await client.query(itemQuery, [
          order.id,
          item.software_plan_id,
          item.unit_price,
        ]);
      }
    }

    // Create payment record based on payment method
    let payment;
    if (payment_method === "cod") {
      // Create COD payment with pending status
      const paymentQuery = `
        INSERT INTO software_payments (
          software_order_id,
          payment_type,
          gateway,
          gateway_txn_id,
          manual_reference,
          amount,
          status
        )
        VALUES ($1, 'cod', NULL, NULL, 'Cash on Delivery', $2, 'pending')
        RETURNING *;
      `;
      const paymentResult = await client.query(paymentQuery, [order.id, total]);
      payment = paymentResult.rows[0];
    } else if (payment_method === "gateway") {
      // Create gateway payment with initiated status
      const paymentQuery = `
        INSERT INTO software_payments (
          software_order_id,
          payment_type,
          gateway,
          gateway_txn_id,
          manual_reference,
          amount,
          status
        )
        VALUES ($1, 'gateway', 'pending_gateway', NULL, NULL, $2, 'initiated')
        RETURNING *;
      `;
      const paymentResult = await client.query(paymentQuery, [order.id, total]);
      payment = paymentResult.rows[0];
    }

    // If logged-in user, clear their cart
    if (user_id) {
      await client.query(
        `DELETE FROM software_cart_items 
         WHERE cart_id IN (SELECT id FROM software_carts WHERE user_id = $1 AND status = 'active')`,
        [user_id]
      );

      await client.query(
        `UPDATE software_carts SET status = 'checked_out' WHERE user_id = $1 AND status = 'active'`,
        [user_id]
      );
    }

    await client.query("COMMIT");

    return { order, payment };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Create order from logged-in user's cart
export async function createOrderFromCart(input: {
  user_id: string;
  billing_info: BillingInfo;
  payment_method: "gateway" | "manual" | "cod"; // ✅ Added COD
}) {
  const { user_id, billing_info, payment_method } = input;

  // Get user's cart items
  const cartQuery = `
    SELECT 
      ci.software_plan_id,
      ci.quantity,
      ci.unit_price
    FROM software_cart_items ci
    JOIN software_carts c ON ci.cart_id = c.id
    WHERE c.user_id = $1 AND c.status = 'active';
  `;

  const cartResult = await pool.query(cartQuery, [user_id]);

  if (cartResult.rows.length === 0) {
    throw new HttpError(400, "Cart is empty.");
  }

  return createOrder({
    user_id,
    billing_info,
    items: cartResult.rows,
    payment_method,
  });
}

// Get order by ID
export async function getOrderById(order_id: string, user_id?: string) {
  const q = `
    SELECT 
      o.*,
      json_agg(
        json_build_object(
          'id', oi.id,
          'software_plan_id', oi.software_plan_id,
          'plan_name', pl.plan_name,
          'duration_type', pl.duration_type,
          'product_name', p.name,
          'brand_name', b.name,
          'unit_price', oi.unit_price,
          'serial_number', oi.serial_number,
          'barcode_value', oi.barcode_value,
          'issued_at', oi.issued_at,
          'expires_at', oi.expires_at
        )
      ) as items
    FROM software_orders o
    LEFT JOIN software_order_items oi ON o.id = oi.order_id
    LEFT JOIN software_plans pl ON oi.software_plan_id = pl.id
    LEFT JOIN software_products p ON pl.software_product_id = p.id
    LEFT JOIN software_brands b ON p.brand_id = b.id
    WHERE o.id = $1
    ${user_id ? 'AND o.buyer_user_id = $2' : ''}
    GROUP BY o.id;
  `;

  const params = user_id ? [order_id, user_id] : [order_id];
  const result = await pool.query(q, params);

  if (!result.rows[0]) {
    throw new HttpError(404, "Order not found.");
  }

  return result.rows[0];
}

// Get user's orders
export async function getUserOrders(user_id: string) {
  const q = `
    SELECT 
      o.id,
      o.billing_full_name,
      o.billing_email,
      o.status,
      o.total,
      o.created_at,
      COUNT(oi.id) as item_count
    FROM software_orders o
    LEFT JOIN software_order_items oi ON o.id = oi.order_id
    WHERE o.buyer_user_id = $1
    GROUP BY o.id
    ORDER BY o.created_at DESC;
  `;

  const result = await pool.query(q, [user_id]);
  return result.rows;
}

// Get guest order by email and order ID (for order tracking)
export async function getGuestOrder(order_id: string, email: string) {
  const q = `
    SELECT 
      o.*,
      json_agg(
        json_build_object(
          'id', oi.id,
          'software_plan_id', oi.software_plan_id,
          'plan_name', pl.plan_name,
          'duration_type', pl.duration_type,
          'product_name', p.name,
          'brand_name', b.name,
          'unit_price', oi.unit_price,
          'serial_number', oi.serial_number,
          'barcode_value', oi.barcode_value,
          'issued_at', oi.issued_at,
          'expires_at', oi.expires_at
        )
      ) as items
    FROM software_orders o
    LEFT JOIN software_order_items oi ON o.id = oi.order_id
    LEFT JOIN software_plans pl ON oi.software_plan_id = pl.id
    LEFT JOIN software_products p ON pl.software_product_id = p.id
    LEFT JOIN software_brands b ON p.brand_id = b.id
    WHERE o.id = $1 AND o.billing_email = $2 AND o.buyer_user_id IS NULL
    GROUP BY o.id;
  `;

  const result = await pool.query(q, [order_id, email]);

  if (!result.rows[0]) {
    throw new HttpError(404, "Order not found.");
  }

  return result.rows[0];
}

// Update order status (for payment processing)
export async function updateOrderStatus(order_id: string, status: "pending" | "paid" | "failed" | "cancelled") {
  const q = `
    UPDATE software_orders 
    SET status = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING *;
  `;

  const result = await pool.query<SoftwareOrder>(q, [status, order_id]);

  if (!result.rows[0]) {
    throw new HttpError(404, "Order not found.");
  }

  return result.rows[0];
}

// Generate serial numbers and barcodes after payment (placeholder for now)
export async function generateLicenses(order_id: string) {
  // Get all order items without serial numbers
  const itemsQuery = `
    SELECT id, software_plan_id 
    FROM software_order_items 
    WHERE order_id = $1 AND serial_number IS NULL;
  `;

  const itemsResult = await pool.query(itemsQuery, [order_id]);

  for (const item of itemsResult.rows) {
    // Generate unique serial and barcode
    const serial = `SN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const barcode = `BC-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    // Calculate expiry (example: 1 year from now)
    const issued_at = new Date();
    const expires_at = new Date();
    expires_at.setFullYear(expires_at.getFullYear() + 1);

    const updateQuery = `
      UPDATE software_order_items 
      SET 
        serial_number = $1,
        barcode_value = $2,
        issued_at = $3,
        expires_at = $4,
        updated_at = NOW()
      WHERE id = $5;
    `;

    await pool.query(updateQuery, [
      serial,
      barcode,
      issued_at.toISOString(),
      expires_at.toISOString(),
      item.id,
    ]);
  }

  return { message: "Licenses generated successfully." };
}
