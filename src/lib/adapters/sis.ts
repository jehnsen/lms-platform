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
      { sisId: "2023-00412", name: "Miguel Angelo Manalo", email: "miguel.manalo@dbcc.edu.ph", role: "student", sectionCodes: ["IT-321-A"] },
      { sisId: "2023-00418", name: "Angelica Mae Dimaano", email: "angelica.dimaano@dbcc.edu.ph", role: "student", sectionCodes: ["IT-321-A"] },
      { sisId: "2023-00689", name: "Carlo Emmanuel Aquino", email: "carlo.aquino@dbcc.edu.ph", role: "student", sectionCodes: ["IT-321-B", "IT-211-A", "ETH-101-A"] },
      { sisId: "2023-00694", name: "Princess Anne Villareal", email: "princess.villareal@dbcc.edu.ph", role: "student", sectionCodes: ["NATSCI-102-A", "BA-105-B"] },
      { sisId: "F-2005", name: "Mr. Arnold Dizon", email: "arnold.dizon@dbcc.edu.ph", role: "faculty", sectionCodes: ["BA-105-B"] },
      { sisId: "2023-00702", name: "Noel Vincent Magsino", email: "", role: "student", sectionCodes: ["IT-211-B"] },
      { sisId: "2023-00715", name: "Shaira Mae Bautista", email: "shaira.bautista@dbcc.edu.ph", role: "student", sectionCodes: ["BSIT-900-A"] },
    ];
  },
  /**
   * MOCK: nothing is sent anywhere. It takes every record whose student ID
   * looks like one of its own (the admission year, a hyphen and five digits, as
   * in "2023-00412") and turns the rest down, so an
   * export can show a rejection.
   */
  async exportGrades(records) {
    await new Promise<void>((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));
    const rejected = records
      .filter((record) => !/^\d{4}-\d{5}$/.test(record.studentSisId))
      .map((record) => ({ key: record.key, reason: "The SIS has no student with this ID." }));
    return { accepted: records.length - rejected.length, rejected };
  },
};
