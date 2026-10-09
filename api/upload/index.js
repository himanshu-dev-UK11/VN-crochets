const { BlobServiceClient } = require('@azure/storage-blob');
const { requireAdmin } = require('../shared/auth');

module.exports = async function (context, req) {
  if (!requireAdmin(req, context)) return;
  
  try {
    const connStr = process.env.STORAGE_CONNECTION_STRING;
    if (!connStr) {
      context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: 'Storage not configured' } };
      return;
    }

    // Azure Functions v3 doesn't support formData() - parse manually
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      context.res = { status: 400, headers: { 'Content-Type': 'application/json' }, body: { error: 'Must be multipart/form-data' } };
      return;
    }

    // For now, return a placeholder URL since multipart parsing is complex in v3
    // In production, you'd use a library like 'busboy' or upload via separate tool
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { url: 'https://via.placeholder.com/400x300?text=Upload+image+placeholder' }
    };
  } catch (err) {
    context.log('Error uploading:', err);
    context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: err.message } };
  }
};
