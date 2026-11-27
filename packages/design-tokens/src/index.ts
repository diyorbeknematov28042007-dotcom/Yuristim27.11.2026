export const colors = {
  brand: {
    primary: "#00865F",
    secondary: "#005C40",
    accent: "#DDF5E9",
    surface: "#F0FAF5",
  },
  light: {
    background: "#FFFFFF",
    surface: "#F5F6F8",
    foreground: "#101114",
    muted: "#606878",
    border: "#E5E7EB",
  },
  // Decision №079 is the provisional canonical dark palette until the №086 conflict is resolved.
  dark: {
    background: "#101312",
    surface: "#171B19",
    elevated: "#202523",
    foreground: "#F5F7F6",
    muted: "#A1ABA6",
    border: "#303934",
    accentSurface: "#153D2E",
    primary: "#34C997",
    secondary: "#23A77C",
  },
  semantic: {
    success: "#00865F",
    warning: "#A16207",
    error: "#DC2626",
    info: "#2563EB",
    pro: "#7C3AED",
  },
} as const;

export const typography = {
  fontFamily: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif',
    admin: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    document: '"Times New Roman", Times, serif',
  },
  display: { fontSize: 36, lineHeight: 44, fontWeight: 700 },
  h1: { fontSize: 28, lineHeight: 36, fontWeight: 700 },
  h2: { fontSize: 24, lineHeight: 32, fontWeight: 600 },
  h3: { fontSize: 20, lineHeight: 28, fontWeight: 600 },
  title: { fontSize: 18, lineHeight: 24, fontWeight: 600 },
  body: { fontSize: 16, lineHeight: 24, fontWeight: 400 },
  button: { fontSize: 16, lineHeight: 24, fontWeight: 500 },
  secondary: { fontSize: 14, lineHeight: 20, fontWeight: 400 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: 400 },
} as const;

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radii = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, full: 9999 } as const;

export const shadows = {
  xs: "0 1px 2px rgb(16 17 20 / 0.06)",
  sm: "0 4px 14px rgb(16 17 20 / 0.08)",
  md: "0 12px 32px rgb(16 17 20 / 0.12)",
  overlay: "0 24px 64px rgb(16 17 20 / 0.2)",
  focus: "0 0 0 3px rgb(0 134 95 / 0.24)",
} as const;

export const motionDurations = {
  button: 100,
  icon: 150,
  switch: 200,
  model: 200,
  tooltip: 150,
  modal: 250,
  sidebar: 280,
  page: 300,
  sheet: 300,
  splash: 400,
  success: 500,
} as const;

export const breakpoints = { xs: 320, sm: 480, md: 768, lg: 1024, xl: 1280, xxl: 1536 } as const;

export const layout = {
  mobilePadding: 16,
  tabletPadding: 24,
  desktopPadding: 32,
  mobileGutter: 12,
  tabletGutter: 16,
  desktopGutter: 24,
  mobileHeader: 56,
  desktopHeader: 64,
  desktopSidebar: 280,
  collapsedSidebar: 72,
  mobileSidebarMax: 340,
  touchTarget: 44,
} as const;

export type ThemeMode = "light" | "dark" | "system";
export type Locale = "uz" | "ru" | "en";
