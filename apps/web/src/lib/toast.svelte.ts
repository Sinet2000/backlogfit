export type ToastKind = 'info' | 'success' | 'error';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
  action?: ToastAction;
}

let seq = 0;

class ToastQueue {
  items = $state<ToastItem[]>([]);

  show(
    text: string,
    kind: ToastKind = 'info',
    opts: { ms?: number; action?: ToastAction } = {},
  ): number {
    const id = ++seq;
    const item: ToastItem = { id, kind, text, ...(opts.action ? { action: opts.action } : {}) };
    this.items = [...this.items.filter((t) => t.text !== text), item].slice(-4);
    if (typeof setTimeout !== 'undefined') setTimeout(() => this.dismiss(id), opts.ms ?? 4500);
    return id;
  }

  dismiss(id: number): void {
    this.items = this.items.filter((t) => t.id !== id);
  }
}

export const toasts = new ToastQueue();
