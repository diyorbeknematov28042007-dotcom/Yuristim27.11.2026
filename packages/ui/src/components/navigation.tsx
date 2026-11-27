import type { LucideIcon } from "lucide-react";
import { Menu, PanelLeftClose, PanelLeftOpen, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { Button } from "./primitives";
import { YuristimLogo } from "./assets";
import { SegmentedControl } from "./controls";

export type NavigationItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  badge?: string;
  onSelect: () => void;
};

export const Sidebar = ({
  items,
  collapsed = false,
  onCollapsedChange,
  logoSrc,
  footer,
}: {
  items: readonly NavigationItem[];
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  logoSrc?: string;
  footer?: ReactNode;
}) => (
  <aside
    aria-label="Asosiy navigatsiya"
    className={cn(
      "flex h-full flex-col border-r border-[var(--yr-color-border)] bg-[var(--yr-color-elevated)] transition-[width] duration-300",
      collapsed ? "w-[72px]" : "w-[280px]",
    )}
  >
    <div
      className={cn(
        "flex h-16 items-center border-b border-[var(--yr-color-border)] px-3",
        collapsed ? "justify-center" : "justify-between",
      )}
    >
      <YuristimLogo src={logoSrc} fallback="text" className={cn(collapsed && "sr-only")} />
      {onCollapsedChange === undefined ? null : (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onCollapsedChange(!collapsed)}
          aria-label={collapsed ? "Yon panelni kengaytirish" : "Yon panelni yig‘ish"}
        >
          {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
        </Button>
      )}
    </div>
    <nav className="grid gap-1 overflow-y-auto p-2">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={item.onSelect}
            aria-current={item.active === true ? "page" : undefined}
            title={collapsed ? item.label : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-[var(--yr-radius-md)] px-3 text-left text-sm font-medium outline-none transition-colors focus-visible:shadow-[var(--yr-focus-ring)]",
              item.active === true
                ? "bg-[var(--yr-color-brand-surface)] text-[var(--yr-color-primary)]"
                : "text-[var(--yr-color-muted)] hover:bg-[var(--yr-color-surface)] hover:text-[var(--yr-color-foreground)]",
              collapsed && "justify-center px-0",
            )}
          >
            <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.8} />
            {collapsed ? (
              <span className="sr-only">{item.label}</span>
            ) : (
              <span className="truncate">{item.label}</span>
            )}
            {collapsed || item.badge === undefined ? null : (
              <span className="ml-auto rounded-full bg-[var(--yr-color-surface)] px-2 py-0.5 text-xs">
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
    {footer === undefined ? null : (
      <div className="mt-auto border-t border-[var(--yr-color-border)] p-2">{footer}</div>
    )}
  </aside>
);

export const Header = ({
  title,
  onMenu,
  center,
  actions,
}: {
  title: string;
  onMenu?: () => void;
  center?: ReactNode;
  actions?: ReactNode;
}) => (
  <header className="grid h-14 grid-cols-[1fr_auto_1fr] items-center border-b border-[var(--yr-color-border)] bg-[var(--yr-color-elevated)] px-2 pt-[var(--yr-safe-top)] md:h-16 md:px-4">
    <div className="flex min-w-0 items-center gap-1">
      {onMenu === undefined ? null : (
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenu}
          aria-label="Menyuni ochish"
          className="lg:hidden"
        >
          <Menu aria-hidden="true" className="size-5" strokeWidth={1.8} />
        </Button>
      )}
      <h1 className="truncate text-lg font-semibold">{title}</h1>
    </div>
    <div>{center}</div>
    <div className="flex justify-end gap-1">{actions}</div>
  </header>
);

export type YuristimModel = "lite" | "pro";

export const ModelSelector = ({
  value,
  onValueChange,
}: {
  value: YuristimModel;
  onValueChange: (value: YuristimModel) => void;
}) => (
  <SegmentedControl
    label="AI modeli"
    value={value}
    onValueChange={onValueChange}
    options={[
      { value: "lite", label: "Lite" },
      { value: "pro", label: "Pro" },
    ]}
  />
);

export const LocalNavigation = ({
  label,
  items,
  value,
  onValueChange,
}: {
  label: string;
  items: readonly { value: string; label: string }[];
  value: string;
  onValueChange: (value: string) => void;
}) => (
  <nav
    aria-label={label}
    className="flex min-h-11 gap-1 overflow-x-auto border-b border-[var(--yr-color-border)]"
  >
    {items.map((item) => (
      <button
        type="button"
        key={item.value}
        aria-current={item.value === value ? "page" : undefined}
        onClick={() => onValueChange(item.value)}
        className={cn(
          "min-h-11 shrink-0 border-b-2 px-3 text-sm font-medium outline-none focus-visible:shadow-[var(--yr-focus-ring)]",
          item.value === value
            ? "border-[var(--yr-color-primary)] text-[var(--yr-color-primary)]"
            : "border-transparent text-[var(--yr-color-muted)]",
        )}
      >
        {item.label}
      </button>
    ))}
  </nav>
);

export const ProfileButton = ({ name, onClick }: { name: string; onClick: () => void }) => (
  <Button variant="ghost" onClick={onClick} className="w-full justify-start px-3">
    <UserRound aria-hidden="true" className="size-5" strokeWidth={1.8} />
    <span className="truncate">{name}</span>
  </Button>
);
