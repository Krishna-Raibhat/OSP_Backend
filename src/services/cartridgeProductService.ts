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
    quantity?: number;
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
    quantity = 0,
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

  // Validate that brand exists and is active
  const brandCheck = await pool.query(
    'SELECT id, name, is_active FROM cartridge_brands WHERE id = $1',
    [brand_id]
  );
  if (!brandCheck.rows[0]) {
    throw new HttpError(404, "Brand not found.");
  }
  if (!brandCheck.rows[0].is_active) {
    throw new HttpError(400, `Brand "${brandCheck.rows[0].name}" is inactive and cannot be used.`);
  }

  // Validate that category exists and is active
  const categoryCheck = await pool.query(
    'SELECT id, name, is_active FROM cartridge_categories WHERE id = $1',
    [category_id]
  );
  if (!categoryCheck.rows[0]) {
    throw new HttpError(404, "Category not found.");
  }
  if (!categoryCheck.rows[0].is_active) {
    throw new HttpError(400, `Category "${categoryCheck.rows[0].name}" is inactive and cannot be used.`);
  }

  // Validate price relationship
  if (unit_price < 0) {
    throw new HttpError(400, "Unit price cannot be negative.");
  }

  if (special_price !== undefined && special_price !== null) {
    if (special_price < 0) {
      throw new HttpError(400, "Special price cannot be negative.");
    }
    if (special_price > unit_price) {
      throw new HttpError(400, "Special price cannot be greater than unit price.");
    }
  }

  try {
    const q = `
      INSERT INTO cartridge_products
        (brand_id, category_id, product_name, model_number, description, unit_price, special_price, quantity, is_active, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
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
      quantity,
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
  try {
  const q = `SELECT p.*, b.name as brand_name, b.original_url as brand_original_url,
  c.name as category_name FROM cartridge_products p LEFT JOIN cartridge_brands b ON p.brand_id = b.id
  LEFT JOIN cartridge_categories c ON p.category_id = c.id ORDER BY p.created_at DESC;`;
  const result = await pool.query<CartridgeProduct>(q);
  return result.rows;}
catch (err) {
  console.error('Error retrieving products:', err);
  throw new HttpError(500, "Failed to retrieve products.");
}
}

export async function getCartridgeProductById(id: string) {
  try{
    
    const q = `SELECT p.*, b.name as brand_name, b.original_url as brand_original_url, 
    c.name as category_name FROM cartridge_products p LEFT JOIN cartridge_brands b ON p.brand_id = b.id
    LEFT JOIN cartridge_categories c ON p.category_id = c.id WHERE p.id = $1;
    `;
    
    const result = await pool.query<CartridgeProduct>(q, [id]);
    if (!result.rows[0]) throw new HttpError(404, "Product not found.");
    return result.rows[0];
  } catch (err) {
    console.error('Error retrieving product by ID:', err);
    throw new HttpError(500, "Failed to retrieve product.");
  }
}

export async function getCartridgeProductsByBrand(brand_id: string) {
  try{

    const q = `SELECT p.*, b.name as brand_name, b.original_url as brand_original_url,
    c.name as category_name FROM cartridge_products p LEFT JOIN cartridge_brands b ON p.brand_id = b.id
    LEFT JOIN cartridge_categories c ON p.category_id = c.id WHERE p.brand_id = $1 ORDER BY p.created_at DESC;
    `;
    const result = await pool.query<CartridgeProduct>(q, [brand_id]);
    return result.rows;
  } catch (err) {
    console.error('Error retrieving products by brand:', err);
    throw new HttpError(500, "Failed to retrieve products by brand.");
  }
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
  quantity?: number;
  is_active?: boolean;
}) {
  const { id, brand_id, category_id, unit_price, special_price, product_name, model_number, description, quantity, is_active } = input;

  if (Object.keys(input).length === 1) { // Only id provided
    throw new HttpError(400, "At least one field is required to update.");
  }

  // Validate brand if being updated
  if (brand_id !== undefined) {
    const brandCheck = await pool.query(
      'SELECT id, name, is_active FROM cartridge_brands WHERE id = $1',
      [brand_id]
    );
    if (!brandCheck.rows[0]) {
      throw new HttpError(404, "Brand not found.");
    }
    if (!brandCheck.rows[0].is_active) {
      throw new HttpError(400, `Brand "${brandCheck.rows[0].name}" is inactive and cannot be used.`);
    }
  }

  // Validate category if being updated
  if (category_id !== undefined) {
    const categoryCheck = await pool.query(
      'SELECT id, name, is_active FROM cartridge_categories WHERE id = $1',
      [category_id]
    );
    if (!categoryCheck.rows[0]) {
      throw new HttpError(404, "Category not found.");
    }
    if (!categoryCheck.rows[0].is_active) {
      throw new HttpError(400, `Category "${categoryCheck.rows[0].name}" is inactive and cannot be used.`);
    }
  }

  // Validate prices if provided
  if (unit_price !== undefined && unit_price < 0) {
    throw new HttpError(400, "Unit price cannot be negative.");
  }

  if (special_price !== undefined && special_price !== null && special_price < 0) {
    throw new HttpError(400, "Special price cannot be negative.");
  }

  // If both prices are provided, validate relationship
  if (unit_price !== undefined && special_price !== undefined && special_price !== null) {
    if (special_price > unit_price) {
      throw new HttpError(400, "Special price cannot be greater than unit price.");
    }
  }

  // If only special_price is being updated, check against existing unit_price
  if (special_price !== undefined && special_price !== null && unit_price === undefined) {
    const existingProduct = await pool.query(
      'SELECT unit_price FROM cartridge_products WHERE id = $1',
      [id]
    );
    if (existingProduct.rows[0]) {
      const existingUnitPrice = parseFloat(existingProduct.rows[0].unit_price);
      if (special_price > existingUnitPrice) {
        throw new HttpError(400, "Special price cannot be greater than unit price.");
      }
    }
  }

  // If only unit_price is being updated, check against existing special_price
  if (unit_price !== undefined && special_price === undefined) {
    const existingProduct = await pool.query(
      'SELECT special_price FROM cartridge_products WHERE id = $1',
      [id]
    );
    if (existingProduct.rows[0] && existingProduct.rows[0].special_price !== null) {
      const existingSpecialPrice = parseFloat(existingProduct.rows[0].special_price);
      if (existingSpecialPrice > unit_price) {
        throw new HttpError(400, "Unit price cannot be less than existing special price.");
      }
    }
  }

  try {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (brand_id !== undefined) {
      updates.push(`brand_id = $${paramIndex++}`);
      values.push(brand_id);
    }
    if (category_id !== undefined) {
      updates.push(`category_id = $${paramIndex++}`);
      values.push(category_id);
    }
    if (product_name !== undefined) {
      updates.push(`product_name = $${paramIndex++}`);
      values.push(product_name);
    }
    if (model_number !== undefined) {
      updates.push(`model_number = $${paramIndex++}`);
      values.push(model_number);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (unit_price !== undefined) {
      updates.push(`unit_price = $${paramIndex++}`);
      values.push(unit_price);
    }
    if (special_price !== undefined) {
      updates.push(`special_price = $${paramIndex++}`);
      values.push(special_price);
    }
    if (quantity !== undefined) {
      updates.push(`quantity = $${paramIndex++}`);
      values.push(quantity);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(is_active);
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

export async  function getProductByQrId(qrId : string) {
  try {
    const q = `SELECT p.*, b.name as brand_name, b.original_url as brand_original_url,
c.name as category_name FROM cartridge_products p LEFT JOIN cartridge_brands b ON p.brand_id = b.id
LEFT JOIN cartridge_categories c ON p.category_id = c.id
INNER JOIN cartridge_product_qr q ON p.id = q.cartridge_product_id
WHERE q.id = $1;
`;
    const result = await pool.query<CartridgeProduct>(q, [qrId]);
    if (!result.rows[0]) throw new HttpError(404, "Product not found for this QR code.");
    return result.rows[0];
  } catch (err) {
    console.error('Error retrieving product by QR code:', err);
    throw new HttpError(500, "Failed to retrieve product by QR code.");
  }
}



