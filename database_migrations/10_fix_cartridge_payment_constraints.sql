-- ============================================
-- Fix Cartridge Payment Constraints
-- ============================================

-- Drop old constraint if exists
ALTER TABLE cartridge_payments 
  DROP CONSTRAINT IF EXISTS cartridge_payment_logic;

-- Recreate with correct logic
-- Allow COD with null gateway, or gateway payment with gateway value
ALTER TABLE cartridge_payments 
  ADD CONSTRAINT cartridge_payment_logic 
  CHECK (
    (payment_type = 'cod' AND gateway IS NULL) OR
    (payment_type = 'manual' AND gateway IS NULL) OR
    (payment_type = 'gateway' AND gateway IS NOT NULL)
  );

-- Verify constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'cartridge_payments'::regclass 
  AND conname = 'cartridge_payment_logic';
