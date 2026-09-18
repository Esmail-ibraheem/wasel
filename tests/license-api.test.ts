import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/lib/db";
import { businessPublicId } from "@/lib/licensing/ids";
import { issueLicense } from "@/lib/licensing/service";
import { getPublicKey, verifyPayload } from "@/lib/licensing/signing";
import { POST as activate } from "@/app/api/license/activate/route";
import { POST as check } from "@/app/api/license/check/route";
import { GET as publicKey } from "@/app/api/license/public-key/route";

const BASE = "http://test.local";
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(BASE + path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

let activeKey: string;
let suspendedKey: string;
let pendingBizKey: string;
let expiredKey: string;

beforeAll(async () => {
  await db.device.deleteMany();
  await db.installation.deleteMany();
  await db.license.deleteMany();
  await db.business.deleteMany({ where: { name: { startsWith: "lic-" } } });

  const active = await db.business.create({ data: { publicId: businessPublicId(), name: "lic-active", status: "ACTIVE" } });
  activeKey = (await issueLicense({ businessId: active.id, days: 30, maxDevices: 2 })).key;
  suspendedKey = (await db.license.update({ where: { id: (await issueLicense({ businessId: active.id })).id }, data: { status: "SUSPENDED" } })).key;
  expiredKey = (await db.license.update({ where: { id: (await issueLicense({ businessId: active.id })).id }, data: { expiresAt: new Date(Date.now() - 1000) } })).key;

  const pending = await db.business.create({ data: { publicId: businessPublicId(), name: "lic-pending", status: "PENDING" } });
  pendingBizKey = (await issueLicense({ businessId: pending.id })).key;
});

async function json(res: Response) {
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

function stripSig(body: Record<string, unknown>) {
  const { signature, alg, ...rest } = body;
  return { rest, signature: String(signature), alg };
}

describe("GET /api/license/public-key", () => {
  it("publishes the Ed25519 key", async () => {
    const { status, body } = await json(await publicKey());
    expect(status).toBe(200);
    expect(body.publicKey).toBe(getPublicKey().spkiBase64);
    expect(body.alg).toBe("Ed25519");
  });
});

describe("POST /api/license/activate", () => {
  it("rejects malformed bodies and unknown keys", async () => {
    expect((await json(await activate(post("/api/license/activate", {})))).status).toBe(400);
    const r = await json(await activate(post("/api/license/activate", { licenseKey: "WSL-AAAA-BBBB-CCCC", device: { kind: "DESKTOP", name: "x" } })));
    expect(r.status).toBe(404);
    expect(r.body.error).toBe("LICENSE_NOT_FOUND");
  });

  it("registers an installation + device for a valid key and returns a signed ACTIVE response", async () => {
    const r = await json(
      await activate(
        post("/api/license/activate", {
          licenseKey: activeKey.toLowerCase().replace(/-/g, ""),
          installation: { name: "فرع صنعاء" },
          device: { kind: "DESKTOP", name: "كاشير 1", fingerprint: "fp-1", platform: "win32", appVersion: "1.0.0" },
        }),
      ),
    );
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("ACTIVE");
    expect(String(r.body.installationId)).toMatch(/^WSL-I-/);
    expect(String(r.body.deviceId)).toMatch(/^WSL-D-/);
    expect(String(r.body.deviceToken)).toMatch(/^wsd_/);
    const { rest, signature } = stripSig(r.body);
    expect(verifyPayload(rest, signature, getPublicKey().spkiBase64)).toBe(true);

    const dev = await db.device.findUniqueOrThrow({ where: { publicId: String(r.body.deviceId) } });
    expect(dev.status).toBe("ACTIVE");
    expect(dev.installationId).not.toBeNull();
  });

  it("attaches a second device to an existing installation and enforces maxDevices", async () => {
    const first = await db.device.findFirstOrThrow({ where: { name: "كاشير 1" }, include: { installation: true } });
    const r2 = await json(
      await activate(post("/api/license/activate", { licenseKey: activeKey, installationId: first.installation!.publicId, device: { kind: "PHONE", name: "هاتف المحل" } })),
    );
    expect(r2.status).toBe(200);
    expect(r2.body.installationId).toBe(first.installation!.publicId);

    const r3 = await json(await activate(post("/api/license/activate", { licenseKey: activeKey, device: { kind: "PHONE", name: "third" } })));
    expect(r3.status).toBe(409);
    expect(r3.body.error).toBe("DEVICE_LIMIT_REACHED");
  });

  it("refuses suspended, expired, and pending-business licenses with the right status", async () => {
    const s = await json(await activate(post("/api/license/activate", { licenseKey: suspendedKey, device: { kind: "DESKTOP", name: "x" } })));
    expect(s.status).toBe(403);
    expect(s.body.status).toBe("SUSPENDED");
    const e = await json(await activate(post("/api/license/activate", { licenseKey: expiredKey, device: { kind: "DESKTOP", name: "x" } })));
    expect(e.status).toBe(403);
    expect(e.body.status).toBe("EXPIRED");
    expect((await db.license.findUniqueOrThrow({ where: { key: expiredKey } })).status).toBe("EXPIRED");
    const p = await json(await activate(post("/api/license/activate", { licenseKey: pendingBizKey, device: { kind: "DESKTOP", name: "x" } })));
    expect(p.status).toBe(403);
    expect(p.body.status).toBe("PENDING");
  });
});

describe("POST /api/license/check", () => {
  let token: string;
  let deviceId: string;

  beforeAll(async () => {
    await db.device.deleteMany({ where: { name: "third" } });
    const r = await json(await activate(post("/api/license/activate", { licenseKey: activeKey, device: { kind: "SERVER", name: "checker" } })));
    if (r.status !== 200) {
      // limit reached from previous tests → free a slot
      await db.device.deleteMany({ where: { name: "هاتف المحل" } });
      const again = await json(await activate(post("/api/license/activate", { licenseKey: activeKey, device: { kind: "SERVER", name: "checker" } })));
      token = String(again.body.deviceToken);
      deviceId = String(again.body.deviceId);
    } else {
      token = String(r.body.deviceToken);
      deviceId = String(r.body.deviceId);
    }
  });

  it("returns a signed ACTIVE status echoing the nonce and updates lastSeenAt", async () => {
    const r = await json(await check(post("/api/license/check", { nonce: "n-123", appVersion: "1.0.1" }, { "x-device-token": token })));
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("ACTIVE");
    expect(r.body.nonce).toBe("n-123");
    expect(typeof r.body.serverTime).toBe("string");
    const { rest, signature } = stripSig(r.body);
    expect(verifyPayload(rest, signature, getPublicKey().spkiBase64)).toBe(true);
    const dev = await db.device.findUniqueOrThrow({ where: { publicId: deviceId } });
    expect(dev.lastSeenAt).not.toBeNull();
    expect(dev.appVersion).toBe("1.0.1");
  });

  it("rejects bad tokens and reports BLOCKED for blocked devices", async () => {
    expect((await json(await check(post("/api/license/check", { nonce: "x" }, { "x-device-token": "wsd_bogus" })))).status).toBe(401);
    await db.device.update({ where: { publicId: deviceId }, data: { status: "BLOCKED" } });
    const r = await json(await check(post("/api/license/check", { nonce: "y" }, { "x-device-token": token })));
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("BLOCKED");
    await db.device.update({ where: { publicId: deviceId }, data: { status: "ACTIVE" } });
  });

  it("reflects a business suspension immediately (central check, nothing cached on the device)", async () => {
    const biz = await db.business.findFirstOrThrow({ where: { name: "lic-active" } });
    await db.business.update({ where: { id: biz.id }, data: { status: "SUSPENDED" } });
    const r = await json(await check(post("/api/license/check", { nonce: "z" }, { "x-device-token": token })));
    expect(r.body.status).toBe("SUSPENDED");
    await db.business.update({ where: { id: biz.id }, data: { status: "ACTIVE" } });
  });
});
