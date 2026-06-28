import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bot,
  CircuitBoard,
  ExternalLink,
  Home,
  Loader2,
  Network,
  Play,
  Rocket,
  Search,
  Sparkles,
  Square,
} from "lucide-react";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { api } from "@/lib/api";
import type { LaunchpadProjectStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

interface LaunchpadProject {
  id: string;
  title: string;
  kicker: string;
  description: string;
  launchLabel: string;
  fallbackUrl: string;
  accent: string;
  icon: typeof Rocket;
  stats: string[];
}

const PROJECTS: LaunchpadProject[] = [
  {
    id: "juror-research",
    title: "Juror Research",
    kicker: "JR app",
    description: "Start the Next.js Juror Research app locally and open its localhost UI.",
    launchLabel: "Start localhost",
    fallbackUrl: "http://127.0.0.1:3000",
    accent: "from-cyan-300/24 via-sky-400/14 to-blue-500/8 text-cyan-100 border-cyan-200/25",
    icon: Network,
    stats: ["Next dev", "localhost:3000", "JR app"],
  },
  {
    id: "agent-arena",
    title: "Agent Arena",
    kicker: "Live viewer",
    description: "Start the Agent Arena live poker viewer and open it on localhost.",
    launchLabel: "Start arena",
    fallbackUrl: "http://127.0.0.1:8787",
    accent: "from-fuchsia-300/22 via-purple-500/14 to-rose-500/8 text-fuchsia-100 border-fuchsia-200/25",
    icon: Bot,
    stats: ["Live HTML", "localhost:8787", "Poker viewer"],
  },
  {
    id: "hermes-team-ui",
    title: "Hermes Team UI",
    kicker: "Dashboard dev",
    description: "Start the Hermes dashboard web dev server for this checkout.",
    launchLabel: "Start UI dev",
    fallbackUrl: "http://127.0.0.1:5177/launchpad",
    accent: "from-amber-300/22 via-orange-400/14 to-yellow-500/8 text-amber-100 border-amber-200/25",
    icon: CircuitBoard,
    stats: ["Vite dev", "localhost:5177", "This repo"],
  },
  {
    id: "osint-lab",
    title: "OSINT Lab",
    kicker: "Footprint lab",
    description: "Start the defensive OSINT lab UI for local digital-footprint checks.",
    launchLabel: "Start lab",
    fallbackUrl: "http://127.0.0.1:5178",
    accent: "from-lime-300/20 via-emerald-400/14 to-slate-500/8 text-lime-100 border-lime-200/25",
    icon: Search,
    stats: ["Vite + API", "localhost:5178", "OSINT Lab"],
  },
  {
    id: "home-hub",
    title: "Home Hub",
    kicker: "House UI",
    description: "Start Rory Home Hub locally for household boards, devices, and photo frame work.",
    launchLabel: "Start hub",
    fallbackUrl: "http://127.0.0.1:4317",
    accent: "from-emerald-300/20 via-teal-400/14 to-cyan-500/8 text-emerald-100 border-emerald-200/25",
    icon: Home,
    stats: ["Node server", "localhost:4317", "House UI"],
  },
];

function ProjectSquare({
  project,
  status,
  launching,
  stopping,
  error,
  onLaunch,
  onStop,
}: {
  project: LaunchpadProject;
  status: LaunchpadProjectStatus | undefined;
  launching: boolean;
  stopping: boolean;
  error: string | undefined;
  onLaunch: (project: LaunchpadProject) => void;
  onStop: (project: LaunchpadProject) => void;
}) {
  const Icon = project.icon;
  const url = status?.url ?? project.fallbackUrl;
  const installed = status?.installed ?? true;
  const running = status?.running ?? false;

  return (
    <Card className="group relative flex min-h-[23rem] overflow-hidden border-current/15 bg-background-base/70 shadow-2xl shadow-black/20 transition-transform duration-150 hover:-translate-y-0.5 hover:border-current/25">
      <CardContent className="relative flex h-full flex-col p-0">
        <button
          type="button"
          onClick={() => onLaunch(project)}
          disabled={launching || !installed}
          className="flex h-full min-h-[23rem] w-full flex-col items-stretch text-left disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midground/70"
          aria-label={`${project.launchLabel}: ${project.title}`}
        >
          <div className={cn("relative h-[7.75rem] overflow-hidden border-b bg-gradient-to-br p-4", project.accent)}>
            <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-current/15 blur-2xl transition-transform duration-300 group-hover:scale-125" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Badge className="mb-3 max-w-full truncate bg-black/24 text-current">{project.kicker}</Badge>
                <h2 className="min-h-[3.35rem] font-expanded text-xl font-black uppercase leading-[1.1] tracking-[0.08em] text-current">
                  {project.title}
                </h2>
              </div>
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-current/25 bg-black/24 shadow-[0_0_28px_currentColor]">
                {launching ? <Loader2 className="size-6 animate-spin" /> : <Icon className="size-6" />}
              </span>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-4 p-4">
            <p className="min-h-[3.75rem] text-sm leading-6 text-text-secondary">{project.description}</p>
            <div className="flex flex-wrap gap-2">
              {project.stats.map((stat) => (
                <span key={stat} className="rounded-full border border-current/15 bg-black/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-text-tertiary">
                  {stat}
                </span>
              ))}
            </div>
            <div className="rounded-xl border border-current/10 bg-black/20 px-3 py-2 text-xs text-text-tertiary">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{url.replace("http://", "")}</span>
                <span className={cn("shrink-0 font-bold", running ? "text-success" : installed ? "text-warning" : "text-destructive")}>
                  {running ? "running" : installed ? "ready" : "missing"}
                </span>
              </div>
              {error ? <div className="mt-1 line-clamp-2 text-destructive">{error}</div> : null}
            </div>
            <div className="mt-auto flex items-center justify-between border-t border-current/10 pb-1 pr-12 pt-4 text-sm font-bold text-midground">
              <span>{launching ? "Starting…" : running ? "Open localhost" : project.launchLabel}</span>
              {running ? <ExternalLink className="size-4" /> : <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />}
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (running) {
              onStop(project);
            } else {
              onLaunch(project);
            }
          }}
          disabled={(running && stopping) || (!running && (launching || !installed))}
          className={cn(
            "absolute bottom-3 right-4 z-20 grid size-8 place-items-center rounded-full border shadow-lg backdrop-blur transition-colors disabled:cursor-wait disabled:opacity-70",
            running
              ? "border-rose-300/35 bg-rose-950/75 text-rose-100 shadow-rose-950/30 hover:border-rose-200/65 hover:bg-rose-500/25"
              : "border-success/35 bg-success/15 text-success shadow-success/15 hover:border-success/65 hover:bg-success/25",
          )}
          aria-label={running ? `Stop ${project.title}` : `Play ${project.title}`}
          title={running ? `Stop ${project.title}` : `Play ${project.title}`}
        >
          {running && stopping ? (
            <Loader2 className="size-4 animate-spin" />
          ) : !running && launching ? (
            <Loader2 className="size-4 animate-spin" />
          ) : running ? (
            <Square className="size-3.5 fill-current" />
          ) : (
            <Play className="ml-0.5 size-4 fill-current" />
          )}
        </button>
      </CardContent>
    </Card>
  );
}

