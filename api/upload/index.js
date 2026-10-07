'use strict';
const { requireAdmin } = require('../shared/auth');
const { uploadBuffer } = require('../shared/blob');

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*'
};

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: HEADERS };
    return;
  }

  // Admin-only
  const auth = requireAdmin(req, context);
  if (!auth) return;

  try {
    // Azure Functions v2 delivers the raw body as a Buffer when
    // Content-Type is not application/json.
    // The admin client sends multipart/form-data, so we parse it manually.
    const contentType = req.headers['content-type'] || '';

    if (!contentType.includes('multipart/form-data')) {
      context.res = {
        status: 400, headers: HEADERS,
        body: JSON.stringify({ error: 'Send a multipart/form-data request with an "image" field.' })
      };
      return;
    }

    // Extract boundary from Content-Type header
    const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
    if (!boundaryMatch) {
      context.res = { status: 400, headers: HEADERS, body: JSON.stringify({ error: 'Missing multipart boundary.' }) };
      return;
    }
    const boundary = boundaryMatch[1];

    // Parse the raw buffer manually (no dependency on multer in Functions)
    const rawBody = req.rawBody instanceof Buffer ? req.rawBody : Buffer.from(req.rawBody || '', 'binary');
    const parsed = parseMultipart(rawBody, boundary);

    const imageField = parsed.find(f => f.name === 'image');
    if (!imageField) {
      context.res = { status: 400, headers: HEADERS, body: JSON.stringify({ error: 'No "image" field found.' }) };
      return;
    }

    const mime = imageField.contentType || 'application/octet-stream';
    if (!ALLOWED_MIME.has(mime)) {
      context.res = { status: 400, headers: HEADERS, body: JSON.stringify({ error: 'Only JPG, PNG, or WebP accepted.' }) };
      return;
    }

    if (imageField.data.length > MAX_BYTES) {
      context.res = { status: 400, headers: HEADERS, body: JSON.stringify({ error: 'Image must be under 4 MB.' }) };
      return;
    }

    const url = await uploadBuffer(imageField.data, imageField.filename || 'image.jpg', mime);

    context.res = { status: 200, headers: HEADERS, body: JSON.stringify({ ok: true, url }) };

  } catch (err) {
    context.log.error('upload error:', err.message);
    context.res = { status: 500, headers: HEADERS, body: JSON.stringify({ error: 'Upload failed. Try again.' }) };
  }
};

/**
 * Minimal multipart/form-data parser.
 * Returns array of { name, filename, contentType, data }.
 */
function parseMultipart(buffer, boundary) {
  const parts = [];
  const sep = Buffer.from(`--${boundary}`);
  const crlf = Buffer.from('\r\n');
  const crlfcrlf = Buffer.from('\r\n\r\n');

  let pos = 0;
  while (pos < buffer.length) {
    // Find next boundary
    const boundaryIdx = indexOf(buffer, sep, pos);
    if (boundaryIdx === -1) break;
    pos = boundaryIdx + sep.length;

    // Check for final boundary (--)
    if (buffer[pos] === 0x2d && buffer[pos + 1] === 0x2d) break;

    // Skip CRLF after boundary
    if (buffer[pos] === 0x0d && buffer[pos + 1] === 0x0a) pos += 2;

    // Find end of headers
    const headersEnd = indexOf(buffer, crlfcrlf, pos);
    if (headersEnd === -1) break;

    const headerBlock = buffer.slice(pos, headersEnd).toString('utf8');
    pos = headersEnd + 4; // skip \r\n\r\n

    // Find next boundary (start of next part or end)
    const nextBoundary = indexOf(buffer, sep, pos);
    const dataEnd = nextBoundary === -1 ? buffer.length : nextBoundary - 2; // -2 to strip trailing CRLF

    const data = buffer.slice(pos, dataEnd);

    // Parse headers
    const headers = {};
    for (const line of headerBlock.split('\r\n')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        headers[line.slice(0, colonIdx).trim().toLowerCase()] = line.slice(colonIdx + 1).trim();
      }
    }

    const disposition = headers['content-disposition'] || '';
    const nameMatch = disposition.match(/name="([^"]+)"/);
    const filenameMatch = disposition.match(/filename="([^"]+)"/);

    parts.push({
      name: nameMatch ? nameMatch[1] : null,
      filename: filenameMatch ? filenameMatch[1] : null,
      contentType: headers['content-type'] || null,
      data
    });

    pos = nextBoundary !== -1 ? nextBoundary : buffer.length;
  }

  return parts;
}

function indexOf(buf, search, start = 0) {
  for (let i = start; i <= buf.length - search.length; i++) {
    let match = true;
    for (let j = 0; j < search.length; j++) {
      if (buf[i + j] !== search[j]) { match = false; break; }
    }
    if (match) return i;
  }
  return -1;
}
