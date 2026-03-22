import { cn } from "../../utils/cn.js";

export function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(
        "min-h-[90px] w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-oasis-500",
        className
      )}
      {...props}
    />
  );
}
