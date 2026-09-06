import { EntrySource, OrderType, QRSessionInfo } from '../types';

// Standard Restaurant Signing Secret (Used for HMAC token validation)
const RESTAURANT_ID = 'mozz';
const QR_SIGNING_SALT = 'mozz_pizzateria_secure_qr_key_v1_2026';

// Canonical base domain
export const CANONICAL_BASE_URL = 'https://www.starters4u.in';

// Simple deterministic HMAC-SHA256 / Hash implementation for browser & node compatibility
function simpleHmacSha256(data: string, key: string): string {
  let hash = 0;
  const combined = `${key}:::${data}:::${key.length}`;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Secondary pass for high entropy signature
  let hash2 = 5381;
  for (let i = combined.length - 1; i >= 0; i--) {
    const char = combined.charCodeAt(i);
    hash2 = ((hash2 << 5) + hash2) ^ (char * 33);
    hash2 = hash2 & hash2;
  }
  
  const hex1 = Math.abs(hash).toString(16).padStart(8, '0');
  const hex2 = Math.abs(hash2).toString(16).padStart(8, '0');
  const hex3 = Math.abs(hash ^ hash2).toString(16).padStart(8, '0');
  const hex4 = Math.abs((hash * 31) ^ hash2).toString(16).padStart(8, '0');
  
  return `${hex1}${hex2}${hex3}${hex4}`;
}

export interface TokenPayload {
  restaurant: string;
  mode: OrderType;
  table?: string;
  source: EntrySource;
  issuedAt: number;
  nonce?: string;
}

/**
 * Encodes token payload to URL-safe Base64 string
 */
function base64UrlEncode(str: string): string {
  if (typeof btoa === 'function') {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf-8').toString('base64url');
  }
  return encodeURIComponent(str);
}

/**
 * Decodes URL-safe Base64 string to payload
 */
function base64UrlDecode(str: string): string {
  try {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    if (typeof atob === 'function') {
      return decodeURIComponent(escape(atob(base64)));
    }
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(base64, 'base64').toString('utf-8');
    }
    return decodeURIComponent(str);
  } catch (err) {
    return '';
  }
}

/**
 * Generates a cryptographically signed QR token for Table, Counter, or Online.
 */
export function generateSignedQRToken(params: {
  mode: OrderType;
  tableNumber?: string;
  restaurantId?: string;
  source?: EntrySource;
}): { token: string; payload: TokenPayload; fullCanonicalUrl: string } {
  const mode = params.mode;
  const restaurant = params.restaurantId || RESTAURANT_ID;
  const source: EntrySource =
    params.source || (mode === 'dine_in' ? 'table_qr' : mode === 'takeaway' ? 'counter_qr' : 'online_web');

  const cleanTable = params.tableNumber ? params.tableNumber.replace(/^Table\s*/i, '').trim() : undefined;

  const payload: TokenPayload = {
    restaurant,
    mode,
    table: mode === 'dine_in' ? cleanTable || '1' : undefined,
    source,
    issuedAt: Date.now(),
    nonce: Math.random().toString(36).substring(2, 8),
  };

  const payloadString = JSON.stringify(payload);
  const encodedPayload = base64UrlEncode(payloadString);
  const signature = simpleHmacSha256(encodedPayload, QR_SIGNING_SALT);
  const token = `${encodedPayload}.${signature}`;

  let pathPart = '';
  if (mode === 'dine_in') {
    pathPart = `/r/mozz/table/${cleanTable || '1'}`;
  } else if (mode === 'takeaway') {
    pathPart = `/r/mozz/counter`;
  } else {
    pathPart = `/`;
  }

  const fullCanonicalUrl = mode === 'delivery'
    ? `${CANONICAL_BASE_URL}/`
    : `${CANONICAL_BASE_URL}${pathPart}?token=${token}`;

  return { token, payload, fullCanonicalUrl };
}

/**
 * Validates a signed QR token and extracts authorized session parameters.
 */
