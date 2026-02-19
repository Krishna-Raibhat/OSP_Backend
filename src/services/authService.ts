import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import { pool } from "../config/db";
import { HttpError, isPgUniqueViolation } from "../utils/errors";
import { env } from "../utils/env";
import type { UserRole, UserRow } from "../models/userModel";

/* ---------- helpers ---------- */
function isEmailValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Nepal 10 digits example; change if you want different rule
function isPhoneValid(phone: string): boolean {
  return /^[0-9]{10}$/.test(phone);
}

function validatePassword(password: string): void {
  if (password.length < 7) {
    throw new HttpError(400, "Password must be at least 7 characters long.");
  }
  if (!/^[A-Z]/.test(password)) {
    throw new HttpError(400, "Password must start with a capital letter.");
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    throw new HttpError(400, "Password must contain at least one special character.");
  }
}

export function signToken(
  userId: string,
  email: string,
  role: UserRole
): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  };

  return jwt.sign(
    { userId, email, role },
    env.JWT_SECRET,
    options
  );
}

/* ---------- REGISTER ---------- */
export async function registerUser(input: {
  full_name?: string;
  email?: string;
  phone?: string;
  password?: string;
  role?: UserRole; // allow only if you want
}) {
  try {
    const { full_name, email, phone, password } = input;
    const role: UserRole = input.role ?? "user";

    if (!full_name) throw new HttpError(400, "Full name is required.");
    if (!email) throw new HttpError(400, "Email is required.");
    if (!password) throw new HttpError(400, "Password is required.");

    // Clean and normalize email
    const cleanEmail = email.trim().toLowerCase();

    if (!isEmailValid(cleanEmail)) throw new HttpError(400, "Invalid email format.");
    if (phone && !isPhoneValid(phone)) {
      throw new HttpError(400, "Phone number must be exactly 10 digits.");
    }

    if (!["admin", "user", "distributor"].includes(role)) {
      throw new HttpError(400, "Invalid role.");
    }

    validatePassword(password);

    const hashedPassword = await bcrypt.hash(password, 10);

    const q = `
      INSERT INTO users (full_name, phone, email, password_hash, role, status)
      VALUES ($1, $2, $3, $4, $5, 'active')
      RETURNING id, full_name, phone, email, role, status, created_at, updated_at;
    `;

    const result = await pool.query<UserRow>(q, [
      full_name.trim(),
      phone ?? null,
      cleanEmail,
      hashedPassword,
      role,
    ]);

    const user = result.rows[0];
    const token = signToken(user.id, user.email, user.role);

    return {
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        status: user.status,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    };
  } catch (err: any) {
    if (err instanceof HttpError) throw err;

    if (isPgUniqueViolation(err)) {
      const detail = String(err.detail || "");
      if (detail.includes("(email)")) throw new HttpError(409, "Email already exists.");
      if (detail.includes("(phone)")) throw new HttpError(409, "Phone already exists.");
      throw new HttpError(409, "Duplicate value already exists.");
    }

    throw err;
  }
}

/* ---------- LOGIN ---------- */
export async function loginUser(input: { email?: string; password?: string }) {
  const { email, password } = input;

  if (!email) throw new HttpError(400, "Email is required.");
  if (!password) throw new HttpError(400, "Password is required.");

  // Clean and normalize email
  const cleanEmail = email.trim().toLowerCase();

  const q = `
    SELECT id, full_name, phone, email, password_hash, role, status, created_at, updated_at
    FROM users
    WHERE email = $1
    LIMIT 1;
  `;

  const result = await pool.query<UserRow>(q, [cleanEmail]);
  const user = result.rows[0];

  if (!user) throw new HttpError(401, "Invalid email or password.");

  if (user.status !== "active") {
    throw new HttpError(403, "Account is suspended.");
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) throw new HttpError(401, "Invalid email or password.");

  const token = signToken(user.id, user.email, user.role);

  return {
    token,
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
    },
  };
}

/* ---------- GET PROFILE ---------- */
export async function getUserProfile(userId: string) {
  const q = `
    SELECT id, full_name, phone, email, role, status, created_at, updated_at
    FROM users
    WHERE id = $1
    LIMIT 1;
  `;

  const result = await pool.query<UserRow>(q, [userId]);
  const user = result.rows[0];

  if (!user) throw new HttpError(404, "User not found.");

  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

/* ---------- CHANGE PASSWORD ---------- */
export async function changePassword(input: {
  userId: string;
  oldPassword?: string;
  newPassword?: string;
}) {
  const { userId, oldPassword, newPassword } = input;

  if (!oldPassword) throw new HttpError(400, "Old password is required.");
  if (!newPassword) throw new HttpError(400, "New password is required.");

  validatePassword(newPassword);

  const q = `
    SELECT id, password_hash
    FROM users
    WHERE id = $1
    LIMIT 1;
  `;

  const result = await pool.query<UserRow>(q, [userId]);
  const user = result.rows[0];

  if (!user) throw new HttpError(404, "User not found.");

  const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
  if (!isMatch) throw new HttpError(401, "Old password is incorrect.");

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  const updateQ = `
    UPDATE users
    SET password_hash = $1, updated_at = NOW()
    WHERE id = $2;
  `;

  await pool.query(updateQ, [hashedPassword, userId]);

  return { message: "Password changed successfully." };
}

/* ---------- GET ALL USERS BY ROLE ---------- */
export async function getUsersByRole(role?: string) {
  // Validate role if provided
  const allowedRoles = new Set(["admin", "user", "distributor"]);
  if (role && !allowedRoles.has(role)) {
    throw new HttpError(400, "Invalid role. Must be one of: admin, user, distributor.");
  }

  let q = `
    SELECT id, full_name, phone, email, role, status, created_at, updated_at
    FROM users
  `;
  
  const params: any[] = [];
  
  if (role) {
    q += ` WHERE role = $1`;
    params.push(role);
  }
  
  q += ` ORDER BY created_at DESC;`;
  
  const result = await pool.query<UserRow>(q, params);
  
  return result.rows.map(user => ({
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    created_at: user.created_at,
    updated_at: user.updated_at,
  }));
}

/* ---------- UPDATE PROFILE ---------- */
export async function updateUserProfile(input: {
  userId: string;
  full_name?: string;
  phone?: string;
}) {
  const { userId, full_name, phone } = input;

  if (!full_name && !phone) {
    throw new HttpError(400, "At least one field (full_name or phone) is required.");
  }

  if (phone && !isPhoneValid(phone)) {
    throw new HttpError(400, "Phone number must be exactly 10 digits.");
  }

  try {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (full_name) {
      updates.push(`full_name = $${paramIndex++}`);
      values.push(full_name.trim());
    }

    if (phone) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(phone);
    }

    updates.push(`updated_at = NOW()`);
    values.push(userId);

    const q = `
      UPDATE users
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING id, full_name, phone, email, role, status, created_at, updated_at;
    `;

    const result = await pool.query<UserRow>(q, values);
    const user = result.rows[0];

    if (!user) throw new HttpError(404, "User not found.");

    return {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  } catch (err: any) {
    if (err instanceof HttpError) throw err;

    if (isPgUniqueViolation(err)) {
      const detail = String(err.detail || "");
      if (detail.includes("(phone)")) throw new HttpError(409, "Phone already exists.");
      throw new HttpError(409, "Duplicate value already exists.");
    }

    throw err;
  }
}