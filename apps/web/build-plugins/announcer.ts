/**
 * SvelteKit's route announcer (`<div id="svelte-announcer">` in kit's runtime root.svelte) carries
 * an inline `style` attribute, which the production CSP (`style-src 'self'`, no inline styles)
 * blocks. Strip the attribute from the component source before Svelte compiles it; the same
 * visually-hidden rules live in app.css (`#svelte-announcer`). Fails the build if Kit's markup
 * changes, so an upgrade cannot silently bring the inline style back.
 */
import type { Plugin } from 'vite';

const ROOT = /@sveltejs[\\/]kit[\\/]src[\\/]runtime[\\/]components[\\/]root\.svelte$/;
const ANNOUNCER_STYLE = /(id="svelte-announcer"[^>]*?)\s+style="[^"]*"/;

export function stripAnnouncerStyle(code: string): string {
  if (!code.includes('id="svelte-announcer"')) return code;
  if (!ANNOUNCER_STYLE.test(code)) {
    throw new Error('announcer: SvelteKit root.svelte changed; update build-plugins/announcer.ts');
  }
  return code.replace(ANNOUNCER_STYLE, '$1');
}

export function announcerWithoutInlineStyle(): Plugin {
  let seen = false;
  return {
    name: 'backlogfit:announcer-without-inline-style',
    enforce: 'pre',
    transform(code, id) {
      if (!ROOT.test(id.split('?')[0] ?? '')) return null;
      seen = true;
      return { code: stripAnnouncerStyle(code), map: null };
    },
    buildEnd() {
      if (this.environment?.name === 'client' && !seen) {
        this.error('announcer: SvelteKit root.svelte was not transformed');
      }
    },
  };
}

const TEMPLATE_CALL = /\$\.from_(?:html|svg|mathml)\(\s*`((?:[^`\\]|\\.)*)`/g;
const STYLE_ATTR = /<[a-zA-Z][^<>]*\sstyle\s*=/;

/** Static `style="…"` attributes in compiled Svelte client templates (CSP would block them). */
export function templateStyleAttrs(compiled: string): string[] {
  const out: string[] = [];
  for (const m of compiled.matchAll(TEMPLATE_CALL)) {
    const tpl = m[1] ?? '';
    if (STYLE_ATTR.test(tpl)) out.push(tpl.slice(0, 120));
  }
  return out;
}

/**
 * Fails the build if any compiled Svelte component (ours, Kit's or a dependency's) has a static
 * style attribute in a client template. `style:` directives are fine: they go through CSSOM.
 */
export function noTemplateStyleAttrs(): Plugin {
  return {
    name: 'backlogfit:no-template-style-attrs',
    enforce: 'post',
    transform(code, id) {
      if (!(id.split('?')[0] ?? '').endsWith('.svelte')) return null;
      const found = templateStyleAttrs(code);
      if (found.length > 0) {
        this.error(`inline style attribute in ${id} would violate the CSP: ${found.join(' | ')}`);
      }
      return null;
    },
  };
}
