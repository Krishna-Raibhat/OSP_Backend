import { pool } from "../config/db";
import { HttpError, isPgUniqueViolation, isPgForeignKeyViolation } from "../utils/errors";
import type { CartridgeCategory } from "../models/cartridgeModels";

export async function createCategory(input: { name?: string; is_active?: boolean }) {
  const { name, is_active = true } = input;

  if (!name) throw new HttpError(400, "Category name is required.");

  try {
    const q = `
      INSERT INTO cartridge_categories (name, is_active)
      VALUES ($1, $2)
      RETURNING *;
    `;
    const result = await pool.query<CartridgeCategory>(q, [name.trim(), is_active]);
    return result.rows[0];
  } catch (err: any) {
    if (isPgUniqueViolation(err)) {
      throw new HttpError(409, "Category name already exists.");
    }
    throw err;
  }
}

export async function getAllCategories() {
  const q = `SELECT * FROM cartridge_categories ORDER BY name ASC;`;
  const result = await pool.query<CartridgeCategory>(q);
  return result.rows;
}

export async function getCategoryById(id: string) {
  const q = `SELECT * FROM cartridge_categories WHERE id = $1;`;
  const result = await pool.query<CartridgeCategory>(q, [id]);
  if (!result.rows[0]) throw new HttpError(404, "Category not found.");
  return result.rows[0];
}

export async function updateCategory(input: { id: string; name?: string; is_active?: boolean }) {
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
      if (typeof is_active !== "boolean") {
        throw new HttpError(400, "is_active must be a boolean.");
      }
      updates.push(`is_active = $${paramIndex++}`);
      values.push(is_active);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const q = `
      UPDATE cartridge_categories
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *;
    `;

    const result = await pool.query<CartridgeCategory>(q, values);
    if (!result.rows[0]) throw new HttpError(404, "Category not found.");
    return result.rows[0];
  } catch (err: any) {
    if (isPgUniqueViolation(err)) {
      throw new HttpError(409, "Category name already exists.");
    }
    throw err;
  }
}   

export async function deleteCategory(id: string) {
  try {
    const q = `DELETE FROM cartridge_categories WHERE id = $1 RETURNING *;`;
    const result = await pool.query<CartridgeCategory>(q, [id]);
    if (!result.rows[0]) throw new HttpError(404, "Category not found.");
    return { message: "Category deleted successfully." };
  } catch (err: any) {
    if (isPgForeignKeyViolation(err)) {
      throw new HttpError(400, "Cannot delete category with associated cartridges.");
    }
    throw err;
  }
}   