<script lang="ts">
  import CopyField from '../components/CopyField.svelte';
  import Dialog from '../components/Dialog.svelte';
  import QR from '../components/QR.svelte';

  let { url, open = $bindable() }: { url: string; open: boolean } = $props();
</script>

<Dialog bind:open title="Invite your team">
  <div class="invite">
    <CopyField label="Join link" value={url} hint="Anyone with this link can join. Share it only with your team." />
    <div class="qr">
      <QR value={url} label="QR code of the join link" size={180} />
      <p class="muted small">Scan to join from a phone.</p>
    </div>
  </div>
</Dialog>

<style>
  .invite {
    display: grid;
    gap: var(--space-5);
  }

  .qr {
    display: grid;
    justify-items: center;
    gap: var(--space-2);
  }

  .small {
    font-size: var(--text-sm);
  }
</style>
