import React, { useState, useEffect } from 'react';
import { printerService } from '../services/printerService';

export default function StoreSettings() {
  const [settings, setSettings] = useState({
    store_name: '',
    store_phone: '',
    paper_size: '80mm'
  });
  const [connectedDevice, setConnectedDevice] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem('wms_store_settings');
    if (saved) setSettings(JSON.parse(saved));
  }, []);

  const handleChange = (e) => {
    setSettings({ ...settings, [e.target.name]: e.target.value });
  };

  const saveSettings = () => {
    localStorage.setItem('wms_store_settings', JSON.stringify(settings));
    alert('Pengaturan berhasil disimpan');
  };

  const handlePairBluetooth = async () => {
    try {
      const deviceName = await printerService.connect();
      setConnectedDevice(deviceName || 'Terhubung');
      alert(`Berhasil terhubung ke: ${deviceName}`);
    } catch (err) {
      alert('Gagal menyambungkan Bluetooth: ' + err.message);
    }
  };

  return (
    <div style={{ maxWidth: '500px', padding: '16px' }}>
      <h3>Pengaturan Toko & Printer</h3>
      
      <div>
        <label>Nama Pengirim / Toko:</label>
        <input name="store_name" value={settings.store_name} onChange={handleChange} style={{ width: '100%' }} />
      </div>

      <div style={{ marginTop: '10px' }}>
        <label>No. HP Pengirim:</label>
        <input name="store_phone" value={settings.store_phone} onChange={handleChange} style={{ width: '100%' }} />
      </div>

      <div style={{ marginTop: '10px' }}>
        <label>Ukuran Kertas Thermal:</label>
        <select name="paper_size" value={settings.paper_size} onChange={handleChange} style={{ width: '100%' }}>
          <option value="58mm">58 mm</option>
          <option value="80mm">80 mm</option>
          <option value="100mm">100 mm</option>
        </select>
      </div>

      <div style={{ marginTop: '16px' }}>
        <button type="button" onClick={handlePairBluetooth}>
          {connectedDevice ? `Printer: ${connectedDevice}` : 'Hubungkan Bluetooth Printer'}
        </button>
      </div>

      <div style={{ marginTop: '16px' }}>
        <button onClick={saveSettings} style={{ background: '#2563eb', color: '#fff' }}>Simpan Pengaturan</button>
      </div>
    </div>
  );
}
