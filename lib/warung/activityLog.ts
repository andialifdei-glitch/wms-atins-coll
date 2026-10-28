import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";

export type ActivityCategory = "COA" | "JOURNAL" | "CASH_FLOW" | "RECEIVABLE" | "PAYABLE";
export type ActivityAction = "CREATE" | "UPDATE" | "DELETE" | "POST" | "PAY" | "VOID";
export type ActivityActor = { uid: string; id: string; name: string; role: string };

export async function logActivity(opts: {
  category: ActivityCategory;
  action: ActivityAction;
  entityId: string;
  entityLabel: string;
  amount?: number;
  journalId?: string;
  actor: ActivityActor;
  notes?: string;
}): Promise<void> {
  try {
    const now = Date.now();
    const logId = `AL-${now}-${Math.random().toString(36).slice(2, 8)}`;
    const url = `${warungDatastoreBase()}/warung_activity_logs/${logId}`;
    const payload = {
      fields: {
        logId: { stringValue: logId },
        category: { stringValue: opts.category },
        action: { stringValue: opts.action },
        entityId: { stringValue: opts.entityId },
        entityLabel: { stringValue: opts.entityLabel },
        amount: { integerValue: String(opts.amount || 0) },
        journalId: { stringValue: opts.journalId || "" },
        actorUid: { stringValue: opts.actor.uid || "" },
        actorId: { stringValue: opts.actor.id || "" },
        actorName: { stringValue: opts.actor.name || "" },
        actorRole: { stringValue: opts.actor.role || "" },
        notes: { stringValue: opts.notes || "" },
        createdAt: { timestampValue: new Date().toISOString() },
      },
    };
    await warungFsFetch(url, { method: "PATCH", body: JSON.stringify(payload) });
  } catch (err: any) {
    console.error("[activityLog] error:", err?.message || err);
  }
}