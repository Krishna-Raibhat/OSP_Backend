-- ============================================
-- Cartridge Cart, Order, and Payment Tables
-- ============================================

-- 1. Create cartridge_carts table
CREATE TABLE IF NOT EXISTS cartridge_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'checked_out')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Create cartridge_cart_items table
CREATE TABLE IF NOT EXISTS cartridge_cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES cartridge_carts(id) ON DELETE CASCADE,
  cartridge_product_id UUID NOT NULL REFERENCES cartridge_products(id) ON DELETE CASCADE,
  unit_price DECIMAL(10, 2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Update cartridge_orders table (add billing info, make buyer_user_id nullable)
ALTER TABLE cartridge_orders 
  ALTER COLUMN buyer_user_id DROP NOT NULL;

ALTER TABLE cartridge_orders 
  ADD COLUMN IF NOT EXISTS billing_full_name VARCHAR(255) NOT NULL DEFAULT '';

ALTER TABLE cartridge_orders 
  ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255) NOT NULL DEFAULT '';

ALTER TABLE cartridge_orders 
  ADD COLUMN IF NOT EXISTS billing_phone VARCHAR(50) NOT NULL DEFAULT '';

ALTER TABLE cartridge_orders 
  ADD COLUMN IF NOT EXISTS billing_address TEXT NOT NULL DEFAULT '';

-- 4. Create cartridge_order_items table
CREATE TABLE IF NOT EXISTS cartridge_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES cartridge_orders(id) ON DELETE CASCADE,
  cartridge_product_id UUID NOT NULL REFERENCES cartridge_products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL,
  serial_number VARCHAR(255) NULL,
  barcode_value VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. Update cartridge_payments table (add COD and pending status)
ALTER TABLE cartridge_payments 
  DROP CONSTRAINT IF EXISTS cartridge_payments_payment_type_check;

ALTER TABLE cartridge_payments 
  ADD CONSTRAINT cartridge_payments_payment_type_check 
  CHECK (payment_type IN ('gateway', 'manual', 'cod'));

ALTER TABLE cartridge_payments 
  DROP CONSTRAINT IF EXISTS cartridge_payments_status_check;

ALTER TABLE cartridge_payments 
  ADD CONSTRAINT cartridge_payments_status_check 
  CHECK (status IN ('initiated', 'success', 'failed', 'pending'));

-- Make gateway nullable
ALTER TABLE cartridge_payments 
  ALTER COLUMN gateway DROP NOT NULL;

-- 6. Create indexes
CREATE INDEX IF NOT EXISTS idx_cartridge_carts_user_id ON cartridge_carts(user_id);
CREATE INDEX IF NOT EXISTS idx_cartridge_carts_status ON cartridge_carts(status);
CREATE INDEX IF NOT EXISTS idx_cartridge_cart_items_cart_id ON cartridge_cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cartridge_cart_items_product_id ON cartridge_cart_items(cartridge_product_id);
CREATE INDEX IF NOT EXISTS idx_cartridge_orders_buyer_user_id ON cartridge_orders(buyer_user_id);
CREATE INDEX IF NOT EXISTS idx_cartridge_orders_status ON cartridge_orders(status);
CREATE INDEX IF NOT EXISTS idx_cartridge_order_items_order_id ON cartridge_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_cartridge_order_items_product_id ON cartridge_order_items(cartridge_product_id);
CREATE INDEX IF NOT EXISTS idx_cartridge_order_items_serial ON cartridge_order_items(serial_number);
CREATE INDEX IF NOT EXISTS idx_cartridge_order_items_barcode ON cartridge_order_items(barcode_value);
CREATE INDEX IF NOT EXISTS idx_cartridge_payments_order_id ON cartridge_payments(cartridge_order_id);
CREATE INDEX IF NOT EXISTS idx_cartridge_payments_type_status ON cartridge_payments(payment_type, status);

-- Verify tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_name LIKE 'cartridge_%' 
ORDER BY table_name;
