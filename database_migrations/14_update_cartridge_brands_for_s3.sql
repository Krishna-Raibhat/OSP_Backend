-- Migration: Update cartridge_brands table to use S3 with thumbnail and original URLs
-- Date: 2026-02-19

-- Add new columns for S3 paths
ALTER TABLE cartridge_brands 
ADD COLUMN thumbnail_url VARCHAR(500),
ADD COLUMN original_url VARCHAR(500);

-- Copy existing img_url to original_url (if you have existing data)
UPDATE cartridge_brands 
SET original_url = img_url 
WHERE img_url IS NOT NULL;

-- Drop old img_url column
ALTER TABLE cartridge_brands 
DROP COLUMN img_url;

-- Add indexes for better performance
CREATE INDEX idx_cartridge_brands_thumbnail ON cartridge_brands(thumbnail_url);
CREATE INDEX idx_cartridge_brands_original ON cartridge_brands(original_url);
