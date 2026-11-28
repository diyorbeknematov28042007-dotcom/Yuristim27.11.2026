import { featureFlagKeys } from "@yuristim/config";
import { successResponse } from "@yuristim/contracts";
import { AppError } from "@yuristim/errors";
import {
  isCriticalProfileChange,
  normalizeDirectoryQuery,
  recommendationProviderState,
  recommendedSpecializations,
  specializationCodes,
  verificationDocumentStorageState,
  type SupportedLocale,
} from "@yuristim/lawyer";
import { sha256Hex } from "@yuristim/security";
import { parseJsonBody, validateInput } from "@yuristim/validation";
import { Hono } from "hono";
import { z } from "zod";
import {
  activeAccountMiddleware,
  csrfMiddleware,
  sessionAuthenticationMiddleware,
} from "../middleware/authentication";
import {
  enforceLawyerFeature,
  enforceLawyerRateLimit,
  lawyerRepositoryFor,
  profileSlug,
  type LawyerProfileInput,
} from "../services/lawyer";
import type { AppBindings } from "../types";

void featureFlagKeys;

const localeSchema = z.enum(["uz", "ru", "en"]);
const specializationSchema = z.enum(specializationCodes);
const stringList = z.array(z.string().trim().min(1).max(300)).max(20);
const profileSchema = z
  .object({
    professionalType: z.enum(["lawyer", "advocate"]),
    fullName: z.string().trim().min(2).max(128),
    professionalStatus: z.string().trim().min(2).max(128),
    experienceYears: z.number().int().min(0).max(80),
    regionCode: z.string().trim().min(2).max(64),
    bioUz: z.string().trim().max(4000).default(""),
    bioRu: z.string().trim().max(4000).default(""),
    bioEn: z.string().trim().max(4000).default(""),
    phone: z.string().trim().min(7).max(32).nullable(),
    telegramUsername: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_]{1,64}$/u)
      .nullable(),
    contactVisible: z.boolean().default(true),
    remoteAvailable: z.boolean().default(false),
    officeAddress: z.string().trim().max(500).nullable(),
    priceNote: z.string().trim().max(500).nullable(),
    education: stringList,
    services: stringList,
    certificates: stringList,
    licenseNumber: z.string().trim().max(128).nullable(),
    licenseIssuer: z.string().trim().max(256).nullable(),
    specializations: z.array(specializationSchema).min(1).max(10),
    primarySpecialization: specializationSchema,
    languages: z.array(localeSchema).min(1).max(3),
  })
  .superRefine((value, context) => {
    if (new Set(value.specializations).size !== value.specializations.length) {
      context.addIssue({ code: "custom", path: ["specializations"], message: "Duplicate specialization" });
    }
    if (!value.specializations.includes(value.primarySpecialization)) {
      context.addIssue({
        code: "custom",
        path: ["primarySpecialization"],
        message: "Primary specialization must be selected",
      });
    }
    if (new Set(value.languages).size !== value.languages.length) {
      context.addIssue({ code: "custom", path: ["languages"], message: "Duplicate language" });
    }
    if (value.professionalType === "advocate" && value.licenseNumber === null) {
      context.addIssue({
        code: "custom",
        path: ["licenseNumber"],
        message: "Advocate license number is required",
      });
    }
  });

const directoryQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  specialization: specializationSchema.optional(),
  region: z.string().trim().min(2).max(64).optional(),
  language: localeSchema.optional(),
  minRating: z.coerce.number().min(1).max(5).optional(),
  remote: z.enum(["true", "false"]).optional(),
  sort: z.enum(["relevance", "rating", "experience"]).default("relevance"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
  locale: localeSchema.default("uz"),
});

const accountId = (context: {
  get(name: "principal"): { accountId: string } | undefined;
}): string => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  return principal.accountId;
};

const directoryInput = (query: z.infer<typeof directoryQuerySchema>) => ({
  ...(query.q === undefined ? {} : { query: normalizeDirectoryQuery(query.q) }),
  ...(query.specialization === undefined ? {} : { specialization: query.specialization }),
  ...(query.region === undefined ? {} : { regionCode: query.region }),
  ...(query.language === undefined ? {} : { language: query.language }),
  ...(query.minRating === undefined ? {} : { minimumRating: query.minRating }),
  ...(query.remote === undefined ? {} : { remoteAvailable: query.remote === "true" }),
  sort: query.sort,
  limit: query.limit,
  offset: query.offset,
});

