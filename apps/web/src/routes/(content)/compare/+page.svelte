<script lang="ts">
  import Seo from '#lib/seo/Seo.svelte';
  import { SITE_ORIGIN } from '#lib/seo/site.ts';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: 'Compare', item: `${SITE_ORIGIN}/compare` },
    ],
  };

  const rows = [
    {
      capability: 'Sign-up required',
      backlogfit: 'No, for nobody',
      hosted: 'Usually for the facilitator, sometimes for everyone',
      plugin: 'Uses your tracker accounts',
    },
    {
      capability: 'Where data lives',
      backlogfit: 'Only for the room lifetime, then deleted; or on your own server',
      hosted: "On the vendor's servers, retention set by the vendor",
      plugin: 'Inside your tracker',
    },
    {
      capability: 'Vote secrecy before reveal',
      backlogfit: 'Enforced by the server; values are never sent before reveal',
      hosted: 'Varies; often hidden only in the user interface',
      plugin: 'Varies',
    },
    {
      capability: 'Tracking, ads, third-party scripts',
      backlogfit: 'None',
      hosted: 'Common in free tiers',
      plugin: 'Depends on the vendor',
    },
    {
      capability: 'Self-hosting',
      backlogfit: 'Yes: one container or a Cloudflare Worker',
      hosted: 'Rarely',
      plugin: 'Tracker-dependent (data center editions)',
    },
    {
      capability: 'Source code',
      backlogfit: 'Open source (Apache-2.0)',
      hosted: 'Usually closed',
      plugin: 'Usually closed',
    },
    {
      capability: 'Writes estimates back to the tracker',
      backlogfit: 'No; export CSV, JSON or Markdown',
      hosted: 'Often, through an integration',
      plugin: 'Yes, natively',
    },
    {
      capability: 'Cost',
      backlogfit: 'Free',
      hosted: 'Free tier with limits, paid plans',
      plugin: 'Usually per user',
    },
  ];
</script>

<Seo
  title="Comparing estimation tools by capability"
  description="An honest comparison of agile estimation tool categories: hosted planning poker tools with accounts, tracker plugins, and Backlogfit."
  path="/compare"
  {jsonLd}
/>

<header>
  <h1>Comparing estimation tools by capability</h1>
  <p>
    There are many good ways to run agile estimation. Rather than ranking products, this page
    compares common categories of tools by what they do, so you can pick what fits your team
    and your security requirements. The descriptions of other categories are general; individual
    products differ.
  </p>
</header>

<section aria-labelledby="categories">
  <h2 id="categories">The categories</h2>
  <ul>
    <li>
      <strong>Hosted planning poker tools with accounts</strong>: web apps where the facilitator
      (and sometimes everyone) signs up, with sessions stored by the vendor.
    </li>
    <li>
      <strong>Tracker plugins</strong>: estimation built into or added to your issue tracker,
      using its accounts and permissions.
    </li>
    <li>
      <strong>Physical cards or a video call</strong>: no software at all, which works but makes a
      simultaneous reveal and a record of results harder for remote teams.
    </li>
    <li>
      <strong>Backlogfit</strong>: an open-source, account-free web app with short-lived rooms,
      usable at backlogfit.com or self-hosted.
    </li>
  </ul>
</section>

<section aria-labelledby="table">
  <h2 id="table">Capabilities side by side</h2>
  <table>
    <caption>Typical capabilities by tool category</caption>
    <thead>
      <tr>
        <th scope="col">Capability</th>
        <th scope="col">Backlogfit</th>
        <th scope="col">Hosted tools with accounts</th>
        <th scope="col">Tracker plugins</th>
      </tr>
    </thead>
    <tbody>
      {#each rows as row (row.capability)}
        <tr>
          <th scope="row">{row.capability}</th>
          <td>{row.backlogfit}</td>
          <td>{row.hosted}</td>
          <td>{row.plugin}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</section>

<section aria-labelledby="when-not">
  <h2 id="when-not">When Backlogfit is not the best fit</h2>
  <ul>
    <li>You want estimates written into your tracker automatically, without an export step.</li>
    <li>You need long-term reports across many sessions inside the estimation tool itself.</li>
    <li>You want persistent team spaces with saved members and history.</li>
  </ul>
  <p>
    Backlogfit deliberately keeps no history beyond a room's lifetime. That is what makes it easy
    to approve in strict environments, and it is also its main trade-off.
  </p>
</section>

<section aria-labelledby="when">
  <h2 id="when">When it fits well</h2>
  <ul>
    <li>Your security or privacy team will not approve tools with external accounts.</li>
    <li>Guests, contractors or other teams join sessions and should not need an account.</li>
    <li>You want a free tool without ads or tracking, or you want to run it yourself.</li>
  </ul>
  <p>
    Read the <a href="/security">security overview</a> or try it now: <a href="/new">start a session</a>.
  </p>
</section>
