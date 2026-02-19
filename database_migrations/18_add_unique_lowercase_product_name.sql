-- Add unique index on lowercase product name for case-insensitive uniqueness
-- This ensures "Microsoft Office" and "microsoft office" cannot both exist

CREATE UNIQUE INDEX IF NOT EXISTS idx_software_products_name_lower 
ON software_products (LOWER(name));
