-- ==========================================================
-- MOZZ Chinese & Pizzateria - PostgreSQL Initial Seed Data
-- Idempotent & Safely Rerunnable Seed Script
-- ==========================================================

-- 1. Insert Default Root Multi-Tenant Restaurant
INSERT INTO restaurants (id, name, slug, phone, email, logo_url, tagline, currency, tax_rate, status)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'MOZZ Chinese & Pizzateria',
    'mozz',
    '+91 98450 12345',
    'contact@mozzpizzateria.com',
    'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=200',
    'Korean-Style Pocket Pizzas & Indo-Chinese Delicacies',
    'INR',
    5.00,
    'active'
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    tax_rate = EXCLUDED.tax_rate,
    updated_at = NOW();

-- 2. Insert Default Flagship Branch
INSERT INTO restaurant_branches (id, restaurant_id, name, slug, address, latitude, longitude, delivery_radius_km, phone, is_active)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Main Branch - Flagship Outlet',
    'main-outlet',
    'Shop #4, Ground Floor, Food Street Hub, Near Metro Pillar 124 (Placeholder)',
    17.4482940,
    78.3914850,
    12.00,
    '+91 98450 12345',
    TRUE
) ON CONFLICT (restaurant_id, slug) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    delivery_radius_km = EXCLUDED.delivery_radius_km,
    updated_at = NOW();

-- 3. Insert Admin User with Valid UUID & Bcrypt Hashed PIN (Default PIN: 8888)
-- Bcrypt Hash generated with 10 salt rounds
INSERT INTO restaurant_users (id, restaurant_id, branch_id, name, email, phone, role, pin_hash, is_active)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'Store Manager (Admin)',
    'admin@mozzpizzateria.com',
    '+91 98450 12345',
    'admin',
    '$2a$10$E8zBq78E89vQ8hJk6E7rquzQeE3kR7xYl2m1N0P9Q8R7S6T5U4V3W', -- bcrypt hash for admin PIN 8888
    TRUE
) ON CONFLICT (restaurant_id, email) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- 4. Insert Restaurant Tables (Tables 1 through 20)
INSERT INTO restaurant_tables (restaurant_id, branch_id, table_number, table_name, capacity, is_active)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '1', 'Table 1 (Window Side)', 4, TRUE),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '2', 'Table 2 (Window Side)', 4, TRUE),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '3', 'Table 3 (Cozy Booth)', 4, TRUE),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '4', 'Table 4 (Cozy Booth)', 4, TRUE),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '5', 'Table 5 (Center Hall)', 4, TRUE),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '6', 'Table 6 (Center Hall)', 6, TRUE),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '7', 'Table 7 (Center Hall)', 6, TRUE),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '8', 'Table 8 (Family Lounge)', 8, TRUE),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '9', 'Table 9 (Family Lounge)', 8, TRUE),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '10', 'Table 10 (High Table)', 2, TRUE),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '11', 'Table 11 (High Table)', 2, TRUE),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '12', 'Table 12 (High Table)', 2, TRUE),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '13', 'Table 13 (Garden Patio)', 4, TRUE),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '14', 'Table 14 (Garden Patio)', 4, TRUE),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '15', 'Table 15 (Garden Patio)', 4, TRUE),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '16', 'Table 16 (Outdoor Deck)', 4, TRUE),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '17', 'Table 17 (Outdoor Deck)', 4, TRUE),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '18', 'Table 18 (VIP Terrace)', 6, TRUE),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '19', 'Table 19 (VIP Terrace)', 6, TRUE),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '20', 'Table 20 (Party Zone)', 12, TRUE)
ON CONFLICT (restaurant_id, branch_id, table_number) DO UPDATE SET
    table_name = EXCLUDED.table_name,
    capacity = EXCLUDED.capacity,
    is_active = EXCLUDED.is_active;

