import { pool } from "../config/db";
import { HttpError } from "../utils/errors";
import type { SoftwareOrder, SoftwareOrderItem, SoftwareCartItem } from "../models/softwareModels";
import { generateBarcodeImage } from "../utils/barcodeGenerator";

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

    // Create order with paid status
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
      VALUES ($1, $2, $3, $4, $5, 'paid', $6)
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
        // Generate serial number immediately (barcode generated on-demand)
        const serial = `SN-${Date.now()}-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;

        const itemQuery = `
          INSERT INTO software_order_items (
            order_id,
            software_plan_id,
            unit_price,
            serial_number
          )
          VALUES ($1, $2, $3, $4)
          RETURNING *;
        `;

        await client.query(itemQuery, [
          order.id,
          item.software_plan_id,
          item.unit_price,
          serial,
        ]);
      }
    }

    // Create payment record with success status
    let payment;
    if (payment_method === "cod") {
      // Create COD payment with success status
      const paymentQuery = `
        INSERT INTO software_payments (
          software_order_id,
          payment_type,
          gateway,
          gateway_txn_id,
          manual_reference,
          amount,
          status,
          paid_at
        )
        VALUES ($1, 'cod', NULL, NULL, 'Cash on Delivery', $2, 'success', NOW())
        RETURNING *;
      `;
      const paymentResult = await client.query(paymentQuery, [order.id, total]);
      payment = paymentResult.rows[0];
    } else if (payment_method === "gateway") {
      // Create gateway payment with success status
      const paymentQuery = `
        INSERT INTO software_payments (
          software_order_id,
          payment_type,
          gateway,
          gateway_txn_id,
          manual_reference,
          amount,
          status,
          paid_at
        )
        VALUES ($1, 'gateway', 'completed', NULL, NULL, $2, 'success', NOW())
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
          'serial_number', oi.serial_number
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
          'serial_number', oi.serial_number
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
      o.id as order_id,
      o.buyer_user_id,
      o.billing_full_name,
      o.billing_email,
      o.billing_phone,
      o.billing_address,
      o.status as order_status,
      o.total as order_total,
      o.created_at as order_created_at,
      o.updated_at as order_updated_at,
      u.email as user_email,
      u.full_name as user_full_name,
      u.role as user_role,
      p.id as payment_id,
      p.payment_type,
      p.status as payment_status,
      p.amount as payment_amount,
      p.paid_at,
      json_agg(
        json_build_object(
          'item_id', oi.id,
          'product_name', prod.name,
          'brand_name', b.name,
          'plan_name', pl.plan_name,
          'category_name', c.name,
          'unit_price', oi.unit_price,
          'serial_number', oi.serial_number
        ) ORDER BY oi.created_at
      ) as order_items
    FROM software_orders o
    LEFT JOIN users u ON o.buyer_user_id = u.id
    LEFT JOIN software_payments p ON o.id = p.software_order_id
    LEFT JOIN software_order_items oi ON o.id = oi.order_id
    LEFT JOIN software_plans pl ON oi.software_plan_id = pl.id
    LEFT JOIN software_products prod ON pl.software_product_id = prod.id
    LEFT JOIN software_brands b ON prod.brand_id = b.id
    LEFT JOIN software_categories c ON prod.category_id = c.id
    ${whereClause}
    GROUP BY o.id, u.email, u.full_name, u.role, p.id, p.payment_type, p.status, p.amount, p.paid_at
    ORDER BY o.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
  `;

  params.push(limit, offset);

  const result = await pool.query(q, params);
  return result.rows;
}

// Admin: Get order details with barcode images
export async function getOrderDetailsAdmin(order_id: string) {
  const orderQuery = `
    SELECT 
      o.*,
      u.email as user_email,
      u.role as user_role,
      u.full_name as user_full_name
    FROM software_orders o
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
    SELECT * FROM software_payments WHERE software_order_id = $1;
  `;
  const paymentResult = await pool.query(paymentQuery, [order_id]);

  // Get order items with full details
  const itemsQuery = `
    SELECT 
      oi.id,
      oi.software_plan_id,
      oi.unit_price,
      oi.serial_number,
      oi.created_at,
      pl.plan_name,
      pl.duration_type,
      p.name as product_name,
      b.name as brand_name,
      c.name as category_name
    FROM software_order_items oi
    JOIN software_plans pl ON oi.software_plan_id = pl.id
    JOIN software_products p ON pl.software_product_id = p.id
    JOIN software_brands b ON p.brand_id = b.id
    JOIN software_categories c ON p.category_id = c.id
    WHERE oi.order_id = $1
    ORDER BY oi.created_at ASC;
  `;

  const itemsResult = await pool.query(itemsQuery, [order_id]);

  // Generate barcode images for items with serial numbers
  const itemsWithBarcodes = await Promise.all(
    itemsResult.rows.map(async (item: any) => {
      if (item.serial_number) {
        try {
          const barcodeImage = await generateBarcodeImage(item.serial_number);
          return {
            ...item,
            barcode_image: barcodeImage, // Base64 data URL
          };
        } catch (error) {
          console.error(`Failed to generate barcode for item ${item.id}:`, error);
          return {
            ...item,
            barcode_image: null,
          };
        }
      }
      return {
        ...item,
        barcode_image: null,
      };
    })
  );

  return {
    order,
    payment: paymentResult.rows[0] || null,
    items: itemsWithBarcodes,
    summary: {
      total_items: itemsWithBarcodes.length,
      items_with_serial: itemsWithBarcodes.filter((item: any) => item.serial_number).length,
      items_without_serial: itemsWithBarcodes.filter((item: any) => !item.serial_number).length,
    }
  };
}

// Generate serial numbers after payment (barcode generated on-demand from serial)
export async function generateLicenses(order_id: string) {
  // Get all order items without serial numbers
  const itemsQuery = `
    SELECT 
      oi.id, 
      oi.software_plan_id
    FROM software_order_items oi
    WHERE oi.order_id = $1 AND oi.serial_number IS NULL;
  `;

  const itemsResult = await pool.query(itemsQuery, [order_id]);

  for (const item of itemsResult.rows) {
    // Generate unique serial number (barcode will be generated from this)
    const serial = `SN-${Date.now()}-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;

    const updateQuery = `
      UPDATE software_order_items 
      SET 
        serial_number = $1,
        updated_at = NOW()
      WHERE id = $2;
    `;

    await pool.query(updateQuery, [serial, item.id]);
  }

  return { message: "Licenses generated successfully." };
}
