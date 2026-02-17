-- ============================================
-- Migration: Add COD Payment Support
-- ============================================

-- Step 1: Check if payment_type column exists and what type it is
-- If it's an ENUM, we need to handle it differently

-- Option A: If payment_type is VARCHAR/TEXT (recommended approach)
-- Just update the check constraint or add values

-- Option B: If payment_type is ENUM, we need to add new value
-- First, check your current setup. If you have ENUM:

-- Add 'cod' to payment_type if using ENUM
-- Note: This only works if payment_type is defined as an ENUM type
-- If you get an error, it means you're using VARCHAR, which is fine - skip this
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_type_enum') THEN
        ALTER TYPE payment_type_enum ADD VALUE IF NOT EXISTS 'cod';
    END IF;
END $$;

-- Add 'pending' to payment status if using ENUM
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status_enum') THEN
        ALTER TYPE payment_status_enum ADD VALUE IF NOT EXISTS 'pending';
    END IF;
END $$;

-- Step 2: If you're using VARCHAR (most common), no type changes needed
-- The application will handle the values

-- Step 3: Update any existing check constraints to allow new values
-- Drop old constraint if exists
ALTER TABLE software_payments 
DROP CONSTRAINT IF EXISTS chk_payment_type;

-- Add new constraint with COD support
ALTER TABLE software_payments 
ADD CONSTRAINT chk_payment_type 
CHECK (payment_type IN ('gateway', 'manual', 'cod'));

-- Drop old status constraint if exists
ALTER TABLE software_payments 
DROP CONSTRAINT IF EXISTS chk_payment_status;

-- Add new constraint with pending status
ALTER TABLE software_payments 
ADD CONSTRAINT chk_payment_status 
CHECK (status IN ('initiated', 'success', 'failed', 'pending'));

-- Step 4: Create index for faster COD payment queries
CREATE INDEX IF NOT EXISTS idx_software_payments_type_status 
ON software_payments(payment_type, status);

-- Step 5: Create index for pending COD payments lookup
CREATE INDEX IF NOT EXISTS idx_software_payments_cod_pending 
ON software_payments(payment_type, status) 
WHERE payment_type = 'cod' AND status = 'pending';

-- Verify the changes
SELECT 
    'Payment types supported:' as info,
    string_agg(DISTINCT payment_type, ', ') as types
FROM software_payments
UNION ALL
SELECT 
    'Payment statuses supported:' as info,
    string_agg(DISTINCT status, ', ') as types
FROM software_payments;

-- Show current constraints
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'software_payments'::regclass
AND contype = 'c';