const toProfileInput = (
  value: z.infer<typeof profileSchema>,
  publicSlug: string,
): LawyerProfileInput => ({ publicSlug, ...value });

export const lawyerRoutes = new Hono<AppBindings>();

lawyerRoutes.get("/specializations", async (context) => {
  await enforceLawyerFeature(context, "lawyer_directory");
  const locale = validateInput(
    z.object({ locale: localeSchema.default("uz") }),
    context.req.query(),
  ).locale;
  return context.json(
    successResponse(
      { specializations: await lawyerRepositoryFor(context).specializations(locale) },
      context.get("requestId"),
    ),
  );
});

lawyerRoutes.use("*", sessionAuthenticationMiddleware);
lawyerRoutes.use("*", csrfMiddleware);
lawyerRoutes.use("*", activeAccountMiddleware);

lawyerRoutes.get("/directory", async (context) => {
  await enforceLawyerFeature(context, "lawyer_directory");
  await enforceLawyerRateLimit(context, "directory", 60);
  const query = validateInput(directoryQuerySchema, context.req.query());
  const profiles = await lawyerRepositoryFor(context).directory(
    directoryInput(query),
    query.locale,
  );
  return context.json(
    successResponse(
      { profiles, pagination: { limit: query.limit, offset: query.offset } },
      context.get("requestId"),
    ),
  );
});

lawyerRoutes.get("/directory/:profileId", async (context) => {
  await enforceLawyerFeature(context, "lawyer_directory");
  const locale = validateInput(
    z.object({ locale: localeSchema.default("uz") }),
    context.req.query(),
  ).locale;
  return context.json(
    successResponse(
      await lawyerRepositoryFor(context).publicProfile(context.req.param("profileId"), locale),
      context.get("requestId"),
    ),
  );
});

lawyerRoutes.post("/directory/:profileId/view", async (context) => {
  await enforceLawyerFeature(context, "lawyer_directory");
  await enforceLawyerRateLimit(context, "views", 120);
  await lawyerRepositoryFor(context).recordView({
    id: crypto.randomUUID(),
    profileId: context.req.param("profileId"),
    accountId: accountId(context),
    requestId: context.get("requestId"),
    now: new Date().toISOString(),
  });
  return context.json(successResponse({ recorded: true }, context.get("requestId")), 201);
});

lawyerRoutes.post("/recommendations", async (context) => {
  await enforceLawyerFeature(context, "lawyer_recommendations");
  await enforceLawyerRateLimit(context, "recommendations", 20);
  const input = validateInput(
    z.object({
      issue: z.string().trim().min(10).max(2000),
      locale: localeSchema.default("uz"),
      region: z.string().trim().min(2).max(64).optional(),
      language: localeSchema.optional(),
      remote: z.boolean().optional(),
      limit: z.number().int().min(1).max(10).default(5),
    }),
    await parseJsonBody(context.req.raw),
  );
  const matchedSpecializations = recommendedSpecializations(input.issue);
  const profiles = await lawyerRepositoryFor(context).recommend(
    matchedSpecializations,
    {
      ...(input.region === undefined ? {} : { regionCode: input.region }),
      ...(input.language === undefined ? {} : { language: input.language }),
      ...(input.remote === undefined ? {} : { remoteAvailable: input.remote }),
      limit: input.limit,
      offset: 0,
    },
    input.locale,
  );
  return context.json(
    successResponse(
      {
        profiles,
        matchedSpecializations,
        recommendation: recommendationProviderState,
        notice: "Recommendation is informational and contains only verified active directory profiles.",
      },
      context.get("requestId"),
    ),
  );
});

lawyerRoutes.post("/professional/registration", async (context) => {
  await enforceLawyerFeature(context, "public_lawyer_registration");
  await enforceLawyerRateLimit(context, "registration", 5);
  const value = validateInput(profileSchema, await parseJsonBody(context.req.raw));
  const id = crypto.randomUUID();
  await lawyerRepositoryFor(context).createProfile({
    id,
    accountId: accountId(context),
    profile: toProfileInput(value, profileSlug(value.fullName, id)),
    now: new Date().toISOString(),
  });
  return context.json(
    successResponse(await lawyerRepositoryFor(context).ownProfile(accountId(context)), context.get("requestId")),
    201,
  );
});

