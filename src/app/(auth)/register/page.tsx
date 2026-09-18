import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "تسجيل منشأة" };

export default function RegisterPage() {
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">تسجيل منشأة جديدة</h1>
      <p className="mt-2 text-sm text-muted">
        أنشئ حساب المنشأة وحساب المالك وأرسل طلب التفعيل. بعد الموافقة تربط رقم الهاتف الذي تصل إليه رسائل التحويل وتضيف موظفيك.
      </p>
      <div className="mt-8">
        <RegisterForm />
      </div>
      <p className="mt-8 text-sm text-muted">
        لديك حساب؟{" "}
        <Link href="/login" className="font-medium text-ink underline underline-offset-4">
          سجّل الدخول
        </Link>
      </p>
    </div>
  );
}
