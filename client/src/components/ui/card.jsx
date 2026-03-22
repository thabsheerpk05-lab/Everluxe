import { cn } from "../../utils/cn.js";

export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl border border-sand-200 bg-white/80 shadow-soft backdrop-blur",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }) {
  return <div className={cn("p-5 pb-2", className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return <h3 className={cn("text-lg font-semibold", className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn("p-5 pt-2", className)} {...props} />;
}
