import { describe, expect, it } from "vitest";
import {
  isCriticalProfileChange,
  recommendedSpecializations,
  specializationCodes,
  verificationDocumentStorageState,
} from "@yuristim/lawyer";

describe("lawyer domain", () => {
  it("keeps the approved specialization registry exact and recommends without inventing profiles", () => {
    expect(specializationCodes).toHaveLength(20);
    expect(new Set(specializationCodes).size).toBe(20);
    expect(recommendedSpecializations("Aliment va ajrashish bo‘yicha yordam kerak")).toContain("family");
    expect(recommendedSpecializations("Noma’lum masala")).toEqual(["other"]);
  });

  it("detects reverification fields and keeps private storage fail closed", () => {
    const base = {
      professionalType: "lawyer" as const,
      fullName: "A",
      professionalStatus: "Yurist",
      regionCode: "tashkent",
      licenseNumber: null,
      licenseIssuer: null,
      specializations: ["civil"],
    };
    expect(isCriticalProfileChange(base, { ...base, fullName: "B" })).toBe(true);
    expect(isCriticalProfileChange(base, { ...base })).toBe(false);
    expect(verificationDocumentStorageState.status).toBe("blocked");
  });
});
