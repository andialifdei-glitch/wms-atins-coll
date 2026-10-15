import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PROJECT_ID = "gen-lang-client-0158803339";
const DATABASE_ID = "ai-studio-android-wmsatins-fb774f20-678f-4586-aeed-4ad08c978b9f";

function getApiKey() {
  return (
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    process.env.FIREBASE_API_KEY ||
    ""
  );
}

function unwrapValue(v: any): any {
  if (!v || typeof v !== "object") return v;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(unwrapValue);
  if ("mapValue" in v) {
    const obj: any = {};
    for (const [mk, mv] of Object.entries(v.mapValue.fields || {})) {
      obj[mk] = unwrapValue(mv);
    }
    return obj;
  }
  return v;
}

function parseDoc(doc: any) {
  if (!doc) return null;
  const id = doc.name ? doc.name.split("/").pop() : "";
  const data: any = { id };
  if (doc.fields) {
    for (const [k, v] of Object.entries(doc.fields)) {
      data[k] = unwrapValue(v);
    }
  }
  return data;
}

function toFirestoreValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "string") return { stringValue: val };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === "object") {
    const fields: any = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function toFirestoreFields(obj: Record<string, any>) {
  const fields: any = {};
  for (const [k, v] of Object.entries(obj)) {
    fields[k] = toFirestoreValue(v);
  }
  return fields;
}

function getLocalDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return { dateDash: `${year}-${month}-${day}`, dateCompact: `${year}${month}${day}` };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { poId, receivedMap, notes = "", actorName = "Admin", actorId = "admin" } = body;

    const apiKey = getApiKey();
    if (!apiKey) {
      return NextResponse.json({ success: false, message: "API Key Firebase belum dikonfigurasi." }, { status: 500 });
    }

    if (!poId || typeof receivedMap !== "object") {
      return NextResponse.json({ success: false, message: "PO ID dan peta barang diterima wajib diisi." }, { status: 400 });
    }

    // 1. Ambil Dokumen PO Terkini dari Database
    const poUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/purchase_orders/${poId}?key=${apiKey}`;
    const poRes = await fetch(poUrl);
    if (!poRes.ok) {
      return NextResponse.json({ success: false, message: `Dokumen PO ${poId} tidak ditemukan di database.` }, { status: 404 });
    }
    const currentPo = parseDoc(await poRes.json());

    if (currentPo.status === "RECEIVED" || currentPo.status === "COMPLETED") {
      return NextResponse.json({ success: false, message: "PO ini sudah selesai diterima seluruhnya." }, { status: 400 });
    }
    if (currentPo.status === "CANCELLED") {
      return NextResponse.json({ success: false, message: "PO ini telah dibatalkan dan tidak dapat diproses." }, { status: 400 });
    }

    // 2. Validasi Kuantitas yang Diterima
    const poItems = Array.isArray(currentPo.items) ? currentPo.items : [];
    const receivedList: any[] = [];
    let hasValidQuantity = false;

    for (const item of poItems) {
      const inputQty = Number(receivedMap[item.sku] || 0);
      if (inputQty < 0) {
        return NextResponse.json({ success: false, message: `Kuantitas untuk ${item.itemName} tidak boleh negatif.` }, { status: 400 });
      }

      const currentReceived = Number(item.receivedQty || 0);
      const totalOrdered = Number(item.qty || 0);
      const remainingQty = Math.max(0, totalOrdered - currentReceived);

      if (inputQty > remainingQty) {
        return NextResponse.json({
          success: false,
          message: `Penerimaan untuk ${item.itemName} (${inputQty} pcs) melebihi sisa PO (${remainingQty} pcs).`
        }, { status: 400 });
      }

      if (inputQty > 0) {
        hasValidQuantity = true;
        receivedList.push({
          sku: item.sku,
          itemName: item.itemName,
          qtyReceived: inputQty,
          purchasingPrice: Number(item.purchasingPrice || 0),
          weightInGrams: Number(item.weightInGrams || 0),
        });
      }
    }

    if (!hasValidQuantity || receivedList.length === 0) {
      return NextResponse.json({ success: false, message: "Pilih minimal satu barang dengan kuantitas lebih dari 0." }, { status: 400 });
    }

    const { dateDash, dateCompact } = getLocalDateString();
    const nowIso = new Date().toISOString();

    // 3. Buat Nomor Dokumen Atomik RCV-YYYYMMDD-XXXX
    const counterDocId = `RCV_${dateCompact}`;
    const counterUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/counters/${counterDocId}?key=${apiKey}`;

    let sequence = 1;
    const counterRes = await fetch(counterUrl);
    if (counterRes.ok) {
      const cData = parseDoc(await counterRes.json());
      sequence = Number(cData?.lastSequence || 0) + 1;
    }

    // Update Counter Sequence
    await fetch(counterUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: toFirestoreFields({
          prefix: `RCV-${dateCompact}`,
          lastSequence: sequence,
          updatedAt: nowIso
        })
      })
    });

    const sequencePadded = String(sequence).padStart(4, "0");
    const receivingDocId = `RCV-${dateCompact}-${sequencePadded}`;

    // 4. Hitung Status PO Baru dan Item Terkini
    let allCompleted = true;
    const updatedPoItems = poItems.map((item: any) => {
      const addedQty = Number(receivedMap[item.sku] || 0);
      const newReceived = Number(item.receivedQty || 0) + addedQty;
      const totalOrdered = Number(item.qty || 0);
      if (newReceived < totalOrdered) {
        allCompleted = false;
      }
      return {
        ...item,
        receivedQty: newReceived,
      };
    });

    const newPoStatus = allCompleted ? "RECEIVED" : "PARTIAL";

    // 5. Eksekusi Batch Write Atomik via Firestore commit API
    const writeOperations: any[] = [];
    const baseDocPath = `projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

    // 5a. Buat Dokumen Receiving
    writeOperations.push({
      update: {
        name: `${baseDocPath}/receivings/${receivingDocId}`,
        fields: toFirestoreFields({
          receivingId: receivingDocId,
          documentNo: receivingDocId,
          poId: currentPo.poId || poId,
          date: dateDash,
          supplier: currentPo.supplier || "-",
          supplierAddress: currentPo.supplierAddress || "",
          supplierPhone: currentPo.supplierPhone || "",
          items: receivedList,
          notes: String(notes).trim(),
          createdBy: actorName,
          createdAt: nowIso,
          updatedAt: nowIso
        })
      }
    });

    // 5b. Update Dokumen PO
    writeOperations.push({
      update: {
        name: `${baseDocPath}/purchase_orders/${poId}`,
        fields: toFirestoreFields({
          ...currentPo,
          items: updatedPoItems,
          status: newPoStatus,
          lastReceivingId: receivingDocId,
          lastReceivingDate: dateDash,
          updatedAt: nowIso,
          updatedBy: actorName
        })
      }
    });

    // 5c. Update Stok Produk dan Catat Stock Movements (Ledger)
    for (const rItem of receivedList) {
      // Ambil stok saat ini dari database
      const prodUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/products/${rItem.sku}?key=${apiKey}`;
      const prodRes = await fetch(prodUrl);
      let prevStock = 0;
      let prodData: any = {};
      if (prodRes.ok) {
        prodData = parseDoc(await prodRes.json());
        prevStock = Number(prodData?.stock || 0);
      }
      const newStock = prevStock + rItem.qtyReceived;

      // Update Product Stock
      writeOperations.push({
        update: {
          name: `${baseDocPath}/products/${rItem.sku}`,
          fields: toFirestoreFields({
            ...prodData,
            stock: newStock,
            lastReceiving: dateDash,
            updatedAt: nowIso,
            updatedBy: actorName
          })
        }
      });

      // Catat Ledger stock_movements
      const movementId = `MOV-${receivingDocId}-${rItem.sku}`;
      writeOperations.push({
        update: {
          name: `${baseDocPath}/stock_movements/${movementId}`,
          fields: toFirestoreFields({
            movementId: movementId,
            date: dateDash,
            timestamp: nowIso,
            type: "RECEIVING",
            referenceId: receivingDocId,
            poReference: currentPo.poId || poId,
            itemCode: rItem.sku,
            itemNameSnapshot: rItem.itemName,
            qtyIn: rItem.qtyReceived,
            qtyOut: 0,
            previousStock: prevStock,
            newStock: newStock,
            reason: `Penerimaan Barang PO ${currentPo.poId || poId} (${receivingDocId})`,
            user: actorName
          })
        }
      });
    }

    // Kirim Transaksi Tunggal Atomik
    const commitUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents:commit?key=${apiKey}`;
    const commitRes = await fetch(commitUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ writes: writeOperations })
    });

    if (!commitRes.ok) {
      const errText = await commitRes.text();
      console.error("[RECEIVING COMMIT ERROR]", errText);
      return NextResponse.json({ success: false, message: `Gagal menyimpan transaksi receiving: ${errText.slice(0, 150)}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        receivingId: receivingDocId,
        poId,
        status: newPoStatus,
        receivedItemsCount: receivedList.length
      }
    });
  } catch (err: any) {
    console.error("[RECEIVING ERROR]", err);
    return NextResponse.json({ success: false, message: err.message || "Internal server error" }, { status: 500 });
  }
}