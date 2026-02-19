import { pool } from "../config/db";
import { HttpError, isPgUniqueViolation, isPgForeignKeyViolation } from "../utils/errors";
import type { CartridgeBrand } from "../models/cartridgeModels";

export const CartridgeBrandService = {

  async createCartridgeBrand(input: { 
    name: string; 
    thumbnail_url?: string; 
    original_url?: string; 
    is_active?: boolean 
  }) {
    const { name, thumbnail_url, original_url, is_active = true } = input;

    if (!name) throw new HttpError(400, "Brand name is required.");

    try {
      const q = `
        INSERT INTO cartridge_brands (name, thumbnail_url, original_url, is_active)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
      `;
      const result = await pool.query<CartridgeBrand>(q, [
        name.trim(), 
        thumbnail_url ?? null, 
        original_url ?? null, 
        is_active
      ]);
      return result.rows[0];
    } catch (err: any) {
      if (isPgUniqueViolation(err)) {
        throw new HttpError(409, "Brand name already exists.");
      }
      throw err;
    }
  },

  async getAllCartridgeBrands() {
    const q = `SELECT * FROM cartridge_brands ORDER BY name ASC;`;
    const result = await pool.query<CartridgeBrand>(q);
    return result.rows;
  },

  async getCartridgeBrandById(id: string) {
    const q = `SELECT * FROM cartridge_brands WHERE id = $1;`;
    const result = await pool.query<CartridgeBrand>(q, [id]);
    if (!result.rows[0]) throw new HttpError(404, "Brand not found.");
    return result.rows[0];
  },

  async updateCartridgeBrand(input: { 
    id: string; 
    name?: string; 
    thumbnail_url?: string; 
    original_url?: string; 
    is_active?: boolean 
  }) {
    const { id, name, thumbnail_url, original_url, is_active } = input;

    if (!name && thumbnail_url === undefined && original_url === undefined && is_active === undefined) {
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
        UPDATE cartridge_brands
        SET ${updates.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING *;
      `;

      const result = await pool.query<CartridgeBrand>(q, values);
      if (!result.rows[0]) throw new HttpError(404, "Brand not found.");
      return result.rows[0];
    } catch (err: any) {
      if (err instanceof HttpError) throw err;
      if (isPgUniqueViolation(err)) {
        throw new HttpError(409, "Brand name already exists.");
      }
      throw err;
    }
  },

  async deleteCartridgeBrand(id: string) {
    try {
      const q = `DELETE FROM cartridge_brands WHERE id = $1 RETURNING *;`;
      const result = await pool.query<CartridgeBrand>(q, [id]);
      if (!result.rows[0]) throw new HttpError(404, "Brand not found.");
      return { message: "Brand deleted successfully." };
    } catch (err: any) {
      if (err instanceof HttpError) throw err;
      if (isPgForeignKeyViolation(err)) {
        throw new HttpError(400, "Cannot delete brand with associated cartridges.");
      }
      throw err;
    }
  },    

  async getBrandByName(name: string) {
    const q = `SELECT * FROM cartridge_brands WHERE name = $1;`;
    const result = await pool.query<CartridgeBrand>(q, [name.trim()]);
    if (!result.rows[0]) throw new HttpError(404, "Brand not found.");
    return result.rows[0];
  }

};
