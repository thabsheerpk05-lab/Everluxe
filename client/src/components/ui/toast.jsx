import { X } from "lucide-react";
import { cn } from "../../utils/cn.js";

const toneStyles = {
  success: "border-oasis-200 bg-white text-ink",
  error: "border-red-200 bg-white text-ink",
  info: "border-sand-200 bg-white text-ink"
};

const dotStyles = {
  success: "bg-oasis-500",
  error: "bg-red-500",
  info: "bg-sand-400"
};

export function ToastViewport({ toasts, onRemove }) {
  return (
    <div className="fixed right-4 top-4 z-[60] flex w-full max-w-sm flex-col gap-3" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "rounded-2xl border px-4 py-3 shadow-soft backdrop-blur",
            toneStyles[toast.variant] || toneStyles.info
          )}
        >
          <div className="flex items-start gap-3">
            <span
              className={cn("mt-2 h-2 w-2 rounded-full", dotStyles[toast.variant] || dotStyles.info)}
              aria-hidden="true"
            />
            <div className="flex-1">
              {toast.title ? <p className="text-sm font-semibold">{toast.title}</p> : null}
              {toast.description ? <p className="mt-1 text-xs text-sand-600">{toast.description}</p> : null}
            </div>
            <button
              type="button"
              className="rounded-full border border-sand-200 bg-white p-1 text-sand-600 transition hover:text-ink"
              onClick={() => onRemove(toast.id)}
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
