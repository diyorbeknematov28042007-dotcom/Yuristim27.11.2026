export const specializationCodes = [
  "civil",
  "criminal",
  "family",
  "labor",
  "economic",
  "administrative",
  "tax",
  "land",
  "housing",
  "inheritance",
  "banking_finance",
  "corporate",
  "intellectual_property",
  "international",
  "migration",
  "customs",
  "social_security",
  "enforcement",
  "consumer",
  "other",
] as const;

export type LawyerSpecializationCode = (typeof specializationCodes)[number];
export type SupportedLocale = "uz" | "ru" | "en";
export type ProfessionalType = "lawyer" | "advocate";
export type VerificationStatus =
  | "draft"
  | "pending"
  | "verified"
  | "rejected"
  | "reverification_required"
  | "revoked";
export type DirectoryStatus = "hidden" | "active" | "restricted" | "blocked";

const keywordRegistry: Readonly<Record<LawyerSpecializationCode, readonly string[]>> = {
  civil: ["fuqarolik", "qarz", "zarar", "mulk", "civil", "граждан"],
  criminal: ["jinoyat", "jinoiy", "criminal", "уголов"],
  family: ["oila", "nikoh", "ajrash", "aliment", "family", "семейн"],
  labor: ["mehnat", "ish haqi", "ishdan", "labor", "труд"],
  economic: ["iqtisodiy sud", "xo‘jalik", "business dispute", "экономичес"],
  administrative: ["ma’muriy", "davlat organ", "administrative", "административ"],
  tax: ["soliq", "tax", "налог"],
  land: ["yer", "kadastr", "land", "земел"],
  housing: ["uy-joy", "kvartira", "ijara", "housing", "жилищ"],
  inheritance: ["meros", "vasiyat", "inheritance", "наслед"],
  banking_finance: ["bank", "kredit", "moliya", "finance", "банк"],
  corporate: ["korporativ", "ta’sischi", "ulush", "corporate", "корпоратив"],
  intellectual_property: ["mualliflik", "tovar belgisi", "patent", "intellectual", "интеллектуал"],
  international: ["xalqaro", "international", "международ"],
  migration: ["migratsiya", "viza", "fuqarolik", "migration", "миграц"],
  customs: ["bojxona", "customs", "тамож"],
  social_security: ["pensiya", "nafaqa", "ijtimoiy", "social security", "социаль"],
  enforcement: ["ijro", "mib", "enforcement", "исполнител"],
  consumer: ["iste’molchi", "xaridor", "consumer", "потребител"],
  other: [],
};

export const normalizeDirectoryQuery = (value: string): string =>
  value.normalize("NFKC").trim().replace(/\s+/gu, " ").slice(0, 200);

export const recommendedSpecializations = (
  issue: string,
  limit = 3,
): LawyerSpecializationCode[] => {
  const normalized = normalizeDirectoryQuery(issue).toLocaleLowerCase("uz");
  const scored = specializationCodes
    .filter((code) => code !== "other")
    .map((code) => ({
      code,
      score: keywordRegistry[code].reduce(
        (total, keyword) => total + (normalized.includes(keyword) ? keyword.length : 0),
        0,
      ),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.code.localeCompare(right.code))
    .slice(0, Math.max(1, Math.min(limit, 5)))
    .map((item) => item.code);
  return scored.length === 0 ? ["other"] : scored;
};

export const isCriticalProfileChange = (
  before: {
    professionalType: ProfessionalType;
    fullName: string;
    professionalStatus: string;
    regionCode: string;
    licenseNumber: string | null;
    licenseIssuer: string | null;
    specializations: readonly string[];
  },
  after: {
    professionalType: ProfessionalType;
    fullName: string;
    professionalStatus: string;
    regionCode: string;
    licenseNumber: string | null;
    licenseIssuer: string | null;
    specializations: readonly string[];
  },
): boolean => {
  const left = [...before.specializations].sort().join(",");
  const right = [...after.specializations].sort().join(",");
  return (
    before.professionalType !== after.professionalType ||
    before.fullName !== after.fullName ||
    before.professionalStatus !== after.professionalStatus ||
    before.regionCode !== after.regionCode ||
    before.licenseNumber !== after.licenseNumber ||
    before.licenseIssuer !== after.licenseIssuer ||
    left !== right
  );
};

export const verificationDocumentStorageState = {
  status: "blocked",
  reason: "private_r2_unavailable",
} as const;

export const recommendationProviderState = {
  method: "deterministic_registry",
  aiReranking: "blocked_provider_prerequisites",
  guarantees: ["existing_profiles_only", "verified_active_only"],
} as const;
