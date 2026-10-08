"use client";

import { useEffect } from "react";

export type ToastMessage = { id: number; text: string };

export function Toast({ toast, onDismiss }: { toast: ToastMessage | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDismiss, 2600);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;
  return <div className="toast" role="status"><span>✓</span>{toast.text}<button onClick={onDismiss} aria-label="Dismiss notification">×</button></div>;
}
