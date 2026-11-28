import { AppError } from "@yuristim/errors";
import type {
  DirectoryStatus,
  LawyerSpecializationCode,
  ProfessionalType,
  SupportedLocale,
  VerificationStatus,
} from "@yuristim/lawyer";
import { runD1Operation, type D1ExecutionPolicy } from "./execution";

export type LawyerProfileInput = {
  publicSlug: string;
  professionalType: ProfessionalType;
  fullName: string;
  professionalStatus: string;
  experienceYears: number;
  regionCode: string;
  bioUz: string;
  bioRu: string;
  bioEn: string;
  phone: string | null;
  telegramUsername: string | null;
  contactVisible: boolean;
  remoteAvailable: boolean;
  officeAddress: string | null;
  priceNote: string | null;
  education: readonly string[];
  services: readonly string[];
  certificates: readonly string[];
  licenseNumber: string | null;
  licenseIssuer: string | null;
  specializations: readonly LawyerSpecializationCode[];
  primarySpecialization: LawyerSpecializationCode;
  languages: readonly SupportedLocale[];
};

export type PrivateLawyerProfile = LawyerProfileInput & {
  id: string;
  accountId: string;
  verificationStatus: VerificationStatus;
  directoryStatus: DirectoryStatus;
  profileRevision: number;
  verifiedRevision: number | null;
  rejectionReasonCode: string | null;
  verifiedAt: string | null;
  photoStorage: "blocked_private_r2";
};

export type LawyerDirectoryQuery = {
  query?: string;
  specialization?: LawyerSpecializationCode;
  regionCode?: string;
  language?: SupportedLocale;
  minimumRating?: number;
  remoteAvailable?: boolean;
  sort: "relevance" | "rating" | "experience";
  limit: number;
  offset: number;
};

export type PublicLawyerProfile = {
  id: string;
  slug: string;
  professionalType: ProfessionalType;
  fullName: string;
  professionalStatus: string;
  experienceYears: number;
  regionCode: string;
  bio: string;
  remoteAvailable: boolean;
  officeAddress: string | null;
  priceNote: string | null;
  education: string[];
  services: string[];
  certificates: string[];
  phone: string | null;
  telegramUsername: string | null;
  specializations: Array<{ code: LawyerSpecializationCode; name: string; primary: boolean }>;
  languages: SupportedLocale[];
  rating: { average: number | null; count: number };
  verification: { status: "verified"; verifiedAt: string | null };
};

type ProfileRow = {
  id: string;
  accountId: string;
  publicSlug: string;
  professionalType: ProfessionalType;
  fullName: string;
  professionalStatus: string;
  experienceYears: number;
  regionCode: string;
  bioUz: string;
  bioRu: string;
  bioEn: string;
  phone: string | null;
  telegramUsername: string | null;
  contactVisible: number;
  remoteAvailable: number;
  officeAddress: string | null;
  priceNote: string | null;
  educationJson: string;
  servicesJson: string;
  certificatesJson: string;
  licenseNumber: string | null;
  licenseIssuer: string | null;
  verificationStatus: VerificationStatus;
  directoryStatus: DirectoryStatus;
  profileRevision: number;
  verifiedRevision: number | null;
  rejectionReasonCode: string | null;
  verifiedAt: string | null;
};

type PublicRow = {
  id: string;
  slug: string;
  professionalType: ProfessionalType;
  fullName: string;
  professionalStatus: string;
  experienceYears: number;
  regionCode: string;
  bio: string;
  remoteAvailable: number;
  officeAddress: string | null;
  priceNote: string | null;
  educationJson: string;
  servicesJson: string;
  certificatesJson: string;
  phone: string | null;
  telegramUsername: string | null;
  averageRating: number | null;
  reviewCount: number;
  verifiedAt: string | null;
};

const parseStringArray = (value: string): string[] => {
  const parsed: unknown = JSON.parse(value);
  return Array.isArray(parsed) && parsed.every((item) => typeof item === "string")
    ? parsed
    : [];
};

const localeColumn = (locale: SupportedLocale): "name_uz" | "name_ru" | "name_en" =>
  locale === "ru" ? "name_ru" : locale === "en" ? "name_en" : "name_uz";

export class D1LawyerRepository {
  constructor(
    private readonly database: D1Database,
    private readonly policy: D1ExecutionPolicy,
  ) {}

  async specializations(locale: SupportedLocale): Promise<Array<{ code: LawyerSpecializationCode; name: string }>> {
    const column = localeColumn(locale);
    const result = await runD1Operation(
      () => this.database
        .prepare("SELECT code, " + column + " AS name FROM lawyer_specializations WHERE active = 1 ORDER BY sort_order")
        .all<{ code: LawyerSpecializationCode; name: string }>(),
      this.policy,
    );
    return result.results;
  }

  private async profileRelations(profileId: string, locale: SupportedLocale = "uz"): Promise<{
    specializations: Array<{ code: LawyerSpecializationCode; name: string; primary: boolean }>;
    languages: SupportedLocale[];
  }> {
    const column = localeColumn(locale);
    const [specializations, languages] = await Promise.all([
      runD1Operation(
        () => this.database
          .prepare(
            "SELECT s.code, s." + column + " AS name, ps.is_primary AS isPrimary " +
              "FROM lawyer_profile_specializations ps JOIN lawyer_specializations s " +
              "ON s.code = ps.specialization_code WHERE ps.profile_id = ?1 " +
              "ORDER BY ps.is_primary DESC, s.sort_order",
          )
          .bind(profileId)
          .all<{ code: LawyerSpecializationCode; name: string; isPrimary: number }>(),
        this.policy,
      ),
      runD1Operation(
        () => this.database
          .prepare("SELECT locale FROM lawyer_profile_languages WHERE profile_id = ?1 ORDER BY locale")
          .bind(profileId)
          .all<{ locale: SupportedLocale }>(),
        this.policy,
      ),
    ]);
    return {
      specializations: specializations.results.map((item) => ({
        code: item.code,
        name: item.name,
        primary: item.isPrimary === 1,
      })),
      languages: languages.results.map((item) => item.locale),
    };
  }

