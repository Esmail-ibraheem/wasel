"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/form";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { submitManualMessage } from "../actions";

export function ManualMessageForm({
  phones,
  wallets,
}: {
  phones: { id: string; number: string; label: string | null }[];
  wallets: { id: string; name: string; sample: string }[];
}) {
  const [walletId, setWalletId] = useState(wallets[0]?.id ?? "");
  const [text, setText] = useState("");
  const sample = wallets.find((w) => w.id === walletId)?.sample ?? "";

  return (
    <ActionForm action={submitManualMessage} className="space-y-5">
      {(state) => (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="الرقم المستقبِل" error={state?.errors?.phoneNumberId}>
              <Select name="phoneNumberId" defaultValue={phones[0]?.id}>
                {phones.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.number}
                    {p.label ? ` — ${p.label}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="المحفظة" error={state?.errors?.walletId}>
              <Select name="walletId" value={walletId} onChange={(e) => setWalletId(e.target.value)}>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="نص الرسالة" error={state?.errors?.text} hint="انسخ النص كاملًا كما هو؛ الأرقام العربية والإنجليزية مقبولة.">
            <Textarea name="text" value={text} onChange={(e) => setText(e.target.value)} required dir="auto" className="min-h-32" />
          </Field>
          {sample && (
            <div className="rounded-md border border-dashed border-line-strong bg-paper p-3 text-xs text-muted">
              <div className="mb-1 flex items-center justify-between">
                <span>مثال على صيغة هذه المحفظة</span>
                <button type="button" onClick={() => setText(sample)} className="font-medium text-sky hover:underline">
                  استخدم المثال
                </button>
              </div>
              <div dir="auto" className="text-text/80">
                {sample}
              </div>
            </div>
          )}
          <Field label="وقت الاستلام (اختياري)" error={state?.errors?.receivedAt} hint="اتركه فارغًا لاستخدام الوقت الحالي">
            <Input name="receivedAt" type="datetime-local" className="w-auto" />
          </Field>
          <SubmitButton pendingText="جارٍ التحليل…">تحليل وتسجيل</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
