<script lang="ts">
  import Button from '#lib/components/Button.svelte';
  import Icon, { type IconName } from '#lib/components/Icon.svelte';
  import MiniDemo from '#lib/components/MiniDemo.svelte';
  import Seo from '#lib/seo/Seo.svelte';
  import { REPO_URL, SITE_NAME, SITE_ORIGIN, TAGLINE } from '#lib/seo/site.ts';

  const steps = [
    {
      title: 'Set up in a minute',
      body: 'Choose a card deck and a few rules. No account, no installation.',
    },
    {
      title: 'Share one link',
      body: 'Your team joins from any browser or phone with a name of their choice.',
    },
    {
      title: 'Vote, reveal, agree',
      body: 'Everyone picks a card in secret. Reveal together, discuss the gaps, settle the estimate.',
    },
  ];

  const features: { icon: IconName; title: string; body: string }[] = [
    {
      icon: 'users',
      title: 'No sign-up',
      body: 'Nobody creates an account. Share a link and start estimating.',
    },
    {
      icon: 'code',
      title: 'Open source',
      body: 'Apache-2.0 licensed. Read every line, or improve it.',
    },
    {
      icon: 'server',
      title: 'Self-hosted if you like',
      body: 'Run it on your own infrastructure in one container.',
    },
    {
      icon: 'shield',
      title: 'Bank-ready security',
      body: 'Strict content security policy, hashed secrets, data deleted on expiry.',
    },
    {
      icon: 'accessibility',
      title: 'Accessible',
      body: 'Keyboard, screen reader and high-contrast friendly. Color is never the only signal.',
    },
  ];
</script>

<Seo
  title={`${SITE_NAME}: story point estimation for agile teams`}
  description="Privacy-first story point estimation for agile teams. A calm planning poker alternative: no sign-up, no tracking, open source and self-hostable."
  path="/"
  jsonLd={{
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE_NAME,
    url: SITE_ORIGIN,
    description: TAGLINE,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Any',
    isAccessibleForFree: true,
    license: 'https://www.apache.org/licenses/LICENSE-2.0',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  }}
/>

<section class="hero">
  <div class="container hero-grid">
    <div class="copy">
      <p class="eyebrow">Story point estimation for agile teams</p>
      <h1>{TAGLINE}</h1>
      <p class="lead">
        A calm, private way for your team to estimate the backlog together. Everyone votes in secret,
        cards are revealed at once, and the discussion goes to where opinions differ.
      </p>
      <div class="ctas">
        <Button href="/new" variant="primary" size="lg" iconAfter="right">Start a session</Button>
        <Button href="/guide" variant="secondary" size="lg">How it works</Button>
      </div>
      <p class="assure muted"><Icon name="check" size={16} /> Free · No account · Nothing to install</p>
    </div>
    <div class="demo">
      <MiniDemo />
    </div>
  </div>
</section>

