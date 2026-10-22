import { useSyncExternalStore } from "react";

export interface ToastMessage {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

let current: ToastMessage | null = null;
let timer: number | undefined;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(text: string, action?: ToastMessage["action"]) {
  current = { id: nextId++, text, action };
  window.clearTimeout(timer);
  timer = window.setTimeout(dismissToast, action ? 6000 : 3200);
  emit();
}

export function dismissToast() {
  current = null;
  emit();
}

export function useToast() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => null,
  );
}
