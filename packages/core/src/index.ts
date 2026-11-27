export const moduleNames = [
  "account",
  "auth",
  "ai",
  "research",
  "lawyer",
  "interactive",
  "financial",
  "knowledge",
  "document",
  "storage",
  "notification",
  "support",
  "admin",
  "analytics",
  "security",
  "job",
] as const;

export type ModuleName = (typeof moduleNames)[number];

export const moduleDependencies: Readonly<Record<ModuleName, readonly ModuleName[]>> = {
  security: [],
  account: ["security"],
  auth: ["security", "account"],
  knowledge: ["security"],
  storage: ["security"],
  document: ["security", "storage"],
  job: ["security"],
  financial: ["security", "account"],
  lawyer: ["account", "document"],
  interactive: ["knowledge"],
  ai: ["auth", "financial", "knowledge", "document"],
  research: ["auth", "financial", "knowledge", "document", "job"],
  notification: ["account", "job"],
  support: ["account", "notification"],
  analytics: ["security"],
  admin: ["auth", "security", "analytics"],
};

export const assertAcyclicModuleGraph = (): void => {
  const visiting = new Set<ModuleName>();
  const visited = new Set<ModuleName>();

  const visit = (name: ModuleName): void => {
    if (visiting.has(name)) throw new Error(`Circular module dependency at ${name}`);
    if (visited.has(name)) return;
    visiting.add(name);
    for (const dependency of moduleDependencies[name]) visit(dependency);
    visiting.delete(name);
    visited.add(name);
  };

  for (const name of moduleNames) visit(name);
};
