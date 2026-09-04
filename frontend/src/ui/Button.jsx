import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const button = cva(
  "focus-ring inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-jade-400 text-jade-900 font-semibold hover:bg-jade-300 active:bg-jade-500",
        secondary: "bg-surface-overlay text-ink-primary ring-1 ring-inset ring-surface-line hover:bg-surface-line",
        outline: "text-ink-secondary ring-1 ring-inset ring-surface-line hover:text-ink-primary hover:ring-surface-edge",
        ghost: "text-ink-muted hover:bg-surface-overlay hover:text-ink-primary",
        danger: "bg-coral-400/12 text-coral-300 ring-1 ring-inset ring-coral-400/30 hover:bg-coral-400/20",
        warn: "bg-amber-400/12 text-amber-300 ring-1 ring-inset ring-amber-400/30 hover:bg-amber-400/20",
      },
      size: {
        xs: "h-7 px-2.5 text-xs [&_svg]:size-3.5",
        sm: "h-8 px-3 text-[13px] [&_svg]:size-3.5",
        md: "h-9 px-4 text-sm [&_svg]:size-4",
        lg: "h-10 px-5 text-sm [&_svg]:size-4",
        icon: "h-8 w-8 [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export default function Button({ className, variant, size, as: As = "button", ...props }) {
  return <As className={cn(button({ variant, size }), className)} {...props} />;
}

export { button as buttonVariants };