<section class="section" aria-labelledby="how-h">
  <div class="container">
    <h2 id="how-h">How it works</h2>
    <ol class="steps">
      {#each steps as s, i (s.title)}
        <li>
          <span class="num" aria-hidden="true">{i + 1}</span>
          <h3>{s.title}</h3>
          <p class="muted">{s.body}</p>
        </li>
      {/each}
    </ol>
  </div>
</section>

<section class="section alt" aria-labelledby="feat-h">
  <div class="container">
    <h2 id="feat-h">Built for teams with rules to follow</h2>
    <p class="section-lead muted">Banks, insurers and public services use it where the usual tools are not allowed.</p>
    <ul class="features">
      {#each features as f (f.title)}
        <li>
          <span class="f-icon" aria-hidden="true"><Icon name={f.icon} size={22} /></span>
          <h3>{f.title}</h3>
          <p class="muted">{f.body}</p>
        </li>
      {/each}
    </ul>
  </div>
</section>

<section class="section" aria-labelledby="trust-h">
  <div class="container trust">
    <div>
      <h2 id="trust-h">Your data stays yours</h2>
      <p class="muted section-lead">What happens in a session stays in the session, and then it is gone.</p>
    </div>
    <ul class="trust-list">
      <li><Icon name="nocookie" /> <span><strong>No cookies.</strong> There is no banner because there is nothing to consent to.</span></li>
      <li><Icon name="eyeoff" /> <span><strong>No tracking.</strong> No analytics, no third-party scripts, fonts or images.</span></li>
      <li><Icon name="clock" /> <span><strong>Deleted on expiry.</strong> Sessions end after a few hours and every record is wiped.</span></li>
      <li><Icon name="lock" /> <span><strong>Secret links.</strong> The link's secret part never leaves your browser in a way the server can read.</span></li>
    </ul>
  </div>
</section>

<section class="section cta-band">
  <div class="container band">
    <h2>Ready for your next refinement?</h2>
    <div class="ctas">
      <Button href="/new" variant="primary" size="lg" iconAfter="right">Start a session</Button>
      <Button href={REPO_URL} variant="ghost" size="lg" icon="code" rel="noopener noreferrer">View the source</Button>
    </div>
  </div>
</section>

<style>
  .hero {
    padding-block: var(--space-16);
    background:
      radial-gradient(1200px 400px at 80% -10%, var(--color-accent-soft), transparent 70%),
      var(--color-bg);
  }

  .hero-grid {
    display: grid;
    gap: var(--space-12);
    align-items: center;
  }

  @media (min-width: 960px) {
    .hero-grid {
      grid-template-columns: 1.05fr 1fr;
    }
  }

  h1 {
    font-size: var(--text-4xl);
    letter-spacing: -0.025em;
    margin-top: var(--space-3);
  }

  .lead {
    margin-top: var(--space-5);
    font-size: var(--text-lg);
    color: var(--color-text-muted);
    max-width: 52ch;
  }

  .ctas {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin-top: var(--space-8);
  }

  .assure {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-4);
    font-size: var(--text-sm);
  }

  .section {
    padding-block: var(--space-16);
  }

  .alt {
    background: var(--color-surface);
    border-block: 1px solid var(--color-border);
  }

  h2 {
    font-size: var(--text-3xl);
  }

  .section-lead {
    margin-top: var(--space-3);
    font-size: var(--text-lg);
  }

  .steps {
    list-style: none;
    margin: var(--space-10) 0 0;
    padding: 0;
    display: grid;
    gap: var(--space-8);
  }

  @media (min-width: 640px) {
    .steps {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .steps h3,
  .features h3 {
    font-size: var(--text-lg);
    margin-block: var(--space-3) var(--space-2);
  }

  .num {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-full);
    border: 1px solid var(--color-accent);
    color: var(--color-accent);
    font-weight: var(--weight-semibold);
  }

  .features {
    list-style: none;
    margin: var(--space-10) 0 0;
    padding: 0;
    display: grid;
    gap: var(--space-8) var(--space-10);
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  }

  .f-icon {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: var(--radius-md);
    background: var(--color-accent-soft);
    color: var(--color-accent);
  }

  .trust {
    display: grid;
    gap: var(--space-8);
  }

  @media (min-width: 960px) {
    .trust {
      grid-template-columns: 1fr 1.2fr;
    }
  }

  .trust-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-5);
  }

  .trust-list li {
    display: flex;
    gap: var(--space-3);
    align-items: flex-start;
  }

  .trust-list :global(.icon) {
    color: var(--color-accent);
    margin-top: 2px;
  }

  .cta-band {
    padding-block: var(--space-16);
  }

  .band {
    display: grid;
    justify-items: center;
    text-align: center;
  }

  @media (max-width: 640px) {
    .hero {
      padding-block: var(--space-10) var(--space-12);
    }

    .section {
      padding-block: var(--space-12);
    }

    h2 {
      font-size: var(--text-2xl);
    }
  }
</style>
