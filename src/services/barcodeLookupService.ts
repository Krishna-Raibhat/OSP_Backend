import { pool } from "../config/db";
import { HttpError } from "../utils/errors";

/* ==================== BARCODE LOOKUP SERVICES ==================== */

// Lookup software purchase history by serial number
export async function lookupSoftwareBySerial(serial_number: string) {
  const query = `
    SELECT 
      oi.id as item_id,
      oi.serial_number,
      oi.unit_price,
      oi.created_at as purchased_at,
      o.id as order_id,
      o.billing_full_name,
      o.billing_email,
      o.billing_phone,
      o.billing_address,
      o.status as order_status,
      o.total as order_total,
      o.created_at as order_date,
      pl.plan_name,
      pl.duration_type,
      p.name as product_name,
      b.name as brand_name,
      c.name as category_name,
      pay.payment_type,
      pay.status as payment_status,
      pay.paid_at
    FROM software_order_items oi
    JOIN software_orders o ON oi.order_id = o.id
    JOIN software_plans pl ON oi.software_plan_id = pl.id
    JOIN software_products p ON pl.software_product_id = p.id
    JOIN software_brands b ON p.brand_id = b.id
    JOIN software_categories c ON p.category_id = c.id
    LEFT JOIN software_payments pay ON o.id = pay.software_order_id
    WHERE oi.serial_number = $1;
  `;

  const result = await pool.query(query, [serial_number]);

  if (!result.rows[0]) {
    throw new HttpError(404, "Serial number not found.");
  }

  const item = result.rows[0];

  // Get all orders from this customer
  const customerOrdersQuery = `
    SELECT 
      o.id,
      o.status,
      o.total,
      o.created_at,
      COUNT(oi.id) as item_count
    FROM software_orders o
    LEFT JOIN software_order_items oi ON o.id = oi.order_id
    WHERE o.billing_email = $1
    GROUP BY o.id
    ORDER BY o.created_at DESC;
  `;

  const customerOrders = await pool.query(customerOrdersQuery, [item.billing_email]);

  return {
    purchaser_name: item.billing_full_name,
    serial_info: {
      serial_number: item.serial_number,
      product_name: item.product_name,
      brand_name: item.brand_name,
      category_name: item.category_name,
      plan_name: item.plan_name,
      duration_type: item.duration_type,
      unit_price: item.unit_price,
      purchased_at: item.purchased_at,
    },
    order_info: {
      order_id: item.order_id,
      order_date: item.order_date,
      order_status: item.order_status,
      order_total: item.order_total,
      payment_type: item.payment_type,
      payment_status: item.payment_status,
      paid_at: item.paid_at,
    },
    customer_info: {
      full_name: item.billing_full_name,
      email: item.billing_email,
      phone: item.billing_phone,
      address: item.billing_address,
    },
    purchase_history: {
      total_orders: customerOrders.rows.length,
      orders: customerOrders.rows,
    },
  };
}

// Lookup cartridge purchase history by serial number
export async function lookupCartridgeBySerial(serial_number: string) {
  // First, find which order item contains this serial number
  const itemQuery = `
    SELECT 
      oi.id as item_id,
      oi.serial_number,
      oi.quantity,
      oi.unit_price,
      oi.created_at as purchased_at,
      o.id as order_id,
      o.billing_full_name,
      o.billing_email,
      o.billing_phone,
      o.billing_address,
      o.status as order_status,
      o.total as order_total,
      o.created_at as order_date,
      p.product_name,
      p.model_number,
      b.name as brand_name,
      c.name as category_name,
      pay.payment_type,
      pay.status as payment_status,
      pay.paid_at
    FROM cartridge_order_items oi
    JOIN cartridge_orders o ON oi.order_id = o.id
    JOIN cartridge_products p ON oi.cartridge_product_id = p.id
    JOIN cartridge_brands b ON p.brand_id = b.id
    JOIN cartridge_categories c ON p.category_id = c.id
    LEFT JOIN cartridge_payments pay ON o.id = pay.cartridge_order_id
    WHERE oi.serial_number IS NOT NULL;
  `;

  const itemsResult = await pool.query(itemQuery);

  // Find the item that contains this serial number in its JSON array
  let matchedItem = null;
  let matchedSerial = null;

  for (const item of itemsResult.rows) {
    try {
      const serialNumbers = JSON.parse(item.serial_number);
      if (serialNumbers.includes(serial_number)) {
        matchedItem = item;
        matchedSerial = serial_number;
        break;
      }
    } catch (error) {
      continue;
    }
  }

  if (!matchedItem) {
    throw new HttpError(404, "Serial number not found.");
  }

  // Get all orders from this customer
  const customerOrdersQuery = `
    SELECT 
      o.id,
      o.status,
      o.total,
      o.created_at,
      COUNT(oi.id) as item_count
    FROM cartridge_orders o
    LEFT JOIN cartridge_order_items oi ON o.id = oi.order_id
    WHERE o.billing_email = $1
    GROUP BY o.id
    ORDER BY o.created_at DESC;
  `;

  const customerOrders = await pool.query(customerOrdersQuery, [matchedItem.billing_email]);

  return {
    purchaser_name: matchedItem.billing_full_name,
    serial_info: {
      serial_number: matchedSerial,
      product_name: matchedItem.product_name,
      model_number: matchedItem.model_number,
      brand_name: matchedItem.brand_name,
      category_name: matchedItem.category_name,
      unit_price: matchedItem.unit_price,
      purchased_at: matchedItem.purchased_at,
    },
    order_info: {
      order_id: matchedItem.order_id,
      order_date: matchedItem.order_date,
      order_status: matchedItem.order_status,
      order_total: matchedItem.order_total,
      payment_type: matchedItem.payment_type,
      payment_status: matchedItem.payment_status,
      paid_at: matchedItem.paid_at,
    },
    customer_info: {
      full_name: matchedItem.billing_full_name,
      email: matchedItem.billing_email,
      phone: matchedItem.billing_phone,
      address: matchedItem.billing_address,
    },
    purchase_history: {
      total_orders: customerOrders.rows.length,
      orders: customerOrders.rows,
    },
  };
}
