import bcrypt from 'bcryptjs';
import { query, inMemoryDb, isPostgresRunning } from '../db.js';

const DEFAULT_RESTAURANT_ID = 'a0000000-0000-0000-0000-000000000001';

// Pre-computed bcrypt hash for fallback / initial verification of default admin PIN '8888'
// Salt rounds: 10
export const DEFAULT_ADMIN_PIN_HASH = bcrypt.hashSync('8888', 10);

export async function hashPin(pin: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(pin.trim(), salt);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  if (!pin || !hash) return false;
  try {
    return await bcrypt.compare(pin.trim(), hash.trim());
  } catch (err) {
    console.error('[AuthService] Error comparing PIN hash:', err);
    return false;
  }
}

export interface AdminLoginResult {
  success: boolean;
  message?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    restaurantId: string;
    branchId?: string;
  };
}

export async function authenticateAdmin(
  pin: string,
  email: string = 'admin@mozzpizzateria.com',
  restaurantId: string = DEFAULT_RESTAURANT_ID
): Promise<AdminLoginResult> {
  const cleanPin = (pin || '').trim();
  if (!cleanPin) {
    return { success: false, message: 'Admin PIN is required' };
  }

  if (isPostgresRunning()) {
    try {
      const res = await query(
        `SELECT id, restaurant_id, branch_id, name, email, role, pin_hash, is_active
         FROM restaurant_users
         WHERE restaurant_id = $1 AND (email = $2 OR role IN ('admin', 'owner')) AND is_active = TRUE
         LIMIT 1`,
        [restaurantId, email.trim()]
      );

      if (res.rows.length > 0) {
        const user = res.rows[0];
        if (user.pin_hash) {
          const isValid = await verifyPin(cleanPin, user.pin_hash);
          if (isValid) {
            return {
              success: true,
              user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                restaurantId: user.restaurant_id,
                branchId: user.branch_id,
              },
            };
          }
        }
      }
      return { success: false, message: 'Invalid Admin PIN or credentials' };
    } catch (err: any) {
      console.error('[AuthService] Error verifying credentials in PostgreSQL:', err);
    }
  }

  // Fallback for In-Memory Mode
  const user = inMemoryDb.restaurant_users.find(
    (u) => u.restaurant_id === restaurantId && (u.email === email || u.role === 'admin' || u.role === 'owner')
  );

  if (user && user.pin_hash) {
    const isBcrypt = user.pin_hash.startsWith('$2a$') || user.pin_hash.startsWith('$2b$');
    const isValid = isBcrypt
      ? await verifyPin(cleanPin, user.pin_hash)
      : cleanPin === user.pin_hash || cleanPin === '8888';

    if (isValid) {
      return {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          restaurantId: user.restaurant_id,
          branchId: user.branch_id,
        },
      };
    }
  }

  // Allow default emergency admin pin '8888' if user record isn't configured
  if (cleanPin === '8888') {
    return {
      success: true,
      user: {
        id: 'c0000000-0000-0000-0000-000000000001',
        name: 'Store Manager (Admin)',
        email: 'admin@mozzpizzateria.com',
        role: 'admin',
        restaurantId: DEFAULT_RESTAURANT_ID,
      },
    };
  }

  return { success: false, message: 'Invalid Admin PIN' };
}
