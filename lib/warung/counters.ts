import { getWarungAccessToken, warungDatastoreBase } from "@/lib/firebase-admin-warung";

const SCOPES = [
  "https://www.googleapis.com/auth/datastore",
  "https://www.googleapis.com/auth/cloud-platform",
];

function baseDocumentsUrl() {
  return warungDatastoreBase();
}

// Increment counter secara atomic (retry 3x pada ABORTED / FAILED_PRECONDITION)
export async function nextSequence(counterName: string, startAt = 1): Promise<number> {
  const MAX_RETRY = 3;
  let attempt = 0;
  while (attempt < MAX_RETRY) {
    attempt++;
    try {
      const token = await getWarungAccessToken(SCOPES);
      const base = baseDocumentsUrl();

      // 1. Begin transaction
      const beginRes = await fetch(`https://firestore.googleapis.com/v1/projects/operasional-warung/databases/(default)/documents:beginTransaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ options: { readWrite: {} } }),
      });
      if (!beginRes.ok) throw new Error("beginTransaction: " + (await beginRes.text()));
      const beginData: any = await beginRes.json();
      const transaction = beginData.transaction;

      // 2. Read counter dalam transaksi
      const counterPath = `warung_counters/${encodeURIComponent(counterName)}`;
      const getRes = await fetch(`${base}/${counterPath}?transaction=${encodeURIComponent(transaction)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      let currentValue = startAt - 1;
      let exists = false;
      if (getRes.ok) {
        const doc: any = await getRes.json();
        exists = true;
        const raw = doc.fields?.value?.integerValue;
        if (raw) currentValue = parseInt(raw, 10);
      } else if (getRes.status !== 404) {
        // Rollback
        await fetch(`https://firestore.googleapis.com/v1/projects/operasional-warung/databases/(default)/documents:rollback`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ transaction }),
        }).catch(() => {});
        throw new Error("read counter: HTTP " + getRes.status);
      }

      const nextValue = currentValue + 1;

      // 3. Commit dengan write counter
      const commitBody: any = {
        transaction,
        writes: [
          exists
            ? {
                update: {
                  name: `projects/operasional-warung/databases/(default)/documents/${counterPath}`,
                  fields: {
                    value: { integerValue: String(nextValue) },
                    updatedAt: { timestampValue: new Date().toISOString() },
                  },
                },
              }
            : {
                update: {
                  name: `projects/operasional-warung/databases/(default)/documents/${counterPath}`,
                  fields: {
                    value: { integerValue: String(nextValue) },
                    createdAt: { timestampValue: new Date().toISOString() },
                  },
                },
              },
        ],
      };
      const commitRes = await fetch(`https://firestore.googleapis.com/v1/projects/operasional-warung/databases/(default)/documents:commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(commitBody),
      });
      if (!commitRes.ok) {
        const txt = await commitRes.text();
        if (txt.includes("ABORTED") || txt.includes("FAILED_PRECONDITION")) {
          continue; // retry
        }
        throw new Error("commit: " + txt);
      }

      return nextValue;
    } catch (err: any) {
      if (attempt >= MAX_RETRY) throw err;
    }
  }
  throw new Error("nextSequence: exceeded retry limit");
}

// Helper: pad nomor urut ke 3 digit (untuk PRD-XXX-001)
export function padSequence(seq: number, width = 3): string {
  return String(seq).padStart(width, "0");
}

// Helper untuk generate docId dokumen harian (SOP-YYYYMMDD-XXX)
export function makeDatedDocId(prefix: string, seq: number): string {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `${prefix}-${ymd}-${String(seq).padStart(3, "0")}`;
}