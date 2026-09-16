import { describe, it, expect } from "vitest";
import { can, canManageRole, assignableRoles } from "@/lib/permissions";

describe("permissions", () => {
  it("everyone can view and review transfers", () => {
    for (const r of ["OWNER", "MANAGER", "ACCOUNTANT", "EMPLOYEE"]) {
      expect(can(r, "transfers.view")).toBe(true);
      expect(can(r, "transfers.review")).toBe(true);
    }
  });
  it("employees cannot confirm, see raw messages, or manage anything", () => {
    expect(can("EMPLOYEE", "transfers.confirm")).toBe(false);
    expect(can("EMPLOYEE", "messages.view")).toBe(false);
    expect(can("EMPLOYEE", "users.manage")).toBe(false);
  });
  it("accountants confirm/reject/export but do not manage users or phones", () => {
    expect(can("ACCOUNTANT", "transfers.confirm")).toBe(true);
    expect(can("ACCOUNTANT", "transfers.export")).toBe(true);
    expect(can("ACCOUNTANT", "phones.manage")).toBe(false);
  });
  it("only owner manages settings", () => {
    expect(can("OWNER", "settings.manage")).toBe(true);
    expect(can("MANAGER", "settings.manage")).toBe(false);
  });
  it("rejects unknown roles", () => {
    expect(can("HACKER", "transfers.view")).toBe(false);
  });
});

describe("canManageRole", () => {
  it("owner manages all but other owners", () => {
    expect(canManageRole("OWNER", "MANAGER")).toBe(true);
    expect(canManageRole("OWNER", "EMPLOYEE")).toBe(true);
    expect(canManageRole("OWNER", "OWNER")).toBe(false);
  });
  it("manager manages only roles below manager", () => {
    expect(canManageRole("MANAGER", "ACCOUNTANT")).toBe(true);
    expect(canManageRole("MANAGER", "MANAGER")).toBe(false);
    expect(canManageRole("MANAGER", "OWNER")).toBe(false);
  });
  it("accountant and employee manage nobody", () => {
    expect(assignableRoles("ACCOUNTANT")).toEqual([]);
    expect(assignableRoles("EMPLOYEE")).toEqual([]);
    expect(assignableRoles("MANAGER")).toEqual(["ACCOUNTANT", "EMPLOYEE"]);
    expect(assignableRoles("OWNER")).toEqual(["MANAGER", "ACCOUNTANT", "EMPLOYEE"]);
  });
});
