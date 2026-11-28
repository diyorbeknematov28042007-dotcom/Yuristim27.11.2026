import type { ImgHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export type AssetKind = "logo" | "sticker" | "animation" | "icon";
export type AssetStatus = "available" | "missing" | "pending-audit";
export type AssetPolicy = "approved" | "deferred" | "prohibited";

export type AssetRecord = {
  id: string;
  kind: AssetKind;
  status: AssetStatus;
  source?: string;
  fallbackSource?: string;
  alt: string;
  decorative?: boolean;
  policy?: AssetPolicy;
  policyReason?: string;
  width?: number;
  height?: number;
  bytes?: number;
};

const isKebabCase = (value: string): boolean => /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value);

export const createAssetRegistry = (
  assets: readonly AssetRecord[],
): ReadonlyMap<string, AssetRecord> => {
  const registry = new Map<string, AssetRecord>();
  for (const asset of assets) {
    if (!isKebabCase(asset.id)) throw new Error(`Asset id must use kebab-case: ${asset.id}`);
    if (registry.has(asset.id)) throw new Error(`Duplicate asset id: ${asset.id}`);
    if (asset.status === "available" && asset.source === undefined) {
      throw new Error(`Available asset must have a source: ${asset.id}`);
    }
    if (asset.policy === "prohibited" && asset.policyReason === undefined) {
      throw new Error(`Prohibited asset must explain the policy: ${asset.id}`);
    }
    registry.set(asset.id, Object.freeze({ ...asset }));
  }
  return registry;
};

const bundledAssets = {
  "../assets/brand/yuristim-logo.png": new URL("../assets/brand/yuristim-logo.png", import.meta.url)
    .href,
  "../assets/brand/yuristim-logo.webp": new URL(
    "../assets/brand/yuristim-logo.webp",
    import.meta.url,
  ).href,
  "../assets/stickers/webp/authentication-error.webp": new URL(
    "../assets/stickers/webp/authentication-error.webp",
    import.meta.url,
  ).href,
  "../assets/stickers/png/authentication-error.png": new URL(
    "../assets/stickers/png/authentication-error.png",
    import.meta.url,
  ).href,
  "../assets/stickers/webp/confirmation-pending.webp": new URL(
    "../assets/stickers/webp/confirmation-pending.webp",
    import.meta.url,
  ).href,
  "../assets/stickers/png/confirmation-pending.png": new URL(
    "../assets/stickers/png/confirmation-pending.png",
    import.meta.url,
  ).href,
  "../assets/stickers/webp/create-account.webp": new URL(
    "../assets/stickers/webp/create-account.webp",
    import.meta.url,
  ).href,
  "../assets/stickers/png/create-account.png": new URL(
    "../assets/stickers/png/create-account.png",
    import.meta.url,
  ).href,
  "../assets/stickers/webp/empty-chat.webp": new URL(
    "../assets/stickers/webp/empty-chat.webp",
    import.meta.url,
  ).href,
  "../assets/stickers/png/empty-chat.png": new URL(
    "../assets/stickers/png/empty-chat.png",
    import.meta.url,
  ).href,
  "../assets/stickers/webp/profile-setup.webp": new URL(
    "../assets/stickers/webp/profile-setup.webp",
    import.meta.url,
  ).href,
  "../assets/stickers/png/profile-setup.png": new URL(
    "../assets/stickers/png/profile-setup.png",
    import.meta.url,
  ).href,
  "../assets/stickers/webp/secure-login.webp": new URL(
    "../assets/stickers/webp/secure-login.webp",
    import.meta.url,
  ).href,
  "../assets/stickers/png/secure-login.png": new URL(
    "../assets/stickers/png/secure-login.png",
    import.meta.url,
  ).href,
  "../assets/stickers/webp/special-login.webp": new URL(
    "../assets/stickers/webp/special-login.webp",
    import.meta.url,
  ).href,
  "../assets/stickers/png/special-login.png": new URL(
    "../assets/stickers/png/special-login.png",
    import.meta.url,
  ).href,
  "../assets/stickers/webp/telegram-connected.webp": new URL(
    "../assets/stickers/webp/telegram-connected.webp",
    import.meta.url,
  ).href,
  "../assets/stickers/png/telegram-connected.png": new URL(
    "../assets/stickers/png/telegram-connected.png",
    import.meta.url,
  ).href,
  "../assets/stickers/webp/telegram-disconnected.webp": new URL(
    "../assets/stickers/webp/telegram-disconnected.webp",
    import.meta.url,
  ).href,
  "../assets/stickers/png/telegram-disconnected.png": new URL(
    "../assets/stickers/png/telegram-disconnected.png",
    import.meta.url,
  ).href,
  "../assets/stickers/webp/telegram-verification.webp": new URL(
    "../assets/stickers/webp/telegram-verification.webp",
    import.meta.url,
  ).href,
  "../assets/stickers/png/telegram-verification.png": new URL(
    "../assets/stickers/png/telegram-verification.png",
    import.meta.url,
  ).href,
  "../assets/stickers/webp/verification-success.webp": new URL(
    "../assets/stickers/webp/verification-success.webp",
    import.meta.url,
  ).href,
  "../assets/stickers/png/verification-success.png": new URL(
    "../assets/stickers/png/verification-success.png",
    import.meta.url,
  ).href,
} as const;

