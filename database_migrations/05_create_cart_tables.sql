-- ============================================
-- Create Cart Tables
-- ============================================

-- Create software_carts table
CREATE TABLE IF NOT EXISTS software_carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'checked_out')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create software_cart_items table
CREATE TABLE IF NOT EXISTS software_cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID NOT NULL REFERENCES software_carts(id) ON DELETE CASCADE,
    software_plan_id UUID NOT NULL REFERENCES software_plans(id) ON DELETE CASCADE,
    unit_price NUMERIC(12, 2) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cart_id, software_plan_id) -- Prevent duplicate items in same cart
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_software_carts_user_id ON software_carts(user_id);
CREATE INDEX IF NOT EXISTS idx_software_carts_status ON software_carts(status);
CREATE INDEX IF NOT EXISTS idx_software_cart_items_cart_id ON software_cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_software_cart_items_plan_id ON software_cart_items(software_plan_id);

-- Verify tables created
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_name LIKE 'software_cart%'
ORDER BY table_name;
