"use client";

import { ActionForm, SubmitButton } from "@/components/form";
import { Field, Input, Textarea } from "@/components/ui";
import { register } from "../actions";

export function RegisterForm() {
  return (
    <ActionForm action={register} className="space-y-5">
      {(state) => (
        <>
          <Field label="اسم المنشأة" error={state?.errors?.businessName}>
            <Input name="businessName" required placeholder="مثال: متجر النور للإلكترونيات" />
          </Field>
          <Field label="اسمك الكامل" error={state?.errors?.fullName}>
            <Input name="fullName" required autoComplete="name" />
          </Field>
          <Field label="رقم التواصل" hint="سنتواصل معك عليه لمراجعة الطلب وتفعيل الحساب" error={state?.errors?.contactPhone}>
            <Input name="contactPhone" required inputMode="tel" dir="ltr" className="text-start" placeholder="777123456" />
          </Field>
          <Field label="عن المنشأة (اختياري)" hint="المدينة، النشاط، عدد الفروع…" error={state?.errors?.contactNote}>
            <Textarea name="contactNote" className="min-h-20" />
          </Field>
          <Field label="اسم المستخدم" hint="أحرف إنجليزية صغيرة وأرقام فقط" error={state?.errors?.username}>
            <Input name="username" required autoComplete="username" dir="ltr" className="text-start" />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="كلمة المرور" hint="8 أحرف على الأقل" error={state?.errors?.password}>
              <Input name="password" type="password" required autoComplete="new-password" dir="ltr" className="text-start" />
            </Field>
            <Field label="تأكيد كلمة المرور" error={state?.errors?.confirm}>
              <Input name="confirm" type="password" required autoComplete="new-password" dir="ltr" className="text-start" />
            </Field>
          </div>
          <SubmitButton className="w-full" pendingText="جارٍ إرسال الطلب…">
            إرسال طلب التفعيل
          </SubmitButton>
          <p className="text-xs text-muted">بعد الإرسال يبقى الحساب بانتظار التفعيل حتى يراجعه مالك النظام ويوافق عليه.</p>
        </>
      )}
    </ActionForm>
  );
}
