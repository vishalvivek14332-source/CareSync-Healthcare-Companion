import React from 'react';
import { useCareSync } from '../../context/CareSyncContext';
import { CheckCircle2, AlertCircle, Info, XCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useCareSync();

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 md:px-0">
      <AnimatePresence>
        {toasts.map((toast) => {
          let bgColor = 'bg-slate-900 text-white border-slate-700';
          let icon = <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;

          if (toast.type === 'info') {
            bgColor = 'bg-sky-950 text-sky-50 border-sky-800';
            icon = <Info className="w-5 h-5 text-sky-400 shrink-0" />;
          } else if (toast.type === 'warning') {
            bgColor = 'bg-amber-950 text-amber-50 border-amber-800';
            icon = <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />;
          } else if (toast.type === 'error') {
            bgColor = 'bg-rose-950 text-rose-50 border-rose-800';
            icon = <XCircle className="w-5 h-5 text-rose-400 shrink-0" />;
          }

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-xl border shadow-xl text-sm font-medium ${bgColor}`}
            >
              <div className="flex items-center gap-2.5">
                {icon}
                <span>{toast.message}</span>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Close notification"
              >
                <X className="w-4 h-4 text-slate-300" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
