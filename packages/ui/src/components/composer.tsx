import { ArrowUp, Paperclip, Square } from "lucide-react";
import { useId, type KeyboardEvent, type TextareaHTMLAttributes } from "react";
import { cn } from "../lib/cn";
import { Button } from "./primitives";

export type ComposerProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onSubmit"> & {
  label: string;
  onSubmit: () => void;
  onAttach?: () => void;
  onStop?: () => void;
  streaming?: boolean;
  sendDisabled?: boolean;
};

export const Composer = ({
  label,
  onSubmit,
  onAttach,
  onStop,
  streaming = false,
  sendDisabled = false,
  className,
  onKeyDown,
  ...props
}: ComposerProps) => {
  const id = useId();
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(event);
    if (
      !event.defaultPrevented &&
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      if (!sendDisabled && !streaming) onSubmit();
    }
  };
  return (
    <div
      className={cn(
        "flex items-end gap-2 rounded-[var(--yr-radius-xl)] border border-[var(--yr-color-border)] bg-[var(--yr-color-elevated)] p-2 shadow-[var(--yr-shadow-sm)] focus-within:shadow-[var(--yr-focus-ring)]",
        className,
      )}
    >
      {onAttach === undefined ? null : (
        <Button variant="ghost" size="icon" onClick={onAttach} aria-label="Fayl biriktirish">
          <Paperclip aria-hidden="true" className="size-5" strokeWidth={1.8} />
        </Button>
      )}
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <textarea
        {...props}
        id={id}
        rows={1}
        onKeyDown={handleKeyDown}
        className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-base leading-6 text-[var(--yr-color-foreground)] outline-none placeholder:text-[var(--yr-color-muted)]"
      />
      {streaming ? (
        <Button variant="secondary" size="icon" onClick={onStop} aria-label="Javobni to‘xtatish">
          <Square aria-hidden="true" className="size-4 fill-current" strokeWidth={1.8} />
        </Button>
      ) : (
        <Button size="icon" onClick={onSubmit} disabled={sendDisabled} aria-label="Yuborish">
          <ArrowUp aria-hidden="true" className="size-5" strokeWidth={1.8} />
        </Button>
      )}
    </div>
  );
};
