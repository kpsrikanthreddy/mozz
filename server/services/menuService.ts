import { query, getClient, inMemoryDb, isPostgresRunning } from '../db.js';
import { MenuItem } from '../../src/types.js';
import { INITIAL_MENU } from '../../src/data/menuData.js';

const DEFAULT_RESTAURANT_ID = 'a0000000-0000-0000-0000-000000000001';
const DEFAULT_BRANCH_ID = 'b0000000-0000-0000-0000-000000000001';

// Helper to map DB row to frontend MenuItem
export function mapRowToMenuItem(row: any): MenuItem {
  const item: MenuItem = {
    id: row.id,
    name: row.name,
    category: row.category,
    dietary: row.dietary_type || row.dietary || 'veg',
    description: row.description || '',
    isPocketPizza: Boolean(row.is_pocket_pizza),
    inStock: Boolean(row.in_stock),
  };

  if (row.is_pocket_pizza) {
    item.prices = {
      R: Number(row.price_r || row.prices?.R || 149),
      C: Number(row.price_c || row.prices?.C || 179),
      S: Number(row.price_s || row.prices?.S || 199),
    };
  } else {
    item.price = Number(row.price !== null && row.price !== undefined ? row.price : 149);
  }

  if (row.is_popular) item.isPopular = true;
  if (row.is_chef_special) item.isChefSpecial = true;
  if (row.spicy_level !== undefined && row.spicy_level !== null) item.spicyLevel = Number(row.spicy_level) as any;
  if (row.image_url || row.image) item.image = row.image_url || row.image;
  if (row.badge) item.badge = row.badge;

  return item;
}

export async function getMenu(restaurantId: string = DEFAULT_RESTAURANT_ID, branchId?: string): Promise<MenuItem[]> {
  if (isPostgresRunning()) {
    try {
      const sql = branchId
        ? `SELECT * FROM menu_items WHERE restaurant_id = $1 AND (branch_id = $2 OR branch_id IS NULL) ORDER BY category, name`
        : `SELECT * FROM menu_items WHERE restaurant_id = $1 ORDER BY category, name`;
      const params = branchId ? [restaurantId, branchId] : [restaurantId];
      const res = await query(sql, params);
      return res.rows.map(mapRowToMenuItem);
    } catch (err) {
      console.error('[MenuService] Error fetching menu from PostgreSQL, fallback to in-memory:', err);
    }
  }

  // In-Memory Fallback
  const items = inMemoryDb.menu_items.filter(
    (item) => item.restaurant_id === restaurantId && (!branchId || item.branch_id === branchId || !item.branch_id)
  );
  return items.map(mapRowToMenuItem);
}

export async function getMenuItem(id: string, restaurantId: string = DEFAULT_RESTAURANT_ID): Promise<MenuItem | null> {
  if (isPostgresRunning()) {
    try {
      const res = await query(`SELECT * FROM menu_items WHERE id = $1 AND restaurant_id = $2 LIMIT 1`, [id, restaurantId]);
      if (res.rows.length > 0) {
        return mapRowToMenuItem(res.rows[0]);
      }
      return null;
    } catch (err) {
      console.error('[MenuService] Error fetching menu item:', err);
    }
  }

  const found = inMemoryDb.menu_items.find((item) => item.id === id && item.restaurant_id === restaurantId);
  return found ? mapRowToMenuItem(found) : null;
}

