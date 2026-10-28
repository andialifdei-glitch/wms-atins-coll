import { getWarungAccessToken, warungDatastoreBase } from "@/lib/firebase-admin-warung";

const SCOPES = ["https://www.googleapis.com/auth/datastore", "https://www.googleapis.com/auth/cloud-platform"];

function base() { return warungDatastoreBase(); }

async function getToken() { return getWarungAccessToken(SCOPES); }

async function readDoc(url: string, token: string): Promise<any | null> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("readDoc: HTTP " + res.status);
  return res.json();
}

function intVal(doc: any, key: string): number {
  const v = doc?.fields?.[key]?.integerValue;
  return v ? parseInt(v, 10) : 0;
}

/**
 * Terapkan mutasi stok dalam SATU commit Firestore (atomic).
 * @param opts.allowNegative  jika false, qty hasil harus >= 0
 * @returns balanceBaru
 */
export async function applyStockMutation(opts: {
  productCode: string;
  signedQty: number;      // + masuk, - keluar
  type: string;            // "IN"|"OUT"|"ADJ"|"SOP"|"IP"|"BRK"
  refType?: string;
  refId?: string;
  cost?: number;
  notes?: string;
  actor: { uid: string; id: string; name: string; role: string };
  allowNegative: boolean;
}): Promise<{ balanceBefore: number; balanceAfter: number; movementId: string }> {
  const { productCode, signedQty, type, refType, refId, cost, notes, actor, allowNegative } = opts;
  if (!signedQty) throw new Error("signedQty harus != 0");

  const MAX_RETRY = 3;
  let attempt = 0;
  while (attempt < MAX_RETRY) {
    attempt++;
    try {
      const token = await getToken();
      const baseUrl = base();
      const stockPath = `warung_stocks/${encodeURIComponent(productCode)}`;

      // Begin transaction
      const beginRes = await fetch(`https://firestore.googleapis.com/v1/projects/operasional-warung/databases/(default)/documents:beginTransaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ options: { readWrite: {} } }),
      });
      if (!beginRes.ok) throw new Error("beginTransaction: " + (await beginRes.text()));
      const { transaction } = await beginRes.json();

      // Read stok
      const stockDoc = await readDoc(`${baseUrl}/${stockPath}?transaction=${encodeURIComponent(transaction)}`, token);
      const stockExists = !!stockDoc;
      const balanceBefore = stockDoc ? intVal(stockDoc, "qty") : 0;
      const balanceAfter = balanceBefore + signedQty;

      if (!allowNegative && balanceAfter < 0) {
        await fetch(`https://firestore.googleapis.com/v1/projects/operasional-warung/databases/(default)/documents:rollback`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ transaction }),
        }).catch(() => {});
        throw new Error(`Stok tidak cukup. Saldo saat ini ${balanceBefore}, permintaan ${signedQty}.`);
      }

      // Generate movement ID
      const now = Date.now();
      const movementId = `MV-${now}-${Math.random().toString(36).slice(2, 8)}`;
      const movementPath = `warung_stock_movements/${movementId}`;

      // Siapkan writes
      const writes: any[] = [];

      // 1. Update/create stok
      writes.push({
        update: {
          name: `projects/operasional-warung/databases/(default)/documents/${stockPath}`,
          fields: {
            productCode: { stringValue: productCode },
            qty: { integerValue: String(balanceAfter) },
            lastMovementAt: { timestampValue: new Date().toISOString() },
          },
        },
      });

      // 2. Tulis movement
      const movementFields: any = {
        docId: { stringValue: movementId },
        productCode: { stringValue: productCode },
        type: { stringValue: type },
        qty: { integerValue: String(signedQty) },
        balanceBefore: { integerValue: String(balanceBefore) },
        balanceAfter: { integerValue: String(balanceAfter) },
        actorUid: { stringValue: actor.uid || "" },
        actorId: { stringValue: actor.id || "" },
        actorName: { stringValue: actor.name || "" },
        createdAt: { timestampValue: new Date().toISOString() },
      };
      if (refType) movementFields.refType = { stringValue: refType };
      if (refId) movementFields.refId = { stringValue: refId };
      if (cost !== undefined) movementFields.cost = { integerValue: String(cost) };
      if (notes) movementFields.notes = { stringValue: notes };

      writes.push({
        update: {
          name: `projects/operasional-warung/databases/(default)/documents/${movementPath}`,
          fields: movementFields,
        },
      });

      // Commit
      const commitRes = await fetch(`https://firestore.googleapis.com/v1/projects/operasional-warung/databases/(default)/documents:commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ transaction, writes }),
      });
      if (!commitRes.ok) {
        const txt = await commitRes.text();
        if (txt.includes("ABORTED") || txt.includes("FAILED_PRECONDITION")) {
          console.warn("[applyStockMutation] retry", attempt, txt.slice(0, 100));
          continue;
        }
        throw new Error("commit: " + txt);
      }

      return { balanceBefore, balanceAfter, movementId };
    } catch (err: any) {
      if (attempt >= MAX_RETRY) throw err;
    }
  }
  throw new Error("applyStockMutation: exceeded retry limit");
}

/**
 * Batch mutasi dalam 1 transaction (untuk SOP/IP) — kedua sisi harus konsisten.
 */
export async function applyBatchStockMutations(opts: {
  mutations: Array<{ productCode: string; signedQty: number; cost?: number; notes?: string }>;
  type: string;
  refType?: string;
  refId?: string;
  actor: { uid: string; id: string; name: string; role: string };
  allowNegative: boolean;
}): Promise<{ movements: Array<{ productCode: string; balanceBefore: number; balanceAfter: number; movementId: string }> }> {
  const MAX_RETRY = 3;
  let attempt = 0;
  while (attempt < MAX_RETRY) {
    attempt++;
    try {
      const token = await getToken();
      const baseUrl = base();

      const beginRes = await fetch(`https://firestore.googleapis.com/v1/projects/operasional-warung/databases/(default)/documents:beginTransaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ options: { readWrite: {} } }),
      });
      if (!beginRes.ok) throw new Error("beginTransaction: " + (await beginRes.text()));
      const { transaction } = await beginRes.json();

      const writes: any[] = [];
      const movements: Array<{ productCode: string; balanceBefore: number; balanceAfter: number; movementId: string }> = [];
      const seen = new Set<string>();

      for (const m of opts.mutations) {
        const stockPath = `warung_stocks/${encodeURIComponent(m.productCode)}`;

        let balanceBefore = 0;
        if (seen.has(m.productCode)) {
          // sudah dihitung di iterasi sebelumnya (jarang, tapi handle)
          throw new Error("Duplikat productCode dalam batch: " + m.productCode);
        }
        seen.add(m.productCode);

        const stockDoc = await readDoc(`${baseUrl}/${stockPath}?transaction=${encodeURIComponent(transaction)}`, token);
        balanceBefore = stockDoc ? intVal(stockDoc, "qty") : 0;
        const balanceAfter = balanceBefore + m.signedQty;

        if (!opts.allowNegative && balanceAfter < 0) {
          await fetch(`https://firestore.googleapis.com/v1/projects/operasional-warung/databases/(default)/documents:rollback`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ transaction }),
          }).catch(() => {});
          throw new Error(`Stok produk ${m.productCode} tidak cukup. Saldo ${balanceBefore}, permintaan ${m.signedQty}.`);
        }

        const now = Date.now();
        const movementId = `MV-${now}-${Math.random().toString(36).slice(2, 8)}`;

        writes.push({
          update: {
            name: `projects/operasional-warung/databases/(default)/documents/${stockPath}`,
            fields: {
              productCode: { stringValue: m.productCode },
              qty: { integerValue: String(balanceAfter) },
              lastMovementAt: { timestampValue: new Date().toISOString() },
            },
          },
        });

        const movementFields: any = {
          docId: { stringValue: movementId },
          productCode: { stringValue: m.productCode },
          type: { stringValue: opts.type },
          qty: { integerValue: String(m.signedQty) },
          balanceBefore: { integerValue: String(balanceBefore) },
          balanceAfter: { integerValue: String(balanceAfter) },
          actorUid: { stringValue: opts.actor.uid || "" },
          actorId: { stringValue: opts.actor.id || "" },
          actorName: { stringValue: opts.actor.name || "" },
          createdAt: { timestampValue: new Date().toISOString() },
        };
        if (opts.refType) movementFields.refType = { stringValue: opts.refType };
        if (opts.refId) movementFields.refId = { stringValue: opts.refId };
        if (m.cost !== undefined) movementFields.cost = { integerValue: String(m.cost) };
        const noteText = m.notes || null;
        if (noteText) movementFields.notes = { stringValue: noteText };

        writes.push({
          update: {
            name: `projects/operasional-warung/databases/(default)/documents/warung_stock_movements/${movementId}`,
            fields: movementFields,
          },
        });

        movements.push({ productCode: m.productCode, balanceBefore, balanceAfter, movementId });
      }

      const commitRes = await fetch(`https://firestore.googleapis.com/v1/projects/operasional-warung/databases/(default)/documents:commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ transaction, writes }),
      });
      if (!commitRes.ok) {
        const txt = await commitRes.text();
        if (txt.includes("ABORTED") || txt.includes("FAILED_PRECONDITION")) {
          continue;
        }
        throw new Error("commit: " + txt);
      }

      return { movements };
    } catch (err: any) {
      if (attempt >= MAX_RETRY) throw err;
    }
  }
  throw new Error("applyBatchStockMutations: exceeded retry limit");
}