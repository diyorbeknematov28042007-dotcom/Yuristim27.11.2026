import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export const Switch = ({
  label,
  description,
  checked,
  onCheckedChange,
  disabled = false,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) => (
  <label className={cn("flex min-h-11 items-center gap-3", disabled && "opacity-50")}>
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-medium text-[var(--yr-color-foreground)]">{label}</span>
      {description === undefined ? null : (
        <span className="block text-sm text-[var(--yr-color-muted)]">{description}</span>
      )}
    </span>
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className="relative h-7 w-12 shrink-0 rounded-full bg-[var(--yr-color-border)] outline-none transition-colors duration-200 data-[state=checked]:bg-[var(--yr-color-primary)] focus-visible:shadow-[var(--yr-focus-ring)]"
    >
      <SwitchPrimitive.Thumb className="block size-6 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 data-[state=checked]:translate-x-[22px]" />
    </SwitchPrimitive.Root>
  </label>
);

export type TabItem = { value: string; label: string; content: ReactNode; disabled?: boolean };

export const Tabs = ({
  items,
  defaultValue,
  value,
  onValueChange,
  label,
}: {
  items: readonly TabItem[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  label: string;
}) => (
  <TabsPrimitive.Root
    value={value}
    defaultValue={defaultValue ?? items[0]?.value}
    onValueChange={onValueChange}
  >
    <TabsPrimitive.List
      aria-label={label}
      className="flex min-h-11 gap-1 overflow-x-auto border-b border-[var(--yr-color-border)]"
    >
      {items.map((item) => (
        <TabsPrimitive.Trigger
          key={item.value}
          value={item.value}
          disabled={item.disabled}
          className="relative min-h-11 shrink-0 px-3 text-sm font-medium text-[var(--yr-color-muted)] outline-none after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent data-[state=active]:text-[var(--yr-color-primary)] data-[state=active]:after:bg-[var(--yr-color-primary)] focus-visible:shadow-[var(--yr-focus-ring)] disabled:opacity-50"
        >
          {item.label}
        </TabsPrimitive.Trigger>
      ))}
    </TabsPrimitive.List>
    {items.map((item) => (
      <TabsPrimitive.Content key={item.value} value={item.value} className="py-4 outline-none">
        {item.content}
      </TabsPrimitive.Content>
    ))}
  </TabsPrimitive.Root>
);

export type SegmentOption<T extends string> = { value: T; label: string; disabled?: boolean };

export const SegmentedControl = <T extends string>({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string;
  value: T;
  options: readonly SegmentOption<T>[];
  onValueChange: (value: T) => void;
}) => (
  <div
    role="radiogroup"
    aria-label={label}
    className="inline-flex min-h-11 rounded-[var(--yr-radius-md)] bg-[var(--yr-color-surface)] p-1"
  >
    {options.map((option) => {
      const selected = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={selected}
          disabled={option.disabled}
          onClick={() => onValueChange(option.value)}
          className={cn(
            "min-h-9 rounded-[var(--yr-radius-sm)] px-4 text-sm font-medium outline-none transition duration-200 focus-visible:shadow-[var(--yr-focus-ring)] disabled:opacity-50",
            selected
              ? "bg-[var(--yr-color-elevated)] text-[var(--yr-color-foreground)] shadow-sm"
              : "text-[var(--yr-color-muted)]",
          )}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);
