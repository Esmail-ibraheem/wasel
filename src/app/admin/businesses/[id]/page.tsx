import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { auditLabel } from "@/lib/audit";
import { formatDate, formatDateTime, PHONE_STATUS_LABELS } from "@/lib/format";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { getBusinessAccess } from "@/lib/licensing/service";
import { ACCESS_STATUS_LABELS, BUSINESS_STATUS_LABELS, DEVICE_KIND_LABELS, LICENSE_STATUS_LABELS } from "@/lib/licensing/access";
import { Badge, Card, CardHeader, EmptyState, Mono, PageHeader, Table, Td, Th } from "@/components/ui";
import { InlineAction } from "@/components/form";
import { ApproveForm, BusinessInfoForm, ExtendLicenseForm, IssueLicenseForm, LicenseLimitsForm, NoteActionForm } from "../forms";
import { deleteDevice, reactivateBusiness, setDeviceStatus, setInstallationStatus, setLicenseStatus } from "../actions";

export const metadata: Metadata = { title: "إدارة منشأة" };

const BIZ_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = { ACTIVE: "success", PENDING: "warning", SUSPENDED: "danger", REJECTED: "neutral" };
const LIC_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = { ACTIVE: "success", PENDING: "warning", SUSPENDED: "danger", EXPIRED: "neutral" };

