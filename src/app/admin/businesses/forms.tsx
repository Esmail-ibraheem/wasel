"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/form";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { approveBusiness, extendLicense, issueLicenseAction, rejectBusiness, suspendBusiness, updateBusinessInfo, updateLicenseLimits } from "./actions";

function LicenseFields({ defaults, errors }: { defaults?: { plan?: string; days?: number; maxPhones?: number; maxUsers?: number; maxDevices?: number; note?: string | null }; errors?: Record<string, string> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Field label="الباقة" error={errors?.plan}>
        <Input name="plan" defaultValue={defaults?.plan ?? "أساسية"} />
      </Field>
      {defaults?.days !== undefined && (
        <Field label="المدة (أيام)" hint="0 = بلا انتهاء" error={errors?.days}>
          <Input name="days" type="number" min={0} defaultValue={defaults.days} />
        </Field>
      )}
      <Field label="حد الأرقام" error={errors?.maxPhones}>
        <Input name="maxPhones" type="number" min={1} defaultValue={defaults?.maxPhones ?? 5} />
      </Field>
      <Field label="حد المستخدمين" error={errors?.maxUsers}>
        <Input name="maxUsers" type="number" min={1} defaultValue={defaults?.maxUsers ?? 10} />
      </Field>
      <Field label="حد الأجهزة" error={errors?.maxDevices}>
        <Input name="maxDevices" type="number" min={0} defaultValue={defaults?.maxDevices ?? 3} />
      </Field>
      <Field label="ملاحظة" className="sm:col-span-2 lg:col-span-5">
        <Input name="note" defaultValue={defaults?.note ?? ""} placeholder="مثال: عقد سنوي — فرعان" />
      </Field>
    </div>
  );
}

export function ApproveForm({ businessId }: { businessId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" variant="success" onClick={() => setOpen(true)}>
        الموافقة والتفعيل
      </Button>
    );
  }
  return (
    <ActionForm action={approveBusiness} className="space-y-3 rounded-md border border-emerald/30 bg-emerald-soft/40 p-4">
      {(state) => (
        <>
          <input type="hidden" name="id" value={businessId} />
          <div className="text-sm font-semibold">إصدار الترخيص الأول</div>
          <LicenseFields defaults={{ days: 365 }} errors={state?.errors} />
          <div className="flex gap-2">
            <SubmitButton variant="success" pendingText="جارٍ التفعيل…">
              تفعيل المنشأة وإصدار الترخيص
            </SubmitButton>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function NoteActionForm({ businessId, kind }: { businessId: string; kind: "reject" | "suspend" }) {
  const [open, setOpen] = useState(false);
  const label = kind === "reject" ? "رفض الطلب" : "إيقاف المنشأة";
  if (!open) {
    return (
      <Button type="button" variant="danger" onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }
  return (
    <ActionForm action={kind === "reject" ? rejectBusiness : suspendBusiness} className="space-y-3 rounded-md border border-crimson/30 bg-crimson-soft/40 p-4">
      {(state) => (
        <>
          <input type="hidden" name="id" value={businessId} />
          <Field label={kind === "reject" ? "سبب الرفض (يظهر للعميل)" : "سبب الإيقاف (يظهر للعميل)"} error={state?.errors?.note}>
            <Textarea name="note" required className="min-h-20" />
          </Field>
          <div className="flex gap-2">
            <SubmitButton variant="danger" pendingText="…">
              تأكيد: {label}
            </SubmitButton>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function BusinessInfoForm({ business }: { business: { id: string; name: string; contactPhone: string | null; contactNote: string | null } }) {
  return (
    <ActionForm action={updateBusinessInfo} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
      {() => (
        <>
          <input type="hidden" name="id" value={business.id} />
          <Field label="الاسم">
            <Input name="name" defaultValue={business.name} required />
          </Field>
          <Field label="رقم التواصل">
            <Input name="contactPhone" defaultValue={business.contactPhone ?? ""} dir="ltr" className="text-start" />
          </Field>
          <div className="flex items-end">
            <SubmitButton variant="secondary">حفظ</SubmitButton>
          </div>
          <Field label="ملاحظات" className="sm:col-span-3">
            <Textarea name="contactNote" defaultValue={business.contactNote ?? ""} className="min-h-16" />
          </Field>
        </>
      )}
    </ActionForm>
  );
}

export function IssueLicenseForm({ businessId }: { businessId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" variant="primary" size="sm" onClick={() => setOpen(true)}>
        إصدار ترخيص
      </Button>
    );
  }
  return (
    <ActionForm action={issueLicenseAction} className="space-y-3 rounded-md border border-line bg-paper p-4">
      {(state) => (
        <>
          <input type="hidden" name="businessId" value={businessId} />
          <LicenseFields defaults={{ days: 365 }} errors={state?.errors} />
          <Field label="الحالة الابتدائية">
            <Select name="status" defaultValue="ACTIVE" className="w-48">
              <option value="ACTIVE">فعّال فورًا</option>
              <option value="PENDING">بانتظار التفعيل</option>
            </Select>
          </Field>
          <div className="flex gap-2">
            <SubmitButton pendingText="…">إصدار</SubmitButton>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              إغلاق
            </Button>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function ExtendLicenseForm({ id }: { id: string }) {
  return (
    <ActionForm action={extendLicense} className="flex items-end gap-2">
      {() => (
        <>
          <input type="hidden" name="id" value={id} />
          <Field label="تمديد (أيام)" hint="0 = بلا انتهاء" className="w-32">
            <Input name="days" type="number" defaultValue={365} className="h-8" />
          </Field>
          <SubmitButton size="sm" variant="secondary" pendingText="…">
            تمديد
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function LicenseLimitsForm({ license }: { license: { id: string; plan: string; maxPhones: number; maxUsers: number; maxDevices: number; note: string | null } }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
        تعديل الحدود
      </Button>
    );
  }
  return (
    <ActionForm action={updateLicenseLimits} className="mt-2 space-y-3 rounded-md border border-line bg-paper p-3">
      {(state) => (
        <>
          <input type="hidden" name="id" value={license.id} />
          <LicenseFields defaults={license} errors={state?.errors} />
          <div className="flex gap-2">
            <SubmitButton size="sm" pendingText="…">
              حفظ
            </SubmitButton>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              إغلاق
            </Button>
          </div>
        </>
      )}
    </ActionForm>
  );
}
