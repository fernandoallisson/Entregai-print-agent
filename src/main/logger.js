const log = require('electron-log');

function event(name, details = {}) {
  const safe = { ...details };
  delete safe.token;
  delete safe.authorization;
  delete safe.pairing_code;
  log.info(JSON.stringify({ event: name, ...safe }));
}

module.exports = { event, log };
