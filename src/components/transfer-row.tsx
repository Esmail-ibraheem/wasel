import Link from "next/link";
import { formatAmount, formatDateTime } from "@/lib/format";
import { walletColors } from "@/lib/wallet-colors";
import { StatusBadge, WalletChip, cx } from "./ui";

export interface TransferRowData {
  id: string;
  amount: number;
  currency: string;
  senderName: string | null;
  senderPhone: string | null;
  reference: string | null;
  transferredAt: Date;
  status: string;
  wallet: { code: string; name: string };
}

/** The receipt-stub row: wallet colour on the start edge, amount set in the display face. */
export function TransferRow({ t, highlight }: { t: TransferRowData; highlight?: boolean }) {
  const c = walletColors(t.wallet.code);
  const from = [t.senderName, t.senderPhone].filter(Boolean).join(" · ");
  return (
    <Link
      href={`/app/transfers/${t.id}`}
      className={cx(
        "stub grid grid-cols-[minmax(110px,auto)_1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-paper sm:grid-cols-[minmax(130px,auto)_1fr_auto_auto]",
        highlight && "arrive",
      )}
      style={{ ["--stub-color" as string]: c.color }}
    >
      <span className="amount text-xl font-semibold leading-none sm:text-[22px]">
        {formatAmount(t.amount, t.currency)
          .split(" ")
          .map((part, i) => (
            <span key={i} className={i === 0 ? "" : "ms-1 font-sans text-xs font-normal text-muted"}>
              {part}
            </span>
          ))}
      </span>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{from || <span className="text-faint">مرسل غير معروف</span>}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
          <WalletChip code={t.wallet.code} name={t.wallet.name} size="sm" />
          {t.reference && <span className="font-mono ltr">{t.reference}</span>}
          <span className="tnum sm:hidden">{formatDateTime(t.transferredAt)}</span>
        </div>
      </div>
      <span className="tnum hidden text-xs text-muted sm:block">{formatDateTime(t.transferredAt)}</span>
      <StatusBadge status={t.status} />
    </Link>
  );
}
