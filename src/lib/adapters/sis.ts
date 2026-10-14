/**
 * FR-1.5, FR-1.6, FR-8.1: the Student Information System.
 *
 * Backend seam. The real adapter runs on the server with the SIS credentials
 * and on a schedule; the browser only asks for a manual sync and reads the
 * result. Grade export (FR-4.5) sends records the app has already checked and
 * reports the ones the SIS itself turns down. The connection test (FR-8.2)
 * joins this interface in Phase 8.
 */
import type { SisGradeRecord } from "@/lib/domain/sis-export";

export interface SisRosterRecord {
  sisId: string;
  name: string;
  email: string;
  role: string;
  sectionCodes: string[];
}

export interface SisAdapter {
  readonly name: string;
  /** Everyone the SIS says should have an account, with their sections. */
  fetchRoster(): Promise<SisRosterRecord[]>;
  /** FR-4.5: sends final grades. Resolves with how many were taken and each one refused, with the reason. */
  exportGrades(records: SisGradeRecord[]): Promise<SisGradeResult>;
}

export interface SisGradeResult {
  accepted: number;
  /** `key` is the record's own key, so the caller can match it. */
  rejected: Array<{ key: string; reason: string }>;
}

const MOCK_LATENCY_MS = 1200;

/**
 * MOCK: a fixed feed. It contains two people who already have accounts, three
 * who do not, and two records the import must reject, so a sync shows every
 * outcome.
 */
export const mockSis: SisAdapter = {
  name: "Mock SIS",
  async fetchRoster() {
    await new Promise<void>((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));
    return [
      { sisId: "S-1000", name: "Mike Manabat", email: "mike.manabat@example.com", role: "student", sectionCodes: ["CS-110-A"] },
      { sisId: "S-1001", name: "Aiko Tanaka", email: "aiko.tanaka@example.com", role: "student", sectionCodes: ["CS-110-A"] },
      { sisId: "S-1013", name: "Mateo Alvarez", email: "mateo.alvarez@example.com", role: "student", sectionCodes: ["CS-110-B", "IT-101-A"] },
      { sisId: "S-1014", name: "Nia Williams", email: "nia.williams@example.com", role: "student", sectionCodes: ["BIO-201-A", "LS-105-B"] },
      { sisId: "F-2005", name: "Dr. Hugo Lindqvist", email: "hugo.lindqvist@example.com", role: "faculty", sectionCodes: ["LS-105-B"] },
      { sisId: "S-1015", name: "Omar Farouk", email: "", role: "student", sectionCodes: ["IT-101-B"] },
      { sisId: "S-1016", name: "Priscilla Nwosu", email: "priscilla.nwosu@example.com", role: "student", sectionCodes: ["ART-900-A"] },
    ];
  },
  /**
   * MOCK: nothing is sent anywhere. It takes every record whose student ID
   * looks like one of its own ("S-" and digits) and turns the rest down, so an
   * export can show a rejection.
   */
  async exportGrades(records) {
    await new Promise<void>((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));
    const rejected = records
      .filter((record) => !/^S-\d+$/.test(record.studentSisId))
      .map((record) => ({ key: record.key, reason: "The SIS has no student with this ID." }));
    return { accepted: records.length - rejected.length, rejected };
  },
};
