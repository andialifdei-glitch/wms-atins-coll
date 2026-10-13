class ThermalPrinterService {
  constructor() {
    this.device = null;
    this.characteristic = null;
  }

  async connect() {
    try {
      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb',
          'e7810a71-73ae-499d-8c15-fac9a742ee66'
        ]
      });

      const server = await this.device.gatt.connect();
      const services = await server.getPrimaryServices();

      for (const service of services) {
        const chars = await service.getCharacteristics();
        for (const char of chars) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            this.characteristic = char;
            return this.device.name;
          }
        }
      }
      throw new Error('Karakteristik writable printer tidak ditemukan');
    } catch (err) {
      console.error('Koneksi printer gagal:', err);
      throw err;
    }
  }

  buildLabelBuffer(data, config) {
    const encoder = new TextEncoder();
    const maxWidth = config.paper_size === '58mm' ? 32 : (config.paper_size === '80mm' ? 48 : 64);
    const line = '-'.repeat(maxWidth) + '\n';

    const ESC = '\x1B';
    const GS = '\x1D';

    const CMD = {
      INIT: ESC + '@',
      ALIGN_LEFT: ESC + 'a\x00',
      ALIGN_CENTER: ESC + 'a\x01',
      BOLD_ON: ESC + 'E\x01',
      BOLD_OFF: ESC + 'E\x00',
      CUT: GS + 'V\x41\x03'
    };

    let content = '';
    content += CMD.INIT;
    content += CMD.ALIGN_CENTER + CMD.BOLD_ON;
    content += 'DELIVERY ORDER\n';
    content += CMD.BOLD_OFF + CMD.ALIGN_LEFT;

    content += `DO        : ${data.do_number}\n`;
    content += `Ekspedisi : ${data.expedition}\n`;
    content += line;

    content += 'PENGIRIM\n';
    content += `${config.store_name}\n`;
    content += 'NO HANDPHONE\n';
    content += `${config.store_phone}\n`;
    content += line;

    content += 'PENERIMA\n';
    content += `${data.recipient_name}\n`;
    content += 'ALAMAT\n';
    content += `${data.recipient_address}\n`;
    content += 'NO HANDPHONE\n';
    content += `${data.recipient_phone}\n`;
    content += line;

    content += `SO            : ${data.so_number}\n`;
    content += `Tanggal Cetak : ${new Date().toLocaleString('id-ID')}\n`;
    content += `By            : ${data.printed_by}\n\n\n`;

    content += CMD.CUT;

    return encoder.encode(content);
  }

  async print(data, config) {
    if (!this.characteristic) {
      await this.connect();
    }
    const buffer = this.buildLabelBuffer(data, config);
    const chunkSize = 100;
    for (let i = 0; i < buffer.length; i += chunkSize) {
      const chunk = buffer.slice(i, i + chunkSize);
      await this.characteristic.writeValue(chunk);
    }
  }
}

export const printerService = new ThermalPrinterService();
