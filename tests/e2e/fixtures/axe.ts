import { appendFile, mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type TestInfo } from '@playwright/test';

export interface AxeSummary {
  label: string;
  violations: { id: string; impact: string | null; nodes: number; targets: string[] }[];
}

/** Collected per worker; a11y specs write them into test attachments. */
export const axeLog: AxeSummary[] = [];

/** Fail on serious/critical WCAG 2.2 AA violations; record the rest. */
export async function checkA11y(page: Page, label: string, info?: TestInfo): Promise<void> {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  const summary: AxeSummary = {
    label,
    violations: result.violations.map((v) => ({
      id: v.id,
      impact: v.impact ?? null,
      nodes: v.nodes.length,
      targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
    })),
  };
  axeLog.push(summary);
  // One JSON line per check, for the QA report (test-results/axe.jsonl).
  const dir = new URL('../test-results/', import.meta.url).pathname;
  await mkdir(dir, { recursive: true });
  await appendFile(`${dir}axe.jsonl`, `${JSON.stringify(summary)}\n`);
  if (info && summary.violations.length > 0) {
    await info.attach(`axe-${label}`, {
      body: JSON.stringify(summary, null, 2),
      contentType: 'application/json',
    });
  }
  const blocking = summary.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(blocking, `serious/critical axe violations on ${label}`).toEqual([]);
}
