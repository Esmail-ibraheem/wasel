"use client";

import { ActionForm, SubmitButton } from "@/components/form";
import { Field, Input } from "@/components/ui";
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
          <SubmitButton className="w-full" pendingText="جارٍ إنشاء الحساب…">
            إنشاء حساب المنشأة
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
