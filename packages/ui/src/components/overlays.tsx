import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { Button } from "./primitives";

type OverlayProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: string;
  description?: string | undefined;
  children: ReactNode;
  footer?: ReactNode;
};

const OverlayHeader = ({ title, description }: Pick<OverlayProps, "title" | "description">) => (
  <div className="grid gap-1 pr-10">
    <DialogPrimitive.Title className="text-xl font-semibold text-[var(--yr-color-foreground)]">
      {title}
    </DialogPrimitive.Title>
    {description === undefined ? null : (
      <DialogPrimitive.Description className="text-sm leading-5 text-[var(--yr-color-muted)]">
        {description}
      </DialogPrimitive.Description>
    )}
  </div>
);

const CloseButton = () => (
  <DialogPrimitive.Close asChild>
    <Button className="absolute right-3 top-3" size="icon" variant="ghost" aria-label="Yopish">
      <X aria-hidden="true" className="size-5" strokeWidth={1.8} />
    </Button>
  </DialogPrimitive.Close>
);

export const Modal = ({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
}: OverlayProps) => (
  <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    {trigger === undefined ? null : (
      <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
    )}
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px] data-[state=closed]:animate-[yr-fade-out_150ms_ease] data-[state=open]:animate-[yr-fade-in_150ms_ease]" />
      <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 grid max-h-[min(85vh,720px)] w-[calc(100%-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-5 overflow-y-auto rounded-[var(--yr-radius-lg)] border border-[var(--yr-color-border)] bg-[var(--yr-color-elevated)] p-5 shadow-[var(--yr-shadow-overlay)] outline-none data-[state=closed]:animate-[yr-modal-out_180ms_ease] data-[state=open]:animate-[yr-modal-in_250ms_cubic-bezier(.2,.8,.2,1)]">
        <OverlayHeader title={title} description={description} />
        <CloseButton />
        <div>{children}</div>
        {footer === undefined ? null : (
          <div className="flex flex-wrap justify-end gap-2">{footer}</div>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>
);

export type SheetProps = OverlayProps & { side?: "left" | "right" | "bottom" };

export const Sheet = ({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  side = "right",
}: SheetProps) => (
  <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    {trigger === undefined ? null : (
      <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
    )}
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 grid gap-5 overflow-y-auto border-[var(--yr-color-border)] bg-[var(--yr-color-elevated)] p-5 shadow-[var(--yr-shadow-overlay)] outline-none duration-300",
          side === "bottom" &&
            "inset-x-0 bottom-0 max-h-[85vh] rounded-t-[var(--yr-radius-xl)] border-t pb-[calc(20px+var(--yr-safe-bottom))] data-[state=closed]:animate-[yr-sheet-down_300ms_ease] data-[state=open]:animate-[yr-sheet-up_300ms_cubic-bezier(.2,.8,.2,1)]",
          side === "right" &&
            "inset-y-0 right-0 w-[min(85vw,420px)] border-l pt-[calc(20px+var(--yr-safe-top))] data-[state=closed]:animate-[yr-sheet-right-out_300ms_ease] data-[state=open]:animate-[yr-sheet-right-in_300ms_cubic-bezier(.2,.8,.2,1)]",
          side === "left" &&
            "inset-y-0 left-0 w-[min(85vw,340px)] border-r pt-[calc(20px+var(--yr-safe-top))] data-[state=closed]:animate-[yr-sheet-left-out_300ms_ease] data-[state=open]:animate-[yr-sheet-left-in_300ms_cubic-bezier(.2,.8,.2,1)]",
        )}
      >
        <OverlayHeader title={title} description={description} />
        <CloseButton />
        <div>{children}</div>
        {footer === undefined ? null : (
          <div className="mt-auto flex flex-wrap justify-end gap-2">{footer}</div>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>
);

export type DropdownItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  selected?: boolean;
  onSelect: () => void;
};

export const Dropdown = ({
  trigger,
  label,
  items,
  align = "end",
}: {
  trigger: ReactNode;
  label: string;
  items: readonly DropdownItem[];
  align?: "start" | "center" | "end";
}) => (
  <DropdownPrimitive.Root>
    <DropdownPrimitive.Trigger asChild>{trigger}</DropdownPrimitive.Trigger>
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        align={align}
        sideOffset={8}
        aria-label={label}
        className="z-50 min-w-52 rounded-[var(--yr-radius-md)] border border-[var(--yr-color-border)] bg-[var(--yr-color-elevated)] p-1.5 shadow-[var(--yr-shadow-md)] data-[state=closed]:animate-[yr-fade-out_100ms_ease] data-[state=open]:animate-[yr-fade-in_150ms_ease]"
      >
        {items.map((item) => (
          <DropdownPrimitive.Item
            key={item.id}
            disabled={item.disabled}
            onSelect={item.onSelect}
            className={cn(
              "flex min-h-10 cursor-default select-none items-center gap-2 rounded-[var(--yr-radius-sm)] px-3 text-sm outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-[var(--yr-color-surface)]",
              item.destructive === true && "text-[var(--yr-color-error)]",
            )}
          >
            <span className="flex size-5 items-center justify-center" aria-hidden="true">
              {item.selected === true ? <Check className="size-4" strokeWidth={1.8} /> : item.icon}
            </span>
            <span className="flex-1">{item.label}</span>
            <ChevronRight aria-hidden="true" className="size-4 opacity-40" strokeWidth={1.8} />
          </DropdownPrimitive.Item>
        ))}
      </DropdownPrimitive.Content>
    </DropdownPrimitive.Portal>
  </DropdownPrimitive.Root>
);
