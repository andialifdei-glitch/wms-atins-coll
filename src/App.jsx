import React, { useState } from 'react';
import StoreSettings from './components/StoreSettings';
import DeliveryOrderList from './components/DeliveryOrderList';

export default function App() {
  const [activeTab, setActiveTab] = useState('do');

  // Dummy data Delivery Order untuk pengujian
  const dummyDO = [
    {
      do_number: 'DO-2026-0001',
      so_number: 'SO-2026-9901',
      recipient_name: 'Budi Santoso',
      recipient_phone: '081298765432',
      recipient_address: 'Jl. Melati No. 12, Bandung',
      expedition: 'J&T Express'
    },
    {
      do_number: 'DO-2026-0002',
      so_number: 'SO-2026-9902',
      recipient_name: 'Siti Aminah',
      recipient_phone: '085712345678',
      recipient_address: 'Jl. Mawar No. 45, Jakarta Selatan',
      expedition: 'SiCepat'
    }
  ];

  return (
    <div style={{ padding: '24px', fontFamily: 'sans-serif' }}>
      <header style={{ marginBottom: '20px', borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>
        <h2>Portal WMS</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => setActiveTab('do')} 
            style={{ fontWeight: activeTab === 'do' ? 'bold' : 'normal' }}
          >
            Delivery Order
          </button>
          <button 
            onClick={() => setActiveTab('settings')} 
            style={{ fontWeight: activeTab === 'settings' ? 'bold' : 'normal' }}
          >
            Pengaturan Toko & Printer
          </button>
        </div>
      </header>

      <main>
        {activeTab === 'do' && (
          <DeliveryOrderList doList={dummyDO} currentUser={{ name: 'Admin WMS' }} />
        )}
        {activeTab === 'settings' && (
          <StoreSettings />
        )}
      </main>
    </div>
  );
}
