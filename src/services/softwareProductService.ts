import { pool } from "../config/db";
import { HttpError, isPgUniqueViolation } from "../utils/errors";
import { getS3Url } from "../utils/s3Upload";
import type { SoftwareProduct } from "../models/softwareModels";

export async function createProduct(input: {
  brand_id?: string;
  category_id?: string;
  name?: string;
  description?: string;
  is_active?: boolean;
}) {
  const { brand_id, category_id, name, description, is_active = true } = input;

  if (!brand_id) throw new HttpError(400, "Brand ID is required.");
  if (!category_id) throw new HttpError(400, "Category ID is required.");
  if (!name) throw new HttpError(400, "Product name is required.");

  try {
    const q = `
      INSERT INTO software_products (brand_id, category_id, name, description, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const result = await pool.query<SoftwareProduct>(q, [
      brand_id,
      category_id,
      name.trim(),
      description ?? null,
      is_active,
    ]);
    return result.rows[0];
  } catch (err: any) {
    if (isPgUniqueViolation(err)) {
      throw new HttpError(409, "Product name already exists.");
    }
    throw err;
  }
}

export async function getAllProducts() {
  const q = `
    SELECT 
      p.*,
      b.name as brand_name,
      b.thumbnail_url as brand_thumbnail_url,
      c.name as category_name
    FROM software_products p
    JOIN software_brands b ON p.brand_id = b.id
    JOIN software_categories c ON p.category_id = c.id
    ORDER BY p.created_at DESC;
  `;
  const result = await pool.query(q);
  
  return result.rows;
}

export async function getProductById(id: string) {
  const q = `
    SELECT 
      p.*,
      b.name as brand_name,
      b.thumbnail_url as brand_thumbnail_url,
      c.name as category_name
    FROM software_products p
    JOIN software_brands b ON p.brand_id = b.id
    JOIN software_categories c ON p.category_id = c.id
    WHERE p.id = $1;
  `;
  const result = await pool.query(q, [id]);
  if (!result.rows[0]) throw new HttpError(404, "Product not found.");
  
  return result.rows[0];
}

export async function getProductsByBrand(brand_id: string) {
  const q = `
    SELECT 
      p.*,
      b.name as brand_name,
      b.thumbnail_url as brand_thumbnail_url,
      c.name as category_name
    FROM software_products p
    JOIN software_brands b ON p.brand_id = b.id
    JOIN software_categories c ON p.category_id = c.id
    WHERE p.brand_id = $1 
    ORDER BY p.name ASC;
  `;
  const result = await pool.query(q, [brand_id]);
  
  return result.rows;
}

export async function updateProduct(input: {
  id: string;
  brand_id?: string;
  category_id?: string;
  name?: string;
  description?: string;
  is_active?: boolean;
}) {
  const { id, brand_id, category_id, name, description, is_active } = input;

  if (!brand_id && !category_id && !name && description === undefined && is_active === undefined) {
    throw new HttpError(400, "At least one field is required.");
  }

  try {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (brand_id) {
      updates.push(`brand_id = $${paramIndex++}`);
      values.push(brand_id);
    }
    if (category_id) {
      updates.push(`category_id = $${paramIndex++}`);
      values.push(category_id);
    }
    if (name) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description ?? null);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(is_active);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const q = `
      UPDATE software_products
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *;
    `;

    const result = await pool.query<SoftwareProduct>(q, values);
    if (!result.rows[0]) throw new HttpError(404, "Product not found.");
    return result.rows[0];
  } catch (err: any) {
    if (err instanceof HttpError) throw err;
    if (isPgUniqueViolation(err)) {
      throw new HttpError(409, "Product name already exists.");
    }
    throw err;
  }
}

export async function deleteProduct(id: string) {
  const q = `DELETE FROM software_products WHERE id = $1 RETURNING *;`;
  const result = await pool.query<SoftwareProduct>(q, [id]);
  if (!result.rows[0]) throw new HttpError(404, "Product not found.");
  return { message: "Product deleted successfully." };
}
