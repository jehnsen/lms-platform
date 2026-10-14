/**
 * FR-3.8, US-14: the plagiarism (similarity) checking service.
 *
 * Backend seam. The real adapter runs on the server: it sends the submission's
 * text and files to the provider with the school's credentials, usually gets
 * the result later through a callback, and stores the report where only
 * faculty can read it. Student work must not be sent to a third party until
 * the school has agreed terms with it (see NFR-3 in BACKEND-BACKLOG.md).
 */
export interface SimilarityResult {
  /** Share of the work that matches other sources, 0 to 100. */
  percent: number;
  matches: Array<{ source: string; percent: number }>;
}

export interface PlagiarismProvider {
  readonly name: string;
  check(work: { submissionId: string; text: string; fileNames: string[] }): Promise<SimilarityResult>;
}

const MOCK_LATENCY_MS = 900;

const MOCK_SOURCES = [
  "Wikipedia: Machine learning",
  "Open textbook: Introduction to Data Science",
  "Student paper submitted to another school",
  "Blog post: A beginner's guide",
  "Encyclopaedia entry",
];

/** A sentence the mock treats as lifted from a source, so a high score can be demonstrated on purpose. */
export const MOCK_KNOWN_PASSAGE = "machine learning is a field of study in artificial intelligence";

function hashOf(text: string) {
  let hash = 0x811c9dc5;
  for (const char of text) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * MOCK: nothing is compared with anything. The score is derived from the text
 * itself so the same work always gets the same report: low for most work, high
 * when it contains `MOCK_KNOWN_PASSAGE`.
 */
export const mockPlagiarismProvider: PlagiarismProvider = {
  name: "Mock similarity checker",
  async check({ submissionId, text, fileNames }) {
    await new Promise<void>((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));
    const hash = hashOf(`${text}|${fileNames.join("|")}|${text ? "" : submissionId}`);
    const lifted = text.toLowerCase().includes(MOCK_KNOWN_PASSAGE);
    const percent = lifted ? 55 + (hash % 30) : 2 + (hash % 17);
    const first = Math.max(1, Math.round(percent * 0.6));
    const matches = [
      { source: MOCK_SOURCES[lifted ? 0 : 1 + (hash % (MOCK_SOURCES.length - 1))], percent: first },
      { source: MOCK_SOURCES[1 + ((hash >> 3) % (MOCK_SOURCES.length - 1))], percent: percent - first },
    ].filter((match, index, all) => match.percent > 0 && all.findIndex((other) => other.source === match.source) === index);
    return { percent: matches.reduce((sum, match) => sum + match.percent, 0), matches };
  },
};
