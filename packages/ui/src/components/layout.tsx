import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export const SkipLink = ({ targetId = "main-content", label = "Asosiy kontentga o‘tish" }) => (
  <a
    href={`#${targetId}`}
    className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-[var(--yr-radius-sm)] bg-[var(--yr-color-primary)] px-4 py-2 text-white transition-transform focus:translate-y-0"
  >
    {label}
  </a>
);

export const SafeArea = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div
    className={cn(
      "pl-[var(--yr-safe-left)] pr-[var(--yr-safe-right)] pt-[var(--yr-safe-top)] pb-[var(--yr-safe-bottom)]",
      className,
    )}
  >
    {children}
  </div>
);

export const AppShell = ({
  sidebar,
  header,
  children,
  className,
}: {
  sidebar?: ReactNode;
  header: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <div className="min-h-dvh bg-[var(--yr-color-background)] text-[var(--yr-color-foreground)]">
    <SkipLink />
    <div className="flex min-h-dvh">
      {sidebar === undefined ? null : <div className="hidden shrink-0 lg:block">{sidebar}</div>}
      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-30">{header}</div>
        <main
          id="main-content"
          tabIndex={-1}
          className={cn("mx-auto w-full max-w-[1536px] p-4 md:p-6 xl:p-8", className)}
        >
          {children}
        </main>
      </div>
    </div>
  </div>
);

export const ResponsiveGrid = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "grid grid-cols-4 gap-3 md:grid-cols-8 md:gap-4 lg:grid-cols-12 lg:gap-6",
      className,
    )}
  >
    {children}
  </div>
);

export const TelegramViewport = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "min-h-dvh bg-[var(--yr-color-background)] pb-[var(--yr-safe-bottom)]",
      className,
    )}
  >
    {children}
  </div>
);
