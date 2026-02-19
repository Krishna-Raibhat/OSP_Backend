-- Add unique constraint on serial numbers to prevent duplicates
-- This ensures each license serial number is unique across all orders

-- For software_order_items
CREATE UNIQUE INDEX IF NOT EXISTS idx_software_order_items_serial_unique 
ON software_order_items (serial_number) 
WHERE serial_number IS NOT NULL;

-- For cartridge_order_items (if it exists)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cartridge_order_items_serial_unique 
ON cartridge_order_items (serial_number) 
WHERE serial_number IS NOT NULL;

-- Note: We use partial index (WHERE serial_number IS NOT NULL) 
-- to allow multiple NULL values (for orders not yet fulfilled)
