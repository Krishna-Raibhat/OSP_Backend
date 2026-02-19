/* =========================CARTRIDGE MODELS========================= */

export type CartridgeBrand = {
  id: string;
  name: string;
  thumbnail_url: string | null;
  original_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CartridgeCategory = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CartridgeProduct = {
  id: string;
  brand_id: string;
  category_id: string;
  product_name: string;
  model_number: string;
  description: string | null;
  unit_price: number;
  special_price: number | null;
  quantity: number; // Available stock/inventory
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type CartridgeProductQR = {
  id: string;
  cartridge_product_id: string;
  qr_value: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// Cart models
export type CartridgeCart = {
  id: string;
  user_id: string;
  status: "active" | "checked_out";
  created_at: string;
  updated_at: string;
};

export type CartridgeCartItem = {
  id: string;
  cart_id: string;
  cartridge_product_id: string;
  unit_price: number;
  quantity: number;
  created_at: string;
  updated_at: string;
};

// Order models (with billing info for guest checkout)
export type CartridgeOrder = {
  id: string;
  buyer_user_id: string | null; // Nullable for guest orders
  
  // Billing information
  billing_full_name: string;
  billing_email: string;
  billing_phone: string;
  billing_address: string;
  
  status: "pending" | "paid" | "failed" | "cancelled";
  total: number;
  created_at: string;
  updated_at: string;
};

export type CartridgeOrderItem = {
  id: string;
  order_id: string;
  cartridge_product_id: string;
  quantity: number;
  unit_price: number;
  
  // Generated after payment confirmation
  // Stored as JSON array of serial numbers (one per quantity)
  // Barcodes are generated dynamically from serial numbers (not stored)
  serial_number: string | null; // JSON array: ["CART-SN-...", "CART-SN-..."]
  
  created_at: string;
  updated_at: string;
};

export type CartridgePayment = {
  id: string;
  cartridge_order_id: string;
  payment_type: "gateway" | "manual" | "cod";
  gateway: string | null;
  gateway_txn_id: string | null;
  manual_reference: string | null;
  amount: number;
  status: "initiated" | "success" | "failed" | "pending";
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};
