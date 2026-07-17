const crypto = require('crypto');

const canonicalPrinters = (printers = []) => printers
  .map((printer) => ({
    device_name: String(printer.device_name || ''),
    display_name: String(printer.display_name || printer.device_name || ''),
    description: String(printer.description || ''),
    paper_width_mm: Number(printer.paper_width_mm || 80),
  }))
  .sort((left, right) => left.device_name.localeCompare(right.device_name));

const printerFingerprint = (printers) => crypto
  .createHash('sha256')
  .update(JSON.stringify(canonicalPrinters(printers)))
  .digest('hex');

module.exports = { canonicalPrinters, printerFingerprint };
