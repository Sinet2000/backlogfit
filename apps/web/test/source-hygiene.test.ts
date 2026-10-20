import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../src', import.meta.url));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

const sources = files(SRC).filter((f) => /\.(svelte|ts|js|html)$/.test(f));
const read = (f: string) => readFileSync(f, 'utf8');

describe('source hygiene', () => {
  it('never renders raw HTML ({@html})', () => {
    expect(sources.filter((f) => read(f).includes('{@html'))).toEqual([]);
  });

  it('has no inline style attributes in markup', () => {
    const offenders = sources
      .filter((f) => f.endsWith('.svelte') || f.endsWith('.html'))
      .filter((f) =>
        /<[a-zA-Z][^>]*\sstyle=/.test(read(f).replace(/<script[\s\S]*?<\/script>/g, '')),
      );
    expect(offenders).toEqual([]);
  });

  it('makes no third-party requests from source', () => {
    const allowed = /https:\/\/(backlogfit\.com|github\.com\/Sinet2000|schema\.org|yourtracker)/;
    const offenders: string[] = [];
    for (const f of sources) {
      for (const m of read(f).matchAll(/(?:src|href)=["'{`]+(https?:\/\/[^"'`}\s]+)/g)) {
        if (!allowed.test(m[1] ?? '')) offenders.push(`${f}: ${m[1]}`);
      }
      if (/@import\s+url\(\s*['"]?https?:/.test(read(f))) offenders.push(`${f}: remote @import`);
    }
    expect(offenders).toEqual([]);
  });

  it('does not use browser storage that leaves the tab for secrets', () => {
    // Secrets (join/admin/resume) may only be kept in sessionStorage.
    const offenders = sources.filter((f) =>
      /localStorage\.setItem\([^)]*(secret|token)/i.test(read(f)),
    );
    expect(offenders).toEqual([]);
  });
});