const assetUrl = (path: keyof typeof bundledAssets): string => bundledAssets[path];

export const yuristimBrandAssets = {
  png: assetUrl("../assets/brand/yuristim-logo.png"),
  webp: assetUrl("../assets/brand/yuristim-logo.webp"),
} as const;

export const yuristimStickerAssets = {
  "authentication-error": {
    webp: assetUrl("../assets/stickers/webp/authentication-error.webp"),
    png: assetUrl("../assets/stickers/png/authentication-error.png"),
  },
  "confirmation-pending": {
    webp: assetUrl("../assets/stickers/webp/confirmation-pending.webp"),
    png: assetUrl("../assets/stickers/png/confirmation-pending.png"),
  },
  "create-account": {
    webp: assetUrl("../assets/stickers/webp/create-account.webp"),
    png: assetUrl("../assets/stickers/png/create-account.png"),
  },
  "empty-chat": {
    webp: assetUrl("../assets/stickers/webp/empty-chat.webp"),
    png: assetUrl("../assets/stickers/png/empty-chat.png"),
  },
  "profile-setup": {
    webp: assetUrl("../assets/stickers/webp/profile-setup.webp"),
    png: assetUrl("../assets/stickers/png/profile-setup.png"),
  },
  "secure-login": {
    webp: assetUrl("../assets/stickers/webp/secure-login.webp"),
    png: assetUrl("../assets/stickers/png/secure-login.png"),
  },
  "special-login": {
    webp: assetUrl("../assets/stickers/webp/special-login.webp"),
    png: assetUrl("../assets/stickers/png/special-login.png"),
  },
  "telegram-connected": {
    webp: assetUrl("../assets/stickers/webp/telegram-connected.webp"),
    png: assetUrl("../assets/stickers/png/telegram-connected.png"),
  },
  "telegram-disconnected": {
    webp: assetUrl("../assets/stickers/webp/telegram-disconnected.webp"),
    png: assetUrl("../assets/stickers/png/telegram-disconnected.png"),
  },
  "telegram-verification": {
    webp: assetUrl("../assets/stickers/webp/telegram-verification.webp"),
    png: assetUrl("../assets/stickers/png/telegram-verification.png"),
  },
  "verification-success": {
    webp: assetUrl("../assets/stickers/webp/verification-success.webp"),
    png: assetUrl("../assets/stickers/png/verification-success.png"),
  },
} as const;

type StickerId = keyof typeof yuristimStickerAssets;

const stickerRecord = (
  id: StickerId,
  alt: string,
  bytes: number,
  policy: AssetPolicy = "approved",
  policyReason?: string,
): AssetRecord => ({
  id,
  kind: "sticker",
  status: "available",
  source: yuristimStickerAssets[id].webp,
  fallbackSource: yuristimStickerAssets[id].png,
  alt,
  policy,
  ...(policyReason === undefined ? {} : { policyReason }),
  width: 512,
  height: 512,
  bytes,
});

export const requiredAssetRegistry = createAssetRegistry([
  {
    id: "yuristim-logo",
    kind: "logo",
    status: "available",
    source: yuristimBrandAssets.webp,
    fallbackSource: yuristimBrandAssets.png,
    alt: "Yuristim",
    policy: "approved",
    width: 512,
    height: 512,
    bytes: 85_094,
  },
  stickerRecord("create-account", "Hisob yaratish", 79_582),
  stickerRecord("profile-setup", "Profilni sozlash", 77_434),
  stickerRecord(
    "special-login",
    "Maxsus kirish",
    51_032,
    "prohibited",
    "Legacy six-digit login is outside Telegram-only authentication.",
  ),
  stickerRecord(
    "secure-login",
    "Xavfsiz kirish",
    87_748,
    "prohibited",
    "Password login is forbidden by decision №050.",
  ),
  stickerRecord("telegram-verification", "Telegram orqali tasdiqlash", 75_766),
  stickerRecord("confirmation-pending", "Tasdiqlash kutilmoqda", 17_208),
  stickerRecord("verification-success", "Tasdiqlash muvaffaqiyatli", 17_054),
  stickerRecord("telegram-connected", "Telegram ulangan", 25_242),
  stickerRecord("telegram-disconnected", "Telegram ulanmagan", 19_286),
  stickerRecord("authentication-error", "Autentifikatsiya xatosi", 17_104),
  stickerRecord("empty-chat", "Bo‘sh chat", 8_362, "deferred"),
  {
    id: "motion-system",
    kind: "animation",
    status: "available",
    source: "@yuristim/ui/motion",
    alt: "",
    decorative: true,
    policy: "approved",
  },
  {
    id: "yuristim-animation-pack",
    kind: "animation",
    status: "missing",
    alt: "",
    decorative: true,
    policy: "deferred",
  },
]);

export type YuristimLogoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
  src?: string | undefined;
  alt?: string;
  fallback?: "text" | "none";
};

export const YuristimLogo = ({
  src = yuristimBrandAssets.webp,
  alt = "Yuristim",
  fallback = "text",
  className,
  ...props
}: YuristimLogoProps) => {
  if (src === undefined) {
    return fallback === "none" ? null : (
      <span
        className={cn("text-lg font-bold tracking-tight text-[var(--yr-color-primary)]", className)}
      >
        Yuristim
      </span>
    );
  }
  return <img {...props} src={src} alt={alt} className={cn("object-contain", className)} />;
};
