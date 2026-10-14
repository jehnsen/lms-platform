import { describe, expect, it } from "vitest";
import { DEFAULT_PASSWORD_POLICY, meetsPasswordPolicy, passwordRules } from "@/lib/domain/password-policy";
import { DEFAULT_SETTINGS, settingsProblems } from "@/lib/domain/settings";
import { archivedCourseIds, isCourseArchived, isTermDueForArchive } from "@/lib/domain/terms";
import type { Term } from "@/lib/types";

describe("FR-1.4: password policy for local accounts", () => {
  it("accepts a password that meets every rule of the default policy", () => {
    expect(meetsPasswordPolicy("Harbour42", DEFAULT_PASSWORD_POLICY)).toBe(true);
  });

  it("names each rule a password fails", () => {
    const unmet = (password: string) =>
      passwordRules(password, DEFAULT_PASSWORD_POLICY)
        .filter((rule) => !rule.met)
        .map((rule) => rule.id);
    expect(unmet("Ab1")).toEqual(["length"]);
    expect(unmet("harbour42")).toEqual(["uppercase"]);
    expect(unmet("HARBOUR42")).toEqual(["lowercase"]);
    expect(unmet("Harbourside")).toEqual(["digit"]);
    expect(unmet("")).toEqual(["length", "uppercase", "lowercase", "digit"]);
  });

  it("only checks the rules the school has turned on", () => {
    const lengthOnly = { ...DEFAULT_PASSWORD_POLICY, requireUppercase: false, requireLowercase: false, requireDigit: false };
    expect(passwordRules("aaaaaaaa", lengthOnly).map((rule) => rule.id)).toEqual(["length"]);
    expect(meetsPasswordPolicy("aaaaaaaa", lengthOnly)).toBe(true);

    const withSymbol = { ...DEFAULT_PASSWORD_POLICY, requireSymbol: true };
    expect(meetsPasswordPolicy("Harbour42", withSymbol)).toBe(false);
    expect(meetsPasswordPolicy("Harbour42!", withSymbol)).toBe(true);
  });

  it("follows a changed minimum length", () => {
    const longer = { ...DEFAULT_PASSWORD_POLICY, minLength: 12 };
    expect(meetsPasswordPolicy("Harbour42", longer)).toBe(false);
    expect(meetsPasswordPolicy("Harbourside42", longer)).toBe(true);
  });
});

describe("school settings", () => {
  it("accepts the defaults", () => {
    expect(settingsProblems(DEFAULT_SETTINGS)).toEqual([]);
  });

  it("rejects a minimum password length outside the allowed range", () => {
    const withLength = (minLength: number) =>
      settingsProblems({ ...DEFAULT_SETTINGS, passwordPolicy: { ...DEFAULT_PASSWORD_POLICY, minLength } });
    expect(withLength(5)).toHaveLength(1);
    expect(withLength(65)).toHaveLength(1);
    expect(withLength(8.5)).toHaveLength(1);
    expect(withLength(6)).toEqual([]);
  });

  it("accepts keeping data indefinitely or for a whole number of years", () => {
    expect(settingsProblems({ ...DEFAULT_SETTINGS, retentionYears: null })).toEqual([]);
    expect(settingsProblems({ ...DEFAULT_SETTINGS, retentionYears: 7 })).toEqual([]);
    expect(settingsProblems({ ...DEFAULT_SETTINGS, retentionYears: 0 })).toHaveLength(1);
    expect(settingsProblems({ ...DEFAULT_SETTINGS, retentionYears: 2.5 })).toHaveLength(1);
  });
});

describe("US-04, FR-1.8: archiving at term end", () => {
  const term = (id: string, status: Term["status"], endsOn = "2026-12-18"): Term => ({
    id,
    name: id,
    startsOn: "2026-08-24",
    endsOn,
    status,
  });
  const courses = [
    { id: "math", termId: "t1", status: "active" as const },
    { id: "art", termId: "t2", status: "active" as const },
    { id: "latin", termId: "t2", status: "archived" as const },
  ];

  it("makes every course of an archived term read-only", () => {
    const terms = [term("t1", "archived"), term("t2", "active")];
    expect(archivedCourseIds(courses, terms)).toEqual(["math", "latin"]);
    expect(isCourseArchived(courses[1], terms)).toBe(false);
  });

  it("leaves courses editable while their term is active or upcoming", () => {
    expect(archivedCourseIds(courses.slice(0, 2), [term("t1", "active"), term("t2", "upcoming")])).toEqual([]);
  });

  it("flags an active term for archiving only after its last day", () => {
    const active = term("t1", "active", "2026-12-18");
    expect(isTermDueForArchive(active, "2026-12-18")).toBe(false);
    expect(isTermDueForArchive(active, "2026-12-19")).toBe(true);
    expect(isTermDueForArchive(term("t1", "archived"), "2027-01-01")).toBe(false);
    expect(isTermDueForArchive(term("t1", "upcoming"), "2027-01-01")).toBe(false);
  });
});
