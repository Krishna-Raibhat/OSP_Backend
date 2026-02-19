import { pool } from "../config/db";
import { HttpError, isPgUniqueViolation, isPgForeignKeyViolation } from "../utils/errors";
import type { CartridgeBrand } from "../models/cartridgeModels";

export const CartridgeBrandService = {

  async createCartridgeBrand(name: string, img_url?: string, is_active?: boolean) {
    if (!name) throw new HttpError(400, "Brand name is required.");

    try {
      const q = `
        INSERT INTO cartridge_brands (name, img_url, is_active)
        VALUES ($1, $2, $3)
        RETURNING *;
      `;
      const result = await pool.query<CartridgeBrand>(q, [name.trim(), img_url ?? null, is_active ?? true]);
      return result.rows[0];
    } catch (err: any) {
      if (isPgUniqueViolation(err)) {
        throw new HttpError(409, "Brand name already exists.");
      }
      throw err;
    }
  },

  async getAllCartridgeBrands() {
    const q = `SELECT * FROM cartridge_brands ORDER BY created_at DESC;`;
    const result = await pool.query<CartridgeBrand>(q);
    return result.rows;
  },

  async getCartridgeBrandById(id: string) {
    const q = `SELECT * FROM cartridge_brands WHERE id = $1;`;
    const result = await pool.query<CartridgeBrand>(q, [id]);
    if (!result.rows[0]) throw new HttpError(404, "Brand not found.");
    return result.rows[0];
  },

  async updateCartridgeBrand(id: string, data: { name: string; img_url?: string | null; is_active: boolean }) {
    const { name, img_url, is_active } = data;
    if (!name && typeof is_active !== "boolean" && img_url === undefined) {
      throw new HttpError(400, "Any one of name, img_url or is_active is required.");
    }

    try {
      const q = `
        UPDATE cartridge_brands
        SET name = COALESCE($1, name),
            img_url = COALESCE($2, img_url),
            is_active = COALESCE($3, is_active),
            updated_at = NOW()
        WHERE id = $4
        RETURNING *;
      `;  
      const result = await pool.query<CartridgeBrand>(q, [name?.trim(), img_url ?? null, is_active, id]);
      if (!result.rows[0]) throw new HttpError(404, "Brand not found.");
      return result.rows[0];
    } catch (err: any) {
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
      if (isPgForeignKeyViolation(err)) {
        throw new HttpError(400, "Cannot delete brand with associated cartridges.");
      }
      throw err;
    }
  },    

  async  getBrandByName(name: string) {
    const q = `SELECT * FROM cartridge_brands WHERE name = $1;`;
    const result = await pool.query<CartridgeBrand>(q, [name.trim()]);
    if (!result.rows[0]) throw new HttpError(404, "Brand not found.");
    return result.rows[0];
  }

};
