/**
 * NFR-2, NFR-5, NFR-6: audits every page of the running app in a real browser.
 *
 * For each role it signs in with the demo session cookie and visits every page
 * that role can open, at 360 px and at 1280 px wide, in the light and the dark
 * theme. On each it records:
 *
 * - WCAG 2.1 A and AA violations found by axe-core (NFR-5). Automated checks
 *   find only part of what WCAG asks; a manual pass is still needed.
 * - Whether the page scrolls sideways, and which elements stick out (NFR-6).
 * - The JavaScript downloaded to show the page, and main-thread tasks over
 *   50 ms while it loads (NFR-2).
 *
 * Some dialogs and states are opened by clicking, so they are audited too.
 *
 * Usage: build and start the app, then run the audit against it.
 *   npm run build && npm run start          (in one terminal)
 *   npm run audit:ui                         (in another)
 * Options: BASE_URL (default http://localhost:3000), CHROME (path to a
 * Chrome or Edge executable; by default the installed Chrome is used),
 * ONLY=role,role to audit some roles.
 *
 * Writes `.audit/ui-report.json` and exits with 1 when anything fails.
 */
import { mkdir, writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright-core";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const ROLES = {
  student: "u-student-mike",
  faculty: "u-faculty-okafor",
  admin: "u-admin-nair",
  parent: "u-parent-manabat",
};
const ONLY = process.env.ONLY?.split(",");

/** Every page, with the seeded records dynamic pages need. A page a role cannot open is skipped. */
const PAGES = [
  "/",
  "/courses",
  "/courses/new",
  "/courses/ml-foundations",
  "/courses/ml-foundations/edit",
  "/courses/ml-foundations/learn/ml-learning-from-data",
  "/assignments",
  "/assignments/new",
  "/assignments/asg-ml-reflection",
  "/assignments/asg-ml-reflection/edit",
  "/assignments/asg-ml-reflection/submissions/u-student-01",
  "/quizzes",
  "/quizzes/new",
  "/quizzes/ml-quiz-2",
  "/quizzes/ml-quiz-2/edit",
  "/grading",
  "/calendar",
  "/attendance",
  "/announcements",
  "/messages",
  "/forums",
  "/forums/thread-ml-validation",
  "/notifications",
  "/grades",
  "/reports",
  "/gradebook",
  "/analytics",
  "/content",
  "/lesson-planner",
  "/tutor",
  "/admin/users",
  "/admin/terms",
  "/admin/settings",
  "/admin/audit",
];

/** States reached by clicking, audited after the page itself. Each is opened on a fresh load of its page. */
const STATES = [
  { role: "faculty", path: "/gradebook", click: "Set up grading" },
  { role: "admin", path: "/gradebook", click: "Export to SIS" },
  { role: "faculty", path: "/announcements", click: "New announcement" },
  { role: "faculty", path: "/messages", click: "New message" },
  { role: "student", path: "/messages", click: /Dr\. Amara Okafor/ },
  { role: "faculty", path: "/calendar", click: "Month" },
  { role: "faculty", path: "/calendar", click: "Add event" },
  { role: "faculty", path: "/courses/ml-foundations", click: "Schedule live class" },
  { role: "student", path: "/quizzes/ml-quiz-1", click: /^(Start|Retake) quiz/ },
  { role: "admin", path: "/admin/users", click: "Import CSV" },
  { role: "admin", path: "/analytics", click: /^Open Machine Learning/ },
  { role: "faculty", path: "/forums", click: "New thread" },
];

const VIEWPORTS = [
  { name: "360", width: 360, height: 800 },
  { name: "1280", width: 1280, height: 900 },
];
const THEMES = ["light", "dark"];
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

function cookieFor(role) {
  return {
    name: "lms_session",
    value: encodeURIComponent(JSON.stringify({ userId: ROLES[role], role })),
    url: BASE_URL,
  };
}

/** Collects main-thread tasks over 50 ms from the very start of the page. */
const LONG_TASKS = () => {
  window.__longTasks = [];
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__longTasks.push(Math.round(entry.duration));
    }).observe({ type: "longtask", buffered: true });
  } catch {
    // Not supported: nothing is recorded.
  }
};

/** Waits until the page has rendered its real content, not the loading placeholder. */
async function settle(page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 8000 }).catch(() => undefined);
  await page.waitForTimeout(250);
}

