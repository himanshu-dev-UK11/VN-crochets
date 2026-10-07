// Shared Azure Blob Storage client
const { BlobServiceClient } = require('@azure/storage-blob');
const path = require('path');

function getContainerClient() {
  const connStr = process.env.BLOB_CONNECTION_STRING;
  if (!connStr) throw new Error('BLOB_CONNECTION_STRING must be set.');
  const blobService = BlobServiceClient.fromConnectionString(connStr);
  const containerName = process.env.BLOB_CONTAINER || 'product-images';
  return blobService.getContainerClient(containerName);
}

async function uploadBuffer(buffer, originalName, mimeType) {
  const containerClient = getContainerClient();
  // Ensure the container exists and is publicly readable
  await containerClient.createIfNotExists({ access: 'blob' });

  const ext = path.extname(originalName).toLowerCase() || '.jpg';
  const blobName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const blockBlob = containerClient.getBlockBlobClient(blobName);

  await blockBlob.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: mimeType }
  });

  return blockBlob.url; // permanent public URL
}

module.exports = { uploadBuffer };
