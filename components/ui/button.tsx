import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4fc3f7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1930] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[#028bee] text-white hover:bg-[#0277d4] shadow-lg hover:shadow-xl hover:scale-105 border border-[#4fc3f7]",
        destructive: "bg-red-500 text-white hover:bg-red-600 shadow-lg hover:shadow-xl border border-red-600",
        outline: "border border-[#4fc3f7] bg-transparent text-[#4fc3f7] hover:bg-[#4fc3f7] hover:text-white shadow-lg hover:shadow-xl",
        secondary: "bg-[#1a2347] text-white hover:bg-[#4fc3f7]/20 border border-[#4fc3f7]/50",
        ghost: "text-white hover:bg-[#4fc3f7]/20 hover:text-[#4fc3f7]",
        link: "text-[#4fc3f7] underline-offset-4 hover:underline",
        gradient: "bg-gradient-to-r from-[#4fc3f7] to-[#29b6f6] text-white hover:from-[#29b6f6] hover:to-[#4fc3f7] shadow-lg hover:shadow-xl border border-[#4fc3f7]",
        success: "bg-green-600 text-white hover:bg-green-700 shadow-lg hover:shadow-xl border border-green-700",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        xl: "h-12 px-10 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };