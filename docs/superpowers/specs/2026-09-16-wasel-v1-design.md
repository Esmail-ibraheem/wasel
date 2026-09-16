# نظام واصل (Wasel) — v1 Design

**Date:** 2026-09-16 · **Status:** approved (user chose approach A, asked to build without further questions)

## Goal
A multi-tenant web app that turns e-wallet transfer SMS notifications (Jaib, Floosak, Cash, ONE Cash, Jawali, …) into a central, searchable, role-controlled transfer log for Yemeni businesses, with live in-app notifications.

## Decisions (from brainstorming)
| Question | Decision |
|---|---|
| Scope | Working full-stack app; SMS enters via a secured ingestion API + manual paste form |
| SMS samples | None available → plausible formats, patterns editable in admin UI |
| Tenancy | Self-signup SaaS; hidden super-admin manages tenants + global wallet parsers |
| Language | Arabic only, RTL |
| Phone verification | Reverse-OTP: number stays `PENDING` until a message containing its code arrives through the ingestion channel |
| Stack | Next.js 15 (App Router, TS) · Tailwind v4 · Prisma 6 + SQLite · Zod · Vitest · SSE for realtime |

## Architecture
Single Next.js app at `F:\wasel`:
- `src/app/(auth)` — login / register pages (server actions)
- `src/app/app/**` — tenant dashboard (server components + small client islands)
- `src/app/admin/**` — super-admin panel
- `src/app/api/ingest/sms` — webhook (API key + optional HMAC)
- `src/app/api/events` — SSE stream of notifications for the logged-in user
- `src/app/api/transfers/export` — CSV export
- `src/lib/` — pure domain code: `parser/` (normalize, match, parse), `ingest.ts`, `auth/` (scrypt passwords, DB sessions), `permissions.ts`, `events.ts` (in-process bus), `audit.ts`, `notify.ts`
- `prisma/schema.prisma`, `prisma/seed.ts`

## Data model (SQLite → string "enums")
- **Business**(id, name, createdAt)
- **User**(id, businessId?, username unique, fullName, passwordHash, role ∈ OWNER|MANAGER|ACCOUNTANT|EMPLOYEE, isSuperAdmin, isActive)
- **Session**(id = sha256(token), userId, expiresAt, userAgent)
- **PhoneNumber**(id, businessId, number unique, label, status ∈ PENDING|VERIFIED|DISABLED, verificationCode, apiKeyHash, apiKeyPrefix, hmacSecret?, verifiedAt, lastSeenAt)
- **Wallet**(id, code unique, name, senderIds JSON[], isActive) — global catalog
- **MessageTemplate**(id, walletId, name, pattern, flags, priority, isActive, sampleText) — regex with named groups `amount, currency, senderName, senderPhone, reference, date, time, account, balance`
- **BusinessWallet**(businessId, walletId, isEnabled) — per-tenant enablement
- **RawMessage**(id, businessId, phoneNumberId, sender, text, receivedAt, source ∈ WEBHOOK|MANUAL, textHash, externalId?, status ∈ PARSED|UNMATCHED|VERIFICATION|DUPLICATE_TRANSFER, walletId?, templateId?, createdById?)
- **Transfer**(id, businessId, phoneNumberId, rawMessageId unique, walletId, amount Float, currency, senderName?, senderPhone?, reference?, transferredAt, account?, balanceAfter?, status ∈ NEW|REVIEWED|CONFIRMED|REJECTED, note?) — `@@unique([businessId, walletId, reference])`
- **TransferEvent**(id, transferId, userId?, fromStatus, toStatus, note, createdAt)
- **Notification**(id, businessId, userId, transferId?, title, body, readAt?)
- **AuditLog**(id, businessId?, userId?, action, entityType?, entityId?, details JSON?, ip?, createdAt)

## Ingestion pipeline (`ingestSms`)
1. Authenticate: `X-Api-Key` → phone (hash lookup); if phone has `hmacSecret`, require `X-Signature = hex(HMAC-SHA256(secret, rawBody))`. In-memory rate limit per key.
2. Normalize text (Arabic-Indic → ASCII digits, whitespace, Arabic comma). `textHash = sha256(phoneId|sender|normText)`.
3. Dedupe: same `externalId` for that phone, or same `textHash` within 24h → return `DUPLICATE` (nothing stored).
4. If phone `PENDING`: text contains its verification code → mark `VERIFIED`, store raw as `VERIFICATION`; otherwise `403 PHONE_NOT_VERIFIED`.
5. Sender → wallet (global active ∧ enabled for business, case-insensitive). No match → `202 IGNORED_SENDER`, **text not stored** (privacy).
6. Try wallet templates by priority; no match → store raw `UNMATCHED` (manager can fix template). 
7. Parsed with reference already present for (business, wallet) → store raw `DUPLICATE_TRANSFER`.
8. Else transaction: RawMessage `PARSED` + Transfer `NEW` + Notification per active business user + AuditLog; publish on event bus → SSE.
Manual paste uses the same function with `source=MANUAL` and an explicit wallet (skips step 5).

## Roles & permissions
| Permission | OWNER | MANAGER | ACCOUNTANT | EMPLOYEE |
|---|:-:|:-:|:-:|:-:|
| transfers.view / review | ✓ | ✓ | ✓ | ✓ |
| transfers.confirm / reject / export | ✓ | ✓ | ✓ | |
| messages.view (raw text) / messages.manual | ✓ | ✓ | ✓ | |
| phones.manage, wallets.manage, users.manage, audit.view | ✓ | ✓ | | |
| settings.manage | ✓ | | | |
MANAGER can manage users below MANAGER; OWNER manages all. Super-admin (flag) has `/admin`: businesses, wallets & templates CRUD, parser tester.

## UI (Arabic RTL)
Pages: `/login`, `/register`, `/app` (overview), `/app/transfers` (filters: date range, amount range, wallet, status, reference/sender text; pagination; CSV), `/app/transfers/[id]` (detail, raw text if permitted, status actions + history), `/app/messages` (raw log), `/app/messages/new` (manual paste), `/app/phones`, `/app/wallets` (enable + test parser), `/app/users`, `/app/audit`, `/app/settings`, `/admin/*`.
Live: SSE → bell badge + toast + optional browser Notification.

## Testing
Vitest: parser (normalization, each seeded template, date parsing), permissions, ingestion integration against a temp SQLite DB (dedupe, verification, ignored sender, unmatched, duplicate reference, happy path). UI verified in the browser pane.

## Out of scope (v1)
Android forwarder, official wallet API verification, invoice linking, Excel/PDF export, data-retention job, multi-instance SSE.