  async ownProfile(accountId: string): Promise<PrivateLawyerProfile | null> {
    const row = await runD1Operation(
      () => this.database
        .prepare(
          [
            "SELECT id, account_id AS accountId, public_slug AS publicSlug, professional_type AS professionalType,",
            "full_name AS fullName, professional_status AS professionalStatus, experience_years AS experienceYears,",
            "region_code AS regionCode, bio_uz AS bioUz, bio_ru AS bioRu, bio_en AS bioEn, phone,",
            "telegram_username AS telegramUsername, contact_visible AS contactVisible, remote_available AS remoteAvailable,",
            "office_address AS officeAddress, price_note AS priceNote, education_json AS educationJson,",
            "services_json AS servicesJson, certificates_json AS certificatesJson, license_number AS licenseNumber,",
            "license_issuer AS licenseIssuer, verification_status AS verificationStatus, directory_status AS directoryStatus,",
            "profile_revision AS profileRevision, verified_revision AS verifiedRevision,",
            "rejection_reason_code AS rejectionReasonCode, verified_at AS verifiedAt",
            "FROM lawyer_profiles WHERE account_id = ?1",
          ].join(" "),
        )
        .bind(accountId)
        .first<ProfileRow>(),
      this.policy,
    );
    if (row === null) return null;
    const relations = await this.profileRelations(row.id);
    return {
      id: row.id,
      accountId: row.accountId,
      publicSlug: row.publicSlug,
      professionalType: row.professionalType,
      fullName: row.fullName,
      professionalStatus: row.professionalStatus,
      experienceYears: row.experienceYears,
      regionCode: row.regionCode,
      bioUz: row.bioUz,
      bioRu: row.bioRu,
      bioEn: row.bioEn,
      phone: row.phone,
      telegramUsername: row.telegramUsername,
      contactVisible: row.contactVisible === 1,
      remoteAvailable: row.remoteAvailable === 1,
      officeAddress: row.officeAddress,
      priceNote: row.priceNote,
      education: parseStringArray(row.educationJson),
      services: parseStringArray(row.servicesJson),
      certificates: parseStringArray(row.certificatesJson),
      licenseNumber: row.licenseNumber,
      licenseIssuer: row.licenseIssuer,
      specializations: relations.specializations.map((item) => item.code),
      primarySpecialization:
        relations.specializations.find((item) => item.primary)?.code ??
        relations.specializations[0]?.code ??
        "other",
      languages: relations.languages,
      verificationStatus: row.verificationStatus,
      directoryStatus: row.directoryStatus,
      profileRevision: row.profileRevision,
      verifiedRevision: row.verifiedRevision,
      rejectionReasonCode: row.rejectionReasonCode,
      verifiedAt: row.verifiedAt,
      photoStorage: "blocked_private_r2",
    };
  }

  async createProfile(input: {
    id: string;
    accountId: string;
    profile: LawyerProfileInput;
    now: string;
  }): Promise<void> {
    if ((await this.ownProfile(input.accountId)) !== null) {
      throw new AppError("CONFLICT", "Professional profile already exists");
    }
    const profile = input.profile;
    const statements: D1PreparedStatement[] = [
      this.database
        .prepare(
          [
            "INSERT INTO lawyer_profiles (id, account_id, public_slug, professional_type, full_name,",
            "professional_status, experience_years, region_code, bio_uz, bio_ru, bio_en, phone,",
            "telegram_username, contact_visible, remote_available, office_address, price_note,",
            "education_json, services_json, certificates_json, license_number, license_issuer, created_at, updated_at)",
            "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17,",
            "?18, ?19, ?20, ?21, ?22, ?23, ?23)",
          ].join(" "),
        )
        .bind(
          input.id,
          input.accountId,
          profile.publicSlug,
          profile.professionalType,
          profile.fullName,
          profile.professionalStatus,
          profile.experienceYears,
          profile.regionCode,
          profile.bioUz,
          profile.bioRu,
          profile.bioEn,
          profile.phone,
          profile.telegramUsername,
          profile.contactVisible ? 1 : 0,
          profile.remoteAvailable ? 1 : 0,
          profile.officeAddress,
          profile.priceNote,
          JSON.stringify(profile.education),
          JSON.stringify(profile.services),
          JSON.stringify(profile.certificates),
          profile.licenseNumber,
          profile.licenseIssuer,
          input.now,
        ),
      ...profile.specializations.map((code) =>
        this.database
          .prepare(
            "INSERT INTO lawyer_profile_specializations (profile_id, specialization_code, is_primary) VALUES (?1, ?2, ?3)",
          )
          .bind(input.id, code, code === profile.primarySpecialization ? 1 : 0),
      ),
      ...profile.languages.map((locale) =>
        this.database
          .prepare("INSERT INTO lawyer_profile_languages (profile_id, locale) VALUES (?1, ?2)")
          .bind(input.id, locale),
      ),
    ];
    await runD1Operation(() => this.database.batch(statements), this.policy);
  }

