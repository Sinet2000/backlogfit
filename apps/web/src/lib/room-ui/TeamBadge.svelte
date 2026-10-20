<script lang="ts">
  import Icon from '../components/Icon.svelte';

  let { name, testid = 'team-badge' }: { name: string; testid?: string } = $props();
</script>

<span class="team" data-testid={testid} data-team={name}><Icon name="users" size={12} />{name}</span>

<style>
  .team {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    width: fit-content;
    max-width: 12rem;
    padding: 0 var(--space-2);
    border-radius: var(--radius-full);
    background: var(--color-surface-2);
    color: var(--color-text);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
    line-height: 20px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .team :global(.icon) {
    flex: none;
    color: var(--color-text-muted);
  }

  :global(:root[data-mode='contrast']) .team {
    border: 1px solid var(--color-border-strong);
  }
</style>
