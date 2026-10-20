<script lang="ts">
import { qrMatrix } from '../qr.ts';

interface Props {
  value: string;
  label: string;
  size?: number;
}
let { value, label, size = 200 }: Props = $props();
const qr = $derived(qrMatrix(value));
const margin = 4;
</script>

<svg
  class="qr"
  width={size}
  height={size}
  viewBox="{-margin} {-margin} {qr.size + 2 * margin} {qr.size + 2 * margin}"
  role="img"
  aria-label={label}
  data-testid="qr-code"
  shape-rendering="crispEdges"
>
  <rect class="bg" x={-margin} y={-margin} width={qr.size + 2 * margin} height={qr.size + 2 * margin} />
  <path class="fg" d={qr.path} />
</svg>

<style>
  .qr {
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
  }

  /* QR codes need dark-on-light in every theme to scan reliably. */
  .bg {
    fill: #ffffff;
  }

  .fg {
    fill: #000000;
  }
</style>