  async updateProfile(input: {
    accountId: string;
    profile: LawyerProfileInput;
    criticalChange: boolean;
    now: string;
  }): Promise<void> {
    const current = await this.ownProfile(input.accountId);
    if (current === null) throw new AppError("NOT_FOUND", "Professional profile not found");
    if (current.verificationStatus === "pending") {
      throw new AppError("CONFLICT", "Profile cannot be changed during verification review");
    }
    const profile = input.profile;
    const reverify = input.criticalChange && current.verificationStatus === "verified";
    const statements: D1PreparedStatement[] = [
      this.database
        .prepare(
          [
            "UPDATE lawyer_profiles SET public_slug = ?1, professional_type = ?2, full_name = ?3,",
            "professional_status = ?4, experience_years = ?5, region_code = ?6, bio_uz = ?7, bio_ru = ?8,",
            "bio_en = ?9, phone = ?10, telegram_username = ?11, contact_visible = ?12, remote_available = ?13,",
            "office_address = ?14, price_note = ?15, education_json = ?16, services_json = ?17,",
            "certificates_json = ?18, license_number = ?19, license_issuer = ?20,",
            "verification_status = CASE WHEN ?21 = 1 THEN 'reverification_required' ELSE verification_status END,",
            "directory_status = CASE WHEN ?21 = 1 THEN 'hidden' ELSE directory_status END,",
            "profile_revision = profile_revision + CASE WHEN ?21 = 1 THEN 1 ELSE 0 END,",
            "verified_revision = CASE WHEN ?21 = 1 THEN NULL ELSE verified_revision END,",
            "verified_at = CASE WHEN ?21 = 1 THEN NULL ELSE verified_at END, updated_at = ?22",
            "WHERE account_id = ?23",
          ].join(" "),
        )
        .bind(
          profile.publicSlug,
          profile.professionalType,
          profile.fullName,
          profile.professionalStatus,
          profile.experienceYears,
          profile.regionCode,
          profile.bioUz,
          profile.bioRu,
          profile.bioEn,
          profile.phone,
          profile.telegramUsername,
          profile.contactVisible ? 1 : 0,
          profile.remoteAvailable ? 1 : 0,
          profile.officeAddress,
          profile.priceNote,
          JSON.stringify(profile.education),
          JSON.stringify(profile.services),
          JSON.stringify(profile.certificates),
          profile.licenseNumber,
          profile.licenseIssuer,
          reverify ? 1 : 0,
          input.now,
          input.accountId,
        ),
      this.database
        .prepare("DELETE FROM lawyer_profile_specializations WHERE profile_id = ?1")
        .bind(current.id),
      this.database
        .prepare("DELETE FROM lawyer_profile_languages WHERE profile_id = ?1")
        .bind(current.id),
      ...profile.specializations.map((code) =>
        this.database
          .prepare(
            "INSERT INTO lawyer_profile_specializations (profile_id, specialization_code, is_primary) VALUES (?1, ?2, ?3)",
          )
          .bind(current.id, code, code === profile.primarySpecialization ? 1 : 0),
      ),
      ...profile.languages.map((locale) =>
        this.database
          .prepare("INSERT INTO lawyer_profile_languages (profile_id, locale) VALUES (?1, ?2)")
          .bind(current.id, locale),
      ),
    ];
    await runD1Operation(() => this.database.batch(statements), this.policy);
  }

  async submitVerification(input: {
    accountId: string;
    caseId: string;
    actionId: string;
    applicantNote: string | null;
    now: string;
  }): Promise<{ caseId: string; status: "pending" }> {
    const profile = await this.ownProfile(input.accountId);
    if (profile === null) throw new AppError("NOT_FOUND", "Professional profile not found");
    if (!["draft", "rejected", "reverification_required"].includes(profile.verificationStatus)) {
      throw new AppError("CONFLICT", "Profile is not eligible for verification submission");
    }
    await runD1Operation(
      () => this.database.batch([
        this.database
          .prepare(
            "INSERT INTO lawyer_verification_cases (id, profile_id, applicant_account_id, profile_revision, status, applicant_note, submitted_at) VALUES (?1, ?2, ?3, ?4, 'pending', ?5, ?6)",
          )
          .bind(input.caseId, profile.id, input.accountId, profile.profileRevision, input.applicantNote, input.now),
        this.database
          .prepare(
            "INSERT INTO lawyer_verification_actions (id, case_id, actor_account_id, action, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
          )
          .bind(
            input.actionId,
            input.caseId,
            input.accountId,
            profile.verificationStatus === "draft" ? "submitted" : "resubmitted",
            input.now,
          ),
        this.database
          .prepare(
            "UPDATE lawyer_profiles SET verification_status = 'pending', directory_status = 'hidden', rejection_reason_code = NULL, updated_at = ?1 WHERE id = ?2",
          )
          .bind(input.now, profile.id),
      ]),
      this.policy,
    );
    return { caseId: input.caseId, status: "pending" };
  }

  private publicSelect(locale: SupportedLocale): string {
    const bio = locale === "ru" ? "bio_ru" : locale === "en" ? "bio_en" : "bio_uz";
    return [
      "SELECT p.id, p.public_slug AS slug, p.professional_type AS professionalType,",
      "p.full_name AS fullName, p.professional_status AS professionalStatus,",
      "p.experience_years AS experienceYears, p.region_code AS regionCode, p." + bio + " AS bio,",
      "p.remote_available AS remoteAvailable, p.office_address AS officeAddress, p.price_note AS priceNote,",
      "p.education_json AS educationJson, p.services_json AS servicesJson,",
      "p.certificates_json AS certificatesJson,",
      "CASE WHEN p.contact_visible = 1 THEN p.phone ELSE NULL END AS phone,",
      "CASE WHEN p.contact_visible = 1 THEN p.telegram_username ELSE NULL END AS telegramUsername,",
      "(SELECT round(avg(r.rating), 2) FROM lawyer_reviews r WHERE r.profile_id = p.id AND r.status = 'published' AND r.deleted_at IS NULL) AS averageRating,",
      "(SELECT count(*) FROM lawyer_reviews r WHERE r.profile_id = p.id AND r.status = 'published' AND r.deleted_at IS NULL) AS reviewCount,",
      "p.verified_at AS verifiedAt FROM lawyer_profiles p",
    ].join(" ");
  }

