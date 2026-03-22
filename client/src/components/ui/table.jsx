import { cn } from "../../utils/cn.js";

export function Table({ className, ...props }) {
  return (
    <div className="w-full overflow-x-auto table-scroll">
      <table className={cn("w-full table-auto text-left text-sm", className)} {...props} />
    </div>
  );
}

export function TableHead({ className, ...props }) {
  return <thead className={cn("bg-sand-100 text-[11px] uppercase tracking-wide", className)} {...props} />;
}

export function TableRow({ className, ...props }) {
  return <tr className={cn("border-b border-sand-100", className)} {...props} />;
}

export function TableHeaderCell({ className, ...props }) {
  return <th className={cn("px-3 py-3 font-semibold text-ink/80", className)} {...props} />;
}

export function TableCell({ className, ...props }) {
  return <td className={cn("px-3 py-2 align-top text-sm text-ink/90 max-w-[200px] truncate", className)} {...props} />;
}
