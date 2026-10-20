/**
 * Extended `test`: every browser context used by a spec (the default one and each participant's)
 * is guarded. At teardown the spec fails if any page
 *   - made a request to an origin other than the app's, or
 *   - triggered a CSP violation (`securitypolicyviolation`).
 */
import {
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  test as base,
  expect,
  type Page,
} from '@playwright/test';
import { allowedOrigins } from './env.ts';
import { type JoinOptions, submitJoin } from './ui.ts';
import { captureWire, type Wire } from './wire.ts';

export interface CspViolation {
  page: string;
  directive: string;
  blockedURI: string;
  sample: string;
  sourceFile: string;
  element?: string;
}

/**
 * Known CSP violations the per-spec guard tolerates, so every spec still reports its own result.
 * specs/security.spec.ts checks without this filter, and E2E_STRICT_CSP=1 disables it everywhere.
 */
export const KNOWN_CSP_ISSUES: { bug: string; match: (v: CspViolation) => boolean }[] = [
  {
    bug: 'SvelteKit route announcer inline style',
    match: (v) =>
      v.directive === 'style-src-attr' && /\/_app\/immutable\/.*\.js$/.test(v.sourceFile),
  },
];

export function unexpectedCsp(vs: readonly CspViolation[]): CspViolation[] {
  if (process.env.E2E_STRICT_CSP === '1') return [...vs];
  return vs.filter((v) => !KNOWN_CSP_ISSUES.some((k) => k.match(v)));
}

export class Guard {
  readonly external: string[] = [];
  readonly csp: CspViolation[] = [];
  private readonly allowed: Set<string>;
  /** Set once the spec body is done: teardown (closing contexts, the runner's own failure
   * screenshots, which inject a caret-hiding <style> in WebKit) must not count. */
  private frozen = false;

  freeze(): void {
    this.frozen = true;
  }

  constructor(baseURL: string) {
    this.allowed = allowedOrigins(baseURL);
  }

  async attach(context: BrowserContext): Promise<void> {
    context.on('request', (req) => {
      const url = req.url();
      if (/^(data|blob|about):/.test(url)) return;
      let origin: string;
      try {
        origin = new URL(url).origin;
      } catch {
        return;
      }
      if (!this.frozen && !this.allowed.has(origin)) this.external.push(url);
    });
    await context.exposeBinding('__bfReportCsp', ({ page }, v: Omit<CspViolation, 'page'>) => {
      if (!this.frozen) this.csp.push({ page: page.url(), ...v });
    });
    await context.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) => {
        const report = (window as unknown as { __bfReportCsp?: (v: unknown) => void })
          .__bfReportCsp;
        report?.({
          directive: e.effectiveDirective,
          blockedURI: e.blockedURI,
          sample: e.sample,
          sourceFile: e.sourceFile,
          element:
            e.target instanceof Element
              ? e.target.outerHTML.slice(0, 160)
              : String(e.target?.constructor?.name ?? ''),
        });
      });
    });
  }

  assertClean(): void {
    expect(this.external, 'requests to third-party origins').toEqual([]);
    expect(unexpectedCsp(this.csp), 'CSP violations').toEqual([]);
  }
}

export interface Person {
  name: string;
  context: BrowserContext;
  page: Page;
  wire: Wire;
}

/** Participants, each in a new browser context, so sessionStorage and secrets stay isolated. */
export class People {
  private readonly all: Person[] = [];
  private readonly browser: Browser;
  private readonly guard: Guard;
  private readonly contextOptions: BrowserContextOptions;

  constructor(browser: Browser, guard: Guard, contextOptions: BrowserContextOptions) {
    this.browser = browser;
    this.guard = guard;
    this.contextOptions = contextOptions;
  }

  async open(extra: BrowserContextOptions = {}): Promise<Omit<Person, 'name'>> {
    const context = await this.browser.newContext({ ...this.contextOptions, ...extra });
    await this.guard.attach(context);
    const page = await context.newPage();
    const wire = captureWire(page);
    return { context, page, wire };
  }

  /** Open `link` in a fresh context and join as `name`. */
  async join(
    link: string,
    name: string,
    opts: JoinOptions & { context?: BrowserContextOptions } = {},
  ): Promise<Person> {
    const { context: ctxOpts, ...joinOpts } = opts;
    const p = { name, ...(await this.open(ctxOpts)) };
    this.all.push(p);
    await p.page.goto(link);
    await submitJoin(p.page, name, joinOpts);
    return p;
  }

  async closeAll(): Promise<void> {
    await Promise.all(this.all.map((p) => p.context.close().catch(() => undefined)));
  }
}

export const test = base.extend<{ guard: Guard; people: People; wire: Wire }>({
  guard: [
    async ({ context, baseURL }, use) => {
      const g = new Guard(baseURL ?? 'http://localhost:8080');
      await g.attach(context);
      await use(g);
      g.freeze();
      g.assertClean();
    },
    { auto: true },
  ],
  people: async ({ browser, guard, contextOptions }, use) => {
    const p = new People(browser, guard, contextOptions);
    await use(p);
    guard.freeze();
    await p.closeAll();
  },
  /** Frames of the default `page` (attach before the first goto). */
  wire: async ({ page }, use) => {
    await use(captureWire(page));
  },
});

export { expect };

/** Join with an API-created admin link on the default page. */
export async function joinAdmin(
  page: Page,
  adminLink: string,
  name = 'Admin',
  opts: JoinOptions = {},
): Promise<void> {
  await page.goto(adminLink);
  await submitJoin(page, name, opts);
}
