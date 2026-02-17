import { pool } from "../config/db";
import {
  HttpError,
  isPgUniqueViolation,
  isPgForeignKeyViolation,
} from "../utils/errors";
import type { CartridgeProduct } from "../models/cartridgeModels";

export async function createCartridgeProduct(
  input: {
    brand_id: string;
    category_id: string;
    product_name: string;
    model_number: string;
    description?: string | null;
    unit_price: number;
    special_price?: number | null;
    is_active?: boolean;
    created_by?: string | null;
  },
  userId?: string,
) {
  const {
    brand_id,
    category_id,
    product_name,
    model_number,
    description = null,
    unit_price,
    special_price = null,
    is_active = true,
    created_by = userId,
  } = input;

  if (
    !brand_id ||
    !category_id ||
    !product_name ||
    !model_number ||
    unit_price === undefined
  ) {
    throw new HttpError(
      400,
      "brand_id, category_id, product_name, model_number, and unit_price are required.",
    );
  }

  try {
    const q = `
      INSERT INTO cartridge_products
        (brand_id, category_id, product_name, model_number, description, unit_price, special_price, is_active, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *;
    `;
    const values = [
      brand_id,
      category_id,
      product_name.trim(),
      model_number.trim(),
      description,
      unit_price,
      special_price,
      is_active,
      created_by,
    ];
    const result = await pool.query<CartridgeProduct>(q, values);
    return result.rows[0];
  } catch (err: any) {
    if (isPgUniqueViolation(err)) {
      throw new HttpError(
        409,
        "Product with this model number already exists.",
      );
    }
    throw err;
  }
}

export async function getAllCartridgeProducts() {
  const q = `SELECT p.*, b.name as brand_name, b.img_url as brand_image_url,
  c.name as category_name FROM cartridge_products p LEFT JOIN cartridge_brands b ON p.brand_id = b.id
  LEFT JOIN cartridge_categories c ON p.category_id = c.id ORDER BY p.created_at DESC;`;
  const result = await pool.query<CartridgeProduct>(q);
  return result.rows;
}

export async function getCartridgeProductById(id: string) {
  const q = `SELECT p.*, b.name as brand_name, b.img_url as brand_image_url, 
  c.name as category_name FROM cartridge_products p LEFT JOIN cartridge_brands b ON p.brand_id = b.id
  LEFT JOIN cartridge_categories c ON p.category_id = c.id WHERE p.id = $1;
  `;

  const result = await pool.query<CartridgeProduct>(q, [id]);
  if (!result.rows[0]) throw new HttpError(404, "Product not found.");
  return result.rows[0];
}

export async function getCartridgeProductsByBrand(brand_id: string) {
  const q = `SELECT p.*, b.name as brand_name, b.img_url as brand_image_url,
  c.name as category_name FROM cartridge_products p LEFT JOIN cartridge_brands b ON p.brand_id = b.id
  LEFT JOIN cartridge_categories c ON p.category_id = c.id WHERE p.brand_id = $1 ORDER BY p.created_at DESC;
  `;
  const result = await pool.query<CartridgeProduct>(q, [brand_id]);
  return result.rows;
}


export async function updateCartridgeProduct(input: {
  id: string;
  brand_id?: string;
  category_id?: string;
  product_name?: string;
  model_number?: string;
  description?: string | null;
  unit_price?: number;
  special_price?: number | null;
  is_active?: boolean;
}) {
  const { id, ...data } = input;

  if (Object.keys(data).length === 0) {
    throw new HttpError(400, "At least one field is required to update.");
  }

  try {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(data)) {
      updates.push(`${key} = $${paramIndex++}`);
      values.push(value);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const q = `
      UPDATE cartridge_products
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *;
    `;

    const result = await pool.query<CartridgeProduct>(q, values);
    if (!result.rows[0]) throw new HttpError(404, "Product not found.");
    return result.rows[0];
  } catch (err: any) {
    if (isPgUniqueViolation(err)) {
      throw new HttpError(
        409,
        "Product with this model number already exists.",
      );
    }
    throw err;
  }
}

export async function deleteCartridgeProduct(id: string) {
  try {
    const q = `DELETE FROM cartridge_products WHERE id = $1 RETURNING *;`;
    const result = await pool.query<CartridgeProduct>(q, [id]);
    if (!result.rows[0]) throw new HttpError(404, "Product not found.");
    return result.rows[0];
  } catch (err: any) {
    if (isPgForeignKeyViolation(err)) {
      throw new HttpError(
        400,
        "Cannot delete product with associated inventory or orders.",
      );
    }
    throw err;
  }
}
