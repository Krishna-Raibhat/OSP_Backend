-- Migration: Add category to software brands
-- Date: 2026-02-19

-- Add category_id to software_brands table
ALTER TABLE software_brands 
ADD COLUMN category_id UUID REFERENCES software_categories(id) ON DELETE SET NULL;

-- Add index for better performance
CREATE INDEX idx_software_brands_category ON software_brands(category_id);
