-- Add activation fields to software_plans table (admin sets these)
ALTER TABLE software_plans 
ADD COLUMN activation_key VARCHAR(255),
ADD COLUMN start_date DATE,
ADD COLUMN expiry_date DATE;

-- Add index for activation_key lookups
CREATE INDEX idx_software_plans_activation_key ON software_plans(activation_key);
