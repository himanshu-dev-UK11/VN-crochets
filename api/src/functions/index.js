const { app } = require('@azure/functions');
const { TableClient } = require('@azure/data-tables');
const { BlobServiceClient } = require('@azure/storage-blob');

const connStr = process.env.STORAGE_CONNECTION_STRING;
const tableClient = TableClient.fromConnectionString(connStr, 'products');
const blobServiceClient = BlobServiceClient.fromConnectionString(connStr);

// GET /api/catalog - List all products
app.http('getCatalog', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'catalog',
  handler: async (request, context) => {
    try {
      const products = [];
      const entities = tableClient.listEntities();
      for await (const entity of entities) {
        products.push({
          id: entity.rowKey,
          n: entity.name,
          e: entity.emoji,
          c: entity.category,
          p: entity.price,
          lv: entity.level,
          bg: entity.bg,
          s: entity.size,
          m: JSON.parse(entity.materials || '[]'),
          d: entity.description,
          care: entity.care,
          stock: entity.stock,
          featured: entity.featured,
          active: entity.active
        });
      }
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(products)
      };
    } catch (err) {
      context.log('Error fetching catalog:', err);
      return { status: 500, body: JSON.stringify({ error: 'Failed to fetch catalog' }) };
    }
  }
});

// POST /api/catalog - Add/update product (admin only)
app.http('updateCatalog', {
  methods: ['POST', 'PUT'],
  authLevel: 'anonymous',
  route: 'catalog',
  handler: async (request, context) => {
    try {
      const auth = request.headers.get('authorization');
      if (!checkAuth(auth)) {
        return { status: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
      }

      const product = await request.json();
      const entity = {
        partitionKey: 'product',
        rowKey: product.id.toString(),
        name: product.n,
        emoji: product.e,
        category: product.c,
        price: product.p,
        level: product.lv,
        bg: product.bg,
        size: product.s,
        materials: JSON.stringify(product.m),
        description: product.d,
        care: product.care,
        stock: product.stock,
        featured: product.featured || false,
        active: product.active !== false
      };

      await tableClient.upsertEntity(entity);
      return { status: 200, body: JSON.stringify({ success: true }) };
    } catch (err) {
      context.log('Error updating catalog:', err);
      return { status: 500, body: JSON.stringify({ error: 'Failed to update catalog' }) };
    }
  }
});

// POST /api/upload - Upload product image (admin only)
app.http('uploadImage', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'upload',
  handler: async (request, context) => {
    try {
      const auth = request.headers.get('authorization');
      if (!checkAuth(auth)) {
        return { status: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
      }

      const formData = await request.formData();
      const file = formData.get('image');
      const productId = formData.get('productId');

      if (!file || !productId) {
        return { status: 400, body: JSON.stringify({ error: 'Missing file or productId' }) };
      }

      const containerClient = blobServiceClient.getContainerClient('product-images');
      const blobName = `${productId}-${Date.now()}.jpg`;
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      const buffer = Buffer.from(await file.arrayBuffer());
      await blockBlobClient.upload(buffer, buffer.length, {
        blobHTTPHeaders: { blobContentType: file.type }
      });

      const imageUrl = blockBlobClient.url;
      return { status: 200, body: JSON.stringify({ url: imageUrl }) };
    } catch (err) {
      context.log('Error uploading image:', err);
      return { status: 500, body: JSON.stringify({ error: 'Failed to upload image' }) };
    }
  }
});

// POST /api/orders - Save order (called from WhatsApp redirect)
app.http('createOrder', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'orders',
  handler: async (request, context) => {
    try {
      const order = await request.json();
      const orderTableClient = TableClient.fromConnectionString(connStr, 'orders');
      
      const entity = {
        partitionKey: 'order',
        rowKey: Date.now().toString(),
        customerName: order.name,
        phone: order.phone,
        items: JSON.stringify(order.items),
        total: order.total,
        timestamp: new Date().toISOString(),
        status: 'pending'
      };

      await orderTableClient.upsertEntity(entity);
      return { status: 200, body: JSON.stringify({ success: true, orderId: entity.rowKey }) };
    } catch (err) {
      context.log('Error creating order:', err);
      return { status: 500, body: JSON.stringify({ error: 'Failed to create order' }) };
    }
  }
});

// GET /api/orders - List orders (admin only)
app.http('getOrders', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'orders',
  handler: async (request, context) => {
    try {
      const auth = request.headers.get('authorization');
      if (!checkAuth(auth)) {
        return { status: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
      }

      const orderTableClient = TableClient.fromConnectionString(connStr, 'orders');
      const orders = [];
      const entities = orderTableClient.listEntities();
      
      for await (const entity of entities) {
        orders.push({
          id: entity.rowKey,
          customerName: entity.customerName,
          phone: entity.phone,
          items: JSON.parse(entity.items),
          total: entity.total,
          timestamp: entity.timestamp,
          status: entity.status
        });
      }

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orders)
      };
    } catch (err) {
      context.log('Error fetching orders:', err);
      return { status: 500, body: JSON.stringify({ error: 'Failed to fetch orders' }) };
    }
  }
});

// POST /api/auth/login - Admin login
app.http('login', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/login',
  handler: async (request, context) => {
    try {
      const { username, password } = await request.json();
      
      if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        const token = Buffer.from(`${username}:${password}`).toString('base64');
        return {
          status: 200,
          body: JSON.stringify({ success: true, token })
        };
      }

      return { status: 401, body: JSON.stringify({ error: 'Invalid credentials' }) };
    } catch (err) {
      context.log('Error during login:', err);
      return { status: 500, body: JSON.stringify({ error: 'Login failed' }) };
    }
  }
});

function checkAuth(authHeader) {
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }

  try {
    const token = authHeader.substring(6);
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [username, password] = decoded.split(':');
    return username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD;
  } catch {
    return false;
  }
}
