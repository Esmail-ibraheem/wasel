import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "تسجيل الدخول" };

export default function LoginPage() {
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">تسجيل الدخول</h1>
      <p className="mt-2 text-sm text-muted">ادخل إلى حساب منشأتك لمتابعة التحويلات الواردة.</p>
      <div className="mt-8">
        <LoginForm />
      </div>
      <p className="mt-8 text-sm text-muted">
        منشأة جديدة؟{" "}
        <Link href="/register" className="font-medium text-ink underline underline-offset-4">
          أنشئ حسابًا
        </Link>
      </p>
    </div>
  );
}
