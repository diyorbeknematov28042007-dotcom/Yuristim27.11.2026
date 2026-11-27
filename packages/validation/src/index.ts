import { AppError } from "@yuristim/errors";
import type { ZodType } from "zod";

export const validateInput = <T>(schema: ZodType<T>, input: unknown): T => {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError("VALIDATION_ERROR", "Invalid request", {
      details: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
  return result.data;
};
