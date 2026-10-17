// Azure Blob Storage access.
//   site-data       (private)  store.json = {products, settings}, orders/*.json
//   product-images  (public if the account allows it, otherwise served
//                    through /api/image/<name>)

const {BlobServiceClient} = require('@azure/storage-blob');
const {httpError} = require('./auth');

const DATA = process.env.DATA_CONTAINER || 'site-data';
const IMAGES = process.env.BLOB_CONTAINER || 'product-images';
const STORE = 'store.json';

let service = null;
const ready = new Map();

function svc() {
  if (service) return service;
  const conn = process.env.STORAGE_CONNECTION_STRING || process.env.BLOB_CONNECTION_STRING;
  if (!conn) {
    throw httpError(503, 'Storage is not configured. In the Azure portal open your Static Web App → Environment variables and add STORAGE_CONNECTION_STRING (the connection string of a Storage account), then redeploy.');
  }
  service = BlobServiceClient.fromConnectionString(conn);
  return service;
}

// Create each container once per instance. The image container asks for
// anonymous read access; many accounts forbid that, so fall back to private
// and remember to serve images through the API instead.
function container(name) {
  if (!ready.has(name)) {
    const client = svc().getContainerClient(name);
    const p = (async () => {
      let isPublic = false;
      if (name === IMAGES) {
        try {
          await client.createIfNotExists({access: 'blob'});
        } catch (err) {
          if (err.code !== 'PublicAccessNotPermitted' && err.statusCode !== 409) throw err;
          await client.createIfNotExists();
        }
        try {
          const policy = await client.getAccessPolicy();
          isPublic = policy.blobPublicAccess === 'blob' || policy.blobPublicAccess === 'container';
        } catch {
          isPublic = false;
        }
      } else {
        await client.createIfNotExists();
      }
      return {client, isPublic};
    })();
    p.catch(() => ready.delete(name));
    ready.set(name, p);
  }
  return ready.get(name);
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function readBlob(containerName, blobName) {
  const {client} = await container(containerName);
  try {
    const res = await client.getBlockBlobClient(blobName).download();
    return {buffer: await streamToBuffer(res.readableStreamBody), etag: res.etag, contentType: res.contentType};
  } catch (err) {
    if (err.statusCode === 404) return null;
    throw err;
  }
}

async function writeBlob(containerName, blobName, buffer, {contentType, cacheControl, ifMatch, ifNoneMatch} = {}) {
  const {client} = await container(containerName);
  const conditions = {};
  if (ifMatch) conditions.ifMatch = ifMatch;
  if (ifNoneMatch) conditions.ifNoneMatch = ifNoneMatch;
  try {
    const res = await client.getBlockBlobClient(blobName).upload(buffer, buffer.length, {
      blobHTTPHeaders: {blobContentType: contentType, blobCacheControl: cacheControl},
      conditions
    });
    return res.etag;
  } catch (err) {
    if (err.statusCode === 412 || (err.statusCode === 409 && ifNoneMatch)) {
      throw httpError(409, 'The shop was changed on another device. Reload to get the latest version, then make your change again.');
    }
    throw err;
  }
}

// ── Store document (products + settings) ────────────────────────────────────

async function readStore() {
  const blob = await readBlob(DATA, STORE);
  if (!blob) return null;
  let parsed;
  try { parsed = JSON.parse(blob.buffer.toString('utf8')); } catch { return null; }
  return {...parsed, etag: blob.etag};
}

async function writeStore(doc, etag) {
  const buffer = Buffer.from(JSON.stringify(doc));
  let current = etag;
  if (!current) {
    // First save from this browser: match whatever version is live instead of
    // demanding the blob not exist (it usually does after the first save).
    const existing = await readStore();
    current = existing ? existing.etag : null;
  }
  return writeBlob(DATA, STORE, buffer, {
    contentType: 'application/json',
    cacheControl: 'no-cache',
    ...(current ? {ifMatch: current} : {ifNoneMatch: '*'})
  });
}

// ── Images ──────────────────────────────────────────────────────────────────

const DATA_URL = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/;

function isDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:image/');
}

function decodeDataUrl(value) {
  const m = DATA_URL.exec(String(value || ''));
  if (!m) return null;
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  return {buffer: Buffer.from(m[2], 'base64'), ext, contentType: `image/${m[1] === 'jpg' ? 'jpeg' : m[1]}`};
}

async function saveImage(buffer, ext, contentType) {
  const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const {client, isPublic} = await container(IMAGES);
  await writeBlob(IMAGES, name, buffer, {
    contentType,
    cacheControl: 'public, max-age=31536000, immutable'
  });
  return isPublic ? client.getBlockBlobClient(name).url : `/api/image/${name}`;
}

async function readImage(name) {
  return readBlob(IMAGES, name);
}

// ── Orders ──────────────────────────────────────────────────────────────────

async function saveOrder(order) {
  const blobName = `orders/${order.createdAt.replace(/[:.]/g, '-')}-${order.id}.json`;
  await writeBlob(DATA, blobName, Buffer.from(JSON.stringify(order)), {contentType: 'application/json'});
  return blobName;
}

async function listOrders(limit = 200) {
  const {client} = await container(DATA);
  const names = [];
  for await (const item of client.listBlobsFlat({prefix: 'orders/'})) names.push(item.name);
  names.sort().reverse();
  const picked = names.slice(0, limit);
  const out = [];
  // Read in small batches to stay friendly to the storage account.
  for (let i = 0; i < picked.length; i += 10) {
    const batch = await Promise.all(picked.slice(i, i + 10).map(async (name) => {
      const blob = await readBlob(DATA, name);
      if (!blob) return null;
      try { return {...JSON.parse(blob.buffer.toString('utf8')), key: name}; } catch { return null; }
    }));
    out.push(...batch.filter(Boolean));
  }
  return out;
}

async function updateOrderStatus(key, status) {
  if (!/^orders\/[\w.-]+\.json$/.test(key)) throw httpError(400, 'Unknown order.');
  const blob = await readBlob(DATA, key);
  if (!blob) throw httpError(404, 'That order no longer exists.');
  const order = JSON.parse(blob.buffer.toString('utf8'));
  order.status = status;
  order.updatedAt = new Date().toISOString();
  await writeBlob(DATA, key, Buffer.from(JSON.stringify(order)), {contentType: 'application/json', ifMatch: blob.etag});
  return {...order, key};
}

module.exports = {
  readStore, writeStore, saveImage, readImage,
  saveOrder, listOrders, updateOrderStatus,
  isDataUrl, decodeDataUrl
};
