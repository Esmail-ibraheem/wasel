"use client";

import { ActionForm, SubmitButton } from "@/components/form";
import { Field, Input } from "@/components/ui";
import { changeOwnPassword, updateBusiness } from "./actions";

export function BusinessForm({ name }: { name: string }) {
  return (
    <ActionForm action={updateBusiness} className="flex flex-wrap items-end gap-3">
      {(state) => (
        <>
          <Field label="اسم المنشأة" error={state?.errors?.name} className="min-w-64 flex-1">
            <Input name="name" defaultValue={name} required />
          </Field>
          <SubmitButton>حفظ</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function OwnPasswordForm() {
  return (
    <ActionForm action={changeOwnPassword} className="grid gap-4 sm:grid-cols-3">
      {(state) => (
        <>
          <Field label="كلمة المرور الحالية" error={state?.errors?.current}>
            <Input name="current" type="password" required dir="ltr" className="text-start" autoComplete="current-password" />
          </Field>
          <Field label="كلمة المرور الجديدة" error={state?.errors?.password}>
            <Input name="password" type="password" required dir="ltr" className="text-start" autoComplete="new-password" />
          </Field>
          <Field label="تأكيد الجديدة" error={state?.errors?.confirm}>
            <Input name="confirm" type="password" required dir="ltr" className="text-start" autoComplete="new-password" />
          </Field>
          <div className="sm:col-span-3">
            <SubmitButton variant="secondary">تغيير كلمة المرور</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
