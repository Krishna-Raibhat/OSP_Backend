import { pool } from "../config/db";
import { HttpError, validateEmail, validatePhone, validateStringLength, validateQuantity } from "../utils/errors";
import type { CartridgeOrder } from "../models/cartridgeModels";
import { generateBarcodeImage } from "../utils/barcodeGenerator";
import { randomUUID } from "crypto";

/* ==================== CARTRIDGE ORDER SERVICES ==================== */

interface BillingInfo {
  full_name: string;
  email: string;
  phone: string;
  address: string;
}

interface CreateOrderInput {
  user_id?: string; // Optional for guest orders
  userRole?: string; // For price calculation
  billing_info: BillingInfo;
  items: Array<{
    cartridge_product_id: string;
    quantity: number;
  }>;
  payment_method: "gateway" | "cod";
}

// Create order from cart or direct checkout (with payment)
export async function createOrder(input: CreateOrderInput) {
  const { user_id, userRole, billing_info, items, payment_method } = input;

  // Validate billing info format
  validateStringLength(billing_info.full_name, "Full name", 2, 100);
  validateEmail(billing_info.email, "Email");
  validatePhone(billing_info.phone, "Phone");
  validateStringLength(billing_info.address, "Address", 5, 500);

  // Validate items
  if (items.length === 0) {
    throw new HttpError(400, "Order must have at least one item.");
  }
  if (items.length > 100) {
    throw new HttpError(400, "Order cannot have more than 100 items.");
  }

  // Validate quantities and merge duplicate product IDs
  const mergedItemsMap = new Map<string, number>();
  for (const item of items) {
    const validatedQty = validateQuantity(item.quantity, "Item quantity");
    const currentQty = mergedItemsMap.get(item.cartridge_product_id) || 0;
    mergedItemsMap.set(item.cartridge_product_id, currentQty + validatedQty);
  }

  // Convert back to array
  const mergedItems = Array.from(mergedItemsMap.entries()).map(([cartridge_product_id, quantity]) => ({
    cartridge_product_id,
    quantity,
  }));

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Fetch product prices from DB with row lock (NEVER trust client prices)
    const productIds = mergedItems.map(item => item.cartridge_product_id);
    const productsQuery = `
      SELECT id, product_name, unit_price, special_price, quantity, is_active 
      FROM cartridge_products 
      WHERE id = ANY($1::uuid[])
      FOR UPDATE; -- Lock rows to prevent race conditions
    `;
    const productsResult = await client.query(productsQuery, [productIds]);
    
    if (productsResult.rows.length !== productIds.length) {
      throw new HttpError(400, "One or more products not found.");
    }

    const productsMap = new Map(productsResult.rows.map(p => [p.id, p]));

    // Validate all products are active, check stock (with merged quantities), and calculate total
    let total = 0;
    const validatedItems = mergedItems.map(item => {
      const product = productsMap.get(item.cartridge_product_id);
      
      if (!product) {
        throw new HttpError(404, `Product ${item.cartridge_product_id} not found.`);
      }
      
      if (!product.is_active) {
        throw new HttpError(400, `Product "${product.product_name}" is not active.`);
      }

      // Check stock availability (now with merged/summed quantities)
      if (product.quantity < item.quantity) {
        throw new HttpError(
          400, 
          `Insufficient stock for "${product.product_name}". Available: ${product.quantity}, Requested: ${item.quantity}`
        );
      }

      // Calculate price based on user role (NEVER trust client)
      const isDistributor = userRole === "distributor";
      const unit_price = isDistributor && product.special_price !== null 
        ? product.special_price 
        : product.unit_price;

      const itemTotal = unit_price * item.quantity;
      total += itemTotal;

      return {
        cartridge_product_id: item.cartridge_product_id,
        quantity: item.quantity,
        unit_price,
        product_name: product.product_name,
      };
    });

    // Create order with paid status
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
      VALUES ($1, $2, $3, $4, $5, 'paid', $6)
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

    // Create order items with multiple serial numbers based on quantity
    for (const item of validatedItems) {
      // Generate multiple cryptographically secure serial numbers based on quantity
      const serialNumbers = [];
      for (let i = 0; i < item.quantity; i++) {
        const serial = `CART-${randomUUID().toUpperCase()}`;
        serialNumbers.push(serial);
      }

      const itemQuery = `
        INSERT INTO cartridge_order_items (
          order_id,
          cartridge_product_id,
          quantity,
          unit_price,
          serial_number
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `;

      await client.query(itemQuery, [
        order.id,
        item.cartridge_product_id,
        item.quantity,
        item.unit_price,
        JSON.stringify(serialNumbers), // Store as JSON array
      ]);

      // Reduce stock quantity (already locked with FOR UPDATE)
      const updateStockQuery = `
        UPDATE cartridge_products 
        SET quantity = quantity - $1 
        WHERE id = $2;
      `;
      await client.query(updateStockQuery, [item.quantity, item.cartridge_product_id]);
    }

    // Create payment record with success status
    let payment;
    if (payment_method === "cod") {
      // Create COD payment with success status
      const paymentQuery = `
        INSERT INTO cartridge_payments (
          cartridge_order_id,
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
        INSERT INTO cartridge_payments (
          cartridge_order_id,
          payment_type,
          gateway,
          gateway_txn_id,
          manual_reference,
          amount,
          status,
          paid_at
        )
        VALUES ($1, 'gateway', NULL, NULL, NULL, $2, 'success', NOW())
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
  userRole?: string;
  billing_info: BillingInfo;
  payment_method: "gateway" | "cod";
}) {
  const { user_id, userRole, billing_info, payment_method } = input;

  // Validate billing info format
  validateStringLength(billing_info.full_name, "Full name", 2, 100);
  validateEmail(billing_info.email, "Email");
  validatePhone(billing_info.phone, "Phone");
  validateStringLength(billing_info.address, "Address", 5, 500);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Get user's cart items INSIDE transaction with lock to prevent double submit
    const cartQuery = `
      SELECT 
        ci.cartridge_product_id,
        ci.quantity
      FROM cartridge_cart_items ci
      JOIN cartridge_carts c ON ci.cart_id = c.id
      WHERE c.user_id = $1 AND c.status = 'active'
      FOR UPDATE OF ci; -- Lock cart items to prevent concurrent checkouts
    `;

    const cartResult = await client.query(cartQuery, [user_id]);

    if (cartResult.rows.length === 0) {
      throw new HttpError(400, "Cart is empty.");
    }

    const items = cartResult.rows;

    // Validate quantities and merge duplicate product IDs
    const mergedItemsMap = new Map<string, number>();
    for (const item of items) {
      const validatedQty = validateQuantity(item.quantity, "Item quantity");
      const currentQty = mergedItemsMap.get(item.cartridge_product_id) || 0;
      mergedItemsMap.set(item.cartridge_product_id, currentQty + validatedQty);
    }

    // Convert back to array
    const mergedItems = Array.from(mergedItemsMap.entries()).map(([cartridge_product_id, quantity]) => ({
      cartridge_product_id,
      quantity,
    }));

    if (mergedItems.length === 0) {
      throw new HttpError(400, "Cart is empty.");
    }
    if (mergedItems.length > 100) {
      throw new HttpError(400, "Order cannot have more than 100 items.");
    }

    // Fetch product prices from DB with row lock (NEVER trust client prices)
    const productIds = mergedItems.map(item => item.cartridge_product_id);
    const productsQuery = `
      SELECT id, product_name, unit_price, special_price, quantity, is_active 
      FROM cartridge_products 
      WHERE id = ANY($1::uuid[])
      FOR UPDATE; -- Lock rows to prevent race conditions
    `;
    const productsResult = await client.query(productsQuery, [productIds]);
    
    if (productsResult.rows.length !== productIds.length) {
      throw new HttpError(400, "One or more products not found.");
    }

    const productsMap = new Map(productsResult.rows.map(p => [p.id, p]));

    // Validate all products are active, check stock (with merged quantities), and calculate total
    let total = 0;
    const validatedItems = mergedItems.map(item => {
      const product = productsMap.get(item.cartridge_product_id);
      
      if (!product) {
        throw new HttpError(404, `Product ${item.cartridge_product_id} not found.`);
      }
      
      if (!product.is_active) {
        throw new HttpError(400, `Product "${product.product_name}" is not active.`);
      }

      // Check stock availability (now with merged/summed quantities)
      if (product.quantity < item.quantity) {
        throw new HttpError(
          400, 
          `Insufficient stock for "${product.product_name}". Available: ${product.quantity}, Requested: ${item.quantity}`
        );
      }

      // Calculate price based on user role (NEVER trust client)
      const isDistributor = userRole === "distributor";
      const unit_price = isDistributor && product.special_price !== null 
        ? product.special_price 
        : product.unit_price;

      const itemTotal = unit_price * item.quantity;
      total += itemTotal;

      return {
        cartridge_product_id: item.cartridge_product_id,
        quantity: item.quantity,
        unit_price,
        product_name: product.product_name,
      };
    });

    // Create order with paid status
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
      VALUES ($1, $2, $3, $4, $5, 'paid', $6)
      RETURNING *;
    `;

    const orderResult = await client.query<CartridgeOrder>(orderQuery, [
      user_id,
      billing_info.full_name,
      billing_info.email,
      billing_info.phone,
      billing_info.address,
      total,
    ]);

    const order = orderResult.rows[0];

    // Create order items with multiple serial numbers based on quantity
    for (const item of validatedItems) {
      // Generate multiple cryptographically secure serial numbers based on quantity
      const serialNumbers = [];
      for (let i = 0; i < item.quantity; i++) {
        const serial = `CART-${randomUUID().toUpperCase()}`;
        serialNumbers.push(serial);
      }

      const itemQuery = `
        INSERT INTO cartridge_order_items (
          order_id,
          cartridge_product_id,
          quantity,
          unit_price,
          serial_number
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `;

      await client.query(itemQuery, [
        order.id,
        item.cartridge_product_id,
        item.quantity,
        item.unit_price,
        JSON.stringify(serialNumbers), // Store as JSON array
      ]);

      // Reduce stock quantity (already locked with FOR UPDATE)
      const updateStockQuery = `
        UPDATE cartridge_products 
        SET quantity = quantity - $1 
        WHERE id = $2;
      `;
      await client.query(updateStockQuery, [item.quantity, item.cartridge_product_id]);
    }

    // Create payment record with success status
    let payment;
    if (payment_method === "cod") {
      // Create COD payment with success status
      const paymentQuery = `
        INSERT INTO cartridge_payments (
          cartridge_order_id,
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
        INSERT INTO cartridge_payments (
          cartridge_order_id,
          payment_type,
          gateway,
          gateway_txn_id,
          manual_reference,
          amount,
          status,
          paid_at
        )
        VALUES ($1, 'gateway', NULL, NULL, NULL, $2, 'success', NOW())
        RETURNING *;
      `;
      const paymentResult = await client.query(paymentQuery, [order.id, total]);
      payment = paymentResult.rows[0];
    }

    // Clear cart (inside transaction, before commit)
    await client.query(
      `DELETE FROM cartridge_cart_items 
       WHERE cart_id IN (SELECT id FROM cartridge_carts WHERE user_id = $1 AND status = 'active')`,
      [user_id]
    );

    await client.query(
      `UPDATE cartridge_carts SET status = 'checked_out' WHERE user_id = $1 AND status = 'active'`,
      [user_id]
    );

    await client.query("COMMIT");

    return { order, payment };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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

// Get user's orders with details
export async function getUserOrders(user_id: string) {
  const q = `
    SELECT 
      o.id,
      o.billing_full_name,
      o.billing_email,
      o.billing_phone,
      o.billing_address,
      o.status,
      o.total,
      o.created_at,
      o.updated_at,
      json_agg(
        json_build_object(
          'id', oi.id,
          'cartridge_product_id', oi.cartridge_product_id,
          'product_name', p.product_name,
          'model_number', p.model_number,
          'brand_name', b.name,
          'category_name', c.name,
          'quantity', oi.quantity,
          'unit_price', oi.unit_price,
          'serial_number', oi.serial_number,
          'created_at', oi.created_at
        ) ORDER BY oi.created_at ASC
      ) as items,
      COUNT(oi.id) as item_count
    FROM cartridge_orders o
    LEFT JOIN cartridge_order_items oi ON o.id = oi.order_id
    LEFT JOIN cartridge_products p ON oi.cartridge_product_id = p.id
    LEFT JOIN cartridge_brands b ON p.brand_id = b.id
    LEFT JOIN cartridge_categories c ON p.category_id = c.id
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

// Admin: Get order details with barcode images
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

  // Generate barcode images for items with serial numbers
  const itemsWithBarcodes = await Promise.all(
    itemsResult.rows.map(async (item: any) => {
      if (item.serial_number) {
        try {
          // Try to parse as JSON array, if it fails treat as single string
          let serialNumbers;
          try {
            serialNumbers = JSON.parse(item.serial_number);
            // If it's not an array, wrap it in an array
            if (!Array.isArray(serialNumbers)) {
              serialNumbers = [serialNumbers];
            }
          } catch {
            // If JSON parse fails, it's a plain string - wrap it in an array
            serialNumbers = [item.serial_number];
          }
          
          // Generate barcode for each serial number with customer name
          const barcodes = await Promise.all(
            serialNumbers.map(async (serial: string) => {
              try {
                const barcodeImage = await generateBarcodeImage(serial, order.billing_full_name);
                return {
                  serial_number: serial,
                  customer_name: order.billing_full_name,
                  barcode_image: barcodeImage,
                };
              } catch (error) {
                console.error(`Failed to generate barcode for serial ${serial}:`, error);
                return {
                  serial_number: serial,
                  customer_name: order.billing_full_name,
                  barcode_image: null,
                };
              }
            })
          );

          return {
            ...item,
            serial_numbers: serialNumbers, // Array of serial numbers
            barcodes: barcodes, // Array of {serial_number, customer_name, barcode_image}
            serial_number: undefined, // Remove raw field
          };
        } catch (error) {
          console.error(`Failed to process serial numbers for item ${item.id}:`, error);
          return {
            ...item,
            serial_numbers: [],
            barcodes: [],
          };
        }
      }
      return {
        ...item,
        serial_numbers: [],
        barcodes: [],
      };
    })
  );

  return {
    order,
    payment: paymentResult.rows[0] || null,
    items: itemsWithBarcodes,
    summary: {
      total_items: itemsWithBarcodes.reduce((sum: number, item: any) => sum + item.quantity, 0),
      total_barcodes: itemsWithBarcodes.reduce((sum: number, item: any) => sum + (item.barcodes?.length || 0), 0),
      items_with_codes: itemsWithBarcodes.filter((item: any) => item.serial_numbers?.length > 0).length,
      items_without_codes: itemsWithBarcodes.filter((item: any) => !item.serial_numbers || item.serial_numbers.length === 0).length,
    }
  };
}

// Generate serial numbers after payment (barcode generated on-demand from serial)
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
    // Generate multiple cryptographically secure serial numbers based on quantity
    const serialNumbers = [];
    for (let i = 0; i < item.quantity; i++) {
      const serial = `CART-${randomUUID().toUpperCase()}`;
      serialNumbers.push(serial);
    }

    const updateQuery = `
      UPDATE cartridge_order_items 
      SET 
        serial_number = $1,
        updated_at = NOW()
      WHERE id = $2;
    `;

    await pool.query(updateQuery, [JSON.stringify(serialNumbers), item.id]);
  }

  return { message: "Cartridge serial numbers generated successfully." };
}