lawyerRoutes.get("/professional/profile", async (context) => {
  const profile = await lawyerRepositoryFor(context).ownProfile(accountId(context));
  if (profile === null) throw new AppError("NOT_FOUND", "Professional profile not found");
  return context.json(successResponse(profile, context.get("requestId")));
});

lawyerRoutes.patch("/professional/profile", async (context) => {
  const current = await lawyerRepositoryFor(context).ownProfile(accountId(context));
  if (current === null) throw new AppError("NOT_FOUND", "Professional profile not found");
  const value = validateInput(profileSchema, await parseJsonBody(context.req.raw));
  const next = toProfileInput(value, current.publicSlug);
  const criticalChange = isCriticalProfileChange(
    {
      professionalType: current.professionalType,
      fullName: current.fullName,
      professionalStatus: current.professionalStatus,
      regionCode: current.regionCode,
      licenseNumber: current.licenseNumber,
      licenseIssuer: current.licenseIssuer,
      specializations: current.specializations,
    },
    {
      professionalType: next.professionalType,
      fullName: next.fullName,
      professionalStatus: next.professionalStatus,
      regionCode: next.regionCode,
      licenseNumber: next.licenseNumber,
      licenseIssuer: next.licenseIssuer,
      specializations: next.specializations,
    },
  );
  await lawyerRepositoryFor(context).updateProfile({
    accountId: accountId(context),
    profile: next,
    criticalChange,
    now: new Date().toISOString(),
  });
  return context.json(
    successResponse(
      {
        profile: await lawyerRepositoryFor(context).ownProfile(accountId(context)),
        reverificationRequired: criticalChange && current.verificationStatus === "verified",
      },
      context.get("requestId"),
    ),
  );
});

lawyerRoutes.post("/professional/verification/submit", async (context) => {
  await enforceLawyerRateLimit(context, "verification", 5);
  const input = validateInput(
    z.object({ applicantNote: z.string().trim().max(2000).nullable().default(null) }),
    await parseJsonBody(context.req.raw),
  );
  const result = await lawyerRepositoryFor(context).submitVerification({
    accountId: accountId(context),
    caseId: crypto.randomUUID(),
    actionId: crypto.randomUUID(),
    applicantNote: input.applicantNote,
    now: new Date().toISOString(),
  });
  return context.json(successResponse(result, context.get("requestId")), 201);
});

lawyerRoutes.post("/professional/verification/documents", () => {
  throw new AppError("FEATURE_DISABLED", "Private verification document storage is unavailable", {
    details: verificationDocumentStorageState,
  });
});

lawyerRoutes.get("/professional/cabinet", async (context) =>
  context.json(
    successResponse(
      await lawyerRepositoryFor(context).cabinet(accountId(context)),
      context.get("requestId"),
    ),
  ),
);

lawyerRoutes.get("/favorites", async (context) => {
  const locale = validateInput(
    z.object({ locale: localeSchema.default("uz") }),
    context.req.query(),
  ).locale;
  return context.json(
    successResponse(
      { profiles: await lawyerRepositoryFor(context).favorites(accountId(context), locale) },
      context.get("requestId"),
    ),
  );
});

lawyerRoutes.put("/favorites/:profileId", async (context) => {
  await lawyerRepositoryFor(context).addFavorite(
    accountId(context),
    context.req.param("profileId"),
    new Date().toISOString(),
  );
  return context.json(successResponse({ favorite: true }, context.get("requestId")));
});

lawyerRoutes.delete("/favorites/:profileId", async (context) => {
  await lawyerRepositoryFor(context).removeFavorite(accountId(context), context.req.param("profileId"));
  return context.json(successResponse({ favorite: false }, context.get("requestId")));
});

lawyerRoutes.post("/directory/:profileId/contact", async (context) => {
  await enforceLawyerRateLimit(context, "contact", 30);
  const input = validateInput(
    z.object({ type: z.enum(["phone", "telegram"]) }),
    await parseJsonBody(context.req.raw),
  );
  const idempotencyKey = context.req.header("idempotency-key");
  if (idempotencyKey === undefined || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
    throw new AppError("VALIDATION_ERROR", "Valid Idempotency-Key is required");
  }
  const result = await lawyerRepositoryFor(context).recordContact({
    id: crypto.randomUUID(),
    accountId: accountId(context),
    profileId: context.req.param("profileId"),
    type: input.type,
    requestId: await sha256Hex(
      "lawyer-contact:" + accountId(context) + ":" + context.req.param("profileId") + ":" + idempotencyKey,
    ),
    now: new Date().toISOString(),
  });
  return context.json(
    successResponse(
      {
        ...result,
        notice: "Contact click is an engagement event and does not prove that a service was provided.",
      },
      context.get("requestId"),
    ),
    201,
  );
});

