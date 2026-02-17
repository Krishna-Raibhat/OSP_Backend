-- ============================================
-- Migration: Remove issued_at and expires_at columns
-- ============================================
-- These columns are not needed for the license management system

-- Drop issued_at column from software_order_items
ALTER TABLE software_order_items 
DROP COLUMN IF EXISTS issued_at;

-- Drop expires_at column from software_order_items
ALTER TABLE software_order_items 
DROP COLUMN IF EXISTS expires_at;

-- Verify the columns are removed
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'software_order_items'
ORDER BY ordinal_position;
