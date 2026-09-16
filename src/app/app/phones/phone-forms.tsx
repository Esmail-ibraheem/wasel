"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/form";
import { Button, Field, Input, Mono, Notice } from "@/components/ui";
import { addPhone, rotatePhoneKey, type PhoneActionState } from "./actions";

function SecretReveal({ secret }: { secret: NonNullable<PhoneActionState>["secret"] }) {
  const [copied, setCopied] = useState<string | null>(null);
  if (!secret) return null;
  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="space-y-3 rounded-md border border-saffron/50 bg-saffron-soft p-4">
      <div className="text-sm font-semibold">بيانات الوصول للرقم {secret.number}</div>
      <div>
        <div className="mb-1 text-xs text-muted">مفتاح الوصول (X-Api-Key)</div>
        <div className="flex items-center gap-2">
          <code className="flex-1 break-all rounded bg-white px-2 py-1.5 font-mono text-[13px] ltr">{secret.apiKey}</code>
          <Button type="button" size="sm" variant="secondary" onClick={() => copy("key", secret.apiKey)}>
            {copied === "key" ? "نُسخ" : "نسخ"}
          </Button>
        </div>
      </div>
      {secret.hmacSecret && (
        <div>
          <div className="mb-1 text-xs text-muted">سر التوقيع (HMAC-SHA256)</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-white px-2 py-1.5 font-mono text-[13px] ltr">{secret.hmacSecret}</code>
            <Button type="button" size="sm" variant="secondary" onClick={() => copy("hmac", secret.hmacSecret!)}>
              {copied === "hmac" ? "نُسخ" : "نسخ"}
            </Button>
          </div>
        </div>
      )}
      <p className="text-xs text-[#5f420a]">احفظ هذه البيانات في التطبيق أو الجهاز الذي سيرسل الرسائل. لن تُعرض مرة أخرى.</p>
    </div>
  );
}

export function AddPhoneForm() {
  const [state, action] = useActionState(addPhone, null);
  return (
    <form action={action} className="space-y-4">
      {state?.message && <Notice tone={state.ok ? "success" : "danger"}>{state.message}</Notice>}
      {state?.ok && state.secret && <SecretReveal secret={state.secret} />}
      {!state?.ok && (
        <>
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
            <Field label="رقم الهاتف" error={state?.errors?.number} hint="الرقم الذي تصل إليه رسائل المحافظ">
              <Input name="number" inputMode="tel" placeholder="777123456" dir="ltr" className="text-start" required />
            </Field>
            <Field label="وصف (اختياري)" error={state?.errors?.label}>
              <Input name="label" placeholder="مثال: هاتف الكاشير" />
            </Field>
            <div className="flex items-end">
              <SubmitButton pendingText="جارٍ الإضافة…">إضافة الرقم</SubmitButton>
            </div>
          </div>
        </>
      )}
    </form>
  );
}

export function RotateKeyForm({ id, hasHmac }: { id: string; hasHmac: boolean }) {
  const [state, action] = useActionState(rotatePhoneKey, null);
  const [open, setOpen] = useState(false);
  if (state?.ok && state.secret) {
    return (
      <div className="space-y-2">
        <Notice tone="success">{state.message}</Notice>
        <SecretReveal secret={state.secret} />
      </div>
    );
  }
  if (!open) {
    return (
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
        تجديد مفتاح الوصول
      </Button>
    );
  }
  return (
    <form
      action={action}
      className="space-y-2 rounded-md border border-line bg-paper p-3"
      onSubmit={(e) => {
        if (!window.confirm("سيتوقف المفتاح الحالي عن العمل فورًا. المتابعة؟")) e.preventDefault();
      }}
    >
      {state?.message && !state.ok && <Notice tone="danger">{state.message}</Notice>}
      <input type="hidden" name="id" value={id} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="hmac" value="1" defaultChecked={hasHmac} />
        تفعيل توقيع الطلبات (HMAC) — أمان إضافي للجهاز المرسل
      </label>
      <div className="flex gap-2">
        <SubmitButton size="sm" variant="danger" pendingText="…">
          تجديد الآن
        </SubmitButton>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          إلغاء
        </Button>
      </div>
    </form>
  );
}

export function CodeChip({ code }: { code: string }) {
  return <Mono className="rounded bg-white px-2 py-1 text-base font-medium tracking-wide ring-1 ring-line-strong">{code}</Mono>;
}
