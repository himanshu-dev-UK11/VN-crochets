const {handler} = require('../shared/http');
const {readImage} = require('../shared/storage');

// Serves product photos when the storage account doesn't allow public blob
// access. Names are unique per upload, so browsers may cache them forever.
module.exports = handler(async function (context, req) {
  const name = String((context.bindingData && context.bindingData.name) || '');
  if (!/^[a-z0-9]+-[a-z0-9]+\.(webp|jpg|png)$/.test(name)) {
    context.res = {status: 404, body: 'Not found'};
    return;
  }
  const blob = await readImage(name);
  if (!blob) {
    context.res = {status: 404, body: 'Not found'};
    return;
  }
  context.res = {
    status: 200,
    isRaw: true,
    headers: {
      'Content-Type': blob.contentType || 'image/webp',
      'Cache-Control': 'public, max-age=31536000, immutable'
    },
    body: blob.buffer
  };
});
