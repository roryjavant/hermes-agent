import type { Translations } from "@/i18n/types";

const BUILTIN: Record<string, keyof Translations["app"]["nav"]> = {
  "/chat": "chat",
  "/launchpad": "launchpad",
  "/marketing": "marketing",
  "/research": "research",
  "/mission-control": "missionControl",
  "/sessions": "sessions",
  "/analytics": "analytics",
  "/models": "models",
  "/logs": "logs",
  "/cron": "cron",
  "/skills": "skills",
  "/plugins": "plugins",
  "/profiles": "profiles",
  "/repos": "repos",
  "/team": "team",
  "/team/present": "team",
  "/config": "config",
  "/env": "keys",
  "/docs": "documentation",
};

const EXTRA_BUILTIN_LABELS: Record<string, string> = {
  "/flow": "Juror Research Flow",
  "/juror-research-map": "Juror Research Map",
};

const BUILTIN_LABELS: Required<Translations["app"]["nav"]> = {
  analytics: "Analytics",
  chat: "Chat",
  config: "Config",
  cron: "Cron",
  documentation: "Documentation",
  keys: "Keys",
  launchpad: "Launchpad",
  logs: "Logs",
  marketing: "Marketing",
  missionControl: "Mission Control",
  models: "Models",
  profiles: "Profiles",
  plugins: "Plugins",
  research: "Research",
  repos: "Repos",
  sessions: "Sessions",
  skills: "Skills",
  team: "Team",
};

export function resolvePageTitle(
  pathname: string,
  t: Translations,
  pluginTabs: { path: string; label: string }[],
): string {
  const normalized = pathname.replace(/\/$/, "") || "/";
  if (normalized === "/") {
    return t.app.nav.sessions;
  }
  const plugin = pluginTabs.find((p) => p.path === normalized);
  if (plugin) {
    return plugin.label;
  }
  const extraLabel = EXTRA_BUILTIN_LABELS[normalized];
  if (extraLabel) {
    return extraLabel;
  }
  const key = BUILTIN[normalized];
  if (key) {
    return t.app.nav[key] ?? BUILTIN_LABELS[key];
  }
  // Derive title from pathname: "/profiles" → "Profiles"
  const segment = normalized.slice(1);
  if (segment) {
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  }
  return t.app.webUi;
}
