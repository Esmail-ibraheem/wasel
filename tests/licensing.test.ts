import { describe, it, expect } from "vitest";
import { evaluateAccess } from "@/lib/licensing/access";
import { businessPublicId, devicePublicId, installationPublicId, licenseKey } from "@/lib/licensing/ids";
import { canonicalize, getPublicKey, signPayload, verifyPayload } from "@/lib/licensing/signing";

const now = new Date("2026-09-18T12:00:00Z");
const future = new Date("2027-01-01T00:00:00Z");
const past = new Date("2026-01-01T00:00:00Z");

describe("evaluateAccess", () => {
  it("business status wins over licenses", () => {
    expect(evaluateAccess({ status: "PENDING" }, [{ status: "ACTIVE", expiresAt: null }], now).status).toBe("PENDING");
    expect(evaluateAccess({ status: "REJECTED" }, [{ status: "ACTIVE", expiresAt: null }], now).status).toBe("REJECTED");
    expect(evaluateAccess({ status: "SUSPENDED" }, [{ status: "ACTIVE", expiresAt: null }], now).status).toBe("SUSPENDED");
  });
  it("active business needs an active, unexpired license", () => {
    const r = evaluateAccess({ status: "ACTIVE" }, [{ id: "l1", status: "ACTIVE", expiresAt: future }], now);
    expect(r.ok).toBe(true);
    expect(r.status).toBe("ACTIVE");
    expect(r.license?.id).toBe("l1");
  });
  it("perpetual licenses (no expiry) are active", () => {
    expect(evaluateAccess({ status: "ACTIVE" }, [{ status: "ACTIVE", expiresAt: null }], now).ok).toBe(true);
  });
  it("an ACTIVE license past its expiry is EXPIRED", () => {
    const r = evaluateAccess({ status: "ACTIVE" }, [{ status: "ACTIVE", expiresAt: past }], now);
    expect(r.ok).toBe(false);
    expect(r.status).toBe("EXPIRED");
  });
  it("picks the valid license when several exist", () => {
    const r = evaluateAccess(
      { status: "ACTIVE" },
      [
        { id: "old", status: "EXPIRED", expiresAt: past },
        { id: "susp", status: "SUSPENDED", expiresAt: null },
        { id: "good", status: "ACTIVE", expiresAt: future },
      ],
      now,
    );
    expect(r.status).toBe("ACTIVE");
    expect(r.license?.id).toBe("good");
  });
  it("suspended-only licenses → SUSPENDED, pending-only → PENDING, none → NO_LICENSE", () => {
    expect(evaluateAccess({ status: "ACTIVE" }, [{ status: "SUSPENDED", expiresAt: null }], now).status).toBe("SUSPENDED");
    expect(evaluateAccess({ status: "ACTIVE" }, [{ status: "PENDING", expiresAt: null }], now).status).toBe("PENDING");
    expect(evaluateAccess({ status: "ACTIVE" }, [], now).status).toBe("NO_LICENSE");
  });
});

describe("public ids", () => {
  it("have the documented shapes and are unique", () => {
    expect(businessPublicId()).toMatch(/^WSL-B-[A-Z2-9]{6}$/);
    expect(licenseKey()).toMatch(/^WSL-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(installationPublicId()).toMatch(/^WSL-I-[A-Z2-9]{8}$/);
    expect(devicePublicId()).toMatch(/^WSL-D-[A-Z2-9]{8}$/);
    const keys = new Set(Array.from({ length: 200 }, () => licenseKey()));
    expect(keys.size).toBe(200);
  });
});

describe("Ed25519 signing", () => {
  it("canonicalizes key order so signatures are stable", () => {
    expect(canonicalize({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: null } })).toBe('{"a":{"c":null,"d":[3,{"y":2,"z":1}]},"b":1}');
  });
  it("signs a payload that verifies with the published public key and fails when tampered", () => {
    const payload = { ok: true, status: "ACTIVE", nonce: "abc", serverTime: now.toISOString() };
    const signed = signPayload(payload);
    expect(signed.signature).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(signed.alg).toBe("Ed25519");
    const { signature, alg, ...body } = signed;
    expect(verifyPayload(body, signature, getPublicKey().spkiBase64)).toBe(true);
    expect(verifyPayload({ ...body, status: "SUSPENDED" }, signature, getPublicKey().spkiBase64)).toBe(false);
    expect(alg).toBe("Ed25519");
  });
  it("exposes the raw 32-byte key for tweetnacl-style clients", () => {
    const pk = getPublicKey();
    expect(Buffer.from(pk.rawBase64, "base64")).toHaveLength(32);
    expect(Buffer.from(pk.spkiBase64, "base64")).toHaveLength(44);
  });
});
