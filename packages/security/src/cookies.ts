import { AppError } from "@yuristim/errors";
import { constantTimeEqual, fromHex, sha256Hex, utf8 } from "./crypto";

export const sessionCookieName = "__Host-yuristim_session";
export const csrfCookieName = "__Host-yuristim_csrf";
export const loginStateCookieName = "__Host-yuristim_login_state";

export const parseCookieHeader = (header: string | undefined): ReadonlyMap<string, string> => {
  const values = new Map<string, string>();
  for (const part of header?.split(";") ?? []) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!values.has(name)) values.set(name, value);
  }
  return values;
};

export const secureCookie = (
  name: string,
  value: string,
  options: { httpOnly: boolean; maxAgeSeconds: number; sameSite?: "Lax" | "Strict" },
): string =>
  [
    `${name}=${value}`,
    "Path=/",
    "Secure",
    options.httpOnly ? "HttpOnly" : "",
    `SameSite=${options.sameSite ?? "Lax"}`,
    `Max-Age=${options.maxAgeSeconds}`,
  ]
    .filter(Boolean)
    .join("; ");

export const clearCookie = (name: string, httpOnly: boolean): string =>
  secureCookie(name, "", { httpOnly, maxAgeSeconds: 0 });

export const enforceCsrf = async (input: {
  cookieToken: string | undefined;
  headerToken: string | undefined;
  expectedHash: string | null;
}): Promise<void> => {
  if (
    input.cookieToken === undefined ||
    input.headerToken === undefined ||
    input.expectedHash === null ||
    input.cookieToken.length < 20 ||
    input.headerToken.length < 20
  ) {
    throw new AppError("FORBIDDEN", "CSRF validation failed");
  }
  const cookieHash = await sha256Hex(input.cookieToken);
  const headerHash = await sha256Hex(input.headerToken);
  if (
    !constantTimeEqual(utf8(cookieHash), utf8(headerHash)) ||
    !constantTimeEqual(fromHex(cookieHash), fromHex(input.expectedHash))
  ) {
    throw new AppError("FORBIDDEN", "CSRF validation failed");
  }
};
