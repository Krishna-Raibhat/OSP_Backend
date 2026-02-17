import QRCode from "qrcode";
import { pool } from "../config/db";
import { HttpError } from "../utils/errors";
import {
  CartridgeProduct,
  CartridgeProductQR,
} from "../models/cartridgeModels";


export async function generateProductQR(product: CartridgeProduct) {
  try {
    const qrData = JSON.stringify(product.id);

    const qrCode = await QRCode.toDataURL(qrData);
    const result = await pool.query<CartridgeProductQR>(
      `
    INSERT INTO cartridge_product_qr
      (cartridge_product_id, qr_value, is_active, created_at, updated_at)
    VALUES
      ($1, $2, true, NOW(), NOW())
    RETURNING *;
    `,
      [product.id, qrCode],
    );
    return result.rows[0];
  } catch (err) {
    console.error("QR code generation error:", err);
    throw new HttpError(500, "Failed to generate QR code.");
    
  }
}

export async function getProductQRByProductId(
  productId: string,
): Promise<CartridgeProductQR | null> {
  try {
    const result = await pool.query<CartridgeProductQR>(
      `
    SELECT * FROM cartridge_product_qr
    WHERE cartridge_product_id = $1 AND is_active = true;
    `,
      [productId],
    );
    if (result.rows.length === 0) {
      throw new HttpError(404, "QR code not found for this product.");
    }
    return result.rows[0];

  } catch (err) {
    console.error("Get QR code error:", err);
    throw new HttpError(500, "Failed to retrieve QR code.");
  }
}

export async function deactivateProductQR(productId: string) {
  try {
   const result = await pool.query(
      `
    UPDATE cartridge_product_qr
    SET is_active = false, updated_at = NOW()
    WHERE cartridge_product_id = $1;
    `,
      [productId],
    );
    if (result.rowCount === 0) {  
      throw new HttpError(404, "QR code not found for this product.");
    }
  } catch (err) {
    throw new HttpError(500, "Failed to deactivate QR code.");
  }
}

export async function reactivateProductQR(productId: string) {
  try {
    const result = await pool.query(
      `
    UPDATE cartridge_product_qr
    SET is_active = true, updated_at = NOW()
    WHERE cartridge_product_id = $1;
    `,
      [productId],
    );
    if (result.rowCount === 0) {
      throw new HttpError(404, "QR code not found for this product.");
    }
  } catch (err) {
    throw new HttpError(500, "Failed to reactivate QR code.");
  }
}

export async function deleteProductQR(productId: string) {
  try {
    const result = await pool.query(
      `
    DELETE FROM cartridge_product_qr
    WHERE cartridge_product_id = $1;
    `,
      [productId],
    );
    if (result.rowCount === 0) {
      throw new HttpError(404, "QR code not found for this product.");
    }
  } catch (err) {
    throw new HttpError(500, "Failed to delete QR code.");
  }
}

export async function getAllProductQRs() {
  try{
    
    const q = `SELECT * FROM cartridge_product_qr;`;
    const result = await pool.query<CartridgeProductQR>(q);
    if (result.rows.length === 0) {
      throw new HttpError(404, "No QR codes found.");
    } 
    return result.rows;
  } catch (err) {
    throw new HttpError(500, "Failed to retrieve QR codes.");
  }
} 

export async function updateProductQR(product: CartridgeProduct) {
  try {
    const qrData = JSON.stringify(product.id);
    const qrCode = await QRCode.toDataURL(qrData);
    const result = await pool.query<CartridgeProductQR>(
      `
    UPDATE cartridge_product_qr
    SET qr_value = $1, updated_at = NOW()
    WHERE cartridge_product_id = $2
    RETURNING *;
    `,
      [qrCode, product.id],
    );
    if (result.rows.length === 0) {
      throw new HttpError(404, "QR code not found for this product.");
    }
    return result.rows[0];
  } catch (err) {
    throw new HttpError(500, "Failed to update QR code.");
  } 
}