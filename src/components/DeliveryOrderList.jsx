import React, { useState } from 'react';
import { printerService } from '../services/printerService';

export default function DeliveryOrderList({ doList, currentUser }) {
  const [selectedDO, setSelectedDO] = useState(null);
  const [loadingPrint, setLoadingPrint] = useState(false);

  const handlePrint = async () => {
    const config = JSON.parse(localStorage.getItem('wms_store_settings') || '{}');
    if (!config.store_name || !config.store_phone) {
      alert('Lengkapi pengaturan toko terlebih dahulu');
      return;
    }

    try {
      setLoadingPrint(true);
      await printerService.print({
        do_number: selectedDO.do_number,
        expedition: selectedDO.expedition,
        recipient_name: selectedDO.recipient_name,
        recipient_address: selectedDO.recipient_address,
        recipient_phone: selectedDO.recipient_phone,
        so_number: selectedDO.so_number,
        printed_by: currentUser?.name || 'Admin'
      }, config);
      alert('Label berhasil dikirim ke printer');
    } catch (err) {
      alert('Gagal mencetak: ' + err.message);
    } finally {
      setLoadingPrint(false);
    }
  };

  return (
    <div>
      <h3>Daftar Delivery Order</h3>
      <table>
        <thead>
          <tr>
            <th>No DO</th>
            <th>No SO</th>
            <th>Penerima</th>
            <th>Ekspedisi</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {doList && doList.map((row) => (
            <tr key={row.do_number}>
              <td>{row.do_number}</td>
              <td>{row.so_number}</td>
              <td>{row.recipient_name}</td>
              <td>{row.expedition}</td>
              <td>
                <button onClick={() => setSelectedDO(row)}>Detail</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedDO && (
        <div style={modalBackdropStyle}>
          <div style={modalContentStyle}>
            <h4>Detail Delivery Order</h4>
            <p><strong>No DO:</strong> {selectedDO.do_number}</p>
            <p><strong>No SO:</strong> {selectedDO.so_number}</p>
            <p><strong>Penerima:</strong> {selectedDO.recipient_name}</p>
            <p><strong>Alamat:</strong> {selectedDO.recipient_address}</p>
            <p><strong>No HP:</strong> {selectedDO.recipient_phone}</p>
            <p><strong>Ekspedisi:</strong> {selectedDO.expedition}</p>

            <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
              <button 
                onClick={handlePrint} 
                disabled={loadingPrint}
                style={{ background: '#16a34a', color: '#fff' }}
              >
                {loadingPrint ? 'Mencetak...' : 'Cetak Label'}
              </button>
              <button onClick={() => setSelectedDO(null)}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const modalBackdropStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center'
};

const modalContentStyle = {
  background: '#fff', padding: '20px', borderRadius: '8px', minWidth: '350px'
};
