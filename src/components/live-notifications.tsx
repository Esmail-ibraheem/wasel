"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { markAllNotificationsRead } from "@/app/app/notifications/actions";
import { timeAgo } from "@/lib/format";
import { cx } from "./ui";

export interface NotificationItem {
  id: string;
  transferId: string | null;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

interface Toast {
  id: string;
  title: string;
  body: string;
  transferId: string | null;
}

export function LiveNotifications({ initial, initialUnread }: { initial: NotificationItem[]; initialUnread: number }) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>(initial);
  const [unread, setUnread] = useState(initialUnread);
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [desktop, setDesktop] = useState<NotificationPermission | "unsupported">("default");
  const [, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Keep in sync with server-rendered props after router.refresh()
  useEffect(() => {
    setItems(initial);
    setUnread(initialUnread);
  }, [initial, initialUnread]);

  useEffect(() => {
    setDesktop(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  const dismissToast = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  useEffect(() => {
    const es = new EventSource("/api/events");
    es.addEventListener("ready", () => setConnected(true));
    es.onerror = () => setConnected(false);
    es.addEventListener("transfer", (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as {
        notificationId: string;
        transferId: string;
        title: string;
        body: string;
        createdAt: string;
      };
      setItems((prev) => [
        { id: data.notificationId, transferId: data.transferId, title: data.title, body: data.body, readAt: null, createdAt: data.createdAt },
        ...prev,
      ].slice(0, 10));
      setUnread((n) => n + 1);
      setToasts((t) => [...t, { id: data.notificationId, title: data.title, body: data.body, transferId: data.transferId }]);
      setTimeout(() => dismissToast(data.notificationId), 8000);
      if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
        try {
          const n = new Notification(data.title, { body: data.body, tag: data.notificationId, lang: "ar", dir: "rtl" });
          n.onclick = () => {
            window.focus();
            router.push(`/app/transfers/${data.transferId}`);
          };
        } catch {
          /* ignore */
        }
      }
      startTransition(() => router.refresh());
    });
    return () => es.close();
  }, [router, dismissToast]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const requestDesktop = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setDesktop(p);
  };

  const markAll = () => {
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    startTransition(() => {
      void markAllNotificationsRead();
    });
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-3 text-sm hover:bg-paper"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`الإشعارات، ${unread} غير مقروء`}
      >
        <span
          className={cx("inline-block size-2 rounded-full", connected ? "bg-emerald live-dot" : "bg-faint")}
          title={connected ? "متصل — الإشعارات فورية" : "غير متصل"}
        />
        <BellIcon />
        {unread > 0 && (
          <span className="tnum inline-flex min-w-5 items-center justify-center rounded-full bg-saffron px-1.5 text-[11px] font-semibold text-ink">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute start-0 top-11 z-40 w-[min(92vw,380px)] overflow-hidden rounded-lg border border-line bg-surface shadow-pop">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="text-sm font-semibold">الإشعارات</span>
            <div className="flex items-center gap-3">
              {desktop === "default" && (
                <button type="button" onClick={requestDesktop} className="text-xs text-sky hover:underline">
                  تفعيل تنبيهات سطح المكتب
                </button>
              )}
              {unread > 0 && (
                <button type="button" onClick={markAll} className="text-xs text-muted hover:text-text hover:underline">
                  تعليم الكل كمقروء
                </button>
              )}
            </div>
          </div>
          <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">لا إشعارات بعد.</li>}
            {items.map((n) => (
              <li key={n.id} className={cx(!n.readAt && "bg-saffron-soft/50")}>
                <Link
                  href={n.transferId ? `/app/transfers/${n.transferId}` : "/app/notifications"}
                  onClick={() => setOpen(false)}
                  className="block px-4 py-3 hover:bg-paper"
                >
                  <div className="text-sm font-medium">{n.title}</div>
                  {n.body && <div className="mt-0.5 text-xs text-muted">{n.body}</div>}
                  <div className="mt-1 text-[11px] text-faint">{timeAgo(n.createdAt)}</div>
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-4 py-2 text-center">
            <Link href="/app/notifications" onClick={() => setOpen(false)} className="text-xs text-muted hover:text-text hover:underline">
              كل الإشعارات
            </Link>
          </div>
        </div>
      )}

      {/* Toasts (portaled: the blurred header would otherwise become their containing block) */}
      {mounted &&
        createPortal(
      <div className="pointer-events-none fixed bottom-4 start-4 z-50 flex w-[min(92vw,360px)] flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="toast-in pointer-events-auto stub rounded-lg border border-line bg-surface p-4 shadow-pop" style={{ ["--stub-color" as string]: "var(--color-saffron)" }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{t.title}</div>
                {t.body && <div className="mt-0.5 text-xs text-muted">{t.body}</div>}
                {t.transferId && (
                  <Link href={`/app/transfers/${t.transferId}`} onClick={() => dismissToast(t.id)} className="mt-2 inline-block text-xs font-medium text-sky hover:underline">
                    فتح التحويل
                  </Link>
                )}
              </div>
              <button type="button" onClick={() => dismissToast(t.id)} className="text-faint hover:text-text" aria-label="إغلاق">
                ×
              </button>
            </div>
          </div>
        ))}
      </div>,
          document.body,
        )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Zm4 4a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
