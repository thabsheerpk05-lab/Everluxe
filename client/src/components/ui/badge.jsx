import { cn } from "../../utils/cn.js";

export function Badge({ className, variant = "default", ...props }) {
  const base = "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold";
  const variants = {
    default: "bg-sand-200 text-ink",
    success: "bg-oasis-200 text-oasis-900",
    warning: "bg-sand-300 text-sand-900",
    info: "bg-sand-100 text-sand-800",
    danger: "bg-red-100 text-red-700"
  };

  return <span className={cn(base, variants[variant], className)} {...props} />;
}
