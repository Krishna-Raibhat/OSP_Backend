-- Add constraint to ensure only one active cart per user
-- This prevents race conditions when creating carts

-- Create partial unique index: only one active cart per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_software_carts_user_active 
ON software_carts (user_id) 
WHERE status = 'active';

-- Note: The UNIQUE(cart_id, software_plan_id) constraint already exists in software_cart_items
-- from migration 05, which prevents duplicate items in the same cart
