import { pool } from "../config/db";
import { HttpError, isPgUniqueViolation, isPgForeignKeyViolation } from "../utils/errors";
import type { SoftwareBrand } from "../models/softwareModels";

export async function createBrand(input: { 
  name?: string; 
  category_id?: string;
  thumbnail_url?: string; 
  original_url?: string; 
  is_active?: boolean 
}) {
  const { name, category_id, thumbnail_url, original_url, is_active = true } = input;

  if (!name) throw new HttpError(400, "Brand name is required.");

  try {
    const q = `
      INSERT INTO software_brands (name, category_id, thumbnail_url, original_url, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const result = await pool.query<SoftwareBrand>(q, [
      name.trim(), 
      category_id ?? null,
      thumbnail_url ?? null, 
      original_url ?? null, 
      is_active
    ]);
    
    const brand = result.rows[0];
    return brand;
  } catch (err: any) {
    if (isPgUniqueViolation(err)) {
      throw new HttpError(409, "Brand name already exists.");
    }
    throw err;
  }
}

export async function getAllBrands() {
  const q = `
    SELECT b.*, c.name as category_name 
    FROM software_brands b 
    LEFT JOIN software_categories c ON b.category_id = c.id 
    ORDER BY b.name ASC;
  `;
  const result = await pool.query<SoftwareBrand>(q);
  
  return result.rows;
}

export async function getBrandById(id: string) {
  const q = `
    SELECT b.*, c.name as category_name 
    FROM software_brands b 
    LEFT JOIN software_categories c ON b.category_id = c.id 
    WHERE b.id = $1;
  `;
  const result = await pool.query<SoftwareBrand>(q, [id]);
  if (!result.rows[0]) throw new HttpError(404, "Brand not found.");
  
  return result.rows[0];
}

export async function updateBrand(input: { 
  id: string; 
  name?: string; 
  category_id?: string;
  thumbnail_url?: string; 
  original_url?: string; 
  is_active?: boolean 
}) {
  const { id, name, category_id, thumbnail_url, original_url, is_active } = input;

  if (!name && category_id === undefined && thumbnail_url === undefined && original_url === undefined && is_active === undefined) {
    throw new HttpError(400, "At least one field is required.");
  }

  try {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }
    if (category_id !== undefined) {
      updates.push(`category_id = $${paramIndex++}`);
      values.push(category_id ?? null);
    }
    if (thumbnail_url !== undefined) {
      updates.push(`thumbnail_url = $${paramIndex++}`);
      values.push(thumbnail_url ?? null);
    }
    if (original_url !== undefined) {
      updates.push(`original_url = $${paramIndex++}`);
      values.push(original_url ?? null);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(is_active);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const q = `
      UPDATE software_brands
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *;
    `;

    const result = await pool.query<SoftwareBrand>(q, values);
    if (!result.rows[0]) throw new HttpError(404, "Brand not found.");
    
    return result.rows[0];
  } catch (err: any) {
    if (err instanceof HttpError) throw err;
    if (isPgUniqueViolation(err)) {
      throw new HttpError(409, "Brand name already exists.");
    }
    throw err;
  }
}

export async function deleteBrand(id: string) {
  try {
    const q = `DELETE FROM software_brands WHERE id = $1 RETURNING *;`;
    const result = await pool.query<SoftwareBrand>(q, [id]);
    if (!result.rows[0]) throw new HttpError(404, "Brand not found.");
    return { message: "Brand deleted successfully." };
  } catch (err: any) {
    if (err instanceof HttpError) throw err;
    if (isPgForeignKeyViolation(err)) {
      throw new HttpError(409, "Cannot delete brand because products are using it.");
    }
    throw err;
  }
}
