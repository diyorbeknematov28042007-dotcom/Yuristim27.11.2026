import { MotionConfig, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export type HapticPattern = "selection" | "impact-light" | "impact-medium" | "success" | "error";
export type HapticAdapter = { trigger: (pattern: HapticPattern) => void };

export const noopHapticAdapter: HapticAdapter = { trigger: () => undefined };

export const createTelegramHapticAdapter = (telegram?: {
  HapticFeedback?: {
    selectionChanged?: () => void;
    impactOccurred?: (style: "light" | "medium") => void;
    notificationOccurred?: (type: "success" | "error") => void;
  };
}): HapticAdapter => ({
  trigger: (pattern) => {
    const feedback = telegram?.HapticFeedback;
    if (pattern === "selection") feedback?.selectionChanged?.();
    else if (pattern === "impact-light") feedback?.impactOccurred?.("light");
    else if (pattern === "impact-medium") feedback?.impactOccurred?.("medium");
    else feedback?.notificationOccurred?.(pattern);
  },
});

export const YuristimMotionProvider = ({ children }: { children: ReactNode }) => (
  <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 420, damping: 34 }}>
    {children}
  </MotionConfig>
);

export const useMotionPreference = (): { reduceMotion: boolean } => ({
  reduceMotion: useReducedMotion() === true,
});
