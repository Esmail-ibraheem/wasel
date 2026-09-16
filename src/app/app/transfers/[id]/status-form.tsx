"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/form";
import { Button, Field, Notice, Textarea } from "@/components/ui";
import type { Transition } from "@/lib/transfer-workflow";
import { changeTransferStatus, updateTransferNote } from "../actions";

export function StatusForm({ id, transitions, note }: { id: string; transitions: Transition[]; note: string | null }) {
  const [pending, setPending] = useState<Transition | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (transitions.length === 0) {
    return <p className="text-sm text-muted">لا إجراءات متاحة لك على هذه الحالة.</p>;
  }

  return (
    <div className="space-y-4">
      {done && !pending && <Notice tone="success">{done}</Notice>}
      {!pending ? (
        <div className="flex flex-wrap gap-2">
          {transitions.map((t) => (
            <Button key={t.to} type="button" variant={t.variant} onClick={() => setPending(t)}>
              {t.label}
            </Button>
          ))}
        </div>
      ) : (
        <ActionForm
          action={changeTransferStatus}
          className="space-y-3 rounded-md border border-line bg-paper p-4"
          onSuccess={(s) => {
            setDone(s.message ?? null);
            setPending(null);
          }}
        >
          {(state) => (
            <>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="status" value={pending.to} />
              <div className="text-sm font-medium">{pending.label}</div>
              <Field
                label={pending.to === "REJECTED" ? "سبب الرفض" : "ملاحظة (اختياري)"}
                error={state?.errors?.note}
                hint={pending.to === "CONFIRMED" ? "مثال: رقم الفاتورة أو الطلب الذي يغطيه هذا التحويل" : undefined}
              >
                <Textarea name="note" defaultValue={note ?? ""} required={pending.to === "REJECTED"} className="min-h-20" />
              </Field>
              <div className="flex gap-2">
                <SubmitButton variant={pending.variant} pendingText="جارٍ التحديث…">
                  تأكيد: {pending.label}
                </SubmitButton>
                <Button type="button" variant="ghost" onClick={() => setPending(null)}>
                  إلغاء
                </Button>
              </div>
            </>
          )}
        </ActionForm>
      )}
    </div>
  );
}

export function NoteForm({ id, note }: { id: string; note: string | null }) {
  return (
    <ActionForm action={updateTransferNote} className="space-y-3">
      {() => (
        <>
          <input type="hidden" name="id" value={id} />
          <Textarea name="note" defaultValue={note ?? ""} placeholder="ملاحظة داخلية عن هذا التحويل" className="min-h-20" />
          <SubmitButton variant="secondary" size="sm">
            حفظ الملاحظة
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
