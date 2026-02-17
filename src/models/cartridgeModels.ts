/* =========================CARTRIDGE MODELS========================= */

export type CartridgeBrand = {
  id: string;
  name: string;
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

export type CartridgeInventoryUnit = {
  id: string;
  cartridge_product_id: string;
  serial_number: string;
  barcode_value: string;
  status: "in_stock" | "reserved" | "sold";
  sold_order_id: string | null;
  sold_to_user_id: string | null;
  sold_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CartridgeOrder = {
  id: string;
  buyer_user_id: string;
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
};

export type CartridgePayment = {
  id: string;
  cartridge_order_id: string;
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
