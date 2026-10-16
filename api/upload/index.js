const {send, readJson, requireAdmin, handler} = require('../shared/http');
const {saveImage} = require('../shared/storage');

const MAX_BYTES = 4 * 1024 * 1024;

// Check the file's real signature, not just what the browser claims.
function sniff(buf) {
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return ['webp', 'image/webp'];
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return ['jpg', 'image/jpeg'];
  if (buf.length > 8 && buf.toString('hex', 0, 8) === '89504e470d0a1a0a') return ['png', 'image/png'];
  return null;
}

module.exports = handler(async function (context, req) {
  if (!requireAdmin(context, req)) return;

  const body = readJson(req);
  const data = body && typeof body.data === 'string' ? body.data.replace(/^data:[^,]*,/, '') : '';
  if (!data) return send(context, 400, {error: 'No image was received.'});

  const buffer = Buffer.from(data, 'base64');
  if (buffer.length > MAX_BYTES) return send(context, 413, {error: 'That image is larger than 4 MB.'});

  const kind = sniff(buffer);
  if (!kind) return send(context, 415, {error: 'Use a JPG, PNG or WebP photo.'});

  const url = await saveImage(buffer, kind[0], kind[1]);
  send(context, 200, {ok: true, url});
});
