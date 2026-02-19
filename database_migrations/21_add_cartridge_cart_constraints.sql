-- Add constraints for cartridge carts to prevent race conditions

-- ⚠️ CRITICAL: Ensure only one active cart per user
-- This prevents multiple active carts and enables the cart creation logic in code
CREATE UNIQUE INDEX IF NOT EXISTS idx_cartridge_carts_user_active 
ON cartridge_carts (user_id) 
WHERE status = 'active';

-- ⚠️ CRITICAL: Ensure unique items in cart (prevent duplicate products in same cart)
-- This is REQUIRED for the ON CONFLICT clause in UPSERT to work
CREATE UNIQUE INDEX IF NOT EXISTS idx_cartridge_cart_items_unique 
ON cartridge_cart_items (cart_id, cartridge_product_id);

-- Note: These constraints work together with the transaction locks in the code
-- to prevent race conditions and ensure data integrity
-- Without these constraints, the code will fail at runtime!
