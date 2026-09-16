# نظام واصل (Wasel)

نظام مركزي لمتابعة التحويلات المالية الواردة عبر المحافظ الإلكترونية في اليمن (جيب، فلوسك، كاش، ون كاش، جوالي…).
يستقبل رسائل SMS الخاصة بالتحويلات، يحللها ويستخرج بياناتها، ويعرضها في لوحة تحكم بصلاحيات وإشعارات فورية وسجل تدقيق.

**Stack:** Next.js 15 (App Router, TypeScript) · Tailwind v4 · Prisma 6 + SQLite · Zod · Vitest · Server-Sent Events.

## التشغيل

```bash
pnpm install          # يولّد Prisma client تلقائيًا
pnpm db:push          # ينشئ قاعدة البيانات dev.db
pnpm db:seed          # المحافظ + منشأة تجريبية + حسابات
pnpm dev              # http://localhost:3000
```

الأوامر الأخرى: `pnpm test` (Vitest) · `pnpm build` / `pnpm start` (إنتاج) · `pnpm db:reset` (يمسح ويعيد البذر — يطلب الموافقة).

## الحسابات التجريبية

| الحساب | كلمة المرور | الدور |
|---|---|---|
| `owner` | `Owner@12345` | مالك المنشأة (كل الصلاحيات) |
| `manager` | `Manager@12345` | مدير |
| `accountant` | `Accountant@12345` | محاسب (تأكيد/رفض/تصدير + الرسائل الأصلية) |
| `employee` | `Employee@12345` | موظف (عرض ومراجعة فقط) |
| `admin` | `Admin@12345` | مشرف المنصة (`/admin`: المنشآت، المحافظ والأنماط) |

مفتاح الرقم التجريبي الموثّق `967777123456`:
`wsl_demo_0123456789abcdef0123456789abcdef01234567`

## واجهة الاستقبال (Webhook)

كل رسالة SMS واردة تُرسل إلى الخادم بواسطة الجهة التي تمرر الرسائل (تطبيق أندرويد، GSM gateway، أو webhook من شركة الاتصالات):

```http
POST /api/ingest/sms
Content-Type: application/json
X-Api-Key: wsl_...                      # مفتاح الرقم (يظهر مرة واحدة عند إضافة الرقم)
X-Signature: <hex hmac-sha256(secret, body)>   # فقط إذا فُعّل التوقيع للرقم

{ "sender": "Jaib", "text": "...", "receivedAt": "2026-09-16T14:35:00+03:00", "externalId": "optional-device-id" }
```

| الرد | المعنى |
|---|---|
| `200 PARSED` | تحويل جديد سُجّل وأُشعر المستخدمون |
| `200 DUPLICATE` | نفس الرسالة (أو نفس `externalId`) وصلت خلال 24 ساعة — لم يُحفظ شيء |
| `200 DUPLICATE_TRANSFER` | رقم عملية مسجل مسبقًا لنفس المحفظة — حُفظت الرسالة فقط |
| `200 VERIFIED` | الرسالة احتوت رمز التحقق فوُثّق الرقم |
| `202 UNMATCHED` | مرسل معتمد لكن الصيغة غير معروفة — حُفظت الرسالة للمراجعة |
| `202 IGNORED_SENDER` | مرسل غير معتمد — **لا يُحفظ النص** |
| `403 PHONE_NOT_VERIFIED` | الرقم بانتظار التحقق |
| `401` / `429` | مفتاح غير صحيح / تجاوز 120 طلب في الدقيقة |

**التحقق من ملكية الرقم (Reverse-OTP):** عند إضافة رقم يحصل على رمز مثل `WASEL-P6FPQX` ويبقى `PENDING`؛ أول رسالة تصل عبر القناة وتحتوي الرمز توثّق الرقم تلقائيًا.

## البنية

```
prisma/schema.prisma        نموذج البيانات (SQLite؛ للانتقال إلى Postgres غيّر provider)
prisma/seed.ts              البذر عبر مسار الاستقبال الحقيقي
src/lib/parser/             normalize · amount · datetime · engine · seed-templates (أنماط المحافظ)
src/lib/ingest.ts           خط المعالجة: dedupe → تحقق الرقم → مطابقة المرسل → تحليل → حفظ + إشعار + تدقيق
src/lib/auth/               scrypt passwords · جلسات في قاعدة البيانات · مفاتيح API · HMAC
src/lib/permissions.ts      مصفوفة الأدوار والصلاحيات
src/lib/events.ts           ناقل أحداث داخل العملية → SSE
src/app/(auth)              تسجيل الدخول / تسجيل منشأة
src/app/app/**              لوحة المنشأة (نظرة عامة، التحويلات، الرسائل، الأرقام، المحافظ، المستخدمون، التدقيق…)
src/app/admin/**            لوحة مشرف المنصة (المنشآت، كتالوج المحافظ وأنماط الرسائل، اختبار التحليل)
src/app/api/ingest/sms      الويب هوك · src/app/api/events (SSE) · src/app/api/transfers/export (CSV)
tests/                      Vitest: المحلل، الصلاحيات، وتكامل الاستقبال على قاعدة SQLite مؤقتة
docs/superpowers/specs/     وثيقة التصميم
```

