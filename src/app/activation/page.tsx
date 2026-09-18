import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { logout } from "@/app/(auth)/actions";
import { Logo } from "@/components/logo";
import { Badge, Mono } from "@/components/ui";
import type { AccessStatus } from "@/lib/licensing/access";

export const metadata: Metadata = { title: "حالة التفعيل" };

const COPY: Record<AccessStatus, { title: string; body: string; tone: "warning" | "danger" | "neutral" | "success" }> = {
  PENDING: {
    title: "حسابك بانتظار التفعيل",
    body: "وصل طلبك إلى مالك النظام وسيراجعه قريبًا. عند التواصل اذكر معرّف المنشأة أدناه. بعد الموافقة سجّل الدخول مجددًا وستجد لوحة التحكم جاهزة.",
    tone: "warning",
  },
  REJECTED: {
    title: "تم رفض طلب التفعيل",
    body: "لم تتم الموافقة على هذا الحساب. إن كان ذلك خطأ، تواصل مع مالك النظام مع ذكر معرّف المنشأة.",
    tone: "danger",
  },
  SUSPENDED: {
    title: "الحساب موقوف مؤقتًا",
    body: "أُوقف الوصول إلى النظام من قبل مالك النظام. لن تُستقبل تحويلات جديدة حتى إعادة التفعيل. تواصل معه لمعرفة السبب.",
    tone: "danger",
  },
  EXPIRED: {
    title: "انتهى ترخيص المنشأة",
    body: "انتهت مدة الترخيص. جدّد الاشتراك مع مالك النظام ليعود الوصول فورًا دون فقدان أي بيانات.",
    tone: "warning",
  },
  NO_LICENSE: {
    title: "لا يوجد ترخيص فعّال",
    body: "الحساب مُفعّل لكن لا يوجد ترخيص ساري. تواصل مع مالك النظام لإصدار ترخيص.",
    tone: "warning",
  },
  ACTIVE: { title: "الحساب فعّال", body: "", tone: "success" },
};

export default async function ActivationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.businessId) redirect(user.isSuperAdmin ? "/admin" : "/login");
  if (user.access.ok) redirect("/app");

  const business = await db.business.findUniqueOrThrow({ where: { id: user.businessId }, select: { name: true, publicId: true, createdAt: true, reviewNote: true, status: true } });
  const c = COPY[user.access.status];

  return (
    <div className="flex min-h-dvh flex-col bg-paper px-6 py-8">
      <div className="mx-auto w-full max-w-lg">
        <Link href="/" className="inline-block">
          <Logo />
        </Link>
        <div className="mt-10 rounded-lg border border-line bg-surface p-8 shadow-card">
          <Badge tone={c.tone}>{c.title}</Badge>
          <h1 className="mt-4 font-display text-2xl font-semibold">{business.name}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">{c.body}</p>

          <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-md border border-line bg-paper p-4 text-sm">
            <dt className="text-muted">معرّف المنشأة</dt>
            <dd>
              <Mono className="text-base font-semibold">{business.publicId}</Mono>
            </dd>
            <dt className="text-muted">تاريخ الطلب</dt>
            <dd className="tnum">{formatDate(business.createdAt)}</dd>
            <dt className="text-muted">المستخدم</dt>
            <dd>
              {user.fullName} · <Mono>{user.username}</Mono>
            </dd>
            {user.access.licenseExpiresAt && (
              <>
                <dt className="text-muted">انتهى في</dt>
                <dd className="tnum">{formatDate(user.access.licenseExpiresAt)}</dd>
              </>
            )}
            {(business.status === "REJECTED" || business.status === "SUSPENDED") && business.reviewNote && (
              <>
                <dt className="text-muted">ملاحظة</dt>
                <dd>{business.reviewNote}</dd>
              </>
            )}
          </dl>

          <div className="mt-6 flex items-center justify-between gap-3">
            <Link href="/activation" className="text-sm text-sky hover:underline">
              تحديث الحالة
            </Link>
            <form action={logout}>
              <button type="submit" className="text-sm text-muted hover:text-text hover:underline">
                تسجيل الخروج
              </button>
            </form>
          </div>
        </div>
        <p className="mt-6 text-xs text-faint">يتم التحقق من حالة التفعيل والترخيص من الخادم المركزي عند كل طلب؛ لا توجد إعدادات محلية يمكن تعديلها لتجاوزه.</p>
      </div>
    </div>
  );
}
