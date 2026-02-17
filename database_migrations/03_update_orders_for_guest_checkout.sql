-- Update software_orders table to support guest checkout with billing info

-- Make buyer_user_id nullable (for guest orders)
ALTER TABLE software_orders 
ALTER COLUMN buyer_user_id DROP NOT NULL;

-- Add billing information columns
ALTER TABLE software_orders 
ADD COLUMN billing_full_name VARCHAR(255) NOT NULL DEFAULT '',
ADD COLUMN billing_email VARCHAR(255) NOT NULL DEFAULT '',
ADD COLUMN billing_phone VARCHAR(50) NOT NULL DEFAULT '',
ADD COLUMN billing_address TEXT NOT NULL DEFAULT '';

-- Remove defaults after adding columns (they were just for migration)
ALTER TABLE software_orders 
ALTER COLUMN billing_full_name DROP DEFAULT,
ALTER COLUMN billing_email DROP DEFAULT,
ALTER COLUMN billing_phone DROP DEFAULT,
ALTER COLUMN billing_address DROP DEFAULT;

-- Add index for email lookups (guest order tracking)
CREATE INDEX idx_software_orders_billing_email ON software_orders(billing_email);

-- Add index for user orders
CREATE INDEX idx_software_orders_buyer_user_id ON software_orders(buyer_user_id);

-- Add timestamps columns to order_items if not exists
ALTER TABLE software_order_items 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