export async function createMenuItem(
  item: Partial<MenuItem> & { name: string; category: string; dietary: string },
  restaurantId: string = DEFAULT_RESTAURANT_ID,
  branchId: string = DEFAULT_BRANCH_ID
): Promise<MenuItem> {
  const id = item.id || `item-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const isPocket = Boolean(item.isPocketPizza);
  const priceR = item.prices?.R ?? (isPocket ? 149 : null);
  const priceC = item.prices?.C ?? (isPocket ? 179 : null);
  const priceS = item.prices?.S ?? (isPocket ? 199 : null);
  const price = !isPocket ? (item.price ?? 149) : null;
  const inStock = item.inStock !== false;

  if (isPostgresRunning()) {
    try {
      const sql = `
        INSERT INTO menu_items (
          id, restaurant_id, branch_id, category, name, description, dietary_type,
          price, price_r, price_c, price_s, is_pocket_pizza, is_popular, is_chef_special,
          spicy_level, in_stock, image_url, badge, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, NOW(), NOW()
        ) RETURNING *;
      `;
      const params = [
        id,
        restaurantId,
        branchId,
        item.category,
        item.name,
        item.description || '',
        item.dietary || 'veg',
        price,
        priceR,
        priceC,
        priceS,
        isPocket,
        Boolean(item.isPopular),
        Boolean(item.isChefSpecial),
        item.spicyLevel ?? 0,
        inStock,
        item.image || null,
        item.badge || null,
      ];
      const res = await query(sql, params);
      return mapRowToMenuItem(res.rows[0]);
    } catch (err) {
      console.error('[MenuService] Error inserting menu item in PG:', err);
    }
  }

  // In-Memory
  const newObj = {
    id,
    restaurant_id: restaurantId,
    branch_id: branchId,
    category: item.category,
    name: item.name,
    description: item.description || '',
    dietary_type: item.dietary || 'veg',
    price,
    price_r: priceR,
    price_c: priceC,
    price_s: priceS,
    is_pocket_pizza: isPocket,
    is_popular: Boolean(item.isPopular),
    is_chef_special: Boolean(item.isChefSpecial),
    spicy_level: item.spicyLevel ?? 0,
    in_stock: inStock,
    image_url: item.image || null,
    badge: item.badge || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  inMemoryDb.menu_items.push(newObj);
  return mapRowToMenuItem(newObj);
}

export async function updateMenuItem(
  id: string,
  updates: Partial<MenuItem>,
  restaurantId: string = DEFAULT_RESTAURANT_ID
): Promise<MenuItem | null> {
  const isPocket = updates.isPocketPizza !== undefined ? Boolean(updates.isPocketPizza) : undefined;
  
  if (isPostgresRunning()) {
    try {
      const existing = await query(`SELECT * FROM menu_items WHERE id = $1 AND restaurant_id = $2`, [id, restaurantId]);
      if (existing.rows.length === 0) return null;
      const current = existing.rows[0];

      const newCategory = updates.category !== undefined ? updates.category : current.category;
      const newName = updates.name !== undefined ? updates.name : current.name;
      const newDesc = updates.description !== undefined ? updates.description : current.description;
      const newDietary = updates.dietary !== undefined ? updates.dietary : current.dietary_type;
      const newIsPocket = isPocket !== undefined ? isPocket : current.is_pocket_pizza;
      
      const newPrice = !newIsPocket && updates.price !== undefined ? updates.price : (!newIsPocket ? current.price : null);
      const newPriceR = newIsPocket && updates.prices?.R !== undefined ? updates.prices.R : (newIsPocket ? current.price_r : null);
      const newPriceC = newIsPocket && updates.prices?.C !== undefined ? updates.prices.C : (newIsPocket ? current.price_c : null);
      const newPriceS = newIsPocket && updates.prices?.S !== undefined ? updates.prices.S : (newIsPocket ? current.price_s : null);

      const newPopular = updates.isPopular !== undefined ? updates.isPopular : current.is_popular;
      const newChef = updates.isChefSpecial !== undefined ? updates.isChefSpecial : current.is_chef_special;
      const newSpicy = updates.spicyLevel !== undefined ? updates.spicyLevel : current.spicy_level;
      const newStock = updates.inStock !== undefined ? updates.inStock : current.in_stock;
      const newImage = updates.image !== undefined ? updates.image : current.image_url;
      const newBadge = updates.badge !== undefined ? updates.badge : current.badge;

      const sql = `
        UPDATE menu_items SET
          category = $1,
          name = $2,
          description = $3,
          dietary_type = $4,
          price = $5,
          price_r = $6,
          price_c = $7,
          price_s = $8,
          is_pocket_pizza = $9,
          is_popular = $10,
          is_chef_special = $11,
          spicy_level = $12,
          in_stock = $13,
          image_url = $14,
          badge = $15,
          updated_at = NOW()
        WHERE id = $16 AND restaurant_id = $17
        RETURNING *;
      `;
      const params = [
        newCategory,
        newName,
        newDesc,
        newDietary,
        newPrice,
        newPriceR,
        newPriceC,
        newPriceS,
        newIsPocket,
        newPopular,
        newChef,
        newSpicy,
        newStock,
        newImage,
        newBadge,
        id,
        restaurantId,
      ];
      const res = await query(sql, params);
      return res.rows.length > 0 ? mapRowToMenuItem(res.rows[0]) : null;
    } catch (err) {
      console.error('[MenuService] Error updating menu item in PG:', err);
    }
  }

  // In Memory
  const idx = inMemoryDb.menu_items.findIndex((item) => item.id === id && item.restaurant_id === restaurantId);
  if (idx === -1) return null;

  const cur = inMemoryDb.menu_items[idx];
  const updatedObj = {
    ...cur,
    category: updates.category ?? cur.category,
    name: updates.name ?? cur.name,
    description: updates.description ?? cur.description,
    dietary_type: updates.dietary ?? cur.dietary_type,
    is_pocket_pizza: updates.isPocketPizza ?? cur.is_pocket_pizza,
    price: updates.price !== undefined ? updates.price : cur.price,
    price_r: updates.prices?.R !== undefined ? updates.prices.R : cur.price_r,
    price_c: updates.prices?.C !== undefined ? updates.prices.C : cur.price_c,
    price_s: updates.prices?.S !== undefined ? updates.prices.S : cur.price_s,
    is_popular: updates.isPopular !== undefined ? updates.isPopular : cur.is_popular,
    is_chef_special: updates.isChefSpecial !== undefined ? updates.isChefSpecial : cur.is_chef_special,
    spicy_level: updates.spicyLevel !== undefined ? updates.spicyLevel : cur.spicy_level,
    in_stock: updates.inStock !== undefined ? updates.inStock : cur.in_stock,
    image_url: updates.image !== undefined ? updates.image : cur.image_url,
    badge: updates.badge !== undefined ? updates.badge : cur.badge,
    updated_at: new Date().toISOString(),
  };

  inMemoryDb.menu_items[idx] = updatedObj;
  return mapRowToMenuItem(updatedObj);
}

export async function toggleStock(
  id: string,
  explicitInStock?: boolean,
  restaurantId: string = DEFAULT_RESTAURANT_ID
): Promise<MenuItem | null> {
  if (isPostgresRunning()) {
    try {
      let sql: string;
      let params: any[];
      if (explicitInStock !== undefined) {
        sql = `UPDATE menu_items SET in_stock = $1, updated_at = NOW() WHERE id = $2 AND restaurant_id = $3 RETURNING *`;
        params = [explicitInStock, id, restaurantId];
      } else {
        sql = `UPDATE menu_items SET in_stock = NOT in_stock, updated_at = NOW() WHERE id = $1 AND restaurant_id = $2 RETURNING *`;
        params = [id, restaurantId];
      }
      const res = await query(sql, params);
      return res.rows.length > 0 ? mapRowToMenuItem(res.rows[0]) : null;
    } catch (err) {
      console.error('[MenuService] Error toggling stock in PG:', err);
    }
  }

  // In-Memory
  const idx = inMemoryDb.menu_items.findIndex((item) => item.id === id && item.restaurant_id === restaurantId);
  if (idx === -1) return null;

  const current = inMemoryDb.menu_items[idx];
  const newStock = explicitInStock !== undefined ? explicitInStock : !current.in_stock;
  inMemoryDb.menu_items[idx] = {
    ...current,
    in_stock: newStock,
    updated_at: new Date().toISOString(),
  };

  return mapRowToMenuItem(inMemoryDb.menu_items[idx]);
}

export async function updateItemPrice(
  id: string,
  newPrice: number | { R: number; C: number; S: number },
  restaurantId: string = DEFAULT_RESTAURANT_ID
): Promise<MenuItem | null> {
  if (typeof newPrice === 'object' && newPrice !== null) {
    return updateMenuItem(id, { prices: newPrice, isPocketPizza: true }, restaurantId);
  } else {
    return updateMenuItem(id, { price: Number(newPrice), isPocketPizza: false }, restaurantId);
  }
}

export async function deleteMenuItem(id: string, restaurantId: string = DEFAULT_RESTAURANT_ID): Promise<boolean> {
  if (isPostgresRunning()) {
    try {
      const res = await query(`DELETE FROM menu_items WHERE id = $1 AND restaurant_id = $2`, [id, restaurantId]);
      return (res.rowCount ?? 0) > 0;
    } catch (err) {
      console.error('[MenuService] Error deleting menu item from PG:', err);
    }
  }

  const initialLen = inMemoryDb.menu_items.length;
  inMemoryDb.menu_items = inMemoryDb.menu_items.filter((item) => !(item.id === id && item.restaurant_id === restaurantId));
  return inMemoryDb.menu_items.length < initialLen;
}

export async function resetMenuToDefault(
  restaurantId: string = DEFAULT_RESTAURANT_ID,
  branchId: string = DEFAULT_BRANCH_ID
): Promise<MenuItem[]> {
  if (isPostgresRunning()) {
    try {
      await query(`DELETE FROM menu_items WHERE restaurant_id = $1`, [restaurantId]);
      for (const item of INITIAL_MENU) {
        await createMenuItem(item, restaurantId, branchId);
      }
      return getMenu(restaurantId, branchId);
    } catch (err) {
      console.error('[MenuService] Error resetting menu in PG:', err);
    }
  }

  inMemoryDb.menu_items = INITIAL_MENU.map((item) => ({
    id: item.id,
    restaurant_id: restaurantId,
    branch_id: branchId,
    category: item.category,
    name: item.name,
    description: item.description,
    dietary_type: item.dietary,
    price: item.price ?? null,
    price_r: item.prices?.R ?? null,
    price_c: item.prices?.C ?? null,
    price_s: item.prices?.S ?? null,
    is_pocket_pizza: !!item.isPocketPizza,
    is_popular: !!item.isPopular,
    is_chef_special: !!item.isChefSpecial,
    spicy_level: item.spicyLevel ?? 0,
    in_stock: item.inStock !== false,
    image_url: item.image ?? null,
    badge: item.badge ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  return inMemoryDb.menu_items.map(mapRowToMenuItem);
}