export default function LaunchpadPage() {
  const featured = useMemo(() => PROJECTS, []);
  const [statuses, setStatuses] = useState<Record<string, LaunchpadProjectStatus>>({});
  const [launching, setLaunching] = useState<Record<string, boolean>>({});
  const [stopping, setStopping] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const refreshStatuses = async () => {
    const response = await api.getLaunchpadProjects();
    setStatuses(Object.fromEntries(response.projects.map((project) => [project.id, project])));
  };

  useEffect(() => {
    void refreshStatuses().catch((error) => {
      setErrors((current) => ({ ...current, __load: String(error) }));
    });
  }, []);

  const handleLaunch = async (project: LaunchpadProject) => {
    setLaunching((current) => ({ ...current, [project.id]: true }));
    setErrors((current) => ({ ...current, [project.id]: "" }));
    try {
      const result = await api.launchProject(project.id);
      await refreshStatuses().catch(() => undefined);
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setErrors((current) => ({ ...current, [project.id]: error instanceof Error ? error.message : String(error) }));
    } finally {
      setLaunching((current) => ({ ...current, [project.id]: false }));
    }
  };

  const handleStop = async (project: LaunchpadProject) => {
    setStopping((current) => ({ ...current, [project.id]: true }));
    setErrors((current) => ({ ...current, [project.id]: "" }));
    try {
      await api.stopProject(project.id);
      await refreshStatuses().catch(() => undefined);
    } catch (error) {
      setErrors((current) => ({ ...current, [project.id]: error instanceof Error ? error.message : String(error) }));
    } finally {
      setStopping((current) => ({ ...current, [project.id]: false }));
    }
  };

  return (
    <div className="min-h-full w-full p-4 lg:p-6">
      <div className="mb-5 overflow-hidden rounded-3xl border border-border/70 bg-card/72 p-5 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-current/15 bg-black/25 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-text-tertiary">
              <Rocket className="size-3.5 text-midground" />
              Project launchpad
            </div>
            <h1 className="font-expanded text-3xl font-black uppercase tracking-[0.08em] text-midground">
              Start local projects
            </h1>
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              Each square starts the project’s local dev server from its checkout and opens the localhost URL.
            </p>
          </div>
        </div>
        {errors.__load ? <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">Could not load project status: {errors.__load}</div> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
        {featured.map((project) => (
          <ProjectSquare
            key={project.id}
            project={project}
            status={statuses[project.id]}
            launching={Boolean(launching[project.id])}
            stopping={Boolean(stopping[project.id])}
            error={errors[project.id] || undefined}
            onLaunch={handleLaunch}
            onStop={handleStop}
          />
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-current/10 bg-background-base/55 p-4 text-sm text-text-secondary">
        <div className="mb-2 flex items-center gap-2 font-bold text-midground">
          <Sparkles className="size-4" />
          Launch behavior
        </div>
        Launchpad starts a fixed command for each known project, reuses an already-running localhost server when available,
        and writes output to the matching dashboard action log.
      </div>
    </div>
  );
}
