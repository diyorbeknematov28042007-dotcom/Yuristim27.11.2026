import type { RuntimeConfig } from "@yuristim/config";

export type GatewayVariables = {
  requestId: string;
  startedAt: number;
  config?: RuntimeConfig;
};

export type AppBindings = {
  Bindings: Env;
  Variables: GatewayVariables;
};
