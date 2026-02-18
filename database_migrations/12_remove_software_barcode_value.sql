-- ============================================
-- Remove barcode_value column from software_order_items
-- Barcodes are now generated dynamically from serial_number
-- ============================================

ALTER TABLE software_order_items 
  DROP COLUMN IF EXISTS barcode_value;

-- Verify column is removed
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'software_order_items';
