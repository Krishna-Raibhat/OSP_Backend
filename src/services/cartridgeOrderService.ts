import { pool } from "../config/db";
import { HttpError } from "../utils/errors";
import type { CartridgeOrder } from "../models/cartridgeModels";

/* ==================== CARTRIDGE ORDER SERVICES ==================== */

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
    cartridge_product_id: string;
    quantity: number;
    unit_price: number;
  }>;
  payment_method: "gateway" | "manual" | "cod";
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
      INSERT INTO cartridge_orders (
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

    const orderResult = await client.query<CartridgeOrder>(orderQuery, [
      user_id || null,
      billing_info.full_name,
      billing_info.email,
      billing_info.phone,
      billing_info.address,
      total,
    ]);

    const order = orderResult.rows[0];

    // Create order items (1 row per unit based on quantity)
    for (const item of items) {
      const itemQuery = `
        INSERT INTO cartridge_order_items (
          order_id,
          cartridge_product_id,
          quantity,
          unit_price,
          serial_number,
          barcode_value
        )
        VALUES ($1, $2, $3, $4, NULL, NULL)
        RETURNING *;
      `;

      await client.query(itemQuery, [
        order.id,
        item.cartridge_product_id,
        item.quantity,
        item.unit_price,
      ]);
    }

    // Create payment record based on payment method
    let payment;
    if (payment_method === "cod") {
      // Create COD payment with pending status
      const paymentQuery = `
        INSERT INTO cartridge_payments (
          cartridge_order_id,
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
        INSERT INTO cartridge_payments (
          cartridge_order_id,
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
        `DELETE FROM cartridge_cart_items 
         WHERE cart_id IN (SELECT id FROM cartridge_carts WHERE user_id = $1 AND status = 'active')`,
        [user_id]
      );

      await client.query(
        `UPDATE cartridge_carts SET status = 'checked_out' WHERE user_id = $1 AND status = 'active'`,
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
  payment_method: "gateway" | "manual" | "cod";
}) {
  const { user_id, billing_info, payment_method } = input;

  // Get user's cart items
  const cartQuery = `
    SELECT 
      ci.cartridge_product_id,
      ci.quantity,
      ci.unit_price
    FROM cartridge_cart_items ci
    JOIN cartridge_carts c ON ci.cart_id = c.id
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
          'cartridge_product_id', oi.cartridge_product_id,
          'product_name', p.product_name,
          'model_number', p.model_number,
          'brand_name', b.name,
          'category_name', c.name,
          'quantity', oi.quantity,
          'unit_price', oi.unit_price
        )
      ) as items
    FROM cartridge_orders o
    LEFT JOIN cartridge_order_items oi ON o.id = oi.order_id
    LEFT JOIN cartridge_products p ON oi.cartridge_product_id = p.id
    LEFT JOIN cartridge_brands b ON p.brand_id = b.id
    LEFT JOIN cartridge_categories c ON p.category_id = c.id
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
    FROM cartridge_orders o
    LEFT JOIN cartridge_order_items oi ON o.id = oi.order_id
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
          'cartridge_product_id', oi.cartridge_product_id,
          'product_name', p.product_name,
          'model_number', p.model_number,
          'brand_name', b.name,
          'category_name', c.name,
          'quantity', oi.quantity,
          'unit_price', oi.unit_price
        )
      ) as items
    FROM cartridge_orders o
    LEFT JOIN cartridge_order_items oi ON o.id = oi.order_id
    LEFT JOIN cartridge_products p ON oi.cartridge_product_id = p.id
    LEFT JOIN cartridge_brands b ON p.brand_id = b.id
    LEFT JOIN cartridge_categories c ON p.category_id = c.id
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
    UPDATE cartridge_orders 
    SET status = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING *;
  `;

  const result = await pool.query<CartridgeOrder>(q, [status, order_id]);

  if (!result.rows[0]) {
    throw new HttpError(404, "Order not found.");
  }

  return result.rows[0];
}

// Admin: Get all orders with filters
export async function getAllOrders(filters?: {
  status?: string;
  payment_method?: string;
  limit?: number;
  offset?: number;
}) {
  const { status, payment_method, limit = 50, offset = 0 } = filters || {};

  let whereConditions = [];
  let params: any[] = [];
  let paramIndex = 1;

  if (status) {
    whereConditions.push(`o.status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  if (payment_method) {
    whereConditions.push(`p.payment_type = $${paramIndex}`);
    params.push(payment_method);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  const q = `
    SELECT 
      o.id,
      o.buyer_user_id,
      o.billing_full_name,
      o.billing_email,
      o.billing_phone,
      o.billing_address,
      o.status,
      o.total,
      o.created_at,
      o.updated_at,
      u.email as user_email,
      u.role as user_role,
      p.payment_type,
      p.status as payment_status,
      p.paid_at,
      json_agg(
        json_build_object(
          'id', oi.id,
          'cartridge_product_id', oi.cartridge_product_id,
          'product_name', pr.product_name,
          'model_number', pr.model_number,
          'brand_name', b.name,
          'category_name', c.name,
          'quantity', oi.quantity,
          'unit_price', oi.unit_price
        )
      ) as order_items
    FROM cartridge_orders o
    LEFT JOIN users u ON o.buyer_user_id = u.id
    LEFT JOIN cartridge_payments p ON o.id = p.cartridge_order_id
    LEFT JOIN cartridge_order_items oi ON o.id = oi.order_id
    LEFT JOIN cartridge_products pr ON oi.cartridge_product_id = pr.id
    LEFT JOIN cartridge_brands b ON pr.brand_id = b.id
    LEFT JOIN cartridge_categories c ON pr.category_id = c.id
    ${whereClause}
    GROUP BY o.id, u.email, u.role, p.payment_type, p.status, p.paid_at
    ORDER BY o.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
  `;

  params.push(limit, offset);

  const result = await pool.query(q, params);
  return result.rows;
}

