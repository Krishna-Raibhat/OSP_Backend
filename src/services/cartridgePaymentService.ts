import { pool } from "../config/db";
import { HttpError } from "../utils/errors";
import type { CartridgePayment } from "../models/cartridgeModels";
import * as orderService from "./cartridgeOrderService";

/* ==================== CARTRIDGE PAYMENT SERVICES ==================== */

// Create COD payment record
export async function createCODPayment(order_id: string) {
  // Verify order exists and is pending
  const orderQuery = `SELECT * FROM cartridge_orders WHERE id = $1 AND status = 'pending';`;
  const orderResult = await pool.query(orderQuery, [order_id]);

  if (!orderResult.rows[0]) {
    throw new HttpError(404, "Order not found or already processed.");
  }

  const order = orderResult.rows[0];

  // Create payment record with COD
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

  const result = await pool.query<CartridgePayment>(paymentQuery, [order_id, order.total]);

  return result.rows[0];
}

// Admin confirms COD payment received
export async function confirmCODPayment(input: {
  payment_id: string;
  manual_reference?: string; // Optional receipt number or note
}) {
  const { payment_id, manual_reference } = input;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Get payment
    const paymentQuery = `SELECT * FROM cartridge_payments WHERE id = $1 AND payment_type = 'cod';`;
    const paymentResult = await client.query<CartridgePayment>(paymentQuery, [payment_id]);

    if (!paymentResult.rows[0]) {
      throw new HttpError(404, "COD payment not found.");
    }

    const payment = paymentResult.rows[0];

    if (payment.status === "success") {
      throw new HttpError(400, "Payment already confirmed.");
    }

    // Update payment status
    const updatePaymentQuery = `
      UPDATE cartridge_payments 
      SET 
        status = 'success',
        paid_at = NOW(),
        manual_reference = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *;
    `;

    await client.query(updatePaymentQuery, [
      manual_reference || payment.manual_reference,
      payment_id,
    ]);

    // Update order status to paid
    await client.query(
      `UPDATE cartridge_orders SET status = 'paid', updated_at = NOW() WHERE id = $1`,
      [payment.cartridge_order_id]
    );

    // Generate serial numbers and barcodes
    await orderService.generateCartridgeCodes(payment.cartridge_order_id);

    await client.query("COMMIT");

    return { message: "COD payment confirmed and codes generated." };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Get payment by order ID
export async function getPaymentByOrderId(order_id: string) {
  const q = `SELECT * FROM cartridge_payments WHERE cartridge_order_id = $1;`;
  const result = await pool.query<CartridgePayment>(q, [order_id]);

  if (!result.rows[0]) {
    throw new HttpError(404, "Payment not found.");
  }

  return result.rows[0];
}

// Admin: Get all pending COD payments
export async function getPendingCODPayments() {
  const q = `
    SELECT 
      p.*,
      o.billing_full_name,
      o.billing_email,
      o.billing_phone,
      o.billing_address,
      o.total as order_total,
      o.created_at as order_created_at
    FROM cartridge_payments p
    JOIN cartridge_orders o ON p.cartridge_order_id = o.id
    WHERE p.payment_type = 'cod' AND p.status = 'pending'
    ORDER BY p.created_at DESC;
  `;

  const result = await pool.query(q);
  return result.rows;
}

// Create manual payment (for admin manual orders)
export async function createManualPayment(input: {
  order_id: string;
  amount: number;
  manual_reference: string;
}) {
  const { order_id, amount, manual_reference } = input;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Verify order exists
    const orderQuery = `SELECT * FROM cartridge_orders WHERE id = $1;`;
    const orderResult = await client.query(orderQuery, [order_id]);

    if (!orderResult.rows[0]) {
      throw new HttpError(404, "Order not found.");
    }

    // Create payment record
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
      VALUES ($1, 'manual', NULL, NULL, $2, $3, 'success', NOW())
      RETURNING *;
    `;

    const paymentResult = await client.query<CartridgePayment>(paymentQuery, [
      order_id,
      manual_reference,
      amount,
    ]);

    // Update order status to paid
    await client.query(
      `UPDATE cartridge_orders SET status = 'paid', updated_at = NOW() WHERE id = $1`,
      [order_id]
    );

    // Generate serial numbers and barcodes
    await orderService.generateCartridgeCodes(order_id);

    await client.query("COMMIT");

    return paymentResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
