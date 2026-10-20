import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { stripAnnouncerStyle, templateStyleAttrs } from '../build-plugins/announcer.ts';

describe('route announcer without inline style', () => {
  it("strips the style attribute from the installed SvelteKit's root.svelte", () => {
    const require = createRequire(import.meta.url);
    const kitPkg = require.resolve('@sveltejs/kit/package.json');
    const src = readFileSync(
      new URL('src/runtime/components/root.svelte', `file://${kitPkg}`),
      'utf8',
    );
    const out = stripAnnouncerStyle(src);
    expect(out).toContain('id="svelte-announcer"');
    expect(out).not.toMatch(/id="svelte-announcer"[^>]*style=/);
  });

  it('fails loudly when the markup changes', () => {
    expect(() => stripAnnouncerStyle('<div id="svelte-announcer" class="x">')).toThrow();
    expect(stripAnnouncerStyle('<div>other</div>')).toBe('<div>other</div>');
  });
});

describe('compiled template scan', () => {
  it('finds static style attributes in Svelte client templates only', () => {
    expect(
      templateStyleAttrs('var t = $.from_html(`<div style="color:red"></div>`);'),
    ).toHaveLength(1);
    expect(templateStyleAttrs('var t = $.from_svg(`<rect style="x"/>`, 1);')).toHaveLength(1);
    expect(templateStyleAttrs('var t = $.from_html(`<div class="a"></div>`);')).toEqual([]);
    expect(templateStyleAttrs('$.set_style(div, "color:red")')).toEqual([]);
  });
});
