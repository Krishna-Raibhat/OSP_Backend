/* =========================SOFTWARE MODELS========================= */

export type SoftwareBrand = {
  id: string;
  name: string;
  image_url: string | null;
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
  created_by: string;
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
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SoftwareOrder = {
  id: string;
  buyer_user_id: string;
  status: "pending" | "paid" | "failed" | "cancelled";
  serial_number: string | null;
  barcode_value: string | null;
  issued_at: string | null;
  expires_at: string | null;
  total: number;
  created_at: string;
  updated_at: string;
};

export type SoftwareOrderItem = {
  id: string;
  order_id: string;
  software_plan_id: string;
  unit_price: number;
};

export type SoftwarePayment = {
  id: string;
  software_order_id: string;
  payment_type: "gateway" | "manual";
  gateway: string | null;
  gateway_txn_id: string | null;
  manual_reference: string | null;
  amount: number;
  status: "initiated" | "success" | "failed";
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};
