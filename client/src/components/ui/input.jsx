import * as React from "react";
import { cn } from "../../utils/cn.js";

const Input = React.forwardRef(({ className, type = "text", ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      "h-10 w-full rounded-lg border border-sand-200 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-oasis-500",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