  private async mapPublic(rows: readonly PublicRow[], locale: SupportedLocale): Promise<PublicLawyerProfile[]> {
    return Promise.all(rows.map(async (row) => {
      const relations = await this.profileRelations(row.id, locale);
      return {
        id: row.id,
        slug: row.slug,
        professionalType: row.professionalType,
        fullName: row.fullName,
        professionalStatus: row.professionalStatus,
        experienceYears: row.experienceYears,
        regionCode: row.regionCode,
        bio: row.bio,
        remoteAvailable: row.remoteAvailable === 1,
        officeAddress: row.officeAddress,
        priceNote: row.priceNote,
        education: parseStringArray(row.educationJson),
        services: parseStringArray(row.servicesJson),
        certificates: parseStringArray(row.certificatesJson),
        phone: row.phone,
        telegramUsername: row.telegramUsername,
        specializations: relations.specializations,
        languages: relations.languages,
        rating: { average: row.averageRating, count: row.reviewCount },
        verification: { status: "verified", verifiedAt: row.verifiedAt },
      };
    }));
  }

  async directory(query: LawyerDirectoryQuery, locale: SupportedLocale): Promise<PublicLawyerProfile[]> {
    const conditions = [
      "p.verification_status = 'verified'",
      "p.directory_status = 'active'",
      "p.verified_revision = p.profile_revision",
    ];
    const bindings: unknown[] = [];
    if (query.query !== undefined && query.query !== "") {
      bindings.push("%" + query.query.replaceAll("%", "\\%").replaceAll("_", "\\_") + "%");
      const token = "?" + bindings.length;
      conditions.push(
        "(p.full_name LIKE " + token + " ESCAPE '\\' OR p.professional_status LIKE " + token +
          " ESCAPE '\\' OR p.bio_uz LIKE " + token + " ESCAPE '\\' OR p.bio_ru LIKE " + token +
          " ESCAPE '\\' OR p.bio_en LIKE " + token + " ESCAPE '\\')",
      );
    }
    if (query.specialization !== undefined) {
      bindings.push(query.specialization);
      conditions.push(
        "EXISTS (SELECT 1 FROM lawyer_profile_specializations ps WHERE ps.profile_id = p.id AND ps.specialization_code = ?" +
          bindings.length + ")",
      );
    }
    if (query.regionCode !== undefined) {
      bindings.push(query.regionCode);
      conditions.push("p.region_code = ?" + bindings.length);
    }
    if (query.language !== undefined) {
      bindings.push(query.language);
      conditions.push(
        "EXISTS (SELECT 1 FROM lawyer_profile_languages pl WHERE pl.profile_id = p.id AND pl.locale = ?" +
          bindings.length + ")",
      );
    }
    if (query.remoteAvailable !== undefined) {
      bindings.push(query.remoteAvailable ? 1 : 0);
      conditions.push("p.remote_available = ?" + bindings.length);
    }
    if (query.minimumRating !== undefined) {
      bindings.push(query.minimumRating);
      conditions.push(
        "COALESCE((SELECT avg(r.rating) FROM lawyer_reviews r WHERE r.profile_id = p.id AND r.status = 'published' AND r.deleted_at IS NULL), 0) >= ?" +
          bindings.length,
      );
    }
    const order =
      query.sort === "rating"
        ? "averageRating DESC, reviewCount DESC, p.full_name ASC"
        : query.sort === "experience"
          ? "p.experience_years DESC, averageRating DESC, p.full_name ASC"
          : "CASE WHEN EXISTS (SELECT 1 FROM lawyer_profile_specializations ps WHERE ps.profile_id = p.id AND ps.is_primary = 1) THEN 0 ELSE 1 END, averageRating DESC, p.experience_years DESC, p.full_name ASC";
    bindings.push(query.limit, query.offset);
    const sql =
      this.publicSelect(locale) +
      " WHERE " + conditions.join(" AND ") +
      " ORDER BY " + order +
      " LIMIT ?" + (bindings.length - 1) + " OFFSET ?" + bindings.length;
    const result = await runD1Operation(
      () => this.database.prepare(sql).bind(...bindings).all<PublicRow>(),
      this.policy,
    );
    return this.mapPublic(result.results, locale);
  }

  async publicProfile(profileIdOrSlug: string, locale: SupportedLocale): Promise<PublicLawyerProfile> {
    const row = await runD1Operation(
      () => this.database
        .prepare(
          this.publicSelect(locale) +
            " WHERE (p.id = ?1 OR p.public_slug = ?1) AND p.verification_status = 'verified' " +
            "AND p.directory_status = 'active' AND p.verified_revision = p.profile_revision LIMIT 1",
        )
        .bind(profileIdOrSlug)
        .first<PublicRow>(),
      this.policy,
    );
    if (row === null) throw new AppError("NOT_FOUND", "Professional profile not found");
    return (await this.mapPublic([row], locale))[0]!;
  }

