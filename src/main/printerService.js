const { BrowserWindow } = require('electron');
const { renderJob } = require('./templateRenderer');

class PrinterService {
  constructor(mainWindowProvider, printLayoutProvider = null) {
    this.mainWindowProvider = mainWindowProvider;
    this.printLayoutProvider = printLayoutProvider;
  }

  async listPrinters() {
    const win = this.mainWindowProvider();
    const printers = await win.webContents.getPrintersAsync();
    return printers.map((printer) => ({
      device_name: printer.name,
      display_name: printer.displayName || printer.name,
      description: printer.description || '',
      paper_width_mm: 80,
      sector: 'CAIXA',
      active: printer.status !== 0 ? true : true,
    }));
  }

  async print(job) {
    const deviceName = job.payload?.printer?.deviceName || job.printer?.device_name;
    if (!deviceName && job.printer_id) {
      throw Object.assign(new Error('Impressora não encontrada para o job'), { code: 'PRINTER_NOT_FOUND' });
    }

    const html = renderJob(job, this.printLayoutProvider?.());
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
    try {
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      await new Promise((resolve, reject) => {
        win.webContents.print({
          silent: true,
          deviceName,
          printBackground: false,
          margins: { marginType: 'none' },
        }, (success, failureReason) => {
          if (success) resolve();
          else reject(Object.assign(new Error(failureReason || 'Falha ao imprimir'), { code: failureReason || 'PRINT_FAILED' }));
        });
      });
    } finally {
      win.close();
    }
  }
}

module.exports = PrinterService;
