const {checkCredentials, issueToken, clientIp, lockedFor, recordFail, clearFails} = require('../shared/auth');
const {send, readJson, handler} = require('../shared/http');

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = handler(async function (context, req) {
  const ip = clientIp(req.headers);
  const wait = lockedFor(ip);
  if (wait) {
    return send(context, 429, {error: `Too many attempts. Try again in ${wait} minute${wait === 1 ? '' : 's'}.`});
  }

  const body = readJson(req) || {};
  if (checkCredentials(body.username, body.password)) {
    clearFails(ip);
    return send(context, 200, issueToken(body.remember === true));
  }

  recordFail(ip);
  await pause(600); // slows down guessing without bothering a real person
  send(context, 401, {error: 'That username and password don’t match.'});
});