  async recommend(
    specializationCodes: readonly LawyerSpecializationCode[],
    query: Omit<LawyerDirectoryQuery, "query" | "specialization" | "sort">,
    locale: SupportedLocale,
  ): Promise<PublicLawyerProfile[]> {
    const placeholders = specializationCodes.map((_, index) => "?" + (index + 1)).join(", ");
    const bindings: unknown[] = [...specializationCodes];
    const conditions = [
      "p.verification_status = 'verified'",
      "p.directory_status = 'active'",
      "p.verified_revision = p.profile_revision",
      "EXISTS (SELECT 1 FROM lawyer_profile_specializations ps WHERE ps.profile_id = p.id AND ps.specialization_code IN (" +
        placeholders + "))",
    ];
    if (query.regionCode !== undefined) {
      bindings.push(query.regionCode);
      conditions.push("p.region_code = ?" + bindings.length);
    }
    if (query.language !== undefined) {
      bindings.push(query.language);
      conditions.push(
        "EXISTS (SELECT 1 FROM lawyer_profile_languages pl WHERE pl.profile_id = p.id AND pl.locale = ?" +
          bindings.length + ")",
      );
    }
    if (query.remoteAvailable !== undefined) {
      bindings.push(query.remoteAvailable ? 1 : 0);
      conditions.push("p.remote_available = ?" + bindings.length);
    }
    if (query.minimumRating !== undefined) {
      bindings.push(query.minimumRating);
      conditions.push(
        "COALESCE((SELECT avg(r.rating) FROM lawyer_reviews r WHERE r.profile_id = p.id AND r.status = 'published' AND r.deleted_at IS NULL), 0) >= ?" +
          bindings.length,
      );
    }
    bindings.push(query.limit, query.offset);
    const sql =
      this.publicSelect(locale) + " WHERE " + conditions.join(" AND ") +
      " ORDER BY (SELECT max(ps.is_primary) FROM lawyer_profile_specializations ps WHERE ps.profile_id = p.id AND ps.specialization_code IN (" +
      placeholders + ")) DESC, averageRating DESC, p.experience_years DESC, p.full_name ASC LIMIT ?" +
      (bindings.length - 1) + " OFFSET ?" + bindings.length;
    const result = await runD1Operation(
      () => this.database.prepare(sql).bind(...bindings).all<PublicRow>(),
      this.policy,
    );
    return this.mapPublic(result.results, locale);
  }

  async recordView(input: {
    id: string;
    profileId: string;
    accountId: string;
    requestId: string;
    now: string;
  }): Promise<void> {
    await this.publicProfile(input.profileId, "uz");
    await runD1Operation(
      () => this.database
        .prepare(
          "INSERT INTO lawyer_profile_views (id, profile_id, viewer_account_id, request_id, viewed_at) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(request_id) DO NOTHING",
        )
        .bind(input.id, input.profileId, input.accountId, input.requestId, input.now)
        .run(),
      this.policy,
    );
  }

  async addFavorite(accountId: string, profileId: string, now: string): Promise<void> {
    await this.publicProfile(profileId, "uz");
    await runD1Operation(
      () => this.database
        .prepare(
          "INSERT INTO lawyer_favorites (account_id, profile_id, created_at) VALUES (?1, ?2, ?3) ON CONFLICT(account_id, profile_id) DO NOTHING",
        )
        .bind(accountId, profileId, now)
        .run(),
      this.policy,
    );
  }

  async removeFavorite(accountId: string, profileId: string): Promise<void> {
    await runD1Operation(
      () => this.database
        .prepare("DELETE FROM lawyer_favorites WHERE account_id = ?1 AND profile_id = ?2")
        .bind(accountId, profileId)
        .run(),
      this.policy,
    );
  }

  async favorites(accountId: string, locale: SupportedLocale): Promise<PublicLawyerProfile[]> {
    const result = await runD1Operation(
      () => this.database
        .prepare(
          this.publicSelect(locale) +
            " JOIN lawyer_favorites f ON f.profile_id = p.id WHERE f.account_id = ?1 " +
            "AND p.verification_status = 'verified' AND p.directory_status = 'active' " +
            "AND p.verified_revision = p.profile_revision ORDER BY f.created_at DESC LIMIT 100",
        )
        .bind(accountId)
        .all<PublicRow>(),
      this.policy,
    );
    return this.mapPublic(result.results, locale);
  }

  async recordContact(input: {
    id: string;
    accountId: string;
    profileId: string;
    type: "phone" | "telegram";
    requestId: string;
    now: string;
  }): Promise<{ value: string; serviceConfirmed: false }> {
    const profile = await this.publicProfile(input.profileId, "uz");
    const value = input.type === "phone" ? profile.phone : profile.telegramUsername;
    if (value === null) throw new AppError("NOT_FOUND", "Requested contact is unavailable");
    await runD1Operation(
      () => this.database
        .prepare(
          "INSERT INTO lawyer_contact_events (id, profile_id, account_id, contact_type, request_id, clicked_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(request_id) DO NOTHING",
        )
        .bind(input.id, input.profileId, input.accountId, input.type, input.requestId, input.now)
        .run(),
      this.policy,
    );
    return { value, serviceConfirmed: false };
  }

  async reviews(profileId: string): Promise<unknown[]> {
    await this.publicProfile(profileId, "uz");
    const result = await runD1Operation(
      () => this.database
        .prepare(
          [
            "SELECT r.id, r.rating, r.body, r.anonymous, r.created_at AS createdAt, r.updated_at AS updatedAt,",
            "CASE WHEN r.anonymous = 1 THEN NULL ELSE a.display_name END AS reviewerName,",
            "rr.body AS professionalReply, rr.created_at AS repliedAt",
            "FROM lawyer_reviews r JOIN accounts a ON a.id = r.reviewer_account_id",
            "LEFT JOIN lawyer_review_replies rr ON rr.review_id = r.id AND rr.deleted_at IS NULL",
            "WHERE r.profile_id = ?1 AND r.status = 'published' AND r.deleted_at IS NULL",
            "ORDER BY r.created_at DESC LIMIT 100",
          ].join(" "),
        )
        .bind(profileId)
        .all(),
      this.policy,
    );
    return result.results;
  }

