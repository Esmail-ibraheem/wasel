import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { Card, EmptyState, Pagination, PageHeader, cx } from "@/components/ui";
import { InlineAction } from "@/components/form";
import { markAllNotificationsRead, markNotificationRead } from "./actions";

export const metadata: Metadata = { title: "الإشعارات" };
const PAGE_SIZE = 30;

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [total, unread, rows] = await Promise.all([
    db.notification.count({ where: { userId: user.id } }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="الإشعارات"
        description={unread > 0 ? `${unread} إشعار غير مقروء` : "كل الإشعارات مقروءة"}
        actions={
          unread > 0 ? (
            <form action={markAllNotificationsRead}>
              <button type="submit" className="text-sm text-muted hover:text-text hover:underline">
                تعليم الكل كمقروء
              </button>
            </form>
          ) : undefined
        }
      />
      <Card>
        {rows.length === 0 ? (
          <EmptyState title="لا إشعارات بعد" body="ستصلك الإشعارات هنا وفي الجرس أعلى الصفحة فور وصول تحويل جديد." />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((n) => (
              <li key={n.id} className={cx("flex items-start gap-4 px-5 py-4", !n.readAt && "bg-saffron-soft/40")}>
                <div className="min-w-0 flex-1">
                  <Link href={n.transferId ? `/app/transfers/${n.transferId}` : "#"} className="block text-sm font-medium hover:underline">
                    {n.title}
                  </Link>
                  {n.body && <div className="mt-0.5 text-xs text-muted">{n.body}</div>}
                  <div className="mt-1 text-[11px] text-faint tnum">{formatDateTime(n.createdAt)}</div>
                </div>
                {!n.readAt && (
                  <InlineAction action={markNotificationRead} hidden={{ id: n.id }} variant="ghost">
                    تعليم كمقروء
                  </InlineAction>
                )}
              </li>
            ))}
          </ul>
        )}
        <Pagination page={page} pages={pages} hrefFor={(p) => `/app/notifications?page=${p}`} />
      </Card>
    </div>
  );
}
