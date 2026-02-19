-- Migration: Add quantity (stock/inventory) to cartridge products
-- Date: 2026-02-19

-- Add quantity column to cartridge_products table
ALTER TABLE cartridge_products 
ADD COLUMN quantity INTEGER DEFAULT 0 NOT NULL;

-- Add index for better performance when checking stock
CREATE INDEX idx_cartridge_products_quantity ON cartridge_products(quantity);

-- Add comment
COMMENT ON COLUMN cartridge_products.quantity IS 'Available stock/inventory quantity';
