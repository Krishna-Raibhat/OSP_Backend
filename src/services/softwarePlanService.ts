import { pool } from "../config/db";
import { HttpError } from "../utils/errors";
import type { SoftwarePlan } from "../models/softwareModels";

export async function createPlan(input: {
  software_product_id?: string;
  plan_name?: string;
  duration_type?: "monthly" | "yearly";
  price?: number;
  special_price?: number;
  features?: string;
  is_active?: boolean;
}) {
  const {
    software_product_id,
    plan_name,
    duration_type,
    price,
    special_price,
    features,
    is_active = true,
  } = input;

  if (!software_product_id) throw new HttpError(400, "Product ID is required.");
  if (!plan_name) throw new HttpError(400, "Plan name is required.");
  if (!duration_type) throw new HttpError(400, "Duration type is required.");
  if (price === undefined || price === null) throw new HttpError(400, "Price is required.");

  const q = `
    INSERT INTO software_plans (software_product_id, plan_name, duration_type, price, special_price, features, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;
  const result = await pool.query<SoftwarePlan>(q, [
    software_product_id,
    plan_name.trim(),
    duration_type,
    price,
    special_price ?? null,
    features ?? null,
    is_active,
  ]);
  return result.rows[0];
}

export async function getAllPlans() {
  const q = `SELECT * FROM software_plans ORDER BY created_at DESC;`;
  const result = await pool.query<SoftwarePlan>(q);
  return result.rows;
}

export async function getPlanById(id: string) {
  const q = `SELECT * FROM software_plans WHERE id = $1;`;
  const result = await pool.query<SoftwarePlan>(q, [id]);
  if (!result.rows[0]) throw new HttpError(404, "Plan not found.");
  return result.rows[0];
}

export async function getPlansByProduct(software_product_id: string) {
  const q = `SELECT * FROM software_plans WHERE software_product_id = $1 ORDER BY price ASC;`;
  const result = await pool.query<SoftwarePlan>(q, [software_product_id]);
  return result.rows;
}

export async function updatePlan(input: {
  id: string;
  plan_name?: string;
  duration_type?: "monthly" | "yearly";
  price?: number;
  special_price?: number;
  features?: string;
  is_active?: boolean;
}) {
  const { id, plan_name, duration_type, price, special_price, features, is_active } = input;

  if (
    !plan_name &&
    !duration_type &&
    price === undefined &&
    special_price === undefined &&
    features === undefined &&
    is_active === undefined
  ) {
    throw new HttpError(400, "At least one field is required.");
  }

  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (plan_name) {
    updates.push(`plan_name = $${paramIndex++}`);
    values.push(plan_name.trim());
  }
  if (duration_type) {
    updates.push(`duration_type = $${paramIndex++}`);
    values.push(duration_type);
  }
  if (price !== undefined) {
    updates.push(`price = $${paramIndex++}`);
    values.push(price);
  }
  if (special_price !== undefined) {
    updates.push(`special_price = $${paramIndex++}`);
    values.push(special_price ?? null);
  }
  if (features !== undefined) {
    updates.push(`features = $${paramIndex++}`);
    values.push(features ?? null);
  }
  if (is_active !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    values.push(is_active);
  }

  updates.push(`updated_at = NOW()`);
  values.push(id);

  const q = `
    UPDATE software_plans
    SET ${updates.join(", ")}
    WHERE id = $${paramIndex}
    RETURNING *;
  `;

  const result = await pool.query<SoftwarePlan>(q, values);
  if (!result.rows[0]) throw new HttpError(404, "Plan not found.");
  return result.rows[0];
}

export async function deletePlan(id: string) {
  const q = `DELETE FROM software_plans WHERE id = $1 RETURNING *;`;
  const result = await pool.query<SoftwarePlan>(q, [id]);
  if (!result.rows[0]) throw new HttpError(404, "Plan not found.");
  return { message: "Plan deleted successfully." };
}
