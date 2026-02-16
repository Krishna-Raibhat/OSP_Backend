export type UserRole = "admin" | "user" | "distributor";
export type UserStatus = "active" | "suspended";

export type UserRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  password_hash: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
};