lawyerRoutes.get("/directory/:profileId/reviews", async (context) =>
  context.json(
    successResponse(
      { reviews: await lawyerRepositoryFor(context).reviews(context.req.param("profileId")) },
      context.get("requestId"),
    ),
  ),
);

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().max(3000).nullable().default(null),
  anonymous: z.boolean().default(false),
});

lawyerRoutes.post("/directory/:profileId/reviews", async (context) => {
  await enforceLawyerRateLimit(context, "reviews", 10);
  const input = validateInput(reviewSchema, await parseJsonBody(context.req.raw));
  await lawyerRepositoryFor(context).createReview({
    id: crypto.randomUUID(),
    historyId: crypto.randomUUID(),
    accountId: accountId(context),
    profileId: context.req.param("profileId"),
    rating: input.rating,
    body: input.body,
    anonymous: input.anonymous,
    bodyHash: input.body === null ? null : await sha256Hex(input.body),
    now: new Date().toISOString(),
  });
  return context.json(successResponse({ created: true }, context.get("requestId")), 201);
});

lawyerRoutes.patch("/reviews/:reviewId", async (context) => {
  const input = validateInput(reviewSchema, await parseJsonBody(context.req.raw));
  await lawyerRepositoryFor(context).updateReview({
    reviewId: context.req.param("reviewId"),
    historyId: crypto.randomUUID(),
    accountId: accountId(context),
    rating: input.rating,
    body: input.body,
    anonymous: input.anonymous,
    bodyHash: input.body === null ? null : await sha256Hex(input.body),
    now: new Date().toISOString(),
  });
  return context.json(successResponse({ updated: true }, context.get("requestId")));
});

lawyerRoutes.delete("/reviews/:reviewId", async (context) => {
  await lawyerRepositoryFor(context).deleteReview({
    reviewId: context.req.param("reviewId"),
    historyId: crypto.randomUUID(),
    accountId: accountId(context),
    now: new Date().toISOString(),
  });
  return context.json(successResponse({ deleted: true }, context.get("requestId")));
});

lawyerRoutes.put("/reviews/:reviewId/reply", async (context) => {
  const input = validateInput(
    z.object({ body: z.string().trim().min(1).max(3000) }),
    await parseJsonBody(context.req.raw),
  );
  await lawyerRepositoryFor(context).replyToReview({
    reviewId: context.req.param("reviewId"),
    accountId: accountId(context),
    body: input.body,
    now: new Date().toISOString(),
  });
  return context.json(successResponse({ replied: true }, context.get("requestId")));
});

lawyerRoutes.post("/complaints", async (context) => {
  await enforceLawyerRateLimit(context, "complaints", 10);
  const input = validateInput(
    z.object({
      profileId: z.string().uuid(),
      reviewId: z.string().uuid().nullable().default(null),
      category: z.enum(["identity", "professional_info", "conduct", "review", "contact", "fraud", "other"]),
      description: z.string().trim().min(10).max(4000),
      evidenceNote: z.string().trim().max(2000).nullable().default(null),
    }),
    await parseJsonBody(context.req.raw),
  );
  const id = crypto.randomUUID();
  await lawyerRepositoryFor(context).createComplaint({
    id,
    accountId: accountId(context),
    ...input,
    now: new Date().toISOString(),
  });
  return context.json(successResponse({ complaintId: id, status: "open" }, context.get("requestId")), 201);
});

lawyerRoutes.post("/appeals", async (context) => {
  const input = validateInput(
    z.object({
      moderationActionId: z.string().uuid(),
      statement: z.string().trim().min(10).max(4000),
    }),
    await parseJsonBody(context.req.raw),
  );
  const id = crypto.randomUUID();
  await lawyerRepositoryFor(context).createAppeal({
    id,
    accountId: accountId(context),
    ...input,
    now: new Date().toISOString(),
  });
  return context.json(successResponse({ appealId: id, status: "open" }, context.get("requestId")), 201);
});
