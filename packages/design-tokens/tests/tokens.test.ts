import { describe, expect, it } from "vitest";
import { breakpoints, colors, layout, motionDurations, radii, spacing, typography } from "../src";

const luminance = (hex: string): number => {
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
  return channels
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index]!, 0);
};

const contrast = (foreground: string, background: string): number => {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
};

describe("Yuristim design tokens", () => {
  it("preserves approved brand and semantic colors", () => {
    expect(colors.brand).toEqual({
      primary: "#00865F",
      secondary: "#005C40",
      accent: "#DDF5E9",
      surface: "#F0FAF5",
    });
    expect(colors.semantic.pro).toBe("#7C3AED");
  });

  it("provides approved typography, spacing, radius, motion and responsive scales", () => {
    expect(typography.h1).toEqual({ fontSize: 28, lineHeight: 36, fontWeight: 700 });
    expect(Object.values(spacing)).toEqual([4, 8, 12, 16, 20, 24, 32, 40, 48, 64]);
    expect(radii).toMatchObject({ xs: 4, sm: 8, md: 12, lg: 16, xl: 24 });
    expect(motionDurations).toMatchObject({ button: 100, modal: 250, page: 300, success: 500 });
    expect(breakpoints).toEqual({ xs: 320, sm: 480, md: 768, lg: 1024, xl: 1280, xxl: 1536 });
    expect(layout.touchTarget).toBe(44);
  });

  it("meets AA contrast for primary text on approved light and dark backgrounds", () => {
    expect(contrast(colors.light.foreground, colors.light.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.dark.foreground, colors.dark.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#FFFFFF", colors.brand.primary)).toBeGreaterThanOrEqual(4.5);
  });
});