-- 5. Insert Menu Categories
INSERT INTO menu_categories (restaurant_id, slug, name, display_order)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'pocket_pizza_veg', 'Veg Pocket Pizzas', 1),
    ('a0000000-0000-0000-0000-000000000001', 'pocket_pizza_nonveg', 'Non-Veg Pocket Pizzas', 2),
    ('a0000000-0000-0000-0000-000000000001', 'dessert_pizza', 'Dessert Pocket Pizzas', 3),
    ('a0000000-0000-0000-0000-000000000001', 'chinese_starters', 'Chinese Starters', 4),
    ('a0000000-0000-0000-0000-000000000001', 'fried_rice', 'Fried Rice Delights', 5),
    ('a0000000-0000-0000-0000-000000000001', 'noodles', 'Wok Tossed Noodles', 6),
    ('a0000000-0000-0000-0000-000000000001', 'maggie', 'Fusion Maggie Bowls', 7),
    ('a0000000-0000-0000-0000-000000000001', 'momos', 'Steamed & Fried Momos', 8),
    ('a0000000-0000-0000-0000-000000000001', 'drinks', 'Chilled Beverages', 9)
ON CONFLICT (restaurant_id, slug) DO UPDATE SET
    name = EXCLUDED.name,
    display_order = EXCLUDED.display_order;