## أنماط الرسائل

لم تتوفر عينات حقيقية من رسائل المحافظ عند البناء؛ الأنماط المضمّنة واقعية لكنها تقديرية.
كل نمط هو تعبير نمطي JavaScript بمجموعات مسماة (`amount` إلزامية؛ `currency`, `senderName`, `senderPhone`, `reference`, `date`, `time`, `account`, `balance` اختيارية)
ويُعدَّل من لوحة المشرف دون نشر جديد. استخدم «اختبار التحليل» للتأكد من أي نص قبل الاعتماد عليه.

## النشر (تجريبي)

الخادم يحتاج بيئة Node.js دائمة التشغيل (لا يعمل على GitHub Pages أو الاستضافة الثابتة):

```bash
git clone https://github.com/Esmail-ibraheem/wasel.git && cd wasel
pnpm install
cp .env.example .env          # DATABASE_URL="file:./dev.db"
pnpm db:push && pnpm db:seed  # قاعدة SQLite + الحسابات التجريبية
pnpm build && pnpm start      # http://localhost:3000
```

- ضع الخادم خلف HTTPS (Caddy أو nginx) قبل استخدامه مع بيانات حقيقية؛ الكوكي الآمن يُفعَّل تلقائيًا في وضع الإنتاج.
- **غيّر كلمات مرور الحسابات التجريبية أو احذف المنشأة التجريبية** بعد أول تشغيل (`admin` خاصة).
- SQLite مناسب لخادم واحد. للانتقال إلى Postgres غيّر `provider` في `prisma/schema.prisma` و`DATABASE_URL` ثم `pnpm db:push`.
- الإشعارات الفورية (SSE) تعمل داخل عملية واحدة؛ عند التوسع لأكثر من نسخة يلزم Redis pub/sub.
- **Vercel + Neon (مجاني، جاهز):** انقر
  [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FEsmail-ibraheem%2Fwasel&project-name=wasel&repository-name=wasel&env=ADMIN_USERNAME,ADMIN_PASSWORD&envDescription=%D8%AD%D8%B3%D8%A7%D8%A8%20%D9%85%D8%B4%D8%B1%D9%81%20%D8%A7%D9%84%D9%85%D9%86%D8%B5%D8%A9%20(%2Fadmin))
  ثم من تبويب **Storage** أضف قاعدة **Neon Postgres** (المجانية) واربطها بالمشروع — تُضاف `DATABASE_URL` و`DATABASE_URL_UNPOOLED` تلقائيًا — وأعد النشر.
  البناء على Vercel يستخدم `vercel-build`: مخطط Postgres (`prisma/schema.postgres.prisma`، مولَّد من `schema.prisma`) → `db push` → البذر → `next build`.
  الإشعارات الفورية تعمل على serverless عبر استقصاء قاعدة البيانات كل 3 ثوانٍ (يعاد الاتصال تلقائيًا كل ~50 ثانية).
- **Railway / أي Docker host:** المستودع يحتوي `Dockerfile` و`railway.json`. أنشئ خدمة من هذا المستودع، أضف Volume على المسار `/data`، واضبط المتغيرات:
  `DATABASE_URL=file:/data/wasel.db` · `ADMIN_USERNAME` · `ADMIN_PASSWORD` (اختياري: `SEED_DEMO=true` لإضافة المنشأة التجريبية).
  عند كل تشغيل يُنفَّذ `prisma db push` ثم البذر (المحافظ + المشرف إن لم يوجدا) ثم `next start`. فحص الصحة: `/api/health`.
- Render / Fly.io: نفس الصورة مع قرص دائم على `/data`. Vercel لا يحفظ SQLite بين الطلبات — استخدم Postgres هناك.

## ما لم يُنفذ بعد (مقصود)

تطبيق أندرويد لتمرير الرسائل، التحقق عبر API رسمي للمحفظة، ربط التحويل بفاتورة، تصدير Excel/PDF، سياسة الاحتفاظ الآلي، وتوزيع SSE على أكثر من خادم (يتطلب Redis).
