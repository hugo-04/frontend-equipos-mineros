import * as React from "react";
import { cn } from "@/shared/lib/utils";

const base =
  "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-destructive";

export function Input({ className, type = "text", ref, ...props }: React.ComponentProps<"input">) {
  return <input type={type} ref={ref} className={cn(base, "h-10", className)} {...props} />;
}

export function Textarea({ className, ref, ...props }: React.ComponentProps<"textarea">) {
  return <textarea ref={ref} className={cn(base, "min-h-24 resize-y", className)} {...props} />;
}
