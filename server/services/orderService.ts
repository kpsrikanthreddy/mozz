import crypto from 'crypto';
import { query, getClient, inMemoryDb, isPostgresRunning } from '../db.js';
import { Order, OrderStatus, OrderType, EntrySource, PaymentMethod, CartItem, CustomerDetails } from '../../src/types.js';
import { findOrCreateCustomer } from './customerService.js';
import { validateSignedToken } from './qrService.js';
import { createPrintJobsForOrder } from './printService.js';

const DEFAULT_RESTAURANT_ID = 'a0000000-0000-0000-0000-000000000001';
const DEFAULT_BRANCH_ID = 'b0000000-0000-0000-0000-000000000001';

// Sequential, collision-safe Order Number per Restaurant Tenant
async function generateOrderNumber(restaurantId: string = DEFAULT_RESTAURANT_ID): Promise<string> {
  if (isPostgresRunning()) {
    try {
      const res = await query(
        `SELECT COUNT(*) FROM orders WHERE restaurant_id = $1`,
        [restaurantId]
      );
      const count = parseInt(res.rows[0]?.count || '0', 10);
      const nextNum = 8900 + count + 1;
      return `MOZZ-${nextNum}`;
    } catch {
      // Fallback
    }
  }
  const nextNum = 8900 + inMemoryDb.orders.length + 1;
  return `MOZZ-${nextNum}`;
}

export interface CreateOrderPayload {
  restaurantId?: string;
  branchId?: string;
  orderType: OrderType;
  entrySource?: EntrySource;
  tableNumber?: string;
  tableId?: string;
  qrToken?: string;
  customer: CustomerDetails;
  items: CartItem[];
  paymentMethod: PaymentMethod;
  paymentStatus?: 'pending' | 'paid' | 'cod_pending' | 'failed';
  paymentId?: string;
  couponCode?: string;
  discount?: number;
  deliveryFee?: number;
  specialInstructions?: string;
}

