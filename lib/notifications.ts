import { db } from "./firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export type WmsEventType =
  | "SO_CONFIRMED"
  | "SO_PROCESSING"
  | "SO_READY_TO_DELIVER"
  | "DO_CREATED"
  | "ADJ_CREATED"
  | "PO_CREATED"
  | "RECEIVING_CREATED"
  | "SOP_INITIALIZED"
  | "USER_CREATED";

interface TriggerNotificationParams {
  eventType: WmsEventType;
  documentType: "SO" | "DO" | "PO" | "RECEIVING" | "SOP" | "ADJ" | "USER";
  documentId: string;
  documentNo: string;
  actorId: string;
  actorName: string;
  targetUserName?: string;
}

export function buildNotificationMessage(params: TriggerNotificationParams): string {
  const { eventType, documentNo, actorName, targetUserName } = params;
  const userTarget = targetUserName || documentNo;

  switch (eventType) {
    case "SO_CONFIRMED":
      return `SO : Sales Order confirmed dengan nomor ${documentNo} dibuat oleh ${actorName}`;
    case "SO_PROCESSING":
      return `SO : Sales Order processing dengan nomor ${documentNo} dibuat oleh ${actorName}`;
    case "SO_READY_TO_DELIVER":
      return `SO : Sales Order Ready to Deliver dengan nomor ${documentNo} dibuat oleh ${actorName}`;
    case "DO_CREATED":
      return `DO : Delivery Order dengan nomor ${documentNo} dibuat oleh ${actorName}`;
    case "ADJ_CREATED":
      return `Adj : Adjusment dengan nomor ${documentNo} dibuat oleh ${actorName}`;
    case "PO_CREATED":
      return `PO : Purchasing Order dengan nomor ${documentNo} dibuat oleh ${actorName}`;
    case "RECEIVING_CREATED":
      return `Receiving : Receiving nomor ${documentNo} dibuat oleh ${actorName}`;
    case "SOP_INITIALIZED":
      return `SOP : Initialized Stock Opname dengan nomor ${documentNo} dibuat oleh ${actorName} siap untuk memulai counting`;
    case "USER_CREATED":
      return `User : Pengguna baru ${userTarget} telah ditambahkan oleh ${actorName}`;
    default:
      return `${documentNo} diperbarui oleh ${actorName}`;
  }
}

export async function createOperationalNotification(params: TriggerNotificationParams) {
  try {
    const notifId = `NOTIF-${params.eventType}-${params.documentNo || params.documentId}`;
    const notifRef = doc(db, "notifications", notifId);
    const message = buildNotificationMessage(params);

    await setDoc(
      notifRef,
      {
        notificationId: notifId,
        eventType: params.eventType,
        documentType: params.documentType,
        documentId: params.documentId,
        documentNo: params.documentNo,
        actorId: params.actorId,
        actorName: params.actorName,
        message: message,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error("Gagal membuat notifikasi operasional:", err);
  }
}