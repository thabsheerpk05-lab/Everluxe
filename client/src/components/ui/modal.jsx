import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "../../utils/cn.js";

const sizeStyles = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl"
};

let scrollLockCount = 0;

function unlockPageScroll() {
  document.body.style.removeProperty("overflow");
  document.documentElement.style.removeProperty("overflow");
}

if (typeof document !== "undefined") {
  unlockPageScroll();
}

export function Modal({ open, onClose, children, size = "lg", className, showClose = true }) {
  useEffect(() => {
    if (!open) return undefined;
    scrollLockCount += 1;
    document.body.style.overflow = "hidden";
    return () => {
      scrollLockCount = Math.max(scrollLockCount - 1, 0);
      if (scrollLockCount === 0) {
        unlockPageScroll();
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative w-full overflow-hidden rounded-3xl border border-sand-200 bg-white/95 shadow-lift",
          sizeStyles[size] || sizeStyles.lg,
          className
        )}
      >
        {showClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full border border-sand-200 bg-white p-1 text-sand-600 transition hover:text-ink"
          >
            <X size={16} />
          </button>
        ) : null}
        <div className="max-h-[calc(100vh-3rem)] overflow-y-auto no-scrollbar">{children}</div>
      </div>
    </div>
  );
}

export function ModalHeader({ className, ...props }) {
  return <div className={cn("border-b border-sand-200 bg-white/80 px-6 py-4", className)} {...props} />;
}

export function ModalTitle({ className, ...props }) {
  return <h2 className={cn("font-display text-2xl text-ink", className)} {...props} />;
}

export function ModalBody({ className, ...props }) {
  return <div className={cn("px-6 py-4", className)} {...props} />;
}

export function ModalFooter({ className, ...props }) {
  return (
    <div className={cn("flex flex-wrap gap-2 border-t border-sand-200 bg-white/80 px-6 py-4", className)} {...props} />
  );
}
