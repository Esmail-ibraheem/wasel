"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/form";
import { Button, Field, Input, Textarea } from "@/components/ui";
import { createWallet, saveTemplate, updateWallet } from "./actions";

export function WalletForm({ wallet }: { wallet?: { id: string; code: string; name: string; senderIds: string[]; isActive: boolean } }) {
  return (
    <ActionForm action={wallet ? updateWallet : createWallet} className="space-y-4">
      {(state) => (
        <>
          {wallet && <input type="hidden" name="id" value={wallet.id} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="الاسم المعروض" error={state?.errors?.name}>
              <Input name="name" defaultValue={wallet?.name} required placeholder="مثال: محفظة جيب" />
            </Field>
            <Field label="الرمز" hint="أحرف إنجليزية صغيرة، يُستخدم داخليًا" error={state?.errors?.code}>
              <Input name="code" defaultValue={wallet?.code} required dir="ltr" className="text-start" placeholder="jaib" />
            </Field>
          </div>
          <Field label="معرّفات المرسل" hint="سطر لكل معرّف: الاسم الذي تظهر به الرسالة (Sender ID) أو الرقم الرسمي" error={state?.errors?.senderIds}>
            <Textarea name="senderIds" defaultValue={wallet?.senderIds.join("\n")} dir="ltr" className="min-h-20 text-start" required />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked={wallet ? wallet.isActive : true} />
            مفعّلة على مستوى المنصة
          </label>
          <SubmitButton>{wallet ? "حفظ المحفظة" : "إضافة المحفظة"}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export interface TemplateData {
  id: string;
  name: string;
  pattern: string;
  flags: string;
  priority: number;
  isActive: boolean;
  sampleText: string | null;
}

export function TemplateForm({ walletId, template, onDone }: { walletId: string; template?: TemplateData; onDone?: () => void }) {
  return (
    <ActionForm action={saveTemplate} className="space-y-4 rounded-md border border-line bg-paper p-4">
      {(state) => (
        <>
          <input type="hidden" name="walletId" value={walletId} />
          {template && <input type="hidden" name="id" value={template.id} />}
          <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
            <Field label="اسم النمط" error={state?.errors?.name}>
              <Input name="name" defaultValue={template?.name} required />
            </Field>
            <Field label="الأولوية" hint="الأعلى يُجرَّب أولًا" error={state?.errors?.priority}>
              <Input name="priority" type="number" defaultValue={template?.priority ?? 10} className="w-24" />
            </Field>
            <Field label="الأعلام" hint="i m s u" error={state?.errors?.flags}>
              <Input name="flags" defaultValue={template?.flags ?? "iu"} dir="ltr" className="w-20 text-start" />
            </Field>
          </div>
          <Field
            label="التعبير النمطي (JavaScript RegExp)"
            hint="مجموعات مسماة: amount (إلزامية) currency senderName senderPhone reference date time account balance"
            error={state?.errors?.pattern}
          >
            <Textarea name="pattern" defaultValue={template?.pattern} dir="ltr" className="min-h-28 font-mono text-[13px] text-start" required />
          </Field>
          <Field label="نص مثال" hint="رسالة حقيقية (بأرقام مموّهة) يجب أن يطابقها هذا النمط" error={state?.errors?.sampleText}>
            <Textarea name="sampleText" defaultValue={template?.sampleText ?? ""} dir="auto" className="min-h-20" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked={template ? template.isActive : true} />
            نمط مفعّل
          </label>
          <div className="flex gap-2">
            <SubmitButton>{template ? "حفظ النمط" : "إضافة النمط"}</SubmitButton>
            {onDone && (
              <Button type="button" variant="ghost" onClick={onDone}>
                إغلاق
              </Button>
            )}
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function TemplateEditor({ walletId, template }: { walletId: string; template: TemplateData }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
        تعديل
      </Button>
    );
  }
  return (
    <div className="mt-3 w-full">
      <TemplateForm walletId={walletId} template={template} onDone={() => setOpen(false)} />
    </div>
  );
}

export function NewTemplateToggle({ walletId }: { walletId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" variant="primary" onClick={() => setOpen(true)}>
        إضافة نمط
      </Button>
    );
  }
  return <TemplateForm walletId={walletId} onDone={() => setOpen(false)} />;
}
