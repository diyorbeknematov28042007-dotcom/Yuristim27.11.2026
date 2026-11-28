import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Search, X } from "lucide-react";
import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "../lib/cn";

const buttonVariants = cva(
  "inline-flex min-w-0 items-center justify-center gap-2 rounded-[var(--yr-radius-md)] font-medium outline-none transition-[background,color,box-shadow,transform] duration-100 focus-visible:shadow-[var(--yr-focus-ring)] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary: "bg-[var(--yr-color-primary)] text-white hover:bg-[var(--yr-color-primary-hover)]",
        secondary:
          "border border-[var(--yr-color-border)] bg-[var(--yr-color-elevated)] text-[var(--yr-color-foreground)] hover:bg-[var(--yr-color-surface)]",
        ghost:
          "bg-transparent text-[var(--yr-color-foreground)] hover:bg-[var(--yr-color-surface)]",
        danger: "bg-[var(--yr-color-error)] text-white hover:brightness-90",
        pro: "bg-[var(--yr-color-pro)] text-white hover:brightness-90",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-4 text-base",
        lg: "h-[52px] px-5 text-base",
        icon: "size-11 shrink-0 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    asChild = false,
    className,
    disabled,
    loading = false,
    children,
    type = "button",
    variant,
    size,
    ...props
  },
  ref,
) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      type={asChild ? undefined : type}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      ) : null}
      {children}
    </Component>
  );
});

type FieldShellProps = {
  id: string;
  label?: string | undefined;
  helperText?: string | undefined;
  error?: string | undefined;
  required?: boolean | undefined;
  children: ReactNode;
};

const FieldShell = ({ id, label, helperText, error, required, children }: FieldShellProps) => (
  <div className="grid gap-2">
    {label === undefined ? null : (
      <label className="text-sm font-medium text-[var(--yr-color-foreground)]" htmlFor={id}>
        {label}
        {required === true ? <span aria-hidden="true"> *</span> : null}
      </label>
    )}
    {children}
    {error === undefined && helperText === undefined ? null : (
      <p
        className={cn(
          "text-sm",
          error === undefined ? "text-[var(--yr-color-muted)]" : "text-[var(--yr-color-error)]",
        )}
        id={`${id}-description`}
        role={error === undefined ? undefined : "alert"}
      >
        {error ?? helperText}
      </p>
    )}
  </div>
);

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  helperText?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, id: providedId, label, helperText, error, required, ...props },
  ref,
) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  return (
    <FieldShell {...{ id, label, helperText, error, required }}>
      <input
        ref={ref}
        id={id}
        required={required}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={
          error === undefined && helperText === undefined ? undefined : `${id}-description`
        }
        className={cn(
          "h-11 w-full rounded-[var(--yr-radius-md)] border bg-[var(--yr-color-elevated)] px-3 text-base text-[var(--yr-color-foreground)] outline-none placeholder:text-[var(--yr-color-muted)] focus:shadow-[var(--yr-focus-ring)]",
          error === undefined
            ? "border-[var(--yr-color-border)]"
            : "border-[var(--yr-color-error)]",
          className,
        )}
        {...props}
      />
    </FieldShell>
  );
});

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  helperText?: string;
  error?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, id: providedId, label, helperText, error, required, ...props },
  ref,
) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  return (
    <FieldShell {...{ id, label, helperText, error, required }}>
      <textarea
        ref={ref}
        id={id}
        required={required}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={
          error === undefined && helperText === undefined ? undefined : `${id}-description`
        }
        className={cn(
          "min-h-28 w-full resize-y rounded-[var(--yr-radius-md)] border bg-[var(--yr-color-elevated)] p-3 text-base text-[var(--yr-color-foreground)] outline-none placeholder:text-[var(--yr-color-muted)] focus:shadow-[var(--yr-focus-ring)]",
          error === undefined
            ? "border-[var(--yr-color-border)]"
            : "border-[var(--yr-color-error)]",
          className,
        )}
        {...props}
      />
    </FieldShell>
  );
});

export type SearchFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  onClear?: () => void;
};

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { className, label, onClear, value, ...props },
  ref,
) {
  const id = useId();
  const hasValue = typeof value === "string" && value.length > 0;
  return (
    <div className="relative">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-[var(--yr-color-muted)]"
        strokeWidth={1.8}
      />
      <input
        {...props}
        ref={ref}
        id={id}
        type="search"
        value={value}
        className={cn(
          "h-11 w-full rounded-[var(--yr-radius-md)] border border-[var(--yr-color-border)] bg-[var(--yr-color-surface)] pl-10 pr-11 text-base outline-none focus:shadow-[var(--yr-focus-ring)]",
          className,
        )}
      />
      {onClear === undefined || !hasValue ? null : (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-0 top-0 flex size-11 items-center justify-center rounded-[var(--yr-radius-md)] text-[var(--yr-color-muted)] focus-visible:shadow-[var(--yr-focus-ring)] focus-visible:outline-none"
          aria-label="Qidiruvni tozalash"
        >
          <X aria-hidden="true" className="size-5" strokeWidth={1.8} />
        </button>
      )}
    </div>
  );
});

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, interactive = false, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-[var(--yr-radius-lg)] border border-[var(--yr-color-border)] bg-[var(--yr-color-elevated)] p-4 shadow-[var(--yr-shadow-sm)]",
        interactive &&
          "transition duration-150 hover:-translate-y-0.5 hover:shadow-[var(--yr-shadow-md)] focus-within:shadow-[var(--yr-focus-ring)]",
        className,
      )}
      {...props}
    />
  );
});
