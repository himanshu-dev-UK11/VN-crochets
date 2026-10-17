const {send, requireAdmin, handler} = require('../shared/http');
const {saveImage} = require('../shared/storage');

const MAX_BYTES = 4 * 1024 * 1024;

// Check the file's real signature, not just what the browser claims.
function sniff(buf) {
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return ['webp', 'image/webp'];
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return ['jpg', 'image/jpeg'];
  if (buf.length > 8 && buf.toString('hex', 0, 8) === '89504e470d0a1a0a') return ['png', 'image/png'];
  return null;
}

// The panel posts JSON {data: "data:image/png;base64,..."}. Some browsers and
// older builds post multipart/form-data instead, so accept both — the old
// code only understood JSON, which is why uploads silently failed.
function extract(req) {
  const body = req.body;
  if (body && typeof body === 'object' && !Buffer.isBuffer(body) && typeof body.data === 'string') {
    return body.data;
  }
  if (typeof body === 'string' && body.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(body);
      if (typeof parsed.data === 'string') return parsed.data;
    } catch { /* fall through to multipart */ }
  }

  const raw = Buffer.isBuffer(body)
    ? body
    : Buffer.isBuffer(req.rawBody)
      ? req.rawBody
      : typeof req.rawBody === 'string'
        ? Buffer.from(req.rawBody, 'binary')
        : null;
  if (!raw || !raw.length) return '';

  const type = String((req.headers && (req.headers['content-type'] || req.headers['Content-Type'])) || '');
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(type);
  if (type.includes('multipart/form-data') && boundary) {
    const marker = `--${(boundary[1] || boundary[2]).trim()}`;
    const text = raw.toString('binary');
    const start = text.indexOf(marker);
    if (start >= 0) {
      const headerEnd = text.indexOf('\r\n\r\n', start);
      if (headerEnd >= 0) {
        const dataStart = headerEnd + 4;
        const next = text.indexOf(`\r\n${marker}`, dataStart);
        if (next > dataStart) {
          return Buffer.from(text.slice(dataStart, next), 'binary').toString('base64');
        }
      }
    }
  }
  return '';
}

module.exports = handler(async function (context, req) {
  if (!requireAdmin(context, req)) return;

  const data = extract(req).replace(/^data:[^,]*,/, '');
  if (!data) return send(context, 400, {error: 'No image was received. Pick a JPG, PNG or WebP photo and try again.'});

  const buffer = Buffer.from(data, 'base64');
  if (!buffer.length) return send(context, 400, {error: 'That image could not be read.'});
  if (buffer.length > MAX_BYTES) return send(context, 413, {error: 'That image is larger than 4 MB.'});

  const kind = sniff(buffer);
  if (!kind) return send(context, 415, {error: 'Use a JPG, PNG or WebP photo.'});

  const url = await saveImage(buffer, kind[0], kind[1]);
  send(context, 200, {ok: true, url});
});