  async createReview(input: {
    id: string;
    historyId: string;
    accountId: string;
    profileId: string;
    rating: number;
    body: string | null;
    anonymous: boolean;
    bodyHash: string | null;
    now: string;
  }): Promise<void> {
    const owner = await runD1Operation(
      () => this.database
        .prepare(
          "SELECT account_id AS accountId FROM lawyer_profiles WHERE id = ?1 AND verification_status = 'verified' AND directory_status = 'active'",
        )
        .bind(input.profileId)
        .first<{ accountId: string }>(),
      this.policy,
    );
    if (owner === null) throw new AppError("NOT_FOUND", "Professional profile not found");
    if (owner.accountId === input.accountId) {
      throw new AppError("FORBIDDEN", "Professionals cannot review themselves");
    }
    const contact = await runD1Operation(
      () => this.database
        .prepare(
          "SELECT 1 AS eligible FROM lawyer_contact_events WHERE account_id = ?1 AND profile_id = ?2 LIMIT 1",
        )
        .bind(input.accountId, input.profileId)
        .first<{ eligible: number }>(),
      this.policy,
    );
    if (contact === null) {
      throw new AppError("FORBIDDEN", "A contact action is required before reviewing");
    }
    const duplicate = await runD1Operation(
      () => this.database
        .prepare(
          "SELECT id FROM lawyer_reviews WHERE reviewer_account_id = ?1 AND profile_id = ?2 AND deleted_at IS NULL",
        )
        .bind(input.accountId, input.profileId)
        .first<{ id: string }>(),
      this.policy,
    );
    if (duplicate !== null) throw new AppError("CONFLICT", "Only one active review is allowed");
    await runD1Operation(
      () => this.database.batch([
        this.database
          .prepare(
            "INSERT INTO lawyer_reviews (id, profile_id, reviewer_account_id, rating, body, anonymous, status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'published', ?7, ?7)",
          )
          .bind(input.id, input.profileId, input.accountId, input.rating, input.body, input.anonymous ? 1 : 0, input.now),
        this.database
          .prepare(
            "INSERT INTO lawyer_review_history (id, review_id, actor_account_id, action, rating, body_hash, created_at) VALUES (?1, ?2, ?3, 'created', ?4, ?5, ?6)",
          )
          .bind(input.historyId, input.id, input.accountId, input.rating, input.bodyHash, input.now),
      ]),
      this.policy,
    );
  }

  async updateReview(input: {
    reviewId: string;
    historyId: string;
    accountId: string;
    rating: number;
    body: string | null;
    anonymous: boolean;
    bodyHash: string | null;
    now: string;
  }): Promise<void> {
    const result = await runD1Operation(
      () => this.database.batch([
        this.database
          .prepare(
            "UPDATE lawyer_reviews SET rating = ?1, body = ?2, anonymous = ?3, updated_at = ?4 WHERE id = ?5 AND reviewer_account_id = ?6 AND deleted_at IS NULL",
          )
          .bind(input.rating, input.body, input.anonymous ? 1 : 0, input.now, input.reviewId, input.accountId),
        this.database
          .prepare(
            "INSERT INTO lawyer_review_history (id, review_id, actor_account_id, action, rating, body_hash, created_at) SELECT ?1, id, ?2, 'edited', ?3, ?4, ?5 FROM lawyer_reviews WHERE id = ?6 AND reviewer_account_id = ?2 AND deleted_at IS NULL",
          )
          .bind(input.historyId, input.accountId, input.rating, input.bodyHash, input.now, input.reviewId),
      ]),
      this.policy,
    );
    if (result[0]?.meta.changes !== 1) throw new AppError("NOT_FOUND", "Review not found");
  }

  async deleteReview(input: {
    reviewId: string;
    historyId: string;
    accountId: string;
    now: string;
  }): Promise<void> {
    const result = await runD1Operation(
      () => this.database.batch([
        this.database
          .prepare(
            "UPDATE lawyer_reviews SET status = 'deleted', deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND reviewer_account_id = ?3 AND deleted_at IS NULL",
          )
          .bind(input.now, input.reviewId, input.accountId),
        this.database
          .prepare(
            "INSERT INTO lawyer_review_history (id, review_id, actor_account_id, action, created_at) SELECT ?1, id, ?2, 'deleted', ?3 FROM lawyer_reviews WHERE id = ?4 AND reviewer_account_id = ?2",
          )
          .bind(input.historyId, input.accountId, input.now, input.reviewId),
      ]),
      this.policy,
    );
    if (result[0]?.meta.changes !== 1) throw new AppError("NOT_FOUND", "Review not found");
  }

  async replyToReview(input: {
    reviewId: string;
    accountId: string;
    body: string;
    now: string;
  }): Promise<void> {
    const review = await runD1Operation(
      () => this.database
        .prepare(
          "SELECT r.profile_id AS profileId FROM lawyer_reviews r JOIN lawyer_profiles p ON p.id = r.profile_id WHERE r.id = ?1 AND p.account_id = ?2 AND r.deleted_at IS NULL",
        )
        .bind(input.reviewId, input.accountId)
        .first<{ profileId: string }>(),
      this.policy,
    );
    if (review === null) throw new AppError("NOT_FOUND", "Review not found");
    await runD1Operation(
      () => this.database
        .prepare(
          "INSERT INTO lawyer_review_replies (review_id, profile_id, author_account_id, body, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5) ON CONFLICT(review_id) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at, deleted_at = NULL",
        )
        .bind(input.reviewId, review.profileId, input.accountId, input.body, input.now)
        .run(),
      this.policy,
    );
  }

