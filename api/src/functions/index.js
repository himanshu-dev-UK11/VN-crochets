const { app } = require('@azure/functions');
const { TableClient } = require('@azure/data-tables');
const { BlobServiceClient } = require('@azure/storage-blob');
const { checkCredentials, issueToken, requireAdmin } = require('../shared/auth');

const connStr = process.env.STORAGE_CONNECTION_STRING;
let productsTable, ordersTable, blobService;

try {
  if (connStr) {
    productsTable = TableClient.fromConnectionString(connStr, 'products');
    ordersTable = TableClient.fromConnectionString(connStr, 'orders');
    blobService = BlobServiceClient.fromConnectionString(connStr);
  }
} catch (err) {
  console.error('Storage init failed:', err);
}

// POST /api/login - Admin login
app.http('login', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'login',
  handler: async (request, context) => {
    try {
      const { username, password } = await request.json();
      
      if (checkCredentials(username, password)) {
        const token = issueToken();
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        };
      }

      return { 
        status: 401, 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid credentials' }) 
      };
    } catch (err) {
      context.log('Login error:', err);
      return { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: err.message || 'Login failed' }) 
      };
    }
  }
});

// GET /api/catalog - List all products
app.http('getCatalog', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'catalog',
  handler: async (request, context) => {
    try {
      if (!productsTable) {
        return { status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([]) };
      }
      
      const products = [];
      const entities = productsTable.listEntities();
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
          img: entity.imageUrl || null
        });
      }
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(products)
      };
    } catch (err) {
      context.log('Error fetching catalog:', err);
      return { status: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Failed to fetch catalog' }) };
    }
  }
});

// POST /api/catalog - Add/update product or full catalog (admin only)
app.http('updateCatalog', {
  methods: ['POST', 'PUT'],
  authLevel: 'anonymous',
  route: 'catalog',
  handler: async (request, context) => {
    if (!requireAdmin(request, context)) return context.res;
    
    try {
      if (!productsTable) {
        return { status: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Storage not configured' }) };
      }

      const body = await request.json();
      const products = Array.isArray(body) ? body : [body];
      
      // Save each product
      for (const product of products) {
        // Skip if missing required fields
        if (!product.n || product.p === undefined || product.p === null) {
          context.log('Skipping product missing name or price:', product);
          continue;
        }

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
          imageUrl: product.image || product.img || ''
        };

        await productsTable.upsertEntity(entity);
      }
      
      return { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true }) 
      };
    } catch (err) {
      context.log('Error updating catalog:', err);
      return { status: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: err.message || 'Failed to update product' }) };
    }
  }
});

// DELETE /api/catalog/:id - Delete product
app.http('deleteCatalog', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'catalog/{id}',
  handler: async (request, context) => {
    if (!requireAdmin(request, context)) return context.res;
    
    try {
      if (!productsTable) {
        return { status: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Storage not configured' }) };
      }

      const id = request.params.id;
      await productsTable.deleteEntity('product', id);
      return { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true }) 
      };
    } catch (err) {
      context.log('Error deleting product:', err);
      return { status: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Failed to delete product' }) };
    }
  }
});

// POST /api/upload - Upload product image (admin only)
app.http('uploadImage', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'upload',
  handler: async (request, context) => {
    if (!requireAdmin(request, context)) return context.res;
    
    try {
      if (!blobService) {
        return { status: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Storage not configured' }) };
      }

      const formData = await request.formData();
      const file = formData.get('image');
      const productId = formData.get('productId') || Date.now().toString();

      if (!file) {
        return { status: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'No file provided' }) };
      }

      const containerClient = blobService.getContainerClient('product-images');
      const ext = file.name.split('.').pop() || 'jpg';
      const blobName = `${productId}-${Date.now()}.${ext}`;
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      const buffer = Buffer.from(await file.arrayBuffer());
      await blockBlobClient.upload(buffer, buffer.length, {
        blobHTTPHeaders: { blobContentType: file.type }
      });

      const imageUrl = blockBlobClient.url;
      return { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: imageUrl }) 
      };
    } catch (err) {
      context.log('Error uploading image:', err);
      return { status: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Failed to upload image' }) };
    }
  }
});

// GET /api/orders - List orders (admin only)
app.http('getOrders', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'orders',
  handler: async (request, context) => {
    if (!requireAdmin(request, context)) return context.res;
    
    try {
      if (!ordersTable) {
        return { status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([]) };
      }

      const orders = [];
      const entities = ordersTable.listEntities();
      
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

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orders)
      };
    } catch (err) {
      context.log('Error fetching orders:', err);
      return { status: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Failed to fetch orders' }) };
    }
  }
});

// POST /api/orders - Save order
app.http('createOrder', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'orders',
  handler: async (request, context) => {
    try {
      if (!ordersTable) {
        return { status: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Storage not configured' }) };
      }

      const order = await request.json();
      
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

      await ordersTable.upsertEntity(entity);
      return { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, orderId: entity.rowKey }) 
      };
    } catch (err) {
      context.log('Error creating order:', err);
      return { status: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Failed to create order' }) };
    }
  }
});

