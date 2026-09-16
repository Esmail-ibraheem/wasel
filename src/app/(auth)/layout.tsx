import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { Logo } from "@/components/logo";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user) redirect(user.businessId ? "/app" : "/admin");

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Form column */}
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <div className="mb-10">
          <Link href="/" className="inline-flex items-center gap-2">
            <Logo />
          </Link>
        </div>
        <div className="mx-auto w-full max-w-md flex-1">{children}</div>
        <p className="mt-10 text-xs text-faint">© {new Date().getFullYear()} نظام واصل — متابعة التحويلات الواردة</p>
      </div>

      {/* Thesis panel: an SMS becomes a ledger row. */}
      <aside className="relative hidden overflow-hidden bg-ink text-white lg:block">
        <div className="absolute inset-0 opacity-[0.07]" aria-hidden>
          <div
            className="size-full"
            style={{
              backgroundImage:
                "linear-gradient(to left, rgba(255,255,255,.7) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.7) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
        </div>
        <div className="relative flex h-full flex-col justify-center px-12 py-16 xl:px-20">
          <p className="mb-3 text-sm font-medium text-saffron">لماذا واصل؟</p>
          <h2 className="font-display text-4xl font-semibold leading-[1.25] xl:text-5xl">
            رسالة التحويل تصل إلى هاتف واحد.
            <br />
            <span className="text-white/70">القرار يحتاجه الجميع.</span>
          </h2>

          <div className="mt-12 grid max-w-xl gap-4">
            {/* SMS bubble */}
            <div className="ms-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-white/10 px-5 py-4 text-sm leading-relaxed text-white/90 ring-1 ring-white/15">
              <div className="mb-1 text-[11px] font-medium text-white/50">Jaib · الآن</div>
              تم استلام مبلغ <span className="amount text-base text-saffron">50,000</span> ريال يمني من 777123456 (أحمد محمد).
              رقم العملية: <span className="font-mono ltr">100238471</span>.
            </div>

            <div className="flex items-center gap-3 text-white/40">
              <div className="h-px flex-1 bg-white/15" />
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 4v14m0 0l-5-5m5 5l5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="h-px flex-1 bg-white/15" />
            </div>

            {/* Ledger row */}
            <div
              className="stub grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-lg bg-white px-5 py-4 text-text shadow-pop"
              style={{ ["--stub-color" as string]: "var(--color-crimson)" }}
            >
              <span className="amount text-2xl font-semibold">50,000</span>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">أحمد محمد · 777123456</div>
                <div className="text-xs text-muted">
                  محفظة جيب · <span className="font-mono ltr">100238471</span>
                </div>
              </div>
              <span className="rounded-full bg-sky-soft px-2.5 py-0.5 text-xs font-medium text-sky">جديدة</span>
            </div>
          </div>

          <p className="mt-12 max-w-md text-sm leading-relaxed text-white/60">
            يستقبل واصل إشعارات المحافظ، يستخرج المبلغ والمرسل ورقم العملية، ويعرضها لمن يحق له رؤيتها — مع إشعار فوري وسجل يمكن
            البحث فيه.
          </p>
        </div>
      </aside>
    </div>
  );
}