// Admin: Get order details
export async function getOrderDetailsAdmin(order_id: string) {
  const orderQuery = `
    SELECT 
      o.*,
      u.email as user_email,
      u.role as user_role,
      u.full_name as user_full_name
    FROM cartridge_orders o
    LEFT JOIN users u ON o.buyer_user_id = u.id
    WHERE o.id = $1;
  `;

  const orderResult = await pool.query(orderQuery, [order_id]);

  if (!orderResult.rows[0]) {
    throw new HttpError(404, "Order not found.");
  }

  const order = orderResult.rows[0];

  // Get payment details
  const paymentQuery = `
    SELECT * FROM cartridge_payments WHERE cartridge_order_id = $1;
  `;
  const paymentResult = await pool.query(paymentQuery, [order_id]);

  // Get order items with full details
  const itemsQuery = `
    SELECT 
      oi.id,
      oi.cartridge_product_id,
      oi.quantity,
      oi.unit_price,
      oi.serial_number,
      oi.barcode_value,
      oi.created_at,
      p.product_name,
      p.model_number,
      b.name as brand_name,
      c.name as category_name
    FROM cartridge_order_items oi
    JOIN cartridge_products p ON oi.cartridge_product_id = p.id
    JOIN cartridge_brands b ON p.brand_id = b.id
    JOIN cartridge_categories c ON p.category_id = c.id
    WHERE oi.order_id = $1
    ORDER BY oi.created_at ASC;
  `;

  const itemsResult = await pool.query(itemsQuery, [order_id]);

  return {
    order,
    payment: paymentResult.rows[0] || null,
    items: itemsResult.rows,
    summary: {
      total_items: itemsResult.rows.reduce((sum: number, item: any) => sum + item.quantity, 0),
      items_with_codes: itemsResult.rows.filter((item: any) => item.serial_number).length,
      items_without_codes: itemsResult.rows.filter((item: any) => !item.serial_number).length,
    }
  };
}

// Generate serial numbers and barcodes after payment
export async function generateCartridgeCodes(order_id: string) {
  // Get all order items without serial numbers
  const itemsQuery = `
    SELECT 
      oi.id, 
      oi.cartridge_product_id,
      oi.quantity
    FROM cartridge_order_items oi
    WHERE oi.order_id = $1 AND oi.serial_number IS NULL;
  `;

  const itemsResult = await pool.query(itemsQuery, [order_id]);

  for (const item of itemsResult.rows) {
    // Generate unique serial and barcode for each item
    const serial = `CART-SN-${Date.now()}-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
    const barcode = `CART-BC-${Date.now()}-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;

    const updateQuery = `
      UPDATE cartridge_order_items 
      SET 
        serial_number = $1,
        barcode_value = $2,
        updated_at = NOW()
      WHERE id = $3;
    `;

    await pool.query(updateQuery, [
      serial,
      barcode,
      item.id,
    ]);
  }

  return { message: "Cartridge codes generated successfully." };
}
