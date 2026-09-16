"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/form";
import { Button, Field, Input, Select } from "@/components/ui";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { createUser, resetUserPassword, updateUserRole } from "./actions";

export function CreateUserForm({ roles }: { roles: Role[] }) {
  return (
    <ActionForm action={createUser} className="space-y-4">
      {(state) => (
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto_auto]">
          <Field label="الاسم الكامل" error={state?.errors?.fullName}>
            <Input name="fullName" required />
          </Field>
          <Field label="اسم المستخدم" error={state?.errors?.username}>
            <Input name="username" required dir="ltr" className="text-start" autoComplete="off" />
          </Field>
          <Field label="كلمة المرور المؤقتة" error={state?.errors?.password}>
            <Input name="password" type="password" required dir="ltr" className="text-start" autoComplete="new-password" />
          </Field>
          <Field label="الدور" error={state?.errors?.role}>
            <Select name="role" defaultValue={roles.includes("EMPLOYEE") ? "EMPLOYEE" : roles[0]}>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end">
            <SubmitButton pendingText="…">إضافة</SubmitButton>
          </div>
        </div>
      )}
    </ActionForm>
  );
}

export function RoleSelect({ id, role, roles }: { id: string; role: string; roles: Role[] }) {
  return (
    <form action={updateUserRole} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <Select name="role" defaultValue={role} className="h-8 w-36 text-[13px]" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        {roles.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </Select>
    </form>
  );
}

export function ResetPasswordForm({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
        تغيير كلمة المرور
      </Button>
    );
  }
  return (
    <ActionForm action={resetUserPassword} className="flex flex-wrap items-end gap-2">
      {(state) => (
        <>
          <input type="hidden" name="id" value={id} />
          <Field label="كلمة مرور جديدة" error={state?.errors?.password} className="w-48">
            <Input name="password" type="password" dir="ltr" className="h-8 text-start" autoComplete="new-password" required />
          </Field>
          <SubmitButton size="sm" variant="secondary" pendingText="…">
            حفظ
          </SubmitButton>
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
            إلغاء
          </Button>
        </>
      )}
    </ActionForm>
  );
}
