import { requireAuthentication, type AuthenticationPort } from "@yuristim/security";
import type { MiddlewareHandler } from "hono";
import type { AppBindings } from "../types";

const unavailableAuthentication: AuthenticationPort = {
  authenticate: () => Promise.resolve(null),
};

export const defaultDenyAuthenticationMiddleware: MiddlewareHandler<AppBindings> = async (
  context,
  next,
) => {
  const principal = requireAuthentication(
    await unavailableAuthentication.authenticate(context.req.raw),
  );
  void principal;
  await next();
};
