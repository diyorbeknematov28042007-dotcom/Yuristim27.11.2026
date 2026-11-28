import { successResponse } from "@yuristim/contracts";
import { AppError } from "@yuristim/errors";
import { requireAnyRole } from "@yuristim/security";
import { parseJsonBody, validateInput } from "@yuristim/validation";
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { z } from "zod";
import {
  adminRoleMiddleware,
  adminTotpMiddleware,
  csrfMiddleware,
  sessionAuthenticationMiddleware,
} from "../middleware/authentication";
import { lawyerRepositoryFor } from "../services/lawyer";
import type { AppBindings } from "../types";

const requireRoles = (roles: readonly string[]): MiddlewareHandler<AppBindings> =>
  async (context, next) => {
    const principal = context.get("principal");
    if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
    requireAnyRole(principal, roles);
    await next();
  };

const actorId = (context: {
  get(name: "principal"): { accountId: string } | undefined;
}): string => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  return principal.accountId;
};

export const adminLawyerRoutes = new Hono<AppBindings>();
adminLawyerRoutes.use("*", sessionAuthenticationMiddleware);
adminLawyerRoutes.use("*", csrfMiddleware);
adminLawyerRoutes.use("*", adminRoleMiddleware);
adminLawyerRoutes.use("*", adminTotpMiddleware);

adminLawyerRoutes.get(
  "/verifications",
  requireRoles(["owner", "super_admin", "admin"]),
  async (context) =>
    context.json(
      successResponse(
        { cases: await lawyerRepositoryFor(context).verificationQueue() },
        context.get("requestId"),
      ),
    ),
);

adminLawyerRoutes.post(
  "/verifications/:caseId/decision",
  requireRoles(["owner", "super_admin", "admin"]),
  async (context) => {
    const input = validateInput(
      z.object({
        decision: z.enum(["approved", "rejected"]),
        reasonCode: z.string().trim().min(2).max(64).nullable().default(null),
        note: z.string().trim().max(2000).nullable().default(null),
      }).superRefine((value, issue) => {
        if (value.decision === "rejected" && value.reasonCode === null) {
          issue.addIssue({
            code: "custom",
            path: ["reasonCode"],
            message: "Rejection reason is required",
          });
        }
      }),
      await parseJsonBody(context.req.raw),
    );
    await lawyerRepositoryFor(context).decideVerification({
      caseId: context.req.param("caseId"),
      actorAccountId: actorId(context),
      ...input,
      actionId: crypto.randomUUID(),
      now: new Date().toISOString(),
    });
    return context.json(successResponse({ decided: true }, context.get("requestId")));
  },
);

adminLawyerRoutes.get(
  "/complaints",
  requireRoles(["owner", "super_admin", "admin", "moderator"]),
  async (context) =>
    context.json(
      successResponse(
        { complaints: await lawyerRepositoryFor(context).complaints() },
        context.get("requestId"),
      ),
    ),
);

adminLawyerRoutes.get(
  "/appeals",
  requireRoles(["owner", "super_admin", "admin", "moderator"]),
  async (context) =>
    context.json(
      successResponse(
        { appeals: await lawyerRepositoryFor(context).appeals() },
        context.get("requestId"),
      ),
    ),
);

adminLawyerRoutes.post(
  "/moderation/actions",
  requireRoles(["owner", "super_admin", "admin", "moderator"]),
  async (context) => {
    const input = validateInput(
      z.object({
        profileId: z.string().uuid(),
        complaintId: z.string().uuid().nullable().default(null),
        reviewId: z.string().uuid().nullable().default(null),
        action: z.enum([
          "warning",
          "restrict",
          "block",
          "unblock",
          "revoke_verification",
          "hide_review",
          "restore_review",
        ]),
        reasonCode: z.string().trim().min(2).max(64),
        note: z.string().trim().max(2000).nullable().default(null),
        complaintDecision: z.enum(["upheld", "rejected"]).nullable().default(null),
      }),
      await parseJsonBody(context.req.raw),
    );
    await lawyerRepositoryFor(context).moderate({
      actionId: crypto.randomUUID(),
      actorAccountId: actorId(context),
      ...input,
      now: new Date().toISOString(),
    });
    return context.json(successResponse({ recorded: true }, context.get("requestId")), 201);
  },
);

adminLawyerRoutes.post(
  "/appeals/:appealId/decision",
  requireRoles(["owner", "super_admin", "admin"]),
  async (context) => {
    const input = validateInput(
      z.object({
        decision: z.enum(["upheld", "rejected"]),
        note: z.string().trim().min(3).max(2000),
      }),
      await parseJsonBody(context.req.raw),
    );
    await lawyerRepositoryFor(context).decideAppeal({
      appealId: context.req.param("appealId"),
      actorAccountId: actorId(context),
      ...input,
      now: new Date().toISOString(),
    });
    return context.json(successResponse({ decided: true }, context.get("requestId")));
  },
);

adminLawyerRoutes.get(
  "/statistics",
  requireRoles(["owner", "super_admin", "admin", "moderator", "support"]),
  async (context) =>
    context.json(
      successResponse(
        { statistics: await lawyerRepositoryFor(context).adminStatistics() },
        context.get("requestId"),
      ),
    ),
);
