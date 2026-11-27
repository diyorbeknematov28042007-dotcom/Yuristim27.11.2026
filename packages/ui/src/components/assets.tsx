import type { ImgHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export type AssetKind = "logo" | "sticker" | "animation" | "icon";
export type AssetStatus = "available" | "missing" | "pending-audit";

export type AssetRecord = {
  id: string;
  kind: AssetKind;
  status: AssetStatus;
  source?: string;
  alt: string;
  decorative?: boolean;
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
    registry.set(asset.id, Object.freeze({ ...asset }));
  }
  return registry;
};

export const requiredAssetRegistry = createAssetRegistry([
  { id: "yuristim-logo", kind: "logo", status: "missing", alt: "Yuristim" },
  { id: "yuristim-sticker-pack", kind: "sticker", status: "pending-audit", alt: "" },
  { id: "yuristim-animation-pack", kind: "animation", status: "pending-audit", alt: "" },
]);

export type YuristimLogoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
  src?: string | undefined;
  alt?: string;
  fallback?: "text" | "none";
};

export const YuristimLogo = ({
  src,
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
