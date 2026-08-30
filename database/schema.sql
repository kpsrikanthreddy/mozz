-- ==========================================================
-- MOZZ Chinese & Pizzateria - PostgreSQL Multi-Tenant Schema
-- ==========================================================

-- Enable UUID extension if available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. RESTAURANTS (Root Multi-Tenant Table)
CREATE TABLE IF NOT EXISTS restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    logo_url TEXT,
    tagline VARCHAR(255),
    currency VARCHAR(10) DEFAULT 'INR',
    tax_rate NUMERIC(5, 2) DEFAULT 5.00,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RESTAURANT BRANCHES (Multi-Location Support)
CREATE TABLE IF NOT EXISTS restaurant_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100),
    address TEXT,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    delivery_radius_km NUMERIC(6, 2) DEFAULT 10.00,
    phone VARCHAR(50),
    email VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_restaurant_branch_slug UNIQUE (restaurant_id, slug)
);

-- 3. RESTAURANT USERS & STAFF (Bcrypt Hashed Credentials Only)
CREATE TABLE IF NOT EXISTS restaurant_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES restaurant_branches(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role VARCHAR(50) NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'admin', 'manager', 'chef', 'cashier', 'waiter', 'rider')),
    pin_hash VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_restaurant_user_email UNIQUE (restaurant_id, email)
);

-- 4. RESTAURANT TABLES (For Dine-In & Table QR Ordering)
CREATE TABLE IF NOT EXISTS restaurant_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES restaurant_branches(id) ON DELETE SET NULL,
    table_number VARCHAR(50) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    capacity INT DEFAULT 4,
    qr_token_id VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_restaurant_table UNIQUE (restaurant_id, branch_id, table_number)
);

-- 5. CUSTOMERS (Tenant-Scoped & Unique by Phone)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    landmark TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_restaurant_customer_phone UNIQUE (restaurant_id, phone)
);

-- 6. MENU CATEGORIES
CREATE TABLE IF NOT EXISTS menu_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    slug VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_restaurant_category_slug UNIQUE (restaurant_id, slug)
);

-- 7. MENU ITEMS
CREATE TABLE IF NOT EXISTS menu_items (
    id VARCHAR(100) PRIMARY KEY,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES restaurant_branches(id) ON DELETE SET NULL,
    category VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    dietary_type VARCHAR(50) NOT NULL CHECK (dietary_type IN ('veg', 'non-veg', 'egg', 'dessert')),
    price NUMERIC(10, 2),
    price_r NUMERIC(10, 2),
    price_c NUMERIC(10, 2),
    price_s NUMERIC(10, 2),
    is_pocket_pizza BOOLEAN DEFAULT FALSE,
    is_popular BOOLEAN DEFAULT FALSE,
    is_chef_special BOOLEAN DEFAULT FALSE,
    spicy_level INT DEFAULT 0 CHECK (spicy_level BETWEEN 0 AND 3),
    in_stock BOOLEAN DEFAULT TRUE,
    image_url TEXT,
    badge VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_restaurant_menu_item UNIQUE (restaurant_id, id)
);

-- 8. ORDERS (UUID Internal Primary Key + Tenant Unique Order Number)
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(100) NOT NULL,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES restaurant_branches(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    order_type VARCHAR(50) NOT NULL CHECK (order_type IN ('delivery', 'takeaway', 'dine_in')),
    entry_source VARCHAR(50) NOT NULL CHECK (entry_source IN ('table_qr', 'counter_qr', 'online_web')),
    table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
    table_number VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'confirmed', 'baking', 'packing', 'out_for_delivery', 'ready_for_pickup', 'delivered', 'cancelled')),
    payment_method VARCHAR(50) NOT NULL,
    payment_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'cod_pending', 'failed')),
    payment_id VARCHAR(255),
    item_total NUMERIC(10, 2) NOT NULL,
    tax NUMERIC(10, 2) NOT NULL,
    delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    coupon_code VARCHAR(100),
    grand_total NUMERIC(10, 2) NOT NULL,
    estimated_delivery_time_minutes INT DEFAULT 25,
    kot_number VARCHAR(50),
    kot_station VARCHAR(100),
    waiter_name VARCHAR(100),
    kot_print_count INT DEFAULT 0,
    receipt_print_count INT DEFAULT 0,
    driver_name VARCHAR(100),
    driver_phone VARCHAR(50),
    driver_vehicle VARCHAR(100),
    customer_snapshot JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_restaurant_order_number UNIQUE (restaurant_id, order_number)
);

