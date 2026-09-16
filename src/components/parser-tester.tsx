"use client";

import { useState, useTransition } from "react";
import { testParse, type TestParseResult } from "@/app/app/wallets/actions";
import { formatAmount, formatDateTime } from "@/lib/format";
import { Button, Field, Notice, Select, Textarea, Mono } from "./ui";

export function ParserTester({ wallets, initialWalletId }: { wallets: { id: string; name: string; sample: string }[]; initialWalletId?: string }) {
  const [walletId, setWalletId] = useState(initialWalletId ?? wallets[0]?.id ?? "");
  const [text, setText] = useState("");
  const [out, setOut] = useState<TestParseResult | null>(null);
  const [pending, start] = useTransition();
  const sample = wallets.find((w) => w.id === walletId)?.sample ?? "";

  const run = () => {
    if (!text.trim()) return;
    start(async () => setOut(await testParse(walletId, text)));
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-4">
        <Field label="المحفظة">
          <Select value={walletId} onChange={(e) => setWalletId(e.target.value)}>
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="نص الرسالة">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} dir="auto" className="min-h-32" placeholder="الصق نص رسالة التحويل هنا" />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={run} disabled={pending || !text.trim()}>
            {pending ? "جارٍ التحليل…" : "تحليل"}
          </Button>
          {sample && (
            <Button type="button" variant="ghost" onClick={() => setText(sample)}>
              استخدم مثال المحفظة
            </Button>
          )}
        </div>
      </div>
      <div>
        {!out ? (
          <div className="flex h-full min-h-40 items-center justify-center rounded-md border border-dashed border-line-strong text-sm text-faint">
            نتيجة التحليل تظهر هنا — لا يُحفظ شيء.
          </div>
        ) : !out.result ? (
          <div className="space-y-3">
            <Notice tone="danger">لم يطابق النص أي نمط لهذه المحفظة.</Notice>
            <div className="text-xs text-muted">النص بعد التطبيع:</div>
            <pre className="whitespace-pre-wrap rounded bg-paper p-3 font-sans text-xs">{out.normalized}</pre>
          </div>
        ) : (
          <div className="space-y-3">
            <Notice tone="success">تمت المطابقة بالنمط «{out.result.templateName}»</Notice>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-md border border-line p-4 text-sm">
              <dt className="text-muted">المبلغ</dt>
              <dd className="amount text-lg font-semibold">{formatAmount(out.result.data.amount, out.result.data.currency)}</dd>
              <dt className="text-muted">المرسل</dt>
              <dd>{out.result.data.senderName ?? "—"}</dd>
              <dt className="text-muted">رقم المرسل</dt>
              <dd>{out.result.data.senderPhone ? <Mono>{out.result.data.senderPhone}</Mono> : "—"}</dd>
              <dt className="text-muted">رقم العملية</dt>
              <dd>{out.result.data.reference ? <Mono>{out.result.data.reference}</Mono> : "—"}</dd>
              <dt className="text-muted">وقت التحويل</dt>
              <dd className="tnum">{formatDateTime(out.result.data.transferredAt)}</dd>
              <dt className="text-muted">الرصيد بعد العملية</dt>
              <dd className="tnum">{out.result.data.balanceAfter !== undefined ? formatAmount(out.result.data.balanceAfter, out.result.data.currency) : "—"}</dd>
            </dl>
            <details className="text-xs text-muted">
              <summary className="cursor-pointer">المجموعات الخام</summary>
              <pre className="mt-2 overflow-x-auto rounded bg-paper p-3 font-mono text-[11px] ltr text-start">{JSON.stringify(out.result.groups, null, 2)}</pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
