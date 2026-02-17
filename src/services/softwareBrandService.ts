import { pool } from "../config/db";
import { HttpError, isPgUniqueViolation, isPgForeignKeyViolation } from "../utils/errors";
import type { SoftwareBrand } from "../models/softwareModels";

export async function createBrand(input: { name?: string; is_active?: boolean }) {
  const { name, is_active = true } = input;

  if (!name) throw new HttpError(400, "Brand name is required.");

  try {
    const q = `
      INSERT INTO software_brands (name, is_active)
      VALUES ($1, $2)
      RETURNING *;
    `;
    const result = await pool.query<SoftwareBrand>(q, [name.trim(), is_active]);
    return result.rows[0];
  } catch (err: any) {
    if (isPgUniqueViolation(err)) {
      throw new HttpError(409, "Brand name already exists.");
    }
    throw err;
  }
}

export async function getAllBrands() {
  const q = `SELECT * FROM software_brands ORDER BY name ASC;`;
  const result = await pool.query<SoftwareBrand>(q);
  return result.rows;
}

export async function getBrandById(id: string) {
  const q = `SELECT * FROM software_brands WHERE id = $1;`;
  const result = await pool.query<SoftwareBrand>(q, [id]);
  if (!result.rows[0]) throw new HttpError(404, "Brand not found.");
  return result.rows[0];
}

export async function updateBrand(input: { id: string; name?: string; is_active?: boolean }) {
  const { id, name, is_active } = input;

  if (!name && is_active === undefined) {
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
