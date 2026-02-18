import { pool } from "../config/db";
import { HttpError } from "../utils/errors";
import { sendActivationKeyEmail } from "../utils/emailService";

/* ==================== ACTIVATION SERVICES ==================== */

export async function verifyAndSendActivationKey(input: {
  phone: string;
  serial_number: string;
}) {
  const { phone, serial_number } = input;

  if (!phone) throw new HttpError(400, "Phone number is required.");
  if (!serial_number) throw new HttpError(400, "Serial number is required.");

  // Find the order item with this serial number
  const query = `
    SELECT 
      oi.id,
      oi.serial_number,
      o.billing_full_name,
      o.billing_email,
      o.billing_phone,
      pl.plan_name,
      pl.activation_key,
      pl.start_date,
      pl.expiry_date,
      p.name as product_name
    FROM software_order_items oi
    JOIN software_orders o ON oi.order_id = o.id
    JOIN software_plans pl ON oi.software_plan_id = pl.id
    JOIN software_products p ON pl.software_product_id = p.id
    WHERE oi.serial_number = $1 AND o.billing_phone = $2;
  `;

  const result = await pool.query(query, [serial_number, phone]);

  if (!result.rows[0]) {
    throw new HttpError(404, "Invalid serial number or phone number. Please check your details.");
  }

  const license = result.rows[0];

  // Check if activation key exists
  if (!license.activation_key) {
    throw new HttpError(400, "Activation key not available for this license. Please contact support.");
  }

  // Calculate days remaining
  let daysRemaining = null;
  if (license.expiry_date) {
    const now = new Date();
    const expiryDate = new Date(license.expiry_date);
    const diffTime = expiryDate.getTime() - now.getTime();
    daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) {
      throw new HttpError(400, "This license has expired.");
    }
  }

  // Send activation key email
  const emailSent = await sendActivationKeyEmail({
    customerEmail: license.billing_email,
    customerName: license.billing_full_name,
    productName: license.product_name,
    planName: license.plan_name,
    serialNumber: license.serial_number,
    activationKey: license.activation_key,
    startDate: license.start_date,
    expiryDate: license.expiry_date,
    daysRemaining,
  });

  if (!emailSent) {
    throw new HttpError(500, "Failed to send activation key email. Please try again.");
  }

  return {
    message: "Activation key has been sent to your email.",
    email: license.billing_email,
    daysRemaining,
  };
}
