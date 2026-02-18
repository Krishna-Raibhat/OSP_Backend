-- Add activation fields to software_order_items table
ALTER TABLE software_order_items 
ADD COLUMN activation_key VARCHAR(255),
ADD COLUMN start_date TIMESTAMP,
ADD COLUMN expiry_date TIMESTAMP;

-- Add index for activation_key lookups
CREATE INDEX idx_software_order_items_activation_key ON software_order_items(activation_key);
