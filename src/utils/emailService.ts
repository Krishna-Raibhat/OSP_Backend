import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from "path";

// Load environment variables with explicit path
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface OrderEmailData {
  customerEmail: string;
  customerName: string;
  orderId: string;
  orderItems: Array<{
    productName: string;
    planName?: string;
    serialNumber: string;
    price: string;
  }>;
  total: string;
  activationLink: string;
}

export async function sendOrderConfirmationEmail(data: OrderEmailData) {
  const { customerEmail, customerName, orderId, orderItems, total, activationLink } = data;

  // Build items HTML
  const itemsHtml = orderItems
    .map(
      (item) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">
        <strong>${item.productName}</strong>
        ${item.planName ? `<br/><small>${item.planName}</small>` : ""}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">
        <div style="font-family: monospace; font-size: 12px;">
          ${item.serialNumber}
        </div>
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
        Rs. ${item.price}
      </td>
    </tr>
  `
    )
    .join("");

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
    <h1 style="color: #2c3e50; margin: 0;">Order Confirmation</h1>
    <p style="color: #7f8c8d; margin: 5px 0 0 0;">Order #${orderId}</p>
  </div>

  <p>Dear ${customerName},</p>
  
  <p>Thank you for your purchase! Your order has been confirmed and your licenses are ready to activate.</p>

  <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">Order Details</h2>
  
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <thead>
      <tr style="background-color: #f8f9fa;">
        <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Product</th>
        <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Serial Number</th>
        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #dee2e6;">Price</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2" style="padding: 15px 10px; text-align: right; font-weight: bold;">Total:</td>
        <td style="padding: 15px 10px; text-align: right; font-weight: bold; font-size: 18px; color: #27ae60;">
          Rs. ${total}
        </td>
      </tr>
    </tfoot>
  </table>

  <div style="background-color: #e8f5e9; padding: 20px; border-radius: 5px; margin: 30px 0; border-left: 4px solid #27ae60;">
    <h3 style="margin-top: 0; color: #27ae60;">🎉 Activate Your Licenses</h3>
    <p>Click the button below to activate your software licenses:</p>
    <div style="text-align: center; margin: 20px 0;">
      <a href="${activationLink}" 
         style="display: inline-block; padding: 12px 30px; background-color: #27ae60; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
        Activate Now
      </a>
    </div>
    <p style="font-size: 12px; color: #666;">
      Or copy this link: <a href="${activationLink}" style="color: #3498db;">${activationLink}</a>
    </p>
  </div>

  <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
    <p style="margin: 0;"><strong>⚠️ Important:</strong> Please save your serial numbers in a safe place. You will need them to activate your software.</p>
  </div>

  <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">

  <p style="color: #7f8c8d; font-size: 14px;">
    If you have any questions, please contact our support team at <a href="mailto:${process.env.COMPANY_EMAIL || process.env.SMTP_USER}" style="color: #3498db;">${process.env.COMPANY_EMAIL || process.env.SMTP_USER}</a><br/>
    ${process.env.COMPANY_WEBSITE ? `Visit our website: <a href="${process.env.COMPANY_WEBSITE}" style="color: #3498db;">${process.env.COMPANY_WEBSITE}</a><br/>` : ''}
    Thank you for choosing us!
  </p>

  <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #95a5a6; font-size: 12px;">
    <p>© 2026 ${process.env.COMPANY_NAME || 'Your Company'}. All rights reserved.</p>
  </div>
</body>
</html>
  `;

  const mailOptions = {
    from: `"${process.env.COMPANY_NAME || 'Your Company'}" <${process.env.COMPANY_EMAIL || process.env.SMTP_USER}>`,
    to: customerEmail,
    subject: `Order Confirmation - #${orderId.substring(0, 8)}`,
    html: htmlContent,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Order confirmation email sent to ${customerEmail}`);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}


interface ActivationEmailData {
  customerEmail: string;
  customerName: string;
  productName: string;
  planName: string;
  serialNumber: string;
  activationKey: string;
  startDate: string | null;
  expiryDate: string | null;
  daysRemaining: number | null;
}

export async function sendActivationKeyEmail(data: ActivationEmailData) {
  const { customerEmail, customerName, productName, planName, serialNumber, activationKey, startDate, expiryDate, daysRemaining } = data;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Activation Key</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
    <h1 style="color: #2c3e50; margin: 0;">🔑 Your Activation Key</h1>
  </div>

  <p>Dear ${customerName},</p>
  
  <p>Your activation key has been verified successfully! Here are your license details:</p>

  <div style="background-color: #e8f5e9; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #27ae60;">
    <h3 style="margin-top: 0; color: #27ae60;">Product Information</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; font-weight: bold; width: 40%;">Product:</td>
        <td style="padding: 8px 0;">${productName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Plan:</td>
        <td style="padding: 8px 0;">${planName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Serial Number:</td>
        <td style="padding: 8px 0; font-family: monospace;">${serialNumber}</td>
      </tr>
    </table>
  </div>

  <div style="background-color: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
    <h3 style="margin-top: 0; color: #856404;">🔐 Activation Key</h3>
    <div style="background-color: white; padding: 15px; border-radius: 3px; font-family: monospace; font-size: 18px; font-weight: bold; text-align: center; letter-spacing: 2px;">
      ${activationKey}
    </div>
  </div>

  ${daysRemaining !== null ? `
  <div style="background-color: #e3f2fd; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #2196f3;">
    <h3 style="margin-top: 0; color: #1976d2;">⏰ License Validity</h3>
    <table style="width: 100%; border-collapse: collapse;">
      ${startDate ? `
      <tr>
        <td style="padding: 8px 0; font-weight: bold; width: 40%;">Start Date:</td>
        <td style="padding: 8px 0;">${new Date(startDate).toLocaleDateString()}</td>
      </tr>
      ` : ''}
      ${expiryDate ? `
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Expiry Date:</td>
        <td style="padding: 8px 0;">${new Date(expiryDate).toLocaleDateString()}</td>
      </tr>
      ` : ''}
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Days Remaining:</td>
        <td style="padding: 8px 0; font-size: 20px; color: ${daysRemaining > 30 ? '#27ae60' : daysRemaining > 7 ? '#f39c12' : '#e74c3c'};">
          <strong>${daysRemaining} days</strong>
        </td>
      </tr>
    </table>
  </div>
  ` : ''}

  <div style="background-color: #ffebee; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f44336;">
    <p style="margin: 0;"><strong>⚠️ Security Notice:</strong> Keep your activation key confidential. Do not share it with anyone.</p>
  </div>

  <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">

  <p style="color: #7f8c8d; font-size: 14px;">
    If you did not request this activation key, please contact our support team immediately at <a href="mailto:${process.env.COMPANY_EMAIL || process.env.SMTP_USER}" style="color: #3498db;">${process.env.COMPANY_EMAIL || process.env.SMTP_USER}</a><br/>
    ${process.env.COMPANY_WEBSITE ? `Visit our website: <a href="${process.env.COMPANY_WEBSITE}" style="color: #3498db;">${process.env.COMPANY_WEBSITE}</a><br/>` : ''}
    Thank you for choosing us!
  </p>

  <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #95a5a6; font-size: 12px;">
    <p>© 2026 ${process.env.COMPANY_NAME || 'Your Company'}. All rights reserved.</p>
  </div>
</body>
</html>
  `;

  const mailOptions = {
    from: `"${process.env.COMPANY_NAME || 'Your Company'}" <${process.env.COMPANY_EMAIL || process.env.SMTP_USER}>`,
    to: customerEmail,
    subject: `Activation Key - ${productName}`,
    html: htmlContent,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Activation key email sent to ${customerEmail}`);
    return true;
  } catch (error) {
    console.error("Error sending activation email:", error);
    return false;
  }
}

interface ContactUsData {
  fullName: string;
  email: string;
  phone: string;
  message: string;
}

export async function sendContactUsEmail(data: ContactUsData) {
  const { fullName, email, phone, message } = data;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contact Us Message</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
    <h1 style="color: #2c3e50; margin: 0;">📧 New Contact Us Message</h1>
    <p style="color: #7f8c8d; margin: 5px 0 0 0;">Received: ${new Date().toLocaleString()}</p>
  </div>

  <div style="background-color: #e8f5e9; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #27ae60;">
    <h3 style="margin-top: 0; color: #27ae60;">👤 Contact Information</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; font-weight: bold; width: 30%;">Full Name:</td>
        <td style="padding: 8px 0;">${fullName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Email:</td>
        <td style="padding: 8px 0;"><a href="mailto:${email}" style="color: #3498db;">${email}</a></td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Phone:</td>
        <td style="padding: 8px 0;"><a href="tel:${phone}" style="color: #3498db;">${phone}</a></td>
      </tr>
    </table>
  </div>

  <div style="background-color: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
    <h3 style="margin-top: 0; color: #856404;">💬 Message</h3>
    <div style="background-color: white; padding: 15px; border-radius: 3px; white-space: pre-wrap; font-size: 14px; line-height: 1.6;">
${message}
    </div>
  </div>

  <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #2196f3;">
    <p style="margin: 0;"><strong>💡 Quick Actions:</strong></p>
    <p style="margin: 10px 0 0 0;">
      <a href="mailto:${email}?subject=Re: Your Contact Us Message" style="display: inline-block; padding: 8px 16px; background-color: #3498db; color: white; text-decoration: none; border-radius: 3px; margin-right: 10px;">Reply via Email</a>
      <a href="tel:${phone}" style="display: inline-block; padding: 8px 16px; background-color: #27ae60; color: white; text-decoration: none; border-radius: 3px;">Call Customer</a>
    </p>
  </div>

  <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">

  <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #95a5a6; font-size: 12px;">
    <p>This message was sent via the Contact Us form on ${process.env.COMPANY_WEBSITE || 'your website'}</p>
    <p>© 2026 ${process.env.COMPANY_NAME || 'Your Company'}. All rights reserved.</p>
  </div>
</body>
</html>
  `;

  const mailOptions = {
    from: `"${process.env.COMPANY_NAME || 'Your Company'}" <${process.env.COMPANY_EMAIL || process.env.SMTP_USER}>`,
    to: process.env.COMPANY_EMAIL || process.env.SMTP_USER, // Send to company email
    replyTo: email, // Allow direct reply to customer
    subject: `Contact Us: Message from ${fullName}`,
    html: htmlContent,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Contact us email sent from ${email} (${fullName})`);
    return true;
  } catch (error) {
    console.error("Error sending contact us email:", error);
    return false;
  }
}
