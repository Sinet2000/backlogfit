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
}

export class Guard {
  readonly external: string[] = [];
  readonly csp: CspViolation[] = [];
  private readonly allowed: Set<string>;

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
      if (!this.allowed.has(origin)) this.external.push(url);
    });
    await context.exposeBinding('__bfReportCsp', ({ page }, v: Omit<CspViolation, 'page'>) => {
      this.csp.push({ page: page.url(), ...v });
    });
    await context.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) => {
        const report = (window as unknown as { __bfReportCsp?: (v: unknown) => void })
          .__bfReportCsp;
        report?.({
          directive: e.effectiveDirective,
          blockedURI: e.blockedURI,
          sample: e.sample,
        });
      });
    });
  }

  assertClean(): void {
    expect(this.external, 'requests to third-party origins').toEqual([]);
    expect(this.csp, 'CSP violations').toEqual([]);
  }
}

export interface Person {
  name: string;
  context: BrowserContext;
  page: Page;
  wire: Wire;
}

/** Participants, each in a NEW browser context (isolated sessionStorage). */
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
      g.assertClean();
    },
    { auto: true },
  ],
  people: async ({ browser, guard, contextOptions }, use) => {
    const p = new People(browser, guard, contextOptions);
    await use(p);
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