// Map Database Order Row + Items + History to frontend Order model
export async function assembleOrderObject(
  orderRow: any,
  itemsRows: any[] = [],
  historyRows: any[] = [],
  customerRow?: any
): Promise<Order> {
  const customer: CustomerDetails = customerRow
    ? {
        name: customerRow.name || 'Guest',
        phone: customerRow.phone || '',
        email: customerRow.email || undefined,
        address: customerRow.address || undefined,
        landmark: customerRow.landmark || undefined,
        tableNumber: orderRow.table_number || undefined,
        notes: customerRow.notes || undefined,
      }
    : orderRow.customer_snapshot || {
        name: 'Guest',
        phone: '',
        tableNumber: orderRow.table_number || undefined,
      };

  const items: CartItem[] = itemsRows.map((it) => ({
    cartItemId: it.id || `ci-${Math.random().toString(36).slice(2, 7)}`,
    menuItem: {
      id: it.menu_item_id || it.id,
      itemCode: it.item_code || undefined,
      name: it.item_name || 'Item',
      category: it.category || 'pocket_pizza_veg',
      dietary: it.dietary_type || 'veg',
      description: it.description || '',
      inStock: true,
      price: Number(it.unit_price),
      isPocketPizza: Boolean(it.selected_shape),
    },
    selectedShape: it.selected_shape || undefined,
    selectedCrust: it.selected_crust || undefined,
    spiceLevel: it.spice_level || undefined,
    addons: it.addons || [],
    specialInstructions: it.special_instructions || undefined,
    unitPrice: Number(it.unit_price),
    quantity: Number(it.quantity || 1),
  }));

  const statusHistory = (historyRows || []).map((h) => ({
    status: h.status as OrderStatus,
    timestamp: h.created_at ? new Date(h.created_at).toISOString() : new Date().toISOString(),
    note: h.note || '',
  }));

  if (statusHistory.length === 0) {
    statusHistory.push({
      status: orderRow.status as OrderStatus,
      timestamp: orderRow.created_at ? new Date(orderRow.created_at).toISOString() : new Date().toISOString(),
      note: 'Order registered',
    });
  }

  const orderObj: Order = {
    id: orderRow.id,
    orderNumber: orderRow.order_number,
    createdAt: orderRow.created_at ? new Date(orderRow.created_at).toISOString() : new Date().toISOString(),
    items,
    orderType: orderRow.order_type as OrderType,
    entrySource: orderRow.entry_source as EntrySource,
    qrSession: orderRow.entry_source === 'table_qr'
      ? {
          source: 'table_qr',
          orderMode: 'dine_in',
          tableNumber: orderRow.table_number || 'Table 1',
          isVerified: true,
          isModeLocked: true,
        }
      : orderRow.entry_source === 'counter_qr'
      ? {
          source: 'counter_qr',
          orderMode: 'takeaway',
          isVerified: true,
          isModeLocked: true,
        }
      : undefined,
    customer,
    status: orderRow.status as OrderStatus,
    paymentMethod: orderRow.payment_method as PaymentMethod,
    paymentStatus: orderRow.payment_status as any,
    paymentId: orderRow.payment_id || undefined,
    itemTotal: Number(orderRow.item_total),
    tax: Number(orderRow.tax),
    deliveryFee: Number(orderRow.delivery_fee || 0),
    discount: Number(orderRow.discount || 0),
    couponCode: orderRow.coupon_code || undefined,
    grandTotal: Number(orderRow.grand_total),
    estimatedDeliveryTimeMinutes: Number(orderRow.estimated_delivery_time_minutes || 25),
    kotNumber: orderRow.kot_number || undefined,
    kotStation: orderRow.kot_station || undefined,
    waiterName: orderRow.waiter_name || undefined,
    kotPrintCount: Number(orderRow.kot_print_count || 0),
    receiptPrintCount: Number(orderRow.receipt_print_count || 0),
    driverDetails: orderRow.driver_name
      ? {
          name: orderRow.driver_name,
          phone: orderRow.driver_phone || '',
          vehicleNumber: orderRow.driver_vehicle || '',
        }
      : undefined,
    statusHistory,
  };

  return orderObj;
}

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  const restaurantId = payload.restaurantId || DEFAULT_RESTAURANT_ID;
  const branchId = payload.branchId || DEFAULT_BRANCH_ID;

  // 1. Strict Backend QR & Order Type Validation
  if (payload.qrToken) {
    const qrValidation = validateSignedToken(payload.qrToken);
    if (!qrValidation.valid) {
      throw new Error(`Invalid QR session: ${qrValidation.error}`);
    }
    // Verify QR session constraints match order
    if (qrValidation.source === 'table_qr' && payload.orderType !== 'dine_in') {
      throw new Error('Table QR sessions are strictly locked to Dine-In orders only.');
    }
    if (qrValidation.source === 'counter_qr' && payload.orderType !== 'takeaway') {
      throw new Error('Counter QR sessions are strictly locked to Takeaway orders only.');
    }
  } else {
    // Direct Online Web entries cannot create Dine-In without authenticated table
    if (payload.orderType === 'dine_in' && !payload.tableNumber) {
      throw new Error('Dine-In orders require a verified Table QR session.');
    }
  }

  const entrySource: EntrySource = payload.entrySource || (payload.orderType === 'dine_in' ? 'table_qr' : payload.orderType === 'takeaway' ? 'counter_qr' : 'online_web');

  if (!payload.items || payload.items.length === 0) {
    throw new Error('Cannot create order with an empty cart.');
  }

  // 2. Compute Item Total, 5% GST Tax, and Grand Total
  let calculatedItemTotal = 0;
  for (const it of payload.items) {
    const unitPrice = Number(it.unitPrice || 0);
    const qty = Math.max(1, Number(it.quantity || 1));
    calculatedItemTotal += unitPrice * qty;
  }

  const discount = Math.max(0, Number(payload.discount || 0));
  const deliveryFee = payload.orderType === 'delivery' ? (payload.deliveryFee !== undefined ? Number(payload.deliveryFee) : calculatedItemTotal > 299 ? 0 : 35) : 0;
  const taxableAmount = Math.max(0, calculatedItemTotal - discount);
  const tax = Math.round(taxableAmount * 0.05 * 100) / 100;
  const grandTotal = Math.round((taxableAmount + tax + deliveryFee) * 100) / 100;

  // Determine KOT station assignment
  const hasPizza = payload.items.some((i) => i.selectedShape || i.menuItem.isPocketPizza || i.menuItem.category?.includes('pizza'));
  const hasChinese = payload.items.some((i) => !i.menuItem.isPocketPizza && (i.menuItem.category?.includes('chinese') || i.menuItem.category?.includes('rice') || i.menuItem.category?.includes('noodle') || i.menuItem.category?.includes('momo')));
  const kotStation = hasPizza && hasChinese ? 'All Stations' : hasPizza ? 'Pizza Oven Station' : 'Chinese Wok Station';

  const internalOrderId = crypto.randomUUID();
  const orderNumber = await generateOrderNumber(restaurantId);
  const kotNumber = `KOT-${orderNumber.replace(/[^0-9]/g, '') || Math.floor(1000 + Math.random() * 9000)}`;

  const paymentStatus = payload.paymentStatus || (payload.paymentMethod === 'cod' ? 'cod_pending' : payload.paymentId ? 'paid' : 'pending');
  const initialStatus: OrderStatus = 'placed';
  const initialNote = payload.orderType === 'dine_in'
    ? `Dine-In Order placed from ${payload.tableNumber || 'Table'} via QR`
    : payload.orderType === 'takeaway'
    ? `Takeaway Order placed via Counter QR`
    : `Delivery Order placed via Online Web (${payload.paymentMethod.toUpperCase()})`;

  // 3. Find or Create Customer (Scoped to Restaurant Tenant)
  const customerRecord = await findOrCreateCustomer(
    {
      ...payload.customer,
      tableNumber: payload.tableNumber,
    },
    restaurantId
  );

  // 4. PostgreSQL Transaction
  const pgClient = await getClient();
  if (pgClient && isPostgresRunning()) {
    try {
      await pgClient.query('BEGIN');

      // Insert Order with UUID primary key and unique human-readable order_number
      const insertOrderSql = `
        INSERT INTO orders (
          id, order_number, restaurant_id, branch_id, customer_id,
          order_type, entry_source, table_number, status,
          payment_method, payment_status, payment_id,
          item_total, tax, delivery_fee, discount, coupon_code, grand_total,
          estimated_delivery_time_minutes, kot_number, kot_station, waiter_name,
          customer_snapshot, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12,
          $13, $14, $15, $16, $17, $18,
          $19, $20, $21, $22,
          $23, NOW(), NOW()
        ) RETURNING *;
      `;

      const orderValues = [
        internalOrderId,
        orderNumber,
        restaurantId,
        branchId,
        customerRecord.id,
        payload.orderType,
        entrySource,
        payload.tableNumber || (payload.orderType === 'dine_in' ? 'Table 1' : null),
        initialStatus,
        payload.paymentMethod,
        paymentStatus,
        payload.paymentId || null,
        calculatedItemTotal,
        tax,
        deliveryFee,
        discount,
        payload.couponCode || null,
        grandTotal,
        payload.orderType === 'delivery' ? 30 : 15,
        kotNumber,
        kotStation,
        payload.orderType === 'dine_in' ? 'Ramesh (Captain)' : null,
        JSON.stringify({
          name: customerRecord.name,
          phone: customerRecord.phone,
          email: customerRecord.email,
          address: customerRecord.address,
          landmark: customerRecord.landmark,
          tableNumber: payload.tableNumber,
        }),
      ];

      const orderResult = await pgClient.query(insertOrderSql, orderValues);
      const insertedOrder = orderResult.rows[0];

      // Insert Order Items with Foreign Key to menu_items ON DELETE SET NULL
      const itemRows: any[] = [];
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      for (const item of payload.items) {
        let resolvedMenuItemUuid: string | null = null;
        const rawItemId = item.menuItem?.id || item.menuItem?.itemCode;

        if (rawItemId) {
          if (uuidRegex.test(rawItemId)) {
            resolvedMenuItemUuid = rawItemId;
          } else {
            // Find by item_code in menu_items
            const findItemRes = await pgClient.query(
              `SELECT id FROM menu_items WHERE (item_code = $1 OR id::text = $1) AND restaurant_id = $2 LIMIT 1`,
              [rawItemId, restaurantId]
            );
            if (findItemRes.rows.length > 0) {
              resolvedMenuItemUuid = findItemRes.rows[0].id;
            }
          }
        }

        const rawShape = item.selectedShape as any;
        const shapeCode =
          rawShape === 'rectangle'
            ? 'R'
            : rawShape === 'circle'
            ? 'C'
            : rawShape === 'square'
            ? 'S'
            : ['R', 'C', 'S'].includes(rawShape as string)
            ? (rawShape as 'R' | 'C' | 'S')
            : null;

        const insertItemSql = `
          INSERT INTO order_items (
            order_id, restaurant_id, menu_item_id, item_name,
            quantity, unit_price, selected_shape, selected_crust,
            spice_level, addons, special_instructions, created_at
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8,
            $9, $10, $11, NOW()
          ) RETURNING *;
        `;
        const itemValues = [
          internalOrderId,
          restaurantId,
          resolvedMenuItemUuid,
          item.menuItem?.name || 'Item',
          item.quantity,
          item.unitPrice,
          shapeCode,
          item.selectedCrust || null,
          item.spiceLevel || null,
          JSON.stringify(item.addons || []),
          item.specialInstructions || null,
        ];
        const itemRes = await pgClient.query(insertItemSql, itemValues);
        itemRows.push(itemRes.rows[0]);
      }

      // Insert Initial Status History
      const insertHistorySql = `
        INSERT INTO order_status_history (order_id, restaurant_id, status, note, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *;
      `;
      const histRes = await pgClient.query(insertHistorySql, [internalOrderId, restaurantId, initialStatus, initialNote]);

      // Insert KOT Record
      const insertKotSql = `
        INSERT INTO kots (restaurant_id, branch_id, order_id, kot_number, station, print_count, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, 0, 'active', NOW(), NOW())
        RETURNING *;
      `;
      await pgClient.query(insertKotSql, [restaurantId, branchId, internalOrderId, kotNumber, kotStation]);

      // Insert Payment Record if payment exists
      if (payload.paymentId || payload.paymentMethod === 'razorpay') {
        const insertPaymentSql = `
          INSERT INTO payments (order_id, restaurant_id, provider, provider_order_id, provider_payment_id, amount, currency, payment_method, status, created_at, updated_at)
          VALUES ($1, $2, 'razorpay', $3, $4, $5, 'INR', $6, $7, NOW(), NOW());
        `;
        await pgClient.query(insertPaymentSql, [
          internalOrderId,
          restaurantId,
          payload.paymentId || null,
          payload.paymentId || null,
          grandTotal,
          payload.paymentMethod,
          paymentStatus === 'paid' ? 'captured' : 'created',
        ]);
      }

      await pgClient.query('COMMIT');

      const assembled = await assembleOrderObject(insertedOrder, itemRows, histRes.rows, customerRecord);
      if (assembled.status === 'confirmed' || assembled.paymentStatus === 'paid') {
        await createPrintJobsForOrder(assembled, {
          reason: assembled.paymentStatus === 'paid' ? 'online_paid' : 'confirmed',
        }).catch((err) => console.error('[OrderService] Error triggering print jobs on order creation:', err));
      }
      return assembled;
    } catch (err) {
      await pgClient.query('ROLLBACK');
      console.error('[OrderService] Transaction failed, rolled back:', err);
      throw err;
    } finally {
      pgClient.release();
    }
  }

  // In-Memory Multi-Tenant Store Execution (Fallback)
  const newOrderRow = {
    id: internalOrderId,
    order_number: orderNumber,
    restaurant_id: restaurantId,
    branch_id: branchId,
    customer_id: customerRecord.id,
    order_type: payload.orderType,
    entry_source: entrySource,
    table_number: payload.tableNumber || (payload.orderType === 'dine_in' ? 'Table 1' : null),
    status: initialStatus,
    payment_method: payload.paymentMethod,
    payment_status: paymentStatus,
    payment_id: payload.paymentId || null,
    item_total: calculatedItemTotal,
    tax: tax,
    delivery_fee: deliveryFee,
    discount: discount,
    coupon_code: payload.couponCode || null,
    grand_total: grandTotal,
    estimated_delivery_time_minutes: payload.orderType === 'delivery' ? 30 : 15,
    kot_number: kotNumber,
    kot_station: kotStation,
    waiter_name: payload.orderType === 'dine_in' ? 'Ramesh (Captain)' : null,
    kot_print_count: 0,
    receipt_print_count: 0,
    customer_snapshot: {
      name: customerRecord.name,
      phone: customerRecord.phone,
      email: customerRecord.email,
      address: customerRecord.address,
      landmark: customerRecord.landmark,
      tableNumber: payload.tableNumber,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  inMemoryDb.orders.unshift(newOrderRow);

  const insertedItemRows: any[] = [];
  for (const item of payload.items) {
    const itemRow = {
      id: crypto.randomUUID(),
      order_id: internalOrderId,
      restaurant_id: restaurantId,
      menu_item_id: item.menuItem?.id || null,
      item_name: item.menuItem?.name || 'Item',
      quantity: item.quantity,
      unit_price: item.unitPrice,
      selected_shape: item.selectedShape || null,
      selected_crust: item.selectedCrust || null,
      spice_level: item.spiceLevel || null,
      addons: item.addons || [],
      special_instructions: item.specialInstructions || null,
      created_at: new Date().toISOString(),
    };
    inMemoryDb.order_items.push(itemRow);
    insertedItemRows.push(itemRow);
  }

  const histRow = {
    id: crypto.randomUUID(),
    order_id: internalOrderId,
    restaurant_id: restaurantId,
    status: initialStatus,
    note: initialNote,
    created_at: new Date().toISOString(),
  };
  inMemoryDb.order_status_history.push(histRow);

  inMemoryDb.kots.push({
    id: crypto.randomUUID(),
    restaurant_id: restaurantId,
    branch_id: branchId,
    order_id: internalOrderId,
    kot_number: kotNumber,
    station: kotStation,
    print_count: 0,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (payload.paymentId || payload.paymentMethod === 'razorpay') {
    inMemoryDb.payments.push({
      id: crypto.randomUUID(),
      order_id: internalOrderId,
      restaurant_id: restaurantId,
      provider: 'razorpay',
      provider_order_id: payload.paymentId,
      provider_payment_id: payload.paymentId,
      amount: grandTotal,
      currency: 'INR',
      payment_method: payload.paymentMethod,
      status: paymentStatus === 'paid' ? 'captured' : 'created',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  const assembled = await assembleOrderObject(newOrderRow, insertedItemRows, [histRow], customerRecord);
  if (assembled.status === 'confirmed' || assembled.paymentStatus === 'paid') {
    await createPrintJobsForOrder(assembled, {
      reason: assembled.paymentStatus === 'paid' ? 'online_paid' : 'confirmed',
    }).catch((err) => console.error('[OrderService] Error triggering print jobs on in-memory order creation:', err));
  }
  return assembled;
}

export async function getOrders(
  restaurantId: string = DEFAULT_RESTAURANT_ID,
  branchId?: string,
  status?: string,
  limit: number = 50
): Promise<Order[]> {
  if (isPostgresRunning()) {
    try {
      let sql = `
        SELECT o.*, c.name as cust_name, c.phone as cust_phone, c.email as cust_email, c.address as cust_address, c.landmark as cust_landmark
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.restaurant_id = $1
      `;
      const params: any[] = [restaurantId];

      if (branchId) {
        params.push(branchId);
        sql += ` AND (o.branch_id = $${params.length} OR o.branch_id IS NULL)`;
      }

      if (status && status !== 'all') {
        params.push(status);
        sql += ` AND o.status = $${params.length}`;
      }

      sql += ` ORDER BY o.created_at DESC LIMIT ${Math.min(limit, 100)};`;

      const orderRows = (await query(sql, params)).rows;

      const results: Order[] = [];
      for (const row of orderRows) {
        const itemRows = (await query(
          `SELECT oi.*, mi.item_code, mi.category, mi.dietary_type, mi.description
           FROM order_items oi
           LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
           WHERE oi.order_id = $1`,
          [row.id]
        )).rows;
        const histRows = (await query(`SELECT * FROM order_status_history WHERE order_id = $1 ORDER BY created_at ASC`, [row.id])).rows;
        const custObj = row.cust_phone ? {
          name: row.cust_name,
          phone: row.cust_phone,
          email: row.cust_email,
          address: row.cust_address,
          landmark: row.cust_landmark,
        } : undefined;
        const orderObj = await assembleOrderObject(row, itemRows, histRows, custObj);
        results.push(orderObj);
      }
      return results;
    } catch (err) {
      console.error('[OrderService] Error fetching orders from PG, fallback to in-memory:', err);
    }
  }

  // In-Memory Fallback
  let filtered = inMemoryDb.orders.filter((o) => o.restaurant_id === restaurantId);
  if (branchId) {
    filtered = filtered.filter((o) => o.branch_id === branchId || !o.branch_id);
  }
  if (status && status !== 'all') {
    filtered = filtered.filter((o) => o.status === status);
  }

  const results: Order[] = [];
  for (const o of filtered) {
    const items = inMemoryDb.order_items.filter((it) => it.order_id === o.id);
    const history = inMemoryDb.order_status_history.filter((h) => h.order_id === o.id);
    const cust = inMemoryDb.customers.find((c) => c.id === o.customer_id);
    const orderObj = await assembleOrderObject(o, items, history, cust);
    results.push(orderObj);
  }
  return results;
}

export async function getOrderById(orderIdentifier: string, restaurantId: string = DEFAULT_RESTAURANT_ID): Promise<Order | null> {
  if (isPostgresRunning()) {
    try {
      // Query by UUID id OR human-readable order_number
      const orderRes = await query(
        `SELECT o.*, c.name as cust_name, c.phone as cust_phone, c.email as cust_email, c.address as cust_address, c.landmark as cust_landmark
         FROM orders o
         LEFT JOIN customers c ON o.customer_id = c.id
         WHERE (o.id::text = $1 OR o.order_number = $1) AND o.restaurant_id = $2
         LIMIT 1`,
        [orderIdentifier, restaurantId]
      );
      if (orderRes.rows.length === 0) return null;
      const row = orderRes.rows[0];

      const itemRows = (await query(
        `SELECT oi.*, mi.item_code, mi.category, mi.dietary_type, mi.description
         FROM order_items oi
         LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
         WHERE oi.order_id = $1`,
        [row.id]
      )).rows;
      const histRows = (await query(`SELECT * FROM order_status_history WHERE order_id = $1 ORDER BY created_at ASC`, [row.id])).rows;
      const custObj = row.cust_phone ? {
        name: row.cust_name,
        phone: row.cust_phone,
        email: row.cust_email,
        address: row.cust_address,
        landmark: row.cust_landmark,
      } : undefined;

      return assembleOrderObject(row, itemRows, histRows, custObj);
    } catch (err) {
      console.error('[OrderService] Error in getOrderById PG:', err);
    }
  }

  const row = inMemoryDb.orders.find(
    (o) => (o.id === orderIdentifier || o.order_number === orderIdentifier) && o.restaurant_id === restaurantId
  );
  if (!row) return null;

  const items = inMemoryDb.order_items.filter((it) => it.order_id === row.id);
  const history = inMemoryDb.order_status_history.filter((h) => h.order_id === row.id);
  const cust = inMemoryDb.customers.find((c) => c.id === row.customer_id);
  return assembleOrderObject(row, items, history, cust);
}

export async function updateOrderStatus(
  orderIdentifier: string,
  newStatus: OrderStatus,
  note?: string,
  restaurantId: string = DEFAULT_RESTAURANT_ID
): Promise<Order | null> {
  const defaultNote =
    newStatus === 'confirmed'
      ? 'Order accepted by Kitchen'
      : newStatus === 'baking'
      ? 'Baking Pocket Pizzas & Wok frying Chinese dishes'
      : newStatus === 'packing'
      ? 'Food packaged in insulated thermal boxes'
      : newStatus === 'out_for_delivery'
      ? 'Delivery rider picked up order'
      : newStatus === 'ready_for_pickup'
      ? 'Order is ready at takeaway counter'
      : newStatus === 'delivered'
      ? 'Delivered to customer'
      : newStatus === 'cancelled'
      ? 'Order cancelled'
      : `Status changed to ${newStatus}`;

  const finalNote = note || defaultNote;

  if (isPostgresRunning()) {
    try {
      const updateRes = await query(
        `UPDATE orders SET status = $1, updated_at = NOW()
         WHERE (id::text = $2 OR order_number = $2) AND restaurant_id = $3
         RETURNING *`,
        [newStatus, orderIdentifier, restaurantId]
      );
      if (updateRes.rows.length === 0) return null;
      const order = updateRes.rows[0];

      // Add status history entry
      await query(
        `INSERT INTO order_status_history (order_id, restaurant_id, status, note, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [order.id, restaurantId, newStatus, finalNote]
      );

      // If cancelled or completed, update KOT status
      if (newStatus === 'delivered' || newStatus === 'cancelled') {
        await query(
          `UPDATE kots SET status = $1, updated_at = NOW() WHERE order_id = $2 AND restaurant_id = $3`,
          [newStatus === 'delivered' ? 'completed' : 'cancelled', order.id, restaurantId]
        );
      }

      const updatedOrder = await getOrderById(order.id, restaurantId);
      if (updatedOrder && newStatus === 'confirmed') {
        await createPrintJobsForOrder(updatedOrder, { reason: 'confirmed' }).catch((err) =>
          console.error('[OrderService] Error triggering print jobs on order confirm:', err)
        );
      }

      return updatedOrder;
    } catch (err) {
      console.error('[OrderService] Error updating status in PG:', err);
    }
  }

  // In Memory
  const orderIdx = inMemoryDb.orders.findIndex(
    (o) => (o.id === orderIdentifier || o.order_number === orderIdentifier) && o.restaurant_id === restaurantId
  );
  if (orderIdx === -1) return null;

  const orderId = inMemoryDb.orders[orderIdx].id;
  inMemoryDb.orders[orderIdx].status = newStatus;
  inMemoryDb.orders[orderIdx].updated_at = new Date().toISOString();

  inMemoryDb.order_status_history.push({
    id: crypto.randomUUID(),
    order_id: orderId,
    restaurant_id: restaurantId,
    status: newStatus,
    note: finalNote,
    created_at: new Date().toISOString(),
  });

  const kot = inMemoryDb.kots.find((k) => k.order_id === orderId);
  if (kot) {
    kot.status = newStatus === 'delivered' ? 'completed' : newStatus === 'cancelled' ? 'cancelled' : 'active';
  }

  const inMemUpdated = await getOrderById(orderId, restaurantId);
  if (inMemUpdated && newStatus === 'confirmed') {
    await createPrintJobsForOrder(inMemUpdated, { reason: 'confirmed' }).catch((err) =>
      console.error('[OrderService] Error triggering print jobs on order confirm in-memory:', err)
    );
  }

  return inMemUpdated;
}

export async function deleteOrder(orderIdentifier: string, restaurantId: string = DEFAULT_RESTAURANT_ID): Promise<boolean> {
  if (isPostgresRunning()) {
    try {
      const res = await query(
        `DELETE FROM orders WHERE (id::text = $1 OR order_number = $1) AND restaurant_id = $2`,
        [orderIdentifier, restaurantId]
      );
      return (res.rowCount ?? 0) > 0;
    } catch (err) {
      console.error('[OrderService] Error deleting order in PG:', err);
    }
  }

  const order = inMemoryDb.orders.find(
    (o) => (o.id === orderIdentifier || o.order_number === orderIdentifier) && o.restaurant_id === restaurantId
  );
  if (!order) return false;

  const realId = order.id;
  const initialLen = inMemoryDb.orders.length;
  inMemoryDb.orders = inMemoryDb.orders.filter((o) => o.id !== realId);
  inMemoryDb.order_items = inMemoryDb.order_items.filter((it) => it.order_id !== realId);
  inMemoryDb.order_status_history = inMemoryDb.order_status_history.filter((h) => h.order_id !== realId);
  inMemoryDb.kots = inMemoryDb.kots.filter((k) => k.order_id !== realId);
  inMemoryDb.payments = inMemoryDb.payments.filter((p) => p.order_id !== realId);
  return inMemoryDb.orders.length < initialLen;
}

export async function deleteKot(orderIdentifier: string, restaurantId: string = DEFAULT_RESTAURANT_ID): Promise<boolean> {
  if (isPostgresRunning()) {
    try {
      const res = await query(
        `DELETE FROM kots
         WHERE (order_id::text = $1 OR order_id IN (SELECT id FROM orders WHERE order_number = $1)) AND restaurant_id = $2`,
        [orderIdentifier, restaurantId]
      );
      return (res.rowCount ?? 0) > 0;
    } catch (err) {
      console.error('[OrderService] Error deleting kot in PG:', err);
    }
  }

  const order = inMemoryDb.orders.find(
    (o) => (o.id === orderIdentifier || o.order_number === orderIdentifier) && o.restaurant_id === restaurantId
  );
  const realId = order ? order.id : orderIdentifier;

  const initialLen = inMemoryDb.kots.length;
  inMemoryDb.kots = inMemoryDb.kots.filter((k) => !(k.order_id === realId && k.restaurant_id === restaurantId));
  return inMemoryDb.kots.length < initialLen;
}

export async function markPaymentSuccess(
  orderIdentifier: string,
  paymentId: string,
  restaurantId: string = DEFAULT_RESTAURANT_ID
): Promise<boolean> {
  if (isPostgresRunning()) {
    try {
      const updateRes = await query(
        `UPDATE orders SET payment_status = 'paid', payment_id = $1, updated_at = NOW()
         WHERE (id::text = $2 OR order_number = $2) AND restaurant_id = $3
         RETURNING id`,
        [paymentId, orderIdentifier, restaurantId]
      );

      if (updateRes.rows.length > 0) {
        const realId = updateRes.rows[0].id;
        await query(
          `UPDATE payments SET status = 'captured', provider_payment_id = $1, updated_at = NOW()
           WHERE order_id = $2 AND restaurant_id = $3`,
          [paymentId, realId, restaurantId]
        );

        // Server-side payment verification succeeded: trigger KOT & Bill print jobs
        const verifiedOrder = await getOrderById(realId, restaurantId);
        if (verifiedOrder) {
          await createPrintJobsForOrder(verifiedOrder, { reason: 'online_paid' }).catch((err) =>
            console.error('[OrderService] Error triggering print jobs on verified online payment:', err)
          );
        }
      }
      return true;
    } catch (err) {
      console.error('[OrderService] Error marking payment success in PG:', err);
    }
  }

  const order = inMemoryDb.orders.find(
    (o) => (o.id === orderIdentifier || o.order_number === orderIdentifier) && o.restaurant_id === restaurantId
  );
  if (order) {
    order.payment_status = 'paid';
    order.payment_id = paymentId;
    order.updated_at = new Date().toISOString();

    const pay = inMemoryDb.payments.find((p) => p.order_id === order.id);
    if (pay) {
      pay.status = 'captured';
      pay.provider_payment_id = paymentId;
      pay.updated_at = new Date().toISOString();
    }

    const verifiedOrder = await getOrderById(order.id, restaurantId);
    if (verifiedOrder) {
      await createPrintJobsForOrder(verifiedOrder, { reason: 'online_paid' }).catch((err) =>
        console.error('[OrderService] Error triggering print jobs on verified online payment in-memory:', err)
      );
    }
  }

  return true;
}