async function overflow(page) {
  return page.evaluate(() => {
    const width = window.innerWidth;
    if (document.documentElement.scrollWidth <= width + 1) return null;
    // The outermost elements that stick out and are not inside something that scrolls on its own.
    const offenders = [];
    for (const element of document.querySelectorAll("body *")) {
      const box = element.getBoundingClientRect();
      if (box.right <= width + 1 || box.width === 0) continue;
      let parent = element.parentElement;
      let contained = false;
      while (parent && parent !== document.body) {
        const style = getComputedStyle(parent);
        if (/(auto|scroll|hidden|clip)/.test(style.overflowX) && parent.getBoundingClientRect().right <= width + 1) {
          contained = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (contained) continue;
      if (offenders.some((other) => other.contains(element))) continue;
      offenders.push(element);
    }
    return {
      scrollWidth: document.documentElement.scrollWidth,
      offenders: offenders.slice(0, 5).map((element) => {
        const id = element.id ? `#${element.id}` : "";
        const classes = typeof element.className === "string" ? `.${element.className.trim().split(/\s+/).slice(0, 4).join(".")}` : "";
        return `${element.tagName.toLowerCase()}${id}${classes} (${Math.round(element.getBoundingClientRect().right)}px): ${(element.textContent ?? "").trim().slice(0, 50)}`;
      }),
    };
  });
}

async function audit(page, label, results) {
  // Read before axe runs: axe itself is a long task on a large page.
  const perf = await page.evaluate(() => ({
    scriptKb: Math.round(
      performance
        .getEntriesByType("resource")
        .filter((entry) => entry.initiatorType === "script" || entry.name.endsWith(".js"))
        .reduce((sum, entry) => sum + (entry.encodedBodySize || entry.transferSize || 0), 0) / 1024,
    ),
    longTasks: window.__longTasks ?? [],
  }));
  const axe = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const violations = axe.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.length,
    targets: violation.nodes.slice(0, 3).map((node) => `${node.target.join(" ")} :: ${node.failureSummary?.split("\n").slice(1, 2).join("") ?? ""}`),
  }));
  const sideways = await overflow(page);
  results.push({ label, violations, overflow: sideways, ...perf });
  const flags = [
    violations.length ? `${violations.length} axe` : "",
    sideways ? `scrolls sideways (${sideways.scrollWidth}px)` : "",
  ].filter(Boolean);
  console.log(`${flags.length ? "FAIL" : "ok  "} ${label}${flags.length ? ` — ${flags.join(", ")}` : ""}`);
}

async function main() {
  const browser = await chromium.launch(
    process.env.CHROME ? { executablePath: process.env.CHROME } : { channel: "chrome" },
  );
  const results = [];
  const roles = Object.keys(ROLES).filter((role) => !ONLY || ONLY.includes(role));

  for (const role of roles) {
    for (const viewport of VIEWPORTS) {
      for (const theme of THEMES) {
        const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, colorScheme: theme });
        await context.addCookies([cookieFor(role)]);
        await context.addInitScript(LONG_TASKS);
        const page = await context.newPage();
        for (const path of PAGES) {
          await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded" });
          await settle(page);
          const landed = new URL(page.url()).pathname;
          if (landed !== path) continue; // Redirected: the role cannot open it.
          await audit(page, `${role} ${viewport.name} ${theme} ${path}`, results);
        }
        for (const state of STATES.filter((item) => item.role === role)) {
          await page.goto(`${BASE_URL}${state.path}`, { waitUntil: "domcontentloaded" });
          await settle(page);
          const target = page.getByRole("button", { name: state.click }).first();
          if (!(await target.isVisible().catch(() => false))) {
            console.log(`skip ${role} ${viewport.name} ${theme} ${state.path} [${state.click}]: not found`);
            continue;
          }
          await target.click();
          await settle(page);
          await audit(page, `${role} ${viewport.name} ${theme} ${state.path} [${state.click}]`, results);
        }
        await context.close();
      }
    }
  }
  await browser.close();

  await mkdir(".audit", { recursive: true });
  await writeFile(".audit/ui-report.json", JSON.stringify(results, null, 2));

  const failing = results.filter((result) => result.violations.length > 0 || result.overflow);
  const byRule = new Map();
  for (const result of results) {
    for (const violation of result.violations) {
      const entry = byRule.get(violation.id) ?? { help: violation.help, impact: violation.impact, pages: new Set(), example: violation.targets[0] };
      entry.pages.add(result.label.split(" ").slice(3).join(" "));
      byRule.set(violation.id, entry);
    }
  }
  console.log(`\n${results.length} page states audited; ${failing.length} with problems.`);
  for (const [id, entry] of byRule) {
    console.log(`\n[${entry.impact}] ${id}: ${entry.help}\n  pages: ${[...entry.pages].join(", ")}\n  e.g. ${entry.example}`);
  }
  const sideways = results.filter((result) => result.overflow);
  for (const result of sideways) console.log(`\nSideways scroll: ${result.label}\n  ${result.overflow.offenders.join("\n  ")}`);
  const slow = results.filter((result) => result.longTasks.some((ms) => ms >= 200));
  console.log(`\nLargest JavaScript per page (KB): ${[...results].sort((a, b) => b.scriptKb - a.scriptKb).slice(0, 5).map((result) => `${result.label} ${result.scriptKb}`).join("; ")}`);
  console.log(`Page loads with a main-thread task of 200 ms or more: ${slow.length}`);
  for (const result of slow.slice(0, 10)) console.log(`  ${result.label}: ${result.longTasks.join(", ")} ms`);
  process.exitCode = failing.length > 0 ? 1 : 0;
}

await main();
