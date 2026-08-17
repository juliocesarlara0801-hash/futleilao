import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Toast } from '../../types/client';

const KIND_STYLES: Record<string, string> = {
  info: 'border-blue-400/40 bg-blue-950/80',
  success: 'border-gold/50 bg-pitch/90',
  warning: 'border-red-400/50 bg-red-950/80',
};

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export default function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-[90vw] sm:max-w-sm">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} id={toast.id} message={toast.message} kind={toast.kind} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ id, message, kind, onDismiss }: { id: string; message: string; kind: string; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(id), 4500);
    return () => clearTimeout(t);
  }, [id, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 60 }}
      className={`px-4 py-3 rounded-xl border backdrop-blur text-sm font-medium shadow-lg ${KIND_STYLES[kind] ?? KIND_STYLES.info}`}
    >
      {message}
    </motion.div>
  );
}