  async createComplaint(input: {
    id: string;
    accountId: string;
    profileId: string;
    reviewId: string | null;
    category: string;
    description: string;
    evidenceNote: string | null;
    now: string;
  }): Promise<void> {
    await this.publicProfile(input.profileId, "uz");
    await runD1Operation(
      () => this.database
        .prepare(
          "INSERT INTO lawyer_complaints (id, complainant_account_id, profile_id, review_id, category, description, evidence_note, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        )
        .bind(input.id, input.accountId, input.profileId, input.reviewId, input.category, input.description, input.evidenceNote, input.now)
        .run(),
      this.policy,
    );
  }

  async createAppeal(input: {
    id: string;
    accountId: string;
    moderationActionId: string;
    statement: string;
    now: string;
  }): Promise<void> {
    const action = await runD1Operation(
      () => this.database
        .prepare(
          "SELECT m.profile_id AS profileId FROM lawyer_moderation_actions m JOIN lawyer_profiles p ON p.id = m.profile_id WHERE m.id = ?1 AND p.account_id = ?2",
        )
        .bind(input.moderationActionId, input.accountId)
        .first<{ profileId: string }>(),
      this.policy,
    );
    if (action === null) throw new AppError("NOT_FOUND", "Moderation action not found");
    await runD1Operation(
      () => this.database
        .prepare(
          "INSERT INTO lawyer_appeals (id, profile_id, appellant_account_id, moderation_action_id, statement, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        )
        .bind(input.id, action.profileId, input.accountId, input.moderationActionId, input.statement, input.now)
        .run(),
      this.policy,
    );
  }

  async cabinet(accountId: string): Promise<unknown> {
    const profile = await this.ownProfile(accountId);
    if (profile === null) throw new AppError("NOT_FOUND", "Professional profile not found");
    const stats = await runD1Operation(
      () => this.database
        .prepare(
          [
            "SELECT",
            "(SELECT count(*) FROM lawyer_profile_views WHERE profile_id = ?1 AND viewed_at >= datetime('now', '-7 days')) AS views7,",
            "(SELECT count(*) FROM lawyer_profile_views WHERE profile_id = ?1 AND viewed_at >= datetime('now', '-30 days')) AS views30,",
            "(SELECT count(*) FROM lawyer_profile_views WHERE profile_id = ?1 AND viewed_at >= datetime('now', '-90 days')) AS views90,",
            "(SELECT count(*) FROM lawyer_contact_events WHERE profile_id = ?1 AND clicked_at >= datetime('now', '-7 days')) AS contacts7,",
            "(SELECT count(*) FROM lawyer_contact_events WHERE profile_id = ?1 AND clicked_at >= datetime('now', '-30 days')) AS contacts30,",
            "(SELECT count(*) FROM lawyer_contact_events WHERE profile_id = ?1 AND clicked_at >= datetime('now', '-90 days')) AS contacts90,",
            "(SELECT count(*) FROM lawyer_favorites WHERE profile_id = ?1) AS favorites,",
            "(SELECT count(*) FROM lawyer_reviews WHERE profile_id = ?1 AND status = 'published' AND deleted_at IS NULL) AS reviews,",
            "(SELECT round(avg(rating), 2) FROM lawyer_reviews WHERE profile_id = ?1 AND status = 'published' AND deleted_at IS NULL) AS averageRating",
          ].join(" "),
        )
        .bind(profile.id)
        .first<Record<string, unknown>>(),
      this.policy,
    );
    return {
      profile,
      statistics: stats,
      notice: "Views, contact clicks and favorites are engagement signals, not confirmed clients or services.",
    };
  }

  async verificationQueue(): Promise<unknown[]> {
    const result = await runD1Operation(
      () => this.database
        .prepare(
          [
            "SELECT c.id, c.profile_id AS profileId, c.profile_revision AS profileRevision, c.status,",
            "c.applicant_note AS applicantNote, c.submitted_at AS submittedAt, p.full_name AS fullName,",
            "p.professional_type AS professionalType, p.professional_status AS professionalStatus,",
            "p.license_number AS licenseNumber, p.license_issuer AS licenseIssuer",
            "FROM lawyer_verification_cases c JOIN lawyer_profiles p ON p.id = c.profile_id",
            "WHERE c.status = 'pending' ORDER BY c.submitted_at ASC LIMIT 100",
          ].join(" "),
        )
        .all(),
      this.policy,
    );
    return result.results;
  }

  async decideVerification(input: {
    caseId: string;
    actorAccountId: string;
    decision: "approved" | "rejected";
    reasonCode: string | null;
    note: string | null;
    actionId: string;
    now: string;
  }): Promise<void> {
    const verification = await runD1Operation(
      () => this.database
        .prepare(
          "SELECT profile_id AS profileId, profile_revision AS profileRevision FROM lawyer_verification_cases WHERE id = ?1 AND status = 'pending'",
        )
        .bind(input.caseId)
        .first<{ profileId: string; profileRevision: number }>(),
      this.policy,
    );
    if (verification === null) throw new AppError("CONFLICT", "Verification case is not pending");
    const approved = input.decision === "approved";
    await runD1Operation(
      () => this.database.batch([
        this.database
          .prepare(
            "UPDATE lawyer_verification_cases SET status = ?1, decision_reason_code = ?2, decision_note = ?3, reviewer_account_id = ?4, decided_at = ?5 WHERE id = ?6 AND status = 'pending'",
          )
          .bind(input.decision, input.reasonCode, input.note, input.actorAccountId, input.now, input.caseId),
        this.database
          .prepare(
            [
              "UPDATE lawyer_profiles SET verification_status = ?1, directory_status = ?2,",
              "verified_revision = ?3, verified_at = ?4, verified_by_account_id = ?5,",
              "rejection_reason_code = ?6, updated_at = ?4",
              "WHERE id = ?7 AND profile_revision = ?3",
            ].join(" "),
          )
          .bind(
            approved ? "verified" : "rejected",
            approved ? "active" : "hidden",
            verification.profileRevision,
            input.now,
            approved ? input.actorAccountId : null,
            approved ? null : input.reasonCode,
            verification.profileId,
          ),
        this.database
          .prepare(
            "INSERT INTO lawyer_verification_actions (id, case_id, actor_account_id, action, reason_code, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
          )
          .bind(input.actionId, input.caseId, input.actorAccountId, input.decision, input.reasonCode, input.now),
      ]),
      this.policy,
    );
  }

  async complaints(): Promise<unknown[]> {
    const result = await runD1Operation(
      () => this.database
        .prepare(
          "SELECT id, complainant_account_id AS complainantAccountId, profile_id AS profileId, review_id AS reviewId, category, description, evidence_note AS evidenceNote, status, created_at AS createdAt FROM lawyer_complaints WHERE status IN ('open', 'under_review') ORDER BY created_at ASC LIMIT 100",
        )
        .all(),
      this.policy,
    );
    return result.results;
  }

  async appeals(): Promise<unknown[]> {
    const result = await runD1Operation(
      () => this.database
        .prepare(
          "SELECT id, profile_id AS profileId, appellant_account_id AS appellantAccountId, moderation_action_id AS moderationActionId, statement, status, created_at AS createdAt FROM lawyer_appeals WHERE status IN ('open', 'under_review') ORDER BY created_at ASC LIMIT 100",
        )
        .all(),
      this.policy,
    );
    return result.results;
  }

  async moderate(input: {
    actionId: string;
    profileId: string;
    complaintId: string | null;
    reviewId: string | null;
    actorAccountId: string;
    action: "warning" | "restrict" | "block" | "unblock" | "revoke_verification" | "hide_review" | "restore_review";
    reasonCode: string;
    note: string | null;
    complaintDecision: "upheld" | "rejected" | null;
    now: string;
  }): Promise<void> {
    const statements: D1PreparedStatement[] = [
      this.database
        .prepare(
          "INSERT INTO lawyer_moderation_actions (id, profile_id, complaint_id, actor_account_id, action, reason_code, note, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        )
        .bind(input.actionId, input.profileId, input.complaintId, input.actorAccountId, input.action, input.reasonCode, input.note, input.now),
    ];
    if (input.action === "restrict") {
      statements.push(
        this.database.prepare("UPDATE lawyer_profiles SET directory_status = 'restricted', updated_at = ?1 WHERE id = ?2").bind(input.now, input.profileId),
      );
    } else if (input.action === "block") {
      statements.push(
        this.database.prepare("UPDATE lawyer_profiles SET directory_status = 'blocked', updated_at = ?1 WHERE id = ?2").bind(input.now, input.profileId),
      );
    } else if (input.action === "unblock") {
      statements.push(
        this.database.prepare("UPDATE lawyer_profiles SET directory_status = CASE WHEN verification_status = 'verified' AND verified_revision = profile_revision THEN 'active' ELSE 'hidden' END, updated_at = ?1 WHERE id = ?2").bind(input.now, input.profileId),
      );
    } else if (input.action === "revoke_verification") {
      statements.push(
        this.database.prepare("UPDATE lawyer_profiles SET verification_status = 'revoked', directory_status = 'hidden', verified_revision = NULL, verified_at = NULL, updated_at = ?1 WHERE id = ?2").bind(input.now, input.profileId),
      );
    } else if (input.action === "hide_review" || input.action === "restore_review") {
      if (input.reviewId === null) throw new AppError("VALIDATION_ERROR", "Review ID is required");
      statements.push(
        this.database.prepare("UPDATE lawyer_reviews SET status = ?1, updated_at = ?2 WHERE id = ?3 AND profile_id = ?4 AND deleted_at IS NULL").bind(
          input.action === "hide_review" ? "hidden" : "published",
          input.now,
          input.reviewId,
          input.profileId,
        ),
      );
    }
    if (input.complaintId !== null && input.complaintDecision !== null) {
      statements.push(
        this.database.prepare("UPDATE lawyer_complaints SET status = ?1, resolution_note = ?2, reviewer_account_id = ?3, resolved_at = ?4 WHERE id = ?5").bind(
          input.complaintDecision,
          input.note,
          input.actorAccountId,
          input.now,
          input.complaintId,
        ),
      );
    }
    await runD1Operation(() => this.database.batch(statements), this.policy);
  }

  async decideAppeal(input: {
    appealId: string;
    actorAccountId: string;
    decision: "upheld" | "rejected";
    note: string;
    now: string;
  }): Promise<void> {
    const result = await runD1Operation(
      () => this.database
        .prepare(
          "UPDATE lawyer_appeals SET status = ?1, reviewer_account_id = ?2, decision_note = ?3, decided_at = ?4 WHERE id = ?5 AND status IN ('open', 'under_review')",
        )
        .bind(input.decision, input.actorAccountId, input.note, input.now, input.appealId)
        .run(),
      this.policy,
    );
    if (result.meta.changes !== 1) throw new AppError("CONFLICT", "Appeal is not open");
  }

  async adminStatistics(): Promise<unknown> {
    return runD1Operation(
      () => this.database
        .prepare(
          [
            "SELECT",
            "(SELECT count(*) FROM lawyer_profiles) AS totalProfiles,",
            "(SELECT count(*) FROM lawyer_profiles WHERE verification_status = 'verified') AS verifiedProfiles,",
            "(SELECT count(*) FROM lawyer_profiles WHERE directory_status = 'active') AS activeDirectoryProfiles,",
            "(SELECT count(*) FROM lawyer_verification_cases WHERE status = 'pending') AS pendingVerifications,",
            "(SELECT count(*) FROM lawyer_reviews WHERE status = 'published' AND deleted_at IS NULL) AS publishedReviews,",
            "(SELECT count(*) FROM lawyer_complaints WHERE status IN ('open', 'under_review')) AS openComplaints,",
            "(SELECT count(*) FROM lawyer_appeals WHERE status IN ('open', 'under_review')) AS openAppeals,",
            "(SELECT count(*) FROM lawyer_contact_events) AS contactClicks",
          ].join(" "),
        )
        .first(),
      this.policy,
    );
  }
}
