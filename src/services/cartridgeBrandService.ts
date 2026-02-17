import { pool } from "../config/db";
import { HttpError, isPgUniqueViolation, isPgForeignKeyViolation } from "../utils/errors";
import type { CartridgeBrand } from "../models/cartridgeModels";

export const CartridgeBrandService = {

  async createCartridgeBrand(name: string) {
    if (!name) throw new HttpError(400, "Brand name is required.");

    try {
      const q = `
        INSERT INTO cartridge_brands (name)
        VALUES ($1)
        RETURNING *;
      `;
      const result = await pool.query<CartridgeBrand>(q, [name.trim()]);
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

  async updateCartridgeBrand(id: string, data: { name: string; is_active: boolean }) {
    const { name, is_active } = data;
    if (!name && typeof is_active !== "boolean") {
      throw new HttpError(400, "Any one of name or is_active is required.");
    }

    try {
      const q = `
        UPDATE cartridge_brands
        SET name = COALESCE($1, name),
            is_active = COALESCE($2, is_active),
            updated_at = NOW()
        WHERE id = $3
        RETURNING *;
      `;  
      const result = await pool.query<CartridgeBrand>(q, [name?.trim(), is_active, id]);
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

  // // Create a new cartridge brand
  // async createCartridgeBrand(name: string) {
  //   const result = await pool.query(
  //     `INSERT INTO cartridge_brands (name) VALUES ($1) RETURNING *`,
  //     [name],
  //   );
  //   return result.rows[0];
  // },

  // // Get all cartridge brands
  // async getAllCartridgeBrands() {
  //   const result = await pool.query(
  //     `SELECT * FROM cartridge_brands ORDER BY created_at DESC`,
  //   );
  //   return result.rows;
  // },

  // // Get a cartridge brand by ID
  // async getCartridgeBrandById(id: string) {
  //   const result = await pool.query(
  //     `SELECT * FROM cartridge_brands WHERE id = $1`,
  //     [id],
  //   );
  //   return result.rows[0];
  // },

  // // Update a cartridge brand
  // async updateCartridgeBrand(
  //   id: string,
  //   data: { name: string; is_active: boolean },
  // ) {
  //   const result = await pool.query(
  //     `UPDATE cartridge_brands SET name = $1, is_active = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
  //     [data.name, data.is_active, id],
  //   );
  //   return result.rows[0];
  // },

  // // Delete a cartridge brand
  // async deleteCartridgeBrand(id: string) {
  //   await pool.query(`DELETE FROM cartridge_brands WHERE id = $1`, [id]);
  //   return true;
  // },
};
