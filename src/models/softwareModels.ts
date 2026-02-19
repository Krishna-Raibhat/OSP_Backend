/* =========================SOFTWARE MODELS========================= */

export type SoftwareBrand = {
  id: string;
  name: string;
  category_id: string | null;
  thumbnail_url: string | null;
  original_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SoftwareCategory = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SoftwareProduct = {
  id: string;
  brand_id: string;
  category_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SoftwarePlan = {
  id: string;
  software_product_id: string;
  plan_name: string;
  duration_type: "monthly" | "yearly";
  price: number;
  special_price: number | null;
  features: string | null;
  activation_key: string | null; // Admin sets this
  start_date: string | null; // Admin sets this
  expiry_date: string | null; // Admin sets this
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
export type SoftwareCart = {
  id: string;
  user_id: string;
  status: "active" | "checked_out";
  created_at: string;
  updated_at: string;
};

export type SoftwareCartItem = {
  id: string;
  cart_id: string;
  software_plan_id: string;
  unit_price: number; // Price at time of adding to cart
  quantity: number; // User can add multiple licenses to cart
  created_at: string;
  updated_at: string;
};

export type SoftwareOrder = {
  id: string;
  buyer_user_id: string | null; // ✅ Nullable for guest orders
  
  // Billing information (required for all orders)
  billing_full_name: string;
  billing_email: string;
  billing_phone: string;
  billing_address: string;
  
  status: "pending" | "paid" | "failed" | "cancelled";
  total: number;
  created_at: string;
  updated_at: string;
};

export type SoftwareOrderItem = {
  id: string;
  order_id: string;
  software_plan_id: string;
  unit_price: number;

  // 1 row = 1 license
  // If cart quantity = 5, create 5 separate rows
  // Barcode is generated dynamically from serial_number (not stored)
  serial_number: string | null; // Generated after payment, unique per license
  created_at: string;
  updated_at: string;
};

export type SoftwarePayment = {
  id: string;
  software_order_id: string;
  payment_type: "gateway" | "manual" | "cod"; // ✅ Added COD
  gateway: string | null;
  gateway_txn_id: string | null;
  manual_reference: string | null;
  amount: number;
  status: "initiated" | "success" | "failed" | "pending"; // ✅ Added pending for COD
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};
