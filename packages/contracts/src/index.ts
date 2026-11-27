export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta: { requestId: string };
};

export type ApiFailure = {
  success: false;
  error: { code: string; message: string; details?: unknown };
  meta: { requestId: string };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type ServiceAvailability = "available" | "coming_soon" | "disabled";

export type ServiceStatus = {
  id: string;
  name: string;
  status: ServiceAvailability;
};

export const successResponse = <T>(data: T, requestId: string): ApiSuccess<T> => ({
  success: true,
  data,
  meta: { requestId },
});

export const errorResponse = (
  code: string,
  message: string,
  requestId: string,
  details?: unknown,
): ApiFailure => ({
  success: false,
  error: details === undefined ? { code, message } : { code, message, details },
  meta: { requestId },
});