-- 6. Insert Menu Items (From MOZZ Signature Recipe Catalog)
INSERT INTO menu_items (id, restaurant_id, branch_id, category, name, description, dietary_type, price, price_r, price_c, price_s, is_pocket_pizza, is_popular, is_chef_special, spicy_level, in_stock, badge)
VALUES
    -- Veg Pocket Pizzas
    ('vp-1', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'pocket_pizza_veg', 'Cheesy Margherita', 'Classic in-house mozzarella blend, slow-cooked herb tomato sauce, fresh basil sprinkle in a crisp pocket crust.', 'veg', NULL, 149, 179, 199, TRUE, TRUE, FALSE, 0, TRUE, 'Bestseller'),
    ('vp-2', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'pocket_pizza_veg', 'Veg Salsa', 'Zesty Mexican salsa sauce, crunchy bell peppers, diced onions, sweet corn & melted cheese.', 'veg', NULL, 149, 179, 199, TRUE, FALSE, FALSE, 1, TRUE, NULL),
    ('vp-3', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'pocket_pizza_veg', 'Corn Exotica', 'Golden American sweet corn, jalapenos, melted cheese overload with smoky herb seasoning.', 'veg', NULL, 149, 179, 199, TRUE, FALSE, FALSE, 0, TRUE, NULL),
    ('vp-4', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'pocket_pizza_veg', 'Paneer Tikka', 'Clay-oven marinated tandoori paneer cubes, roasted capsicum, red onions & spiced makhani drizzle.', 'veg', NULL, 179, 199, 249, TRUE, TRUE, FALSE, 2, TRUE, 'Chef Pick'),
    ('vp-5', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'pocket_pizza_veg', 'Paneer Schezwan', 'Spicy Indo-Chinese wok-tossed Schezwan paneer, spring greens & signature Korean pocket cheese.', 'veg', NULL, 179, 199, 249, TRUE, FALSE, FALSE, 3, TRUE, 'Fiery'),
    ('vp-6', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'pocket_pizza_veg', 'Mushroom Cheese Mania', 'Herb-sautéed tender button mushrooms, caramelized onions, loaded garlic butter cheese crust.', 'veg', NULL, 179, 199, 249, TRUE, FALSE, FALSE, 1, TRUE, NULL),
    ('vp-7', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'pocket_pizza_veg', 'BBQ Mushroom', 'Smoky sweet barbecue-glazed button mushrooms, charred onions & creamy mozzarella pocket.', 'veg', NULL, 179, 199, 249, TRUE, FALSE, FALSE, 1, TRUE, NULL),
    ('vp-8', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'pocket_pizza_veg', 'Paneer Pineapple', 'Sweet caramelized tropical pineapple chunks paired with spicy marinated cottage cheese and cheese burst.', 'veg', NULL, 179, 199, 249, TRUE, FALSE, FALSE, 1, TRUE, NULL),
    ('vp-9', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'pocket_pizza_veg', 'Paneer Tikka Makhani', 'Rich royal butter makhani gravy base, succulent paneer tikka, kasuri methi & double cheese fold.', 'veg', NULL, 179, 199, 249, TRUE, TRUE, FALSE, 2, TRUE, NULL),
    ('vp-10', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'pocket_pizza_veg', 'Cilantro Spicy Veg', 'Fresh cilantro herb pesto drizzle, birds-eye green chillies, golden corn, paneer & spicy pepper blend.', 'veg', NULL, 189, 249, 299, TRUE, FALSE, FALSE, 3, TRUE, 'Signature'),

    -- Non-Veg Pocket Pizzas
    ('nvp-1', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'pocket_pizza_nonveg', 'Spicy Chicken Mania', 'Juicy spiced chicken chunks, hot paprika, red paprika, jalapenos & molten stringy cheese.', 'non-veg', NULL, 179, 199, 249, TRUE, TRUE, FALSE, 2, TRUE, 'Top Pick'),
    ('nvp-2', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'pocket_pizza_nonveg', 'Chicken Tikka', 'Tandoori-spiced roasted chicken cubes, crisp red onions, capsicum, tandoori herb sauce & cheese.', 'non-veg', NULL, 189, 249, 299, TRUE, TRUE, FALSE, 2, TRUE, 'Bestseller'),
    ('nvp-3', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'pocket_pizza_nonveg', 'Schezwan Chicken', 'Wok-tossed hot schezwan chicken, scallions, red peppers and Korean pocket cheese crunch.', 'non-veg', NULL, 189, 249, 299, TRUE, FALSE, FALSE, 3, TRUE, 'Fiery'),
    ('nvp-4', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'pocket_pizza_nonveg', 'Chicken Pineapple', 'Tender seasoned chicken breast strips combined with sweet juicy grilled pineapple & mozzarella.', 'non-veg', NULL, 189, 249, 299, TRUE, FALSE, FALSE, 1, TRUE, NULL),
    ('nvp-5', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'pocket_pizza_nonveg', 'BBQ Chicken Supreme', 'Smoky hickory BBQ shredded chicken, smoked sausages, caramelized onions and gooey cheddar.', 'non-veg', NULL, 199, 279, 329, TRUE, TRUE, FALSE, 1, TRUE, NULL),
    ('nvp-6', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'pocket_pizza_nonveg', 'ABC (Absolute Butter Chicken)', 'Creamy North Indian butter chicken gravy, shredded chicken tikka, butter glaze & fragrant kasuri methi.', 'non-veg', NULL, 199, 279, 329, TRUE, TRUE, TRUE, 1, TRUE, 'Must Try'),
    ('nvp-7', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'pocket_pizza_nonveg', 'Chicken Keema Overload', 'Minced spiced chicken keema cooked in rich aromatic spices, mint drizzle & double layer mozzarella.', 'non-veg', NULL, 199, 279, 329, TRUE, FALSE, FALSE, 2, TRUE, NULL),
    ('nvp-8', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'pocket_pizza_nonveg', 'Korean Pepperoni Chicken', 'Special Korean chili cured chicken pepperoni rounds, spicy gochujang glaze & stretchy mozzarella.', 'non-veg', NULL, 219, 299, 349, TRUE, TRUE, FALSE, 2, TRUE, 'Trending'),
    ('nvp-9', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'pocket_pizza_nonveg', 'Cilantro Chicken Special', 'Fresh ground coriander pesto sauce, roasted spicy chicken, garlic flakes & molten cheese crust.', 'non-veg', NULL, 199, 279, 329, TRUE, FALSE, FALSE, 2, TRUE, NULL),
    ('nvp-10', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'pocket_pizza_nonveg', 'Triple Meat Monster Pocket', 'Loaded chicken tikka, BBQ chicken and spiced keema topped with triple mozzarella fold.', 'non-veg', NULL, 249, 339, 389, TRUE, TRUE, TRUE, 2, TRUE, 'Ultimate Feast'),

    -- Dessert Pocket Pizzas
    ('dp-1', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'dessert_pizza', 'Nutella Belgian Chocolate Pocket', 'Warm flaky pocket crust overflowing with rich hazelnut Nutella, crushed cookies & powdered sugar dusting.', 'dessert', NULL, 169, 199, 249, TRUE, TRUE, FALSE, 0, TRUE, 'Sweet Tooth'),
    ('dp-2', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'dessert_pizza', 'Choco Banana Crunch Pocket', 'Warm melted chocolate ganache paired with caramelized banana slices and roasted almond flakes.', 'dessert', NULL, 159, 189, 239, TRUE, FALSE, FALSE, 0, TRUE, NULL),

    -- Chinese Starters
    ('cs-1', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'chinese_starters', 'Chilli Chicken Dry (Indo-Chinese)', 'Crispy battered boneless chicken tossed in wok with dark soya, fiery green chillies and garlic.', 'non-veg', 179, NULL, NULL, NULL, FALSE, TRUE, FALSE, 2, TRUE, 'Bestseller'),
    ('cs-2', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'chinese_starters', 'Chicken 65 (South Special)', 'Deep-fried spiced chicken morsels tempered with curry leaves, crushed pepper and yogurt mustard.', 'non-veg', 179, NULL, NULL, NULL, FALSE, TRUE, FALSE, 2, TRUE, 'Crunchy'),
    ('cs-3', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'chinese_starters', 'Dragon Chicken', 'Crispy chicken strips tossed in sweet & spicy cashew chilli sauce with crisp onions and sesame seeds.', 'non-veg', 199, NULL, NULL, NULL, FALSE, TRUE, TRUE, 2, TRUE, 'Chef Special'),
    ('cs-4', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'chinese_starters', 'Paneer 65', 'Crisp cottage cheese cubes coated in spiced batter and tempered with fresh curry leaves and green chillies.', 'veg', 169, NULL, NULL, NULL, FALSE, FALSE, FALSE, 2, TRUE, NULL),
    ('cs-5', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'chinese_starters', 'Chilli Paneer Dry', 'Wok-tossed paneer cubes in spicy dark soy, bell peppers, crunchy onions and fiery green chillies.', 'veg', 169, NULL, NULL, NULL, FALSE, TRUE, FALSE, 2, TRUE, 'Veg Top Pick'),
    ('cs-6', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'chinese_starters', 'Crispy Corn Pepper Salt', 'Golden American corn kernels tossed with crushed black pepper, sea salt, garlic and spring onions.', 'veg', 149, NULL, NULL, NULL, FALSE, TRUE, FALSE, 1, TRUE, 'Addictive'),
    ('cs-7', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'chinese_starters', 'Chicken Manchurian Dry', 'Juicy minced chicken dumplings fried crisp and tossed in tangy ginger-garlic coriander sauce.', 'non-veg', 179, NULL, NULL, NULL, FALSE, FALSE, FALSE, 2, TRUE, NULL),

    -- Fried Rice
    ('fr-1', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'fried_rice', 'Veg Fried Rice', 'Aromatic long-grain basmati rice wok-tossed with finely chopped carrots, French beans and spring onion.', 'veg', 139, NULL, NULL, NULL, FALSE, FALSE, FALSE, 1, TRUE, NULL),
    ('fr-2', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'fried_rice', 'Egg Fried Rice', 'Wok-charred basmati rice scrambled with fresh farm eggs, green scallions and light sesame soy.', 'egg', 149, NULL, NULL, NULL, FALSE, TRUE, FALSE, 1, TRUE, NULL),
    ('fr-3', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'fried_rice', 'Chicken Fried Rice', 'Fluffy fragrant rice stir-fried with juicy seasoned chicken cubes, egg shreds and Chinese seasonings.', 'non-veg', 169, NULL, NULL, NULL, FALSE, TRUE, FALSE, 1, TRUE, 'Bestseller'),
    ('fr-4', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'fried_rice', 'Schezwan Chicken Fried Rice', 'Fiery wok-tossed rice with in-house Schezwan sauce, spicy chicken chunks and burnt garlic.', 'non-veg', 179, NULL, NULL, NULL, FALSE, TRUE, FALSE, 3, TRUE, 'Spicy Treat'),

    -- Noodles
    ('nd-1', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'noodles', 'Veg Hakka Noodles', 'Classic thin wheat noodles tossed on high flame with cabbage, carrots, bell peppers and light soya.', 'veg', 139, NULL, NULL, NULL, FALSE, FALSE, FALSE, 1, TRUE, NULL),
    ('nd-2', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'noodles', 'Egg Noodles', 'Stir-fried street-style noodles with scrambled eggs, onion juliennes and savoury dark garlic sauce.', 'egg', 149, NULL, NULL, NULL, FALSE, FALSE, FALSE, 1, TRUE, NULL),
    ('nd-3', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'noodles', 'Chicken Hakka Noodles', 'Classic wok noodles loaded with tender shredded chicken, egg drops and fresh crunchy vegetables.', 'non-veg', 169, NULL, NULL, NULL, FALSE, TRUE, FALSE, 1, TRUE, 'Bestseller'),
    ('nd-4', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'noodles', 'Schezwan Chicken Noodles', 'High-heat wok tossed noodles with homemade spicy schezwan paste and tender chicken chunks.', 'non-veg', 179, NULL, NULL, NULL, FALSE, TRUE, FALSE, 3, TRUE, 'Fiery'),

    -- Momos
    ('mo-1', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'momos', 'Steamed Veg Momos (6 pcs)', 'Delicate dumplings stuffed with seasoned minced veggies, served with fiery red chutney.', 'veg', 119, NULL, NULL, NULL, FALSE, FALSE, FALSE, 2, TRUE, NULL),
    ('mo-2', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'momos', 'Steamed Chicken Momos (6 pcs)', 'Thin-skinned juicy dumplings filled with tender minced chicken & ginger, with spicy momo dip.', 'non-veg', 139, NULL, NULL, NULL, FALSE, TRUE, FALSE, 2, TRUE, 'Top Pick'),
    ('mo-3', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'momos', 'Fried Chicken Kurkure Momos (6 pcs)', 'Ultra-crispy coated fried momos dusted with peri-peri spice mix, served with garlic mayo.', 'non-veg', 159, NULL, NULL, NULL, FALSE, TRUE, TRUE, 2, TRUE, 'Crunch Favorite'),

    -- Maggie
    ('mg-1', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'maggie', 'Classic Cheese Butter Maggie', 'Hot slurpy Maggie prepared with dollops of Amul butter, melting cheddar cheese and special masala.', 'veg', 89, NULL, NULL, NULL, FALSE, TRUE, FALSE, 1, TRUE, NULL),
    ('mg-2', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'maggie', 'Chicken Tikka Schezwan Maggie', 'Slurpy spicy noodles topped with pan-seared chicken tikka shreds and Schezwan drizzle.', 'non-veg', 129, NULL, NULL, NULL, FALSE, TRUE, FALSE, 2, TRUE, 'Must Try'),

    -- Drinks
    ('dk-1', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'drinks', 'Cold Coffee Frappe with Ice Cream', 'Creamy whipped iced coffee topped with a rich vanilla ice cream scoop and dark chocolate syrup.', 'veg', 119, NULL, NULL, NULL, FALSE, TRUE, FALSE, 0, TRUE, 'Bestseller'),
    ('dk-2', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'drinks', 'Korean Strawberry Sparkler', 'Refreshing strawberry nectar infused with mint leaves, lemon sprig and chilled soda fizz.', 'veg', 99, NULL, NULL, NULL, FALSE, TRUE, FALSE, 0, TRUE, 'Trending'),
    ('dk-3', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'drinks', 'Fresh Lime Soda (Sweet & Salt)', 'Freshly squeezed lemon juice, black salt, rock sugar and effervescent sparkling soda.', 'veg', 69, NULL, NULL, NULL, FALSE, FALSE, FALSE, 0, TRUE, NULL)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    dietary_type = EXCLUDED.dietary_type,
    price = EXCLUDED.price,
    price_r = EXCLUDED.price_r,
    price_c = EXCLUDED.price_c,
    price_s = EXCLUDED.price_s,
    is_pocket_pizza = EXCLUDED.is_pocket_pizza,
    is_popular = EXCLUDED.is_popular,
    is_chef_special = EXCLUDED.is_chef_special,
    spicy_level = EXCLUDED.spicy_level,
    in_stock = EXCLUDED.in_stock,
    badge = EXCLUDED.badge,
    updated_at = NOW();

-- 7. Insert Active Subscription (Idempotent Rerunnable Safe)
INSERT INTO subscriptions (restaurant_id, plan_name, status, billing_cycle, amount)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'enterprise_growth',
    'active',
    'annual',
    14999.00
) ON CONFLICT (restaurant_id) DO UPDATE SET
    plan_name = EXCLUDED.plan_name,
    status = EXCLUDED.status,
    billing_cycle = EXCLUDED.billing_cycle,
    amount = EXCLUDED.amount;
