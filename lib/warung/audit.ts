import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";

export interface AuditActor {
  uid: string;
  id: string;
  name: string;
  role: string;
}

export async function writeAuditLog(opts: {
  actor: AuditActor;
  action: string;
  entity: string;
  entityId: string;
  before?: any;
  after?: any;
}): Promise<void> {
  try {
    const docId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const url = `${warungDatastoreBase()}/warung_audit_logs/${docId}`;
    const body = {
      fields: {
        action: { stringValue: opts.action },
        entity: { stringValue: opts.entity },
        entityId: { stringValue: opts.entityId },
        actorUid: { stringValue: opts.actor.uid || "" },
        actorId: { stringValue: opts.actor.id || "" },
        actorName: { stringValue: opts.actor.name || "" },
        actorRole: { stringValue: opts.actor.role || "" },
        before: opts.before !== undefined ? { stringValue: JSON.stringify(opts.before) } : { nullValue: null },
        after: opts.after !== undefined ? { stringValue: JSON.stringify(opts.after) } : { nullValue: null },
        createdAt: { timestampValue: new Date().toISOString() },
      },
    };
    await warungFsFetch(url, { method: "PATCH", body: JSON.stringify(body) });
  } catch (err: any) {
    console.error("[audit] writeAuditLog error:", err?.message || err);
  }
}