export default async function AdminBusinessPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin();
  const { id } = await params;
  const access = await getBusinessAccess(id); // also lazily expires licenses
  const biz = await db.business.findUnique({
    where: { id },
    include: {
      users: { orderBy: { createdAt: "asc" } },
      phones: { orderBy: { createdAt: "asc" } },
      licenses: { orderBy: { issuedAt: "desc" }, include: { _count: { select: { devices: true } } } },
      installations: { orderBy: { createdAt: "desc" }, include: { devices: { orderBy: { createdAt: "asc" } } } },
      devices: { where: { installationId: null }, orderBy: { createdAt: "asc" } },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 15, include: { user: { select: { fullName: true } } } },
      _count: { select: { transfers: true, rawMessages: true } },
    },
  });
  if (!biz) notFound();
  const owner = biz.users.find((u) => u.role === "OWNER");

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted">
        <Link href="/admin" className="hover:underline">
          المنشآت
        </Link>{" "}
        / {biz.name}
      </div>
      <PageHeader
        title={biz.name}
        eyebrow={biz.publicId}
        description={`سُجّلت ${formatDateTime(biz.createdAt)} · ${biz._count.transfers} تحويل · ${biz._count.rawMessages} رسالة`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={BIZ_TONE[biz.status] ?? "neutral"}>{BUSINESS_STATUS_LABELS[biz.status] ?? biz.status}</Badge>
            <Badge tone={access.ok ? "success" : "danger"}>الوصول: {ACCESS_STATUS_LABELS[access.status]}</Badge>
          </div>
        }
      />

      <Card>
        <CardHeader title="الحالة والإجراءات" subtitle="أنت وحدك من يقرر التفعيل والإيقاف. التغيير يسري فورًا على كل الطلبات والأجهزة." />
        <div className="space-y-4 p-5">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted">المالك</dt>
            <dd>
              {owner ? (
                <>
                  {owner.fullName} · <Mono>{owner.username}</Mono>
                </>
              ) : (
                "—"
              )}
            </dd>
            <dt className="text-muted">رقم التواصل</dt>
            <dd>{biz.contactPhone ? <Mono>{biz.contactPhone}</Mono> : <span className="text-faint">لم يُذكر</span>}</dd>
            {biz.contactNote && (
              <>
                <dt className="text-muted">عن المنشأة</dt>
                <dd>{biz.contactNote}</dd>
              </>
            )}
            {biz.reviewNote && (
              <>
                <dt className="text-muted">ملاحظة المراجعة</dt>
                <dd>{biz.reviewNote}</dd>
              </>
            )}
            {biz.activatedAt && (
              <>
                <dt className="text-muted">فُعّلت</dt>
                <dd className="tnum">{formatDateTime(biz.activatedAt)}</dd>
              </>
            )}
          </dl>
          <div className="flex flex-wrap gap-2">
            {(biz.status === "PENDING" || biz.status === "REJECTED") && <ApproveForm businessId={biz.id} />}
            {biz.status === "PENDING" && <NoteActionForm businessId={biz.id} kind="reject" />}
            {biz.status === "ACTIVE" && <NoteActionForm businessId={biz.id} kind="suspend" />}
            {biz.status === "SUSPENDED" && (
              <InlineAction action={reactivateBusiness} hidden={{ id: biz.id }} variant="success" size="md">
                إعادة التفعيل
              </InlineAction>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="بيانات المنشأة" />
        <div className="p-5">
          <BusinessInfoForm business={biz} />
        </div>
      </Card>

      <Card>
        <CardHeader title="التراخيص" subtitle="مفتاح الترخيص يُكتب في البرنامج المثبّت لدى العميل لتسجيل التركيب والأجهزة" action={<IssueLicenseForm businessId={biz.id} />} />
        {biz.licenses.length === 0 ? (
          <EmptyState title="لا تراخيص" body="عند الموافقة على المنشأة يصدر ترخيصها الأول تلقائيًا." />
        ) : (
          <ul className="divide-y divide-line">
            {biz.licenses.map((l) => (
              <li key={l.id} className="space-y-2 px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Mono className="text-base font-semibold">{l.key}</Mono>
                  <Badge tone={LIC_TONE[l.status] ?? "neutral"}>{LICENSE_STATUS_LABELS[l.status] ?? l.status}</Badge>
                  <span className="text-sm text-muted">{l.plan}</span>
                  <span className="text-xs text-muted tnum">
                    {l.expiresAt ? `ينتهي ${formatDate(l.expiresAt)}` : "بلا انتهاء"} · أرقام {l.maxPhones} · مستخدمون {l.maxUsers} · أجهزة {l._count.devices}/{l.maxDevices}
                  </span>
                  {l.lastCheckAt && <span className="text-xs text-faint tnum">آخر تحقق {formatDateTime(l.lastCheckAt)}</span>}
                </div>
                {l.note && <div className="text-xs text-muted">{l.note}</div>}
                <div className="flex flex-wrap items-end gap-2">
                  {l.status !== "ACTIVE" && (
                    <InlineAction action={setLicenseStatus} hidden={{ id: l.id, status: "ACTIVE" }} variant="success">
                      تفعيل
                    </InlineAction>
                  )}
                  {l.status === "ACTIVE" && (
                    <InlineAction action={setLicenseStatus} hidden={{ id: l.id, status: "SUSPENDED" }} variant="secondary" confirm="إيقاف هذا الترخيص؟ ستتوقف الأجهزة المرتبطة به.">
                      إيقاف
                    </InlineAction>
                  )}
                  <ExtendLicenseForm id={l.id} />
                  <LicenseLimitsForm license={l} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="التركيبات والأجهزة" subtitle="تُسجَّل عبر واجهة التفعيل المركزية. الجهاز المحظور يتلقى BLOCKED عند أول فحص." />
        {biz.installations.length === 0 && biz.devices.length === 0 ? (
          <EmptyState title="لا تركيبات بعد" body="عندما يُفعَّل البرنامج لدى العميل بمفتاح الترخيص يظهر التركيب وأجهزته هنا." />
        ) : (
          <ul className="divide-y divide-line">
            {biz.installations.map((inst) => (
              <li key={inst.id} className="px-5 py-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-medium">{inst.name}</span>
                  <Mono className="text-xs">{inst.publicId}</Mono>
                  <Badge tone={inst.status === "ACTIVE" ? "success" : "danger"}>{inst.status === "ACTIVE" ? "فعّال" : "محظور"}</Badge>
                  {inst.appVersion && <span className="text-xs text-muted">v{inst.appVersion}</span>}
                  {inst.lastSeenAt && <span className="text-xs text-faint tnum">آخر اتصال {formatDateTime(inst.lastSeenAt)}</span>}
                  <span className="ms-auto">
                    {inst.status === "ACTIVE" ? (
                      <InlineAction action={setInstallationStatus} hidden={{ id: inst.id, status: "BLOCKED" }} variant="ghost" confirm="حظر هذا التركيب وكل أجهزته؟">
                        <span className="text-crimson">حظر التركيب</span>
                      </InlineAction>
                    ) : (
                      <InlineAction action={setInstallationStatus} hidden={{ id: inst.id, status: "ACTIVE" }}>
                        رفع الحظر
                      </InlineAction>
                    )}
                  </span>
                </div>
                <DeviceTable devices={inst.devices} />
              </li>
            ))}
            {biz.devices.length > 0 && (
              <li className="px-5 py-4">
                <div className="mb-2 text-sm font-medium text-muted">أجهزة بلا تركيب</div>
                <DeviceTable devices={biz.devices} />
              </li>
            )}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="المستخدمون" />
          <Table>
            <thead>
              <tr>
                <Th>الاسم</Th>
                <Th>الدور</Th>
                <Th>الحالة</Th>
              </tr>
            </thead>
            <tbody>
              {biz.users.map((u) => (
                <tr key={u.id}>
                  <Td>
                    {u.fullName} <Mono className="text-xs text-muted">{u.username}</Mono>
                  </Td>
                  <Td>{ROLE_LABELS[u.role as Role] ?? u.role}</Td>
                  <Td>{u.isActive ? <Badge tone="success">نشط</Badge> : <Badge tone="neutral">معطّل</Badge>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card>
          <CardHeader title="أرقام الهواتف" />
          {biz.phones.length === 0 ? (
            <EmptyState title="لا أرقام" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>الرقم</Th>
                  <Th>الحالة</Th>
                  <Th>آخر رسالة</Th>
                </tr>
              </thead>
              <tbody>
                {biz.phones.map((p) => (
                  <tr key={p.id}>
                    <Td>
                      <Mono>{p.number}</Mono>
                      {p.label && <span className="ms-2 text-xs text-muted">{p.label}</span>}
                    </Td>
                    <Td>{PHONE_STATUS_LABELS[p.status] ?? p.status}</Td>
                    <Td className="tnum text-xs text-muted">{p.lastSeenAt ? formatDateTime(p.lastSeenAt) : "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="آخر الأحداث" />
        <Table>
          <thead>
            <tr>
              <Th>الوقت</Th>
              <Th>المستخدم</Th>
              <Th>الحدث</Th>
              <Th>التفاصيل</Th>
            </tr>
          </thead>
          <tbody>
            {biz.auditLogs.map((r) => (
              <tr key={r.id}>
                <Td className="tnum whitespace-nowrap text-xs text-muted">{formatDateTime(r.createdAt)}</Td>
                <Td className="whitespace-nowrap">{r.user?.fullName ?? <span className="text-faint">النظام</span>}</Td>
                <Td className="whitespace-nowrap font-medium">{auditLabel(r.action)}</Td>
                <Td className="text-xs text-muted">
                  <span className="ltr inline-block max-w-md truncate align-middle">{r.details ?? ""}</span>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

function DeviceTable({ devices }: { devices: { id: string; publicId: string; kind: string; name: string; status: string; platform: string | null; appVersion: string | null; lastSeenAt: Date | null; lastIp: string | null }[] }) {
  if (devices.length === 0) return <div className="text-xs text-faint">لا أجهزة</div>;
  return (
    <Table>
      <thead>
        <tr>
          <Th>الجهاز</Th>
          <Th>النوع</Th>
          <Th>الحالة</Th>
          <Th>آخر فحص</Th>
          <Th />
        </tr>
      </thead>
      <tbody>
        {devices.map((d) => (
          <tr key={d.id}>
            <Td>
              <div className="font-medium">{d.name}</div>
              <div className="text-xs text-muted">
                <Mono>{d.publicId}</Mono>
                {d.platform && <span className="ms-2">{d.platform}</span>}
                {d.appVersion && <span className="ms-2">v{d.appVersion}</span>}
              </div>
            </Td>
            <Td>{DEVICE_KIND_LABELS[d.kind] ?? d.kind}</Td>
            <Td>{d.status === "ACTIVE" ? <Badge tone="success">فعّال</Badge> : <Badge tone="danger">محظور</Badge>}</Td>
            <Td className="tnum text-xs text-muted">
              {d.lastSeenAt ? formatDateTime(d.lastSeenAt) : "—"}
              {d.lastIp && <span className="ms-2 font-mono">{d.lastIp}</span>}
            </Td>
            <Td>
              <div className="flex justify-end gap-1">
                {d.status === "ACTIVE" ? (
                  <InlineAction action={setDeviceStatus} hidden={{ id: d.id, status: "BLOCKED" }} variant="ghost">
                    <span className="text-crimson">حظر</span>
                  </InlineAction>
                ) : (
                  <InlineAction action={setDeviceStatus} hidden={{ id: d.id, status: "ACTIVE" }} variant="ghost">
                    رفع الحظر
                  </InlineAction>
                )}
                <InlineAction action={deleteDevice} hidden={{ id: d.id }} variant="ghost" confirm="حذف الجهاز؟ سيحتاج إلى تفعيل جديد بمفتاح الترخيص.">
                  <span className="text-muted">حذف</span>
                </InlineAction>
              </div>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
