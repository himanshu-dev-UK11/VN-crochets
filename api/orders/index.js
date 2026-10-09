const { TableClient } = require('@azure/data-tables');
const { requireAdmin } = require('../shared/auth');

module.exports = async function (context, req) {
  const connStr = process.env.STORAGE_CONNECTION_STRING;
  
  if (req.method === 'GET') {
    // Admin only - list orders
    if (!requireAdmin(req, context)) return;
    
    try {
      if (!connStr) {
        context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: [] };
        return;
      }
      
      const table = TableClient.fromConnectionString(connStr, 'orders');
      const orders = [];
      const entities = table.listEntities();
      
      for await (const entity of entities) {
        orders.push({
          id: entity.rowKey,
          customerName: entity.customerName || '',
          phone: entity.phone || '',
          items: entity.items ? JSON.parse(entity.items) : [],
          total: entity.total || 0,
          timestamp: entity.timestamp || '',
          status: entity.status || 'pending'
        });
      }
      
      context.res = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: orders
      };
    } catch (err) {
      context.log('Error fetching orders:', err);
      context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: 'Failed to fetch orders' } };
    }
  } else {
    // POST - public, create order
    try {
      if (!connStr) {
        context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: 'Storage not configured' } };
        return;
      }
      
      const table = TableClient.fromConnectionString(connStr, 'orders');
      const order = req.body;
      
      const entity = {
        partitionKey: 'order',
        rowKey: Date.now().toString(),
        customerName: order.name || '',
        phone: order.phone || '',
        items: JSON.stringify(order.items || []),
        total: order.total || 0,
        timestamp: new Date().toISOString(),
        status: 'pending'
      };
      
      await table.upsertEntity(entity);
      context.res = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { success: true, orderId: entity.rowKey }
      };
    } catch (err) {
      context.log('Error creating order:', err);
      context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: 'Failed to create order' } };
    }
  }
};
