"use client";
﻿"use client";

import React, { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";

interface NotificationItem {
  id: string;
  eventType: string;
  message: string;
  documentType: string;
  documentId: string;
  documentNo?: string;
  actorName: string;
  createdAt: any;
  isRead?: boolean;
}

interface NotificationBellProps {
  currentUserId: string;
  currentUserName: string;
  onNavigateToDocument: (documentType: string, documentId: string) => void;
  showAlert: (msg: string, title?: string) => void;
}

export default function NotificationBell({
  currentUserId,
  currentUserName,
  onNavigateToDocument,
  showAlert,
}: NotificationBellProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentUserId) return;
    setLoading(true);

    let unsubscribe = () => {};

    try {
      const q = query(
        collection(db, "notifications"),
        orderBy("createdAt", "desc"),
        limit(50)
      );

      unsubscribe = onSnapshot(
        q,
        async (snapshot) => {
          const items: NotificationItem[] = [];
          let unread = 0;

          for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            const notifId = docSnap.id;

            let isRead = false;
            try {
              const readSnap = await getDoc(doc(db, "notifications", notifId, "reads", currentUserId));
              isRead = readSnap.exists();
            } catch (err) {
              // Abaikan kegagalan baca sub-dokumen reads jika aturan belum mengizinkan
            }

            if (!isRead) unread++;

            items.push({
              id: notifId,
              eventType: data.eventType || "",
              message: data.message || "",
              documentType: data.documentType || "",
              documentId: data.documentId || "",
              documentNo: data.documentNo || "",
              actorName: data.actorName || "",
              createdAt: data.createdAt,
              isRead: isRead,
            });
          }

          setNotifications(items);
          setUnreadCount(unread);
          setLoading(false);
        },
        (error) => {
          console.warn("Izin Firestore pada koleksi notifications dibatasi oleh security rules:", error.message);
          setLoading(false);
        }
      );
    } catch (e) {
      console.warn("Firestore query error:", e);
      setLoading(false);
    }

    return () => unsubscribe();
  }, [currentUserId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function markAsRead(notifId: string) {
    try {
      const readRef = doc(db, "notifications", notifId, "reads", currentUserId);
      await setDoc(readRef, {
        userId: currentUserId,
        userName: currentUserName,
        readAt: serverTimestamp(),
      });

      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.warn("Gagal menandai notifikasi:", err);
    }
  }

  async function markAllAsRead() {
    try {
      const unreadItems = notifications.filter((n) => !n.isRead);
      for (const it of unreadItems) {
        const readRef = doc(db, "notifications", it.id, "reads", currentUserId);
        await setDoc(readRef, {
          userId: currentUserId,
          userName: currentUserName,
          readAt: serverTimestamp(),
        });
      }
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn("Gagal menandai semua notifikasi:", err);
    }
  }

  function handleNotificationClick(item: NotificationItem) {
    if (!item.isRead) {
      markAsRead(item.id);
    }
    setIsOpen(false);
    onNavigateToDocument(item.documentType, item.documentId);
  }

  const formatTimestamp = (ts: any) => {
    if (!ts) return "-";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-900 transition flex items-center justify-center"
        title="Notifikasi Operasional WMS"
      >
        <span className="text-lg">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-[#BE185D] text-white text-[10px] font-bold rounded-full min-w-4 text-center shadow-xs animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-rose-100 z-50 overflow-hidden animate-fadeIn">
          <div className="p-3.5 bg-rose-50/70 border-b border-rose-100 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-rose-950 uppercase">Notifikasi Operasional</h4>
              <p className="text-[10px] text-slate-500">Realtime sinkron Android & Web</p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-[10px] text-[#BE185D] hover:underline font-bold"
              >
                Tandai Semua Dibaca
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-rose-50 text-xs">
            {loading && (
              <div className="p-5 text-center text-slate-400 text-xs">Memuat notifikasi...</div>
            )}

            {!loading && notifications.length === 0 && (
              <div className="p-6 text-center text-slate-400 text-xs">
                Belum ada riwayat notifikasi.
              </div>
            )}

            {!loading &&
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3 cursor-pointer transition flex items-start gap-2.5 hover:bg-rose-50/50 ${
                    !item.isRead ? "bg-rose-50/30" : "bg-white"
                  }`}
                >
                  <div className="mt-0.5">
                    {!item.isRead ? (
                      <span className="w-2 h-2 rounded-full bg-[#BE185D] block"></span>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-200 block"></span>
                    )}
                  </div>

                  <div className="flex-1">
                    <p className={`text-[11px] leading-relaxed ${!item.isRead ? "font-bold text-rose-950" : "text-slate-600"}`}>
                      {item.message}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 font-mono">
                      <span>{item.documentType}</span>
                      <span>{formatTimestamp(item.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}