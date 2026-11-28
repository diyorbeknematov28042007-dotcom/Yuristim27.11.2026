import { AppError } from "@yuristim/errors";
import { asArrayBuffer, constantTimeEqual, fromBase64Url, toBase64Url, utf8 } from "./crypto";

type TelegramOidcClaims = {
  iss?: unknown;
  aud?: unknown;
  sub?: unknown;
  id?: unknown;
  iat?: unknown;
  exp?: unknown;
  nonce?: unknown;
  name?: unknown;
  preferred_username?: unknown;
};

type TelegramJsonWebKey = JsonWebKey & { kid?: string };
type JsonWebKeySet = { keys?: TelegramJsonWebKey[] };

export type VerifiedTelegramOidcIdentity = {
  telegramUserId: string;
  displayName?: string;
  username?: string;
  replayKey: string;
};

const decodeJwtPart = <T>(value: string): T => {
  try {
    return JSON.parse(new TextDecoder().decode(fromBase64Url(value))) as T;
  } catch (cause) {
    throw new AppError("UNAUTHORIZED", "Invalid Telegram ID token", { cause });
  }
};

export const verifyTelegramOidcIdToken = async (input: {
  idToken: string;
  jwks: JsonWebKeySet;
  clientId: string;
  nonce: string;
  now: Date;
}): Promise<VerifiedTelegramOidcIdentity> => {
  const parts = input.idToken.split(".");
  if (parts.length !== 3) throw new AppError("UNAUTHORIZED", "Invalid Telegram ID token");
  const [encodedHeader, encodedPayload, encodedSignature] = parts as [string, string, string];
  const header = decodeJwtPart<{ alg?: unknown; kid?: unknown }>(encodedHeader);
  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new AppError("UNAUTHORIZED", "Unsupported Telegram ID token algorithm");
  }
  const key = input.jwks.keys?.find((candidate) => candidate.kid === header.kid);
  if (key === undefined || key.kty !== "RSA") {
    throw new AppError("UNAUTHORIZED", "Telegram signing key was not found");
  }
  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    key,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const validSignature = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    asArrayBuffer(fromBase64Url(encodedSignature)),
    asArrayBuffer(utf8(`${encodedHeader}.${encodedPayload}`)),
  );
  if (!validSignature) throw new AppError("UNAUTHORIZED", "Invalid Telegram ID token signature");

  const claims = decodeJwtPart<TelegramOidcClaims>(encodedPayload);
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const nowSeconds = Math.floor(input.now.getTime() / 1_000);
  if (
    claims.iss !== "https://oauth.telegram.org" ||
    !audience.includes(input.clientId) ||
    typeof claims.exp !== "number" ||
    claims.exp < nowSeconds ||
    typeof claims.iat !== "number" ||
    claims.iat > nowSeconds + 30 ||
    claims.nonce !== input.nonce
  ) {
    throw new AppError("UNAUTHORIZED", "Invalid Telegram ID token claims");
  }
  const identity = typeof claims.id === "number" ? String(claims.id) : claims.sub;
  if (
    typeof identity !== "string" ||
    !/^[1-9]\d{0,15}$/u.test(identity) ||
    !Number.isSafeInteger(Number(identity))
  ) {
    throw new AppError("UNAUTHORIZED", "Invalid Telegram identity");
  }
  return {
    telegramUserId: identity,
    ...(typeof claims.name === "string" ? { displayName: claims.name.slice(0, 128) } : {}),
    ...(typeof claims.preferred_username === "string"
      ? { username: claims.preferred_username.slice(0, 64) }
      : {}),
    replayKey: input.idToken,
  };
};

export const createTelegramOidcAuthorizationUrl = (input: {
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}): string => {
  const url = new URL("https://oauth.telegram.org/auth");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid profile");
  url.searchParams.set("state", input.state);
  url.searchParams.set("nonce", input.nonce);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
};

export const exchangeTelegramOidcCode = async (input: {
  code: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<string> => {
  const fetchImpl = input.fetchImpl ?? fetch;
  const basic = btoa(`${input.clientId}:${input.clientSecret}`);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: input.clientId,
    code_verifier: input.codeVerifier,
  });
  const response = await fetchImpl("https://oauth.telegram.org/token", {
    method: "POST",
    headers: {
      authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!response.ok) throw new AppError("UNAUTHORIZED", "Telegram authorization failed");
  const payload: unknown = await response.json();
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("id_token" in payload) ||
    typeof payload.id_token !== "string"
  ) {
    throw new AppError("UNAUTHORIZED", "Telegram ID token is missing");
  }
  return payload.id_token;
};

export const fetchTelegramJwks = async (
  fetchImpl: typeof fetch = fetch,
): Promise<JsonWebKeySet> => {
  const response = await fetchImpl("https://oauth.telegram.org/.well-known/jwks.json", {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new AppError("SERVICE_UNAVAILABLE", "Telegram keys unavailable");
  const payload: unknown = await response.json();
  if (typeof payload !== "object" || payload === null || !("keys" in payload)) {
    throw new AppError("SERVICE_UNAVAILABLE", "Telegram keys are invalid");
  }
  const keys = payload.keys;
  if (!Array.isArray(keys)) {
    throw new AppError("SERVICE_UNAVAILABLE", "Telegram keys are invalid");
  }
  return { keys: keys as TelegramJsonWebKey[] };
};

export const verifyStatePair = (cookieState: string, requestState: string): void => {
  if (!constantTimeEqual(utf8(cookieState), utf8(requestState))) {
    throw new AppError("FORBIDDEN", "Login state validation failed");
  }
};

export const createPkceChallenge = async (verifier: string): Promise<string> =>
  toBase64Url(await crypto.subtle.digest("SHA-256", asArrayBuffer(utf8(verifier))));
