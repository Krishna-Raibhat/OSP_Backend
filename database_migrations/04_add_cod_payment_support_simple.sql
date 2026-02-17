-- ============================================
-- Simple Migration: Add COD Payment Support
-- Run these queries one by one
-- ============================================

-- 1. Update payment_type constraint to include 'cod'
ALTER TABLE software_payments 
DROP CONSTRAINT IF EXISTS chk_payment_type;

ALTER TABLE software_payments 
ADD CONSTRAINT chk_payment_type 
CHECK (payment_type IN ('gateway', 'manual', 'cod'));

-- 2. Update payment status constraint to include 'pending'
ALTER TABLE software_payments 
DROP CONSTRAINT IF EXISTS chk_payment_status;

ALTER TABLE software_payments 
ADD CONSTRAINT chk_payment_status 
CHECK (status IN ('initiated', 'success', 'failed', 'pending'));

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_software_payments_type_status 
ON software_payments(payment_type, status);

CREATE INDEX IF NOT EXISTS idx_software_payments_cod_pending 
ON software_payments(payment_type, status) 
WHERE payment_type = 'cod' AND status = 'pending';

-- 4. Verify changes (optional - just to check)
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'software_payments'::regclass
AND contype = 'c'
AND conname IN ('chk_payment_type', 'chk_payment_status');