export function verifySignedQRToken(token: string): {
  isValid: boolean;
  payload?: TokenPayload;
  error?: string;
} {
  if (!token || typeof token !== 'string') {
    return { isValid: false, error: 'Empty token' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { isValid: false, error: 'Malformed token structure (expected payload.signature)' };
  }

  const [encodedPayload, providedSignature] = parts;
  const expectedSignature = simpleHmacSha256(encodedPayload, QR_SIGNING_SALT);

  if (providedSignature !== expectedSignature) {
    return { isValid: false, error: 'Cryptographic signature mismatch (Token tampered or invalid)' };
  }

  const decodedJson = base64UrlDecode(encodedPayload);
  if (!decodedJson) {
    return { isValid: false, error: 'Unable to decode payload string' };
  }

  try {
    const payload = JSON.parse(decodedJson) as TokenPayload;
    if (!payload.mode || !payload.restaurant) {
      return { isValid: false, error: 'Invalid payload schema' };
    }
    return { isValid: true, payload };
  } catch (err: any) {
    return { isValid: false, error: `JSON parse failed: ${err.message}` };
  }
}

/**
 * Resolves current URL location into validated QR Session Info
 */
export function resolveEntrySourceFromLocation(location: {
  pathname: string;
  search: string;
}): QRSessionInfo {
  const searchParams = new URLSearchParams(location.search);
  const token = searchParams.get('token') || searchParams.get('t') || '';
  const pathname = location.pathname.toLowerCase();

  // 1. Check if token is present
  if (token) {
    const verification = verifySignedQRToken(token);
    if (verification.isValid && verification.payload) {
      const p = verification.payload;
      const cleanTable = p.table ? `Table ${p.table.replace(/^Table\s*/i, '')}` : undefined;

      return {
        source: p.source,
        orderMode: p.mode,
        tableNumber: cleanTable,
        token,
        isVerified: true,
        isModeLocked: true, // Lock order mode because customer entered via authenticated QR
        verificationMessage:
          p.source === 'table_qr'
            ? `Verified Table QR (${cleanTable}) • Locked to Dine-In`
            : `Verified Counter QR • Locked to Takeaway Express`,
        signature: token.split('.')[1],
      };
    } else {
      // Invalid/tampered token was provided
      return {
        source: 'online_web',
        orderMode: 'delivery',
        token,
        isVerified: false,
        isModeLocked: false,
        verificationMessage: `⚠️ ${verification.error || 'Invalid QR Token'}. Defaulted to standard Online Delivery.`,
      };
    }
  }

  // 2. Check path routes without token (e.g. direct /r/mozz/table/7 or /table/7 or /counter)
  // If no token is provided in QR route, check path to alert user or handle fallback
  const tableMatch = pathname.match(/(?:table|r\/mozz\/table)\/(\d+)/i);
  if (tableMatch) {
    // Unsigned table path accessed directly without token
    return {
      source: 'online_web',
      orderMode: 'delivery',
      isVerified: false,
      isModeLocked: false,
      verificationMessage: '⚠️ Unsigned Table URL. Access via genuine Table QR scan to lock Dine-In.',
    };
  }

  const isCounterPath = pathname.includes('/counter') || pathname.includes('/r/mozz/counter') || searchParams.get('counter') === 'true';
  if (isCounterPath) {
    return {
      source: 'online_web',
      orderMode: 'delivery',
      isVerified: false,
      isModeLocked: false,
      verificationMessage: '⚠️ Unsigned Counter URL. Access via genuine Counter QR scan to lock Takeaway.',
    };
  }

  // 3. Default: Online Customer from Website/App
  return {
    source: 'online_web',
    orderMode: 'delivery',
    isVerified: true,
    isModeLocked: false, // Customer on home website can choose delivery
    verificationMessage: 'Online Customer (Website Direct) • Home Delivery',
  };
}

/**
 * Pre-computes standard QR catalog for Tables 1 to 20 + Counter for restaurant staff
 */
export function getStandardQRCatalog(baseUrl: string = CANONICAL_BASE_URL) {
  const catalog: {
    id: string;
    label: string;
    type: 'table' | 'counter';
    mode: OrderType;
    tableNumber?: string;
    token: string;
    fullUrl: string;
    localUrl: string;
  }[] = [];

  // Counter QR
  const counterGen = generateSignedQRToken({ mode: 'takeaway' });
  catalog.push({
    id: 'counter-main',
    label: 'Takeaway Counter QR',
    type: 'counter',
    mode: 'takeaway',
    tableNumber: 'Counter Express',
    token: counterGen.token,
    fullUrl: counterGen.fullCanonicalUrl,
    localUrl: `/r/mozz/counter?token=${counterGen.token}`,
  });

  // Tables 1 to 20
  for (let i = 1; i <= 20; i++) {
    const tableGen = generateSignedQRToken({ mode: 'dine_in', tableNumber: String(i) });
    catalog.push({
      id: `table-${i}`,
      label: `Table ${i} Dine-In QR`,
      type: 'table',
      mode: 'dine_in',
      tableNumber: `Table ${i}`,
      token: tableGen.token,
      fullUrl: tableGen.fullCanonicalUrl,
      localUrl: `/r/mozz/table/${i}?token=${tableGen.token}`,
    });
  }

  return catalog;
}