-- 9. ORDER ITEMS (Foreign Key to menu_items ON DELETE SET NULL)
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    menu_item_id VARCHAR(100) REFERENCES menu_items(id) ON DELETE SET NULL,
    item_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL,
    selected_shape VARCHAR(10) CHECK (selected_shape IN ('R', 'C', 'S') OR selected_shape IS NULL),
    selected_crust VARCHAR(100),
    spice_level VARCHAR(50),
    addons JSONB DEFAULT '[]'::jsonb,
    special_instructions TEXT,
    item_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. ORDER STATUS HISTORY (Audit Trail)
CREATE TABLE IF NOT EXISTS order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. PAYMENTS (Secure Audit - No Raw Card or UPI PIN Storage)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL DEFAULT 'razorpay',
    provider_order_id VARCHAR(255),
    provider_payment_id VARCHAR(255),
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    payment_method VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'authorized', 'captured', 'failed', 'refunded')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. KOTS (Kitchen Order Tickets)
CREATE TABLE IF NOT EXISTS kots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES restaurant_branches(id) ON DELETE SET NULL,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    kot_number VARCHAR(50) NOT NULL,
    station VARCHAR(100) NOT NULL,
    print_count INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. QR CODES (Unique QR Tokens & Anti-Tamper Registry)
CREATE TABLE IF NOT EXISTS qr_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES restaurant_branches(id) ON DELETE SET NULL,
    table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
    code_type VARCHAR(50) NOT NULL CHECK (code_type IN ('table_qr', 'counter_qr', 'online_web')),
    token TEXT NOT NULL,
    target_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_qr_token UNIQUE (token),
    CONSTRAINT unique_restaurant_qr_token UNIQUE (restaurant_id, token)
);

-- 14. SUBSCRIPTIONS (SaaS Plan & Idempotent Multi-Run Safe)
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    plan_name VARCHAR(100) NOT NULL DEFAULT 'growth',
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid')),
    billing_cycle VARCHAR(50) NOT NULL DEFAULT 'monthly',
    amount NUMERIC(10, 2) DEFAULT 0.00,
    starts_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_restaurant_subscription UNIQUE (restaurant_id)
);

-- ==========================================================
-- PERFORMANCE INDEXES & TENANT SECURITY FILTERS
-- ==========================================================

CREATE INDEX IF NOT EXISTS idx_restaurants_slug ON restaurants(slug);
CREATE INDEX IF NOT EXISTS idx_branches_restaurant_id ON restaurant_branches(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_branches_rest_branch ON restaurant_branches(restaurant_id, id);

CREATE INDEX IF NOT EXISTS idx_users_restaurant_id ON restaurant_users(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON restaurant_users(email);

CREATE INDEX IF NOT EXISTS idx_tables_restaurant_id ON restaurant_tables(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tables_branch_id ON restaurant_tables(branch_id);
CREATE INDEX IF NOT EXISTS idx_tables_rest_branch ON restaurant_tables(restaurant_id, branch_id);

CREATE INDEX IF NOT EXISTS idx_customers_restaurant_id ON customers(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_rest_phone ON customers(restaurant_id, phone);

CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_branch_id ON menu_items(branch_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_in_stock ON menu_items(in_stock);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category);

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_branch_id ON orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_rest_branch ON orders(restaurant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_rest_order_num ON orders(restaurant_id, order_number);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_restaurant_id ON order_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);

CREATE INDEX IF NOT EXISTS idx_status_history_order_id ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_kots_order_id ON kots(order_id);
CREATE INDEX IF NOT EXISTS idx_kots_restaurant_id ON kots(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_token ON qr_codes(token);
