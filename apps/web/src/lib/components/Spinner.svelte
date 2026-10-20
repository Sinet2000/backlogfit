<span class="spinner" aria-hidden="true"></span>

<style>
  .spinner {
    display: block;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-full);
    border: 3px solid var(--color-border);
    border-top-color: var(--color-accent);
    animation: spin 900ms linear infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation-duration: 3s;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
