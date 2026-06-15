import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/src/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[16px] border border-transparent bg-clip-padding font-semibold whitespace-nowrap transition-all duration-200 outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "bg-[var(--color-action-flame)] text-white hover:bg-[#e05300] hover:-translate-y-[1px] hover:shadow-[var(--shadow-card-warm)]",
        outline:
          "border-[1.5px] border-border bg-transparent shadow-sm hover:bg-muted hover:text-foreground hover:-translate-y-[1px]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]",
        ghost:
          "bg-transparent text-[var(--color-warm-stone)] font-medium hover:text-[var(--color-ink-black)]",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
        flame: "bg-[var(--color-action-flame)] text-white hover:bg-[#e05300] hover:-translate-y-[1px] hover:shadow-[var(--shadow-card-warm)]",
        "teal-outline": "border-[1.5px] border-[var(--color-saathi-teal)] text-[var(--color-saathi-teal)] bg-transparent hover:bg-[rgba(0,64,56,0.06)] hover:-translate-y-[1px]",
      },
      size: {
        default:
          "px-[28px] py-[14px] text-[15px] gap-[8px]",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),8px)] px-2 text-xs",
        sm: "px-[16px] py-[10px] text-[14px] gap-[6px]",
        lg: "px-[36px] py-[16px] text-[16px] gap-[8px]",
        icon: "size-12",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),8px)] in-data-[slot=button-group]:rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-8 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-md",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "flame",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
