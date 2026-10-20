<script lang="ts" module>
  // 24×24 stroke icons (inline SVG, no icon library). Paths are simple, original shapes.
  export const ICONS = {
    check: 'M5 12.5l4.5 4.5L19 7.5',
    copy: 'M9 9h10v10H9zM5 15V5h10',
    x: 'M6 6l12 12M18 6L6 18',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    up: 'M12 19V5M6 11l6-6 6 6',
    down: 'M12 5v14M6 13l6 6 6-6',
    left: 'M15 6l-6 6 6 6',
    right: 'M9 6l6 6-6 6',
    grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
    link: 'M10 14a4 4 0 005.66 0l3-3a4 4 0 00-5.66-5.66l-1 1M14 10a4 4 0 00-5.66 0l-3 3a4 4 0 005.66 5.66l1-1',
    external: 'M14 4h6v6M20 4l-9 9M18 14v5H5V6h5',
    users:
      'M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 10a3 3 0 100-6 3 3 0 000 6zM21 19v-1a4 4 0 00-3-3.87M15 4.13a3 3 0 010 5.74',
    eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
    lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 017 0v3',
    unlock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 016.8-1.2',
    clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
    refresh: 'M20 11a8 8 0 10-2.3 5.7M20 5v6h-6',
    play: 'M8 5l11 7-11 7z',
    next: 'M5 5l9 7-9 7zM18 5v14',
    flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
    shield: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z',
    star: 'M12 4l2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 16.2 7 19l1.2-5.6L4 9.6 9.6 9z',
    sun: 'M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
    palette:
      'M12 21a9 9 0 110-18c5 0 9 3.6 9 8 0 2.8-2.2 4-4 4h-2a2 2 0 00-1.4 3.4A1.5 1.5 0 0112 21zM7.5 11h.01M10 7.5h.01M14.5 7.5h.01M17 11h.01',
    download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
    upload: 'M12 16V5M7 10l5-5 5 5M5 20h14',
    keyboard: 'M3 7h18v10H3zM7 11h.01M11 11h.01M15 11h.01M8 14h8',
    info: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5M12 8h.01',
    alert: 'M12 4l9 16H3zM12 10v4M12 17h.01',
    help: 'M12 21a9 9 0 100-18 9 9 0 000 18zM9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.5M12 17h.01',
    split: 'M6 4v6a6 6 0 006 6h0M18 4v6a6 6 0 01-6 6v4',
    approx: 'M4 9c2.7-2 5.3 2 8 0s5.3-2 8 0M4 15c2.7-2 5.3 2 8 0s5.3-2 8 0',
    equal: 'M5 9h14M5 15h14',
    door: 'M14 4H6v16h8M10 12h10M17 9l3 3-3 3',
    settings:
      'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z',
    code: 'M8 7l-5 5 5 5M16 7l5 5-5 5',
    server: 'M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01',
    accessibility: 'M12 6a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM5 8l7 1.5L19 8M12 9.5V14l-3 6M12 14l3 6',
    nocookie:
      'M12 21a9 9 0 01-1-17.9 3 3 0 003.6 3.6A3 3 0 0018 10a3 3 0 002.9 1A9 9 0 0112 21zM4 4l16 16',
    menu: 'M4 7h16M4 12h16M4 17h16',
    crown: 'M4 17l-1-9 5 4 4-7 4 7 5-4-1 9zM5 20h14',
    eyeoff:
      'M3 3l18 18M10.6 5.1A10 10 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4M6.6 6.6C3.6 8.5 2 12 2 12s3.5 7 10 7a9.6 9.6 0 005.4-1.6M9.9 9.9a3 3 0 004.2 4.2',
    timer: 'M12 21a8 8 0 100-16 8 8 0 000 16zM12 9v4l2 2M9 2h6',
  } as const;
  export type IconName = keyof typeof ICONS;
</script>

<script lang="ts">
  interface Props {
    name: IconName;
    size?: number;
    /** Accessible name; omit for decorative icons next to visible text. */
    label?: string;
    class?: string;
  }
  let { name, size = 20, label, class: klass = '' }: Props = $props();
</script>

<svg
  class="icon {klass}"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
  focusable="false"
>
  <path d={ICONS[name]} />
</svg>

<style>
  .icon {
    flex: none;
    display: inline-block;
    vertical-align: middle;
  }
</style>
