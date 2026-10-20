<script lang="ts">
  let { size = 28 }: { size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
  <rect class="back" x="3" y="6" width="16" height="22" rx="3" transform="rotate(-8 11 17)" />
  <rect class="front" x="12" y="4" width="16" height="22" rx="3" />
  <path
    d="M16 15.5l3 3 5-6"
    fill="none"
    stroke="currentColor"
    stroke-width="2.4"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="tick"
  />
</svg>

<style>
  .back {
    fill: var(--color-accent);
  }

  .front {
    fill: var(--color-text);
  }

  .tick {
    color: var(--color-bg);
  }
</style>
