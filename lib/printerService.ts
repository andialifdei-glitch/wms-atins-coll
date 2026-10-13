export interface LabelData {
  do_number: string;
  expedition: string;
  recipient_name: string;
  recipient_address: string;
  recipient_phone: string;
  so_number: string;
  printed_by: string;
}

export interface StorePrinterConfig {
  store_name: string;
  store_phone: string;
  paper_size: '58mm' | '80mm' | '100mm';
}

class ThermalPrinterService {
  private device: any = null;
  private characteristic: any = null;

  async connect(): Promise<string> {
    if (typeof window === 'undefined' || !(navigator as any).bluetooth) {
      throw new Error('Browser tidak mendukung Web Bluetooth API. Gunakan Chrome/Edge via HTTPS atau localhost.');
    }

    try {
      this.device = await (navigator as any).bluetooth.requestDevice({
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
            return this.device.name || 'Printer Bluetooth';
          }
        }
      }
      throw new Error('Karakteristik writable printer tidak ditemukan');
    } catch (err: any) {
      console.error('Koneksi printer gagal:', err);
      throw err;
    }
  }

  buildLabelBuffer(data: LabelData, config: StorePrinterConfig): Uint8Array {
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
      TITLE_SIZE: config.paper_size === '58mm' ? (GS + '!\x01') : (GS + '!\x11'),
      NORMAL_SIZE: GS + '!\x00',
      FEED: '\n',
      CUT: GS + 'V\x41\x03'
    };

    let content = '';
    content += CMD.INIT;

    // Spasi 1 baris sebelum judul label agar tidak mepet / bertumpuk
    content += CMD.FEED;

    // Judul DELIVERY ORDER
    content += CMD.ALIGN_CENTER + CMD.BOLD_ON + CMD.TITLE_SIZE;
    content += 'DELIVERY ORDER\n';
    content += CMD.NORMAL_SIZE + CMD.BOLD_OFF + CMD.ALIGN_LEFT;

    // DO & Ekspedisi
    content += `DO        : ${data.do_number || '-'}\n`;
    content += `Ekspedisi : ${data.expedition || '-'}\n`;
    content += line;

    // PENGIRIM (diambil dari database)
    content += 'PENGIRIM\n';
    content += `${config.store_name || '-'}\n`;
    content += 'NO HANDPHONE\n';
    content += `${config.store_phone || '-'}\n`;
    content += line;

    // PENERIMA
    content += 'PENERIMA\n';
    content += `${data.recipient_name || '-'}\n`;
    content += 'ALAMAT\n';
    content += `${data.recipient_address || '-'}\n`;
    content += 'NO HANDPHONE\n';
    content += `${data.recipient_phone || '-'}\n`;
    content += line;

    // SO & Timestamp
    content += `SO            : ${data.so_number || '-'}\n`;
    content += `tanggal cetak : ${new Date().toLocaleString('id-ID')}\n`;
    content += `by            : ${data.printed_by || 'Admin'}\n\n\n`;

    content += CMD.CUT;

    return encoder.encode(content);
  }

  async print(data: LabelData, config: StorePrinterConfig): Promise<void> {
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
