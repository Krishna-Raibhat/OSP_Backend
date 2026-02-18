-- ============================================
-- Add Serial Number and Barcode to Cartridge Order Items
-- ============================================

-- Add serial_number and barcode_value columns to cartridge_order_items
ALTER TABLE cartridge_order_items 
  ADD COLUMN IF NOT EXISTS serial_number VARCHAR(255) NULL;

ALTER TABLE cartridge_order_items 
  ADD COLUMN IF NOT EXISTS barcode_value VARCHAR(255) NULL;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_cartridge_order_items_serial ON cartridge_order_items(serial_number);
CREATE INDEX IF NOT EXISTS idx_cartridge_order_items_barcode ON cartridge_order_items(barcode_value);

-- Verify columns
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'cartridge_order_items' 
  AND column_name IN ('serial_number', 'barcode_value');
