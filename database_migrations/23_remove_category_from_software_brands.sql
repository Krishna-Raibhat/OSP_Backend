-- Migration 23: Remove category_id column from software_brands table
-- Brands should not have categories - only products have categories

-- Drop the foreign key constraint first (if it exists)
ALTER TABLE software_brands 
DROP CONSTRAINT IF EXISTS software_brands_category_id_fkey;

-- Drop the category_id column
ALTER TABLE software_brands 
DROP COLUMN IF EXISTS category_id;

-- Note: This migration is safe to run even if the column doesn't exist
-- The IF EXISTS clause prevents errors
