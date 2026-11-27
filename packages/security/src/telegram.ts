import { AppError } from "@yuristim/errors";
import { constantTimeEqual, fromHex, hmac, sha256Hex, toHex } from "./crypto";

export type TelegramIdentity = {
  telegramUserId: string;
  username?: string;
  displayName?: string;
  languageCode?: string;
  authDate: Date;
  replayKey: string;
};

type TelegramUser = {
  id?: unknown;
  username?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  language_code?: unknown;
};

const parseTelegramUserId = (value: unknown): string => {
  const normalized = typeof value === "number" ? String(value) : value;
  if (typeof normalized !== "string" || !/^[1-9]\d{0,15}$/u.test(normalized)) {
    throw new AppError("UNAUTHORIZED", "Invalid Telegram identity");
  }
  const numeric = Number(normalized);
  if (!Number.isSafeInteger(numeric))
    throw new AppError("UNAUTHORIZED", "Invalid Telegram identity");
  return normalized;
};

const assertFreshAuthDate = (value: string | null, now: Date, maximumAgeSeconds: number): Date => {
  if (value === null || !/^\d{10}$/u.test(value)) {
    throw new AppError("UNAUTHORIZED", "Invalid Telegram authentication date");
  }
  const authDate = new Date(Number(value) * 1_000);
  const ageSeconds = (now.getTime() - authDate.getTime()) / 1_000;
  if (ageSeconds < -30 || ageSeconds > maximumAgeSeconds) {
    throw new AppError("UNAUTHORIZED", "Telegram authentication data is expired");
  }
  return authDate;
};

const uniqueParameters = (parameters: URLSearchParams): void => {
  const seen = new Set<string>();
  for (const [key] of parameters) {
    if (seen.has(key)) throw new AppError("UNAUTHORIZED", "Duplicate Telegram field");
    seen.add(key);
  }
};

const checkString = (parameters: URLSearchParams, excluded: ReadonlySet<string>): string =>
  [...parameters.entries()]
    .filter(([key]) => !excluded.has(key))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

export const verifyTelegramMiniAppInitData = async (input: {
  initData: string;
  botToken: string;
  now: Date;
  maximumAgeSeconds: number;
}): Promise<TelegramIdentity> => {
  if (input.botToken.length < 20)
    throw new AppError("SERVICE_UNAVAILABLE", "Telegram auth unavailable");
  const parameters = new URLSearchParams(input.initData);
  uniqueParameters(parameters);
  const suppliedHash = parameters.get("hash");
  if (suppliedHash === null || !/^[0-9a-f]{64}$/iu.test(suppliedHash)) {
    throw new AppError("UNAUTHORIZED", "Invalid Telegram signature");
  }
  const secretKey = new Uint8Array(await hmac("SHA-256", "WebAppData", input.botToken));
  const calculatedHash = new Uint8Array(
    await hmac("SHA-256", secretKey, checkString(parameters, new Set(["hash", "signature"]))),
  );
  if (!constantTimeEqual(calculatedHash, fromHex(suppliedHash))) {
    throw new AppError("UNAUTHORIZED", "Invalid Telegram signature");
  }

  const authDate = assertFreshAuthDate(
    parameters.get("auth_date"),
    input.now,
    input.maximumAgeSeconds,
  );
  const rawUser = parameters.get("user");
  if (rawUser === null) throw new AppError("UNAUTHORIZED", "Telegram user is missing");
  let user: TelegramUser;
  try {
    user = JSON.parse(rawUser) as TelegramUser;
  } catch (cause) {
    throw new AppError("UNAUTHORIZED", "Invalid Telegram user", { cause });
  }
  const names = [user.first_name, user.last_name].filter(
    (part): part is string => typeof part === "string" && part.length > 0,
  );
  return {
    telegramUserId: parseTelegramUserId(user.id),
    ...(typeof user.username === "string" ? { username: user.username.slice(0, 64) } : {}),
    ...(names.length > 0 ? { displayName: names.join(" ").slice(0, 128) } : {}),
    ...(typeof user.language_code === "string"
      ? { languageCode: user.language_code.slice(0, 16) }
      : {}),
    authDate,
    replayKey: await sha256Hex(input.initData),
  };
};

export const verifyBotAdapterSignature = async (input: {
  body: string;
  timestamp: string;
  signature: string;
  secret: string;
  now: Date;
  maximumAgeSeconds?: number;
}): Promise<string> => {
  if (!/^\d{10}$/u.test(input.timestamp) || !/^[0-9a-f]{64}$/iu.test(input.signature)) {
    throw new AppError("UNAUTHORIZED", "Invalid bot adapter signature");
  }
  const age = Math.abs(input.now.getTime() / 1_000 - Number(input.timestamp));
  if (age > (input.maximumAgeSeconds ?? 60)) {
    throw new AppError("UNAUTHORIZED", "Bot adapter request is expired");
  }
  const calculated = new Uint8Array(
    await hmac("SHA-256", input.secret, `${input.timestamp}.${input.body}`),
  );
  if (!constantTimeEqual(calculated, fromHex(input.signature))) {
    throw new AppError("UNAUTHORIZED", "Invalid bot adapter signature");
  }
  return sha256Hex(`${input.timestamp}.${input.signature}`);
};

export const signTelegramMiniAppTestData = async (
  parameters: URLSearchParams,
  botToken: string,
): Promise<string> => {
  const secretKey = new Uint8Array(await hmac("SHA-256", "WebAppData", botToken));
  const signature = await hmac(
    "SHA-256",
    secretKey,
    checkString(parameters, new Set(["hash", "signature"])),
  );
  parameters.set("hash", toHex(signature));
  return parameters.toString();
};
