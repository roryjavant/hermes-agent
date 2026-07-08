import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bot,
  CircuitBoard,
  ExternalLink,
  Home,
  Loader2,
  MessageSquare,
  Network,
  Play,
  Rocket,
  Search,
  Square,
} from "lucide-react";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
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
    fallbackUrl: "http://127.0.0.1:3010",
    accent: "from-[#130905]/95 via-[#060606]/96 to-[#010101] text-orange-100 border-primary/25",
    icon: Network,
    stats: ["Next dev", "localhost:3010", "JR app"],
  },
  {
    id: "agent-arena",
    title: "Agent Arena",
    kicker: "Live viewer",
    description: "Start the Agent Arena live poker viewer and open it on localhost.",
    launchLabel: "Start arena",
    fallbackUrl: "http://127.0.0.1:8787",
    accent: "from-[#130905]/95 via-[#060606]/96 to-[#010101] text-orange-100 border-primary/25",
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
    accent: "from-[#1a0803]/95 via-[#080504]/96 to-[#010101] text-[#ff7a3d] border-primary/35",
    icon: CircuitBoard,
    stats: ["Vite dev", "localhost:5177", "This repo"],
  },
  {
    id: "open-webui",
    title: "Open WebUI",
    kicker: "Chat UI",
    description: "Open the local Open WebUI chat surface connected to Hermes Agent.",
    launchLabel: "Start WebUI",
    fallbackUrl: "http://127.0.0.1:3000",
    accent: "from-[#130905]/95 via-[#060606]/96 to-[#010101] text-orange-100 border-primary/25",
    icon: MessageSquare,
    stats: ["Docker UI", "localhost:3000", "Hermes chat"],
  },
  {
    id: "osint-lab",
    title: "OSINT Lab",
    kicker: "Footprint lab",
    description: "Start the defensive OSINT lab UI for local digital-footprint checks.",
    launchLabel: "Start lab",
    fallbackUrl: "http://127.0.0.1:5178",
    accent: "from-[#130905]/95 via-[#060606]/96 to-[#010101] text-orange-100 border-primary/25",
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
    accent: "from-[#130905]/95 via-[#060606]/96 to-[#010101] text-orange-100 border-primary/25",
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
    <Card className="group relative flex min-h-[20rem] overflow-hidden border-white/10 bg-[#050505]/92 shadow-none transition-colors duration-150 hover:border-primary/35">
      <CardContent className="relative flex h-full flex-col p-0">
        <button
          type="button"
          onClick={() => onLaunch(project)}
          disabled={launching || !installed}
          className="flex h-full min-h-[20rem] w-full flex-col items-stretch text-left disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/80"
          aria-label={`${project.launchLabel}: ${project.title}`}
        >
          <div className={cn("relative h-[6.75rem] overflow-hidden border-b border-white/10 bg-gradient-to-br p-4", project.accent)}>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#050505] to-transparent" />
            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-3 max-w-full truncate font-mono text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-orange-100/55">
                  {project.kicker}
                </div>
                <h2 className="min-h-[3.05rem] font-expanded text-xl font-black uppercase leading-[1.08] tracking-[0.08em] text-orange-50">
                  {project.title}
                </h2>
              </div>
              <span className="grid size-10 shrink-0 place-items-center rounded-md border border-white/10 bg-black/35 text-primary/85 shadow-none">
                {launching ? <Loader2 className="size-5 animate-spin" /> : <Icon className="size-5" />}
              </span>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-4 p-4">
            <p className="min-h-[3.25rem] text-sm leading-6 text-text-secondary">{project.description}</p>
            <div className="min-w-0 truncate font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary/85">
              {project.stats.join(" · ")}
            </div>
            <div className="rounded-md border border-white/10 bg-black/25 px-3 py-2 font-mono text-xs text-text-tertiary">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <span className="min-w-0 truncate">{url.replace("http://", "")}</span>
                <span className={cn("shrink-0 text-[10px] font-bold uppercase tracking-[0.16em]", running ? "text-success" : installed ? "text-primary" : "text-destructive")}>
                  {running ? "running" : installed ? "ready" : "missing"}
                </span>
              </div>
              {error ? <div className="mt-1 line-clamp-2 text-destructive">{error}</div> : null}
            </div>
            <div className="mt-auto flex items-center justify-between border-t border-white/10 pb-1 pr-12 pt-4 text-sm font-bold text-midground">
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
            "absolute bottom-3 right-4 z-20 grid size-8 place-items-center rounded-full border shadow-none backdrop-blur transition-colors disabled:cursor-wait disabled:opacity-70",
            running
              ? "border-destructive/45 bg-destructive/15 text-destructive hover:border-destructive/70 hover:bg-destructive/20"
              : "border-success/35 bg-success/15 text-success hover:border-success/65 hover:bg-success/20",
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
    <div className="launchpad-mission-control min-h-full w-full p-4 lg:p-6">
      {errors.__load ? (
        <div className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Could not load project status: {errors.__load}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-label="Mission Control Launchpad">
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

    </div>
  );
}
