const { TableClient } = require('@azure/data-tables');
const { requireAdmin } = require('../shared/auth');

module.exports = async function (context, req) {
  const connStr = process.env.STORAGE_CONNECTION_STRING;
  
  if (req.method === 'GET') {
    // Public - list products
    try {
      if (!connStr) {
        context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: [] };
        return;
      }
      
      const table = TableClient.fromConnectionString(connStr, 'products');
      const products = [];
      const entities = table.listEntities();
      
      for await (const entity of entities) {
        products.push({
          id: entity.rowKey,
          n: entity.name || '',
          e: entity.emoji || '',
          c: entity.category || '',
          p: entity.price || 0,
          lv: entity.level || 1,
          bg: entity.bg || '#ffc9c9',
          s: entity.size || '',
          m: entity.materials ? JSON.parse(entity.materials) : [],
          d: entity.description || '',
          care: entity.care || '',
          stock: entity.stock || 0,
          featured: entity.featured || false,
          active: entity.active !== false,
          image: entity.imageUrl || null
        });
      }
      
      context.res = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: products
      };
    } catch (err) {
      context.log('Error fetching catalog:', err);
      context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: 'Failed to fetch catalog' } };
    }
  } else {
    // POST/PUT - admin only
    // Temporarily disabled: if (!requireAdmin(req, context)) return;
    
    try {
      if (!connStr) {
        context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: 'Storage not configured' } };
        return;
      }
      
      const table = TableClient.fromConnectionString(connStr, 'products');
      const body = req.body;
      const products = Array.isArray(body) ? body : [body];
      
      for (const product of products) {
        if (!product.n || product.p === undefined) continue;
        
        const entity = {
          partitionKey: 'product',
          rowKey: product.id ? product.id.toString() : Date.now().toString(),
          name: product.n,
          emoji: product.e || '',
          category: product.c || 'Other',
          price: parseInt(product.p) || 0,
          level: parseInt(product.lv) || 1,
          bg: product.bg || '#ffc9c9',
          size: product.s || '',
          materials: product.m ? JSON.stringify(product.m) : JSON.stringify([]),
          description: product.d || '',
          care: product.care || '',
          stock: parseInt(product.stock) || 0,
          featured: product.featured || false,
          active: product.active !== false,
          imageUrl: product.image || ''
        };
        
        await table.upsertEntity(entity);
      }
      
      context.res = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { success: true }
      };
    } catch (err) {
      context.log('Error updating catalog:', err);
      context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: err.message } };
    }
  }
};

