import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  CloudOff,
  Construction,
  FileQuestion,
  LoaderCircle,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { Button } from "./primitives";

export const LoadingIndicator = ({ label = "Yuklanmoqda" }: { label?: string }) => (
  <div
    className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--yr-color-muted)]"
    role="status"
  >
    <LoaderCircle aria-hidden="true" className="size-5 animate-spin" strokeWidth={1.8} />
    <span>{label}</span>
  </div>
);

export const Skeleton = ({ className }: { className?: string }) => (
  <span
    aria-hidden="true"
    className={cn(
      "block min-h-4 animate-pulse rounded-[var(--yr-radius-sm)] bg-[var(--yr-color-border)]",
      className,
    )}
  />
);

type StateProps = {
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  icon?: LucideIcon;
  tone?: "neutral" | "success" | "warning" | "error" | "info" | "pro";
  extra?: ReactNode;
};

const toneClasses: Record<NonNullable<StateProps["tone"]>, string> = {
  neutral: "bg-[var(--yr-color-surface)] text-[var(--yr-color-muted)]",
  success: "bg-[var(--yr-color-brand-surface)] text-[var(--yr-color-success)]",
  warning: "bg-amber-50 text-[var(--yr-color-warning)] dark:bg-amber-950/30",
  error: "bg-red-50 text-[var(--yr-color-error)] dark:bg-red-950/30",
  info: "bg-blue-50 text-[var(--yr-color-info)] dark:bg-blue-950/30",
  pro: "bg-violet-50 text-[var(--yr-color-pro)] dark:bg-violet-950/30",
};

export const FeedbackState = ({
  title,
  description,
  action,
  icon: Icon = FileQuestion,
  tone = "neutral",
  extra,
}: StateProps) => (
  <section className="grid justify-items-center gap-3 px-4 py-10 text-center" aria-live="polite">
    <span className={cn("grid size-12 place-items-center rounded-full", toneClasses[tone])}>
      <Icon aria-hidden="true" className="size-6" strokeWidth={1.8} />
    </span>
    <div className="grid max-w-md gap-1">
      <h3 className="text-lg font-semibold text-[var(--yr-color-foreground)]">{title}</h3>
      <p className="text-sm leading-5 text-[var(--yr-color-muted)]">{description}</p>
    </div>
    {extra}
    {action === undefined ? null : <Button onClick={action.onClick}>{action.label}</Button>}
  </section>
);

export const EmptyState = (props: Omit<StateProps, "icon">) => (
  <FeedbackState {...props} icon={FileQuestion} />
);
export const ErrorState = (props: Omit<StateProps, "icon" | "tone">) => (
  <FeedbackState {...props} icon={AlertTriangle} tone="error" />
);
export const OfflineState = (props: Omit<StateProps, "icon" | "tone">) => (
  <FeedbackState {...props} icon={CloudOff} tone="warning" />
);
export const SuccessState = (props: Omit<StateProps, "icon" | "tone">) => (
  <FeedbackState {...props} icon={CheckCircle2} tone="success" />
);
export const InsufficientCreditsState = (props: Omit<StateProps, "icon" | "tone">) => (
  <FeedbackState {...props} icon={CircleDollarSign} tone="pro" />
);
export const MaintenanceState = (props: Omit<StateProps, "icon" | "tone">) => (
  <FeedbackState {...props} icon={Construction} tone="info" />
);
export const AccessDeniedState = (props: Omit<StateProps, "icon" | "tone">) => (
  <FeedbackState {...props} icon={ShieldAlert} tone="error" />
);
