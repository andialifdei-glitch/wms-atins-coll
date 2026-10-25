export const formatRupiah = (val: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val || 0);
};

export const buildWhatsAppMessage = (so: any) => {
  const items = so.items || [];
  const totalPcs = items.reduce((acc: number, it: any) => acc + Number(it.qty || 1), 0);
  const subtotalProduk = items.reduce((acc: number, it: any) => acc + Number(it.subtotal || 0), 0);
  const totalBerat = so.totalWeightInGrams || items.reduce((acc: number, it: any) => acc + (Number(it.weightInGrams || 0) * Number(it.qty || 1)), 0);

  let itemsText = "";
  items.forEach((it: any, idx: number) => {
    itemsText += `${idx + 1}. ${it.itemName}\n   Qty: ${it.qty} pcs\n   Harga: ${formatRupiah(Number(it.price || 0))}\n   Subtotal: ${formatRupiah(Number(it.subtotal || 0))}\n`;
  });

  return `SALES ORDER
${so.soId}

Customer: ${so.customerName || "-"}
Alamat: ${so.address || "-"}
${itemsText}-------------------------
Total Item: ${totalPcs} pcs
Total Berat: ${totalBerat} gram
Subtotal Produk: ${formatRupiah(subtotalProduk)}
Total Tagihan: ${formatRupiah(Number(so.total || 0))}`;
};