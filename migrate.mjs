import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// 1. Inisialisasi Firebase Admin
if (!fs.existsSync('./serviceAccountKey.json')) {
  console.error('❌ File serviceAccountKey.json tidak ditemukan di folder ini!');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const firestore = admin.firestore();

// 2. Inisialisasi Supabase Client
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Environment variable SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diisi!');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const parseDate = (val) => {
  if (!val) return new Date().toISOString();
  if (val.toDate && typeof val.toDate === 'function') return val.toDate().toISOString();
  if (val._seconds) return new Date(val._seconds * 1000).toISOString();
  return new Date(val).toISOString();
};

async function migrateData() {
  console.log('🚀 Memulai proses migrasi data dari Firestore ke Supabase...');

  const familyIdMap = new Map();
  const productIdMap = new Map();
  const transactionIdMap = new Map();

  try {
    // 1. MIGRASI FAMILY / KATEGORI PRODUK
    console.log('\n[1/5] Migrasi Product Families...');
    const familySnapshot = await firestore.collection('product_families').get();
    for (const doc of familySnapshot.docs) {
      const data = doc.data();
      const payload = {
        code: data.code || 'GEN',
        name: data.name || 'Umum',
        type: (data.type || 'FISIK').toUpperCase(),
        created_at: parseDate(data.createdAt || data.created_at)
      };

      const { data: inserted, error } = await supabase
        .from('product_families')
        .upsert(payload, { onConflict: 'code' })
        .select('id')
        .single();

      if (error) {
        console.error(`❌ Gagal migrasi family ${doc.id}:`, error.message);
      } else {
        familyIdMap.set(doc.id, inserted.id);
      }
    }
    console.log(`✅ Selesai: ${familyIdMap.size} kategori berhasil dipetakan.`);

    // 2. MIGRASI PRODUK & STOK
    console.log('\n[2/5] Migrasi Products...');
    const productSnapshot = await firestore.collection('products').get();
    for (const doc of productSnapshot.docs) {
      const data = doc.data();
      const supabaseFamilyId = familyIdMap.get(data.familyId || data.family_id) || null;

      const payload = {
        sku: data.sku,
        family_id: supabaseFamilyId,
        name: data.name || 'Produk Tanpa Nama',
        type: (data.type || 'FISIK').toUpperCase(),
        hpp: Number(data.hpp || 0),
        selling_price: Number(data.sellingPrice || data.selling_price || 0),
        stock: Number(data.stock || 0),
        min_stock: Number(data.minStock || data.min_stock || 0),
        is_active: data.isActive !== undefined ? data.isActive : true,
        created_at: parseDate(data.createdAt || data.created_at)
      };

      const { data: inserted, error } = await supabase
        .from('products')
        .upsert(payload, { onConflict: 'sku' })
        .select('id')
        .single();

      if (error) {
        console.error(`❌ Gagal migrasi produk ${doc.id}:`, error.message);
      } else {
        productIdMap.set(doc.id, inserted.id);
      }
    }
    console.log(`✅ Selesai: ${productIdMap.size} produk berhasil dipetakan.`);

    // 3. MIGRASI TRANSAKSI & DETAIL ITEM
    console.log('\n[3/5] Migrasi Transaksi & Item...');
    const trxSnapshot = await firestore.collection('transactions').get();
    for (const doc of trxSnapshot.docs) {
      const data = doc.data();
      const payloadTrx = {
        invoice_number: data.invoiceNumber || data.invoice_number || `INV-${doc.id.substring(0, 8)}`,
        customer_name: data.customerName || data.customer_name || 'Umum',
        total_hpp: Number(data.totalHpp || data.total_hpp || 0),
        total_amount: Number(data.totalAmount || data.total_amount || 0),
        payment_method: (data.paymentMethod || data.payment_method || 'TUNAI').toUpperCase(),
        status: (data.status || 'COMPLETED').toUpperCase(),
        notes: data.notes || null,
        created_at: parseDate(data.createdAt || data.created_at)
      };

      const { data: insertedTrx, error: trxErr } = await supabase
        .from('transactions')
        .upsert(payloadTrx, { onConflict: 'invoice_number' })
        .select('id')
        .single();

      if (trxErr) {
        console.error(`❌ Gagal transaksi ${doc.id}:`, trxErr.message);
        continue;
      }
      transactionIdMap.set(doc.id, insertedTrx.id);

      let items = data.items || [];
      if (!items.length) {
        const subItems = await firestore.collection(`transactions/${doc.id}/items`).get();
        items = subItems.docs.map(d => d.data());
      }

      if (items.length > 0) {
        const itemsPayload = items.map(item => ({
          transaction_id: insertedTrx.id,
          product_id: productIdMap.get(item.productId || item.product_id) || null,
          product_name: item.productName || item.product_name || 'Item',
          qty: Number(item.qty || 1),
          hpp: Number(item.hpp || 0),
          price: Number(item.price || 0),
          created_at: parseDate(item.createdAt || data.createdAt)
        }));

        const { error: itemsErr } = await supabase.from('transaction_items').insert(itemsPayload);
        if (itemsErr) console.error(`⚠️ Gagal insert items trx ${doc.id}:`, itemsErr.message);
      }
    }
    console.log(`✅ Selesai: ${transactionIdMap.size} transaksi diproses.`);

    // 4. MIGRASI PIUTANG
    console.log('\n[4/5] Migrasi Receivables (Piutang)...');
    const recSnapshot = await firestore.collection('receivables').get();
    for (const doc of recSnapshot.docs) {
      const data = doc.data();
      const supabaseTrxId = transactionIdMap.get(data.transactionId || data.transaction_id) || null;

      const payload = {
        transaction_id: supabaseTrxId,
        debtor_name: data.debtorName || data.debtor_name || 'Pelanggan',
        total_amount: Number(data.totalAmount || data.total_amount || 0),
        remaining_amount: Number(data.remainingAmount || data.remaining_amount || 0),
        due_date: data.dueDate ? parseDate(data.dueDate).split('T')[0] : null,
        status: (data.status || 'BELUM_LUNAS').toUpperCase(),
        created_at: parseDate(data.createdAt || data.created_at)
      };

      const { error } = await supabase.from('receivables').insert([payload]);
      if (error) console.error(`❌ Gagal piutang ${doc.id}:`, error.message);
    }

    // 5. MIGRASI CASH COUNT
    console.log('\n[5/5] Migrasi Cash Count...');
    const ccSnapshot = await firestore.collection('cash_counts').get();
    for (const doc of ccSnapshot.docs) {
      const data = doc.data();
      const payload = {
        shift_date: data.shiftDate ? parseDate(data.shiftDate).split('T')[0] : new Date().toISOString().split('T')[0],
        opened_by: data.openedBy || data.opened_by || 'Admin',
        opening_cash: Number(data.openingCash || data.opening_cash || 0),
        expected_closing_cash: Number(data.expectedClosingCash || data.expected_closing_cash || 0),
        actual_closing_cash: Number(data.actualClosingCash || data.actual_closing_cash || 0),
        notes: data.notes || null,
        created_at: parseDate(data.createdAt || data.created_at)
      };

      const { error } = await supabase.from('cash_counts').insert([payload]);
      if (error) console.error(`❌ Gagal cash count ${doc.id}:`, error.message);
    }

    console.log('\n🎉 SEMUA DATA BERHASIL DIMIGRASIKAN KE SUPABASE!');
  } catch (err) {
    console.error('Terjadi kesalahan selama migrasi:', err);
  } finally {
    process.exit(0);
  }
}

migrateData();
