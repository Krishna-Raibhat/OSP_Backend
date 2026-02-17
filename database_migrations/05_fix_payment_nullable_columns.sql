-- ============================================
-- Migration: Fix Payment Table Nullable Columns
-- ============================================
-- Make gateway and gateway_txn_id nullable for COD and manual payments

-- Make gateway column nullable
ALTER TABLE software_payments 
ALTER COLUMN gateway DROP NOT NULL;

-- Make gateway_txn_id column nullable (if it has NOT NULL constraint)
ALTER TABLE software_payments 
ALTER COLUMN gateway_txn_id DROP NOT NULL;

-- Drop old check constraints that might be blocking COD
ALTER TABLE software_payments 
DROP CONSTRAINT IF EXISTS software_gateway_payments_payment_type_check;

ALTER TABLE software_payments 
DROP CONSTRAINT IF EXISTS software_gateway_payments_status_check;

ALTER TABLE software_payments 
DROP CONSTRAINT IF EXISTS software_payment_logic;

-- Drop existing constraints if they exist
ALTER TABLE software_payments 
DROP CONSTRAINT IF EXISTS chk_payment_type;

ALTER TABLE software_payments 
DROP CONSTRAINT IF EXISTS chk_payment_status;

-- Add new constraints with COD support
ALTER TABLE software_payments 
ADD CONSTRAINT chk_payment_type 
CHECK (payment_type IN ('gateway', 'manual', 'cod'));

ALTER TABLE software_payments 
ADD CONSTRAINT chk_payment_status 
CHECK (status IN ('initiated', 'success', 'failed', 'pending'));

-- Add updated payment logic constraint that supports COD
ALTER TABLE software_payments 
ADD CONSTRAINT software_payment_logic 
CHECK (
  (payment_type = 'gateway' AND gateway IS NOT NULL) OR 
  (payment_type = 'manual') OR 
  (payment_type = 'cod')
);

-- Verify the changes
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'software_payments'
AND column_name IN ('gateway', 'gateway_txn_id', 'manual_reference')
ORDER BY column_name;
