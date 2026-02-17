import { pool } from "../config/db";

export const CartridgeBrandService = {

  // Create a new cartridge brand
  async createCartridgeBrand(name: string) {
    const result = await pool.query(
      `INSERT INTO cartridge_brands (name) VALUES ($1) RETURNING *`,
      [name],
    );
    return result.rows[0];
  },

  // Get all cartridge brands
  async getAllCartridgeBrands() {
    const result = await pool.query(
      `SELECT * FROM cartridge_brands ORDER BY created_at DESC`,
    );
    return result.rows;
  },

  // Get a cartridge brand by ID
  async getCartridgeBrandById(id: string) {
    const result = await pool.query(
      `SELECT * FROM cartridge_brands WHERE id = $1`,
      [id],
    );
    return result.rows[0];
  },

  // Update a cartridge brand
  async updateCartridgeBrand(
    id: string,
    data: { name: string; is_active: boolean },
  ) {
    const result = await pool.query(
      `UPDATE cartridge_brands SET name = $1, is_active = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
      [data.name, data.is_active, id],
    );
    return result.rows[0];
  },

  // Delete a cartridge brand
  async deleteCartridgeBrand(id: string) {
    await pool.query(`DELETE FROM cartridge_brands WHERE id = $1`, [id]);
    return true;
  },
};
