-- Add unique index on lowercase brand name to prevent case-insensitive duplicates
-- This ensures "Microsoft" and "microsoft" cannot both exist

-- Drop existing unique constraint if it exists (case-sensitive)
ALTER TABLE software_brands DROP CONSTRAINT IF EXISTS software_brands_name_key;

-- Create unique index on LOWER(name) for case-insensitive uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS software_brands_name_lower_unique 
ON software_brands (LOWER(name));

-- Note: Since we're now storing names in lowercase in the application code,
-- this index ensures database-level enforcement of uniqueness
