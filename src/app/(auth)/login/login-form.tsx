"use client";

import { ActionForm, SubmitButton } from "@/components/form";
import { Field, Input } from "@/components/ui";
import { login } from "../actions";

export function LoginForm() {
  return (
    <ActionForm action={login} className="space-y-5">
      {(state) => (
        <>
          <Field label="اسم المستخدم" error={state?.errors?.username}>
            <Input name="username" autoComplete="username" required dir="ltr" className="text-start" />
          </Field>
          <Field label="كلمة المرور" error={state?.errors?.password}>
            <Input name="password" type="password" autoComplete="current-password" required dir="ltr" className="text-start" />
          </Field>
          <SubmitButton className="w-full" pendingText="جارٍ الدخول…">
            دخول
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
