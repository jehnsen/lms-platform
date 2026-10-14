import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/domain/contrast";

/**
 * NFR-5 (WCAG 2.1 AA): every text token must reach 4.5:1 on every surface it
 * is used on, in both themes. The pairs below are the combinations the
 * components actually use; add a pair when a new combination is introduced.
 */
const TEXT_ON_SURFACE: Array<[text: string, surface: string]> = [
  ["ink", "bg"],
  ["ink", "surface"],
  ["ink", "surface-2"],
  ["ink", "primary-soft"],
  ["ink", "spark-soft"],
  ["ink-2", "bg"],
  ["ink-2", "surface"],
  ["ink-2", "surface-2"],
  ["ink-3", "bg"],
  ["ink-3", "surface"],
  ["ink-3", "surface-2"],
  ["primary-ink", "bg"],
  ["primary-ink", "surface"],
  ["primary-ink", "primary-soft"],
  ["on-primary", "primary"],
  ["on-primary", "primary-hover"],
  ["spark", "spark-soft"],
  ["spark", "surface"],
  ["good", "good-soft"],
  ["good", "surface"],
  ["warn", "warn-soft"],
  ["warn", "surface"],
  ["bad", "bad-soft"],
  ["bad", "surface"],
  // Unread count on the notification bell: bg-bad with text-surface.
  ["surface", "bad"],
  // Text with an inline comment on it: bg-warn-soft with text-ink.
  ["ink", "warn-soft"],
  // Tab bars and filters invert the page: bg-ink with text-bg.
  ["bg", "ink"],
];

function readTokens(block: string) {
  const tokens: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    tokens[name] = value;
  }
  return tokens;
}

const css = readFileSync(fileURLToPath(new URL("../../app/globals.css", import.meta.url)), "utf8");
const darkStart = css.indexOf("@media (prefers-color-scheme: dark)");
const themeEnd = css.indexOf("@theme");
const themes = {
  light: readTokens(css.slice(0, darkStart)),
  dark: readTokens(css.slice(darkStart, themeEnd)),
};

describe.each(Object.entries(themes))("NFR-5 text contrast, %s theme", (_name, tokens) => {
  it.each(TEXT_ON_SURFACE)("%s on %s is at least 4.5:1", (text, surface) => {
    expect(tokens[text], `token --${text}`).toBeDefined();
    expect(tokens[surface], `token --${surface}`).toBeDefined();
    expect(contrastRatio(tokens[text], tokens[surface])).toBeGreaterThanOrEqual(4.5);
  });
});
