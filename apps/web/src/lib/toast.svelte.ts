/** App-wide toast queue, announced through an aria-live region (see Toasts.svelte). */
export type ToastKind = 'info' | 'success' | 'error';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}

let seq = 0;

class ToastQueue {
  items = $state<ToastItem[]>([]);

  show(text: string, kind: ToastKind = 'info', ms = 4500): void {
    const id = ++seq;
    // Same text twice in a row: keep one.
    this.items = [...this.items.filter((t) => t.text !== text), { id, kind, text }].slice(-4);
    if (typeof setTimeout !== 'undefined') setTimeout(() => this.dismiss(id), ms);
  }

  dismiss(id: number): void {
    this.items = this.items.filter((t) => t.id !== id);
  }
}

export const toasts = new ToastQueue();
