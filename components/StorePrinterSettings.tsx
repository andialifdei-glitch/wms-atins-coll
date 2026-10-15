"use client";
import React, { useState, useEffect } from 'react';
import { printerService, StorePrinterConfig } from '../lib/printerService';

export default function StorePrinterSettings() {
  const [settings, setSettings] = useState<StorePrinterConfig>({
    store_name: "Atin's Collection",
    store_phone: '',
    paper_size: '80mm'
  });
  const [deviceConnected, setDeviceConnected] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('wms_store_printer_settings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setSettings((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = () => {
    localStorage.setItem('wms_store_printer_settings', JSON.stringify(settings));
    alert('Pengaturan toko & printer berhasil disimpan!');
  };

  const handleConnectBluetooth = async () => {
    try {
      setIsConnecting(true);
      const name = await printerService.connect();
      setDeviceConnected(name);
      alert(`Terhubung ke printer: ${name}`);
    } catch (err: any) {
      alert('Koneksi Bluetooth gagal: ' + (err?.message || err));
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#F0D5D5] p-6 max-w-xl">
      <h3 className="text-lg font-bold text-[#A75D5D] mb-4">Pengaturan Toko & Printer Bluetooth</h3>

      <div className="space-y-4 text-sm text-gray-700">
        <div>
          <label className="block font-medium mb-1">Nama Toko (Pengirim):</label>
          <input
            type="text"
            name="store_name"
            value={settings.store_name}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#A75D5D]"
            placeholder="Atin's Collection"
          />
        </div>

        <div>
          <label className="block font-medium mb-1">No. Handphone Pengirim:</label>
          <input
            type="text"
            name="store_phone"
            value={settings.store_phone}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#A75D5D]"
            placeholder="0812xxxxxxxx"
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Ukuran Kertas Thermal:</label>
          <select
            name="paper_size"
            value={settings.paper_size}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#A75D5D]"
          >
            <option value="58mm">58 mm (Struk Kecil)</option>
            <option value="80mm">80 mm (Standar Thermal)</option>
            <option value="100mm">100 mm (Label Lebar)</option>
          </select>
        </div>

        <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
          <button
            type="button"
            onClick={handleConnectBluetooth}
            disabled={isConnecting}
            className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium border border-gray-300"
          >
            {isConnecting ? 'Mencari Device...' : (deviceConnected ? `Terhubung: ${deviceConnected}` : 'Hubungkan Printer Bluetooth')}
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-lg bg-[#A75D5D] hover:bg-[#8c4b4b] text-white text-sm font-medium"
          >
            Simpan Pengaturan
          </button>
        </div>
      </div>
    </div>
  );
}
