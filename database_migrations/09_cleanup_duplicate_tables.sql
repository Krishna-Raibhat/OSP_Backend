-- ============================================
-- Cleanup Duplicate and Unused Tables
-- ============================================

-- Drop duplicate singular tables (we use plural versions)
DROP TABLE IF EXISTS cartridge_order_item CASCADE;
DROP TABLE IF EXISTS software_order_item CASCADE;

-- Drop unused inventory table (not implemented in code)
DROP TABLE IF EXISTS cartridge_inventory_units CASCADE;

-- Verify remaining tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND (table_name LIKE 'cartridge_%' OR table_name LIKE 'software_%')
ORDER BY table_name;
