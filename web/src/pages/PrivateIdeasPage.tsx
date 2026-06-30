import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Brain,
  KeyRound,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { api } from "@/lib/api";
import type { PrivateIdeaItem } from "@/lib/api";
import { cn } from "@/lib/utils";

interface IdeaFormState {
  title: string;
  body: string;
}

const EMPTY_FORM: IdeaFormState = { title: "", body: "" };
const INACTIVITY_MS = 60_000;

type AuthStage = "password" | "pin" | "unlocked";

function updatedLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function SummaryPill({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background-base/45 px-4 py-3">
      <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-mono-ui text-2xl", tone)}>{value}</div>
    </div>
  );
}

function AuthPanel({
  stage,
  password,
  pin,
  error,
  loading,
  setupRequired,
  onPassword,
  onPin,
  onSubmitPassword,
  onUnlock,
}: {
  stage: AuthStage;
  password: string;
  pin: string;
  error: string | null;
  loading: boolean;
  setupRequired: boolean;
  onPassword: (value: string) => void;
  onPin: (value: string) => void;
  onSubmitPassword: () => void;
  onUnlock: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 sm:p-6">
      <section className="overflow-hidden rounded-[2rem] border border-border/70 bg-card/80 shadow-2xl shadow-black/20">
        <div className="relative p-5 sm:p-7">
          <div className="pointer-events-none absolute right-0 top-0 h-48 w-80 rounded-full bg-fuchsia-400/10 blur-3xl" />
          <Badge className="mb-3 border-fuchsia-300/30 bg-fuchsia-400/10 text-fuchsia-200">Rory vault</Badge>
          <h1 className="font-expanded text-3xl font-black uppercase tracking-[0.08em] text-foreground sm:text-4xl">RORY</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
            Unlock with your Rory password, then your PIN. The vault locks again after one minute with no activity.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-border/70 bg-background-base/35 p-5 shadow-2xl shadow-black/10">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-fuchsia-300/35 bg-fuchsia-400/10 text-fuchsia-100">
            {stage === "password" ? <Lock className="size-5" /> : <KeyRound className="size-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-expanded text-sm font-black uppercase tracking-[0.12em] text-foreground">
              {stage === "password" ? "Password required" : "PIN required"}
            </h2>
            <p className="mt-1 text-sm leading-5 text-text-secondary">
              {stage === "password" ? "First enter the vault password." : "Password accepted. Enter your PIN to open the ideas list."}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
          {stage === "password" ? (
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(event) => onPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onSubmitPassword();
              }}
              placeholder="Rory password"
              className="rounded-xl border border-border/70 bg-card/70 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-midground/70"
            />
          ) : (
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={(event) => onPin(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onUnlock();
              }}
              placeholder="PIN"
              className="rounded-xl border border-border/70 bg-card/70 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-midground/70"
            />
          )}
          <Button
            onClick={stage === "password" ? onSubmitPassword : onUnlock}
            disabled={loading || setupRequired}
            prefix={loading ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          >
            {stage === "password" ? "Continue" : "Unlock"}
          </Button>
        </div>

        {setupRequired ? (
          <div className="mt-4 rounded-2xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
            Set HERMES_PRIVATE_IDEAS_PASSWORD and HERMES_PRIVATE_IDEAS_PIN in this profile's .env, then restart the dashboard backend.
          </div>
        ) : null}
        {error ? <div className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
      </section>
    </main>
  );
}

function IdeaRow({
  idea,
  editing,
  editForm,
  busy,
  onEdit,
  onChangeEdit,
  onSave,
  onCancel,
  onDelete,
}: {
  idea: PrivateIdeaItem;
  editing: boolean;
  editForm: IdeaFormState;
  busy: boolean;
  onEdit: () => void;
  onChangeEdit: (next: IdeaFormState) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group grid gap-3 border-b border-border/50 bg-card/45 px-3 py-3 transition-colors hover:bg-card/75 md:grid-cols-[minmax(16rem,1.4fr)_minmax(14rem,1fr)_9rem] md:items-center md:px-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-fuchsia-300 shadow-[0_0_24px_rgba(240,171,252,0.55)]" />
        <span className="grid size-8 shrink-0 place-items-center rounded-xl border border-fuchsia-300/35 bg-fuchsia-400/10 text-fuchsia-100">
          <Brain className="size-4" />
        </span>
        {editing ? (
          <div className="grid min-w-0 flex-1 gap-2">
            <input
              value={editForm.title}
              onChange={(event) => onChangeEdit({ ...editForm, title: event.target.value })}
              className="rounded-xl border border-border/70 bg-background-base/70 px-3 py-2 text-sm text-foreground outline-none focus:border-midground/70"
              placeholder="Idea title"
            />
            <textarea
              value={editForm.body}
              onChange={(event) => onChangeEdit({ ...editForm, body: event.target.value })}
              className="min-h-24 rounded-xl border border-border/70 bg-background-base/70 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-midground/70"
              placeholder="Thoughts"
            />
          </div>
        ) : (
          <div className="min-w-0">
            <h2 className="truncate font-expanded text-sm font-black uppercase tracking-[0.08em] text-foreground">{idea.title}</h2>
            {idea.body ? <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-text-secondary">{idea.body}</p> : <p className="mt-1 text-sm text-muted-foreground">No thoughts yet</p>}
          </div>
        )}
      </div>

      <div className="min-w-0 text-xs text-muted-foreground">
        <p className="font-mono-ui uppercase tracking-[0.08em] text-muted-foreground">Updated</p>
        <p className="mt-0.5 text-text-secondary">{updatedLabel(idea.updated_at)}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        {editing ? (
          <>
            <button type="button" onClick={onSave} disabled={busy} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-success/40 bg-success/10 px-2 font-expanded text-[0.65rem] font-bold uppercase tracking-[0.14em] text-success transition-colors hover:bg-success/15 disabled:cursor-not-allowed disabled:opacity-40">
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Save
            </button>
            <button type="button" onClick={onCancel} disabled={busy} className="inline-flex h-8 items-center justify-center rounded-xl border border-border/70 bg-background-base/60 px-2 font-expanded text-[0.65rem] font-bold uppercase tracking-[0.14em] text-foreground transition-colors hover:border-midground/50 hover:bg-card disabled:cursor-not-allowed disabled:opacity-40">
              Cancel
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={onEdit} disabled={busy} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-border/70 bg-background-base/60 px-2 font-expanded text-[0.65rem] font-bold uppercase tracking-[0.14em] text-foreground transition-colors hover:border-midground/50 hover:bg-card disabled:cursor-not-allowed disabled:opacity-40">
              <Pencil className="size-3.5" />
              Edit
            </button>
            <button type="button" onClick={onDelete} disabled={busy} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 px-2 font-expanded text-[0.65rem] font-bold uppercase tracking-[0.14em] text-destructive transition-colors hover:bg-destructive/15 disabled:cursor-not-allowed disabled:opacity-40">
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function PrivateIdeasPage() {
  const [stage, setStage] = useState<AuthStage>("password");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<PrivateIdeaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<IdeaFormState>(EMPTY_FORM);
  const [form, setForm] = useState<IdeaFormState>(EMPTY_FORM);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const logoutTimer = useRef<number | null>(null);

  const lock = useCallback(() => {
    setToken(null);
    setStage("password");
    setPassword("");
    setPin("");
    setIdeas([]);
    window.location.assign("/");
  }, []);

  const bumpActivity = useCallback(() => {
    if (!token) return;
    if (logoutTimer.current !== null) window.clearTimeout(logoutTimer.current);
    logoutTimer.current = window.setTimeout(lock, INACTIVITY_MS);
  }, [lock, token]);

  useEffect(() => {
    if (!token) return undefined;
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((eventName) => window.addEventListener(eventName, bumpActivity, { passive: true }));
    bumpActivity();
    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, bumpActivity));
      if (logoutTimer.current !== null) window.clearTimeout(logoutTimer.current);
    };
  }, [bumpActivity, token]);

  const loadIdeas = useCallback(async (authToken: string) => {
    setError(null);
    try {
      const result = await api.getPrivateIdeas(authToken, { timeoutMs: 12000 });
      setIdeas(result.ideas);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const submitPassword = async () => {
    setError(null);
    setSetupRequired(false);
    setLoading(true);
    try {
      const result = await api.verifyPrivateIdeasPassword(password);
      if (result.setup_required) {
        setSetupRequired(true);
      } else if (result.ok) {
        setStage("pin");
      } else {
        setError("Password was not accepted.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const unlock = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await api.unlockPrivateIdeas({ password, pin });
      setToken(result.token);
      setStage("unlocked");
      setPassword("");
      setPin("");
      await loadIdeas(result.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const sortedIdeas = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle ? ideas.filter((item) => `${item.title} ${item.body}`.toLowerCase().includes(needle)) : ideas;
    return [...filtered].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime() || a.title.localeCompare(b.title));
  }, [ideas, query]);

  const createIdea = async () => {
    if (!token) return;
    if (!form.title.trim()) {
      setError("Idea title is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await api.createPrivateIdea(token, { title: form.title, body: form.body });
      setIdeas((prev) => [...prev, result.idea]);
      setForm(EMPTY_FORM);
      bumpActivity();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (idea: PrivateIdeaItem) => {
    setEditingId(idea.id);
    setEditForm({ title: idea.title, body: idea.body });
    bumpActivity();
  };

  const saveEdit = async (idea: PrivateIdeaItem) => {
    if (!token) return;
    setBusyId(idea.id);
    setError(null);
    try {
      const result = await api.updatePrivateIdea(token, idea.id, { title: editForm.title, body: editForm.body });
      setIdeas((prev) => prev.map((item) => (item.id === idea.id ? result.idea : item)));
      setEditingId(null);
      bumpActivity();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const deleteIdea = async (idea: PrivateIdeaItem) => {
    if (!token) return;
    setBusyId(idea.id);
    setError(null);
    try {
      await api.deletePrivateIdea(token, idea.id);
      setIdeas((prev) => prev.filter((item) => item.id !== idea.id));
      bumpActivity();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  if (stage !== "unlocked" || !token) {
    return (
      <AuthPanel
        stage={stage}
        password={password}
        pin={pin}
        error={error}
        loading={loading}
        setupRequired={setupRequired}
        onPassword={setPassword}
        onPin={setPin}
        onSubmitPassword={() => void submitPassword()}
        onUnlock={() => void unlock()}
      />
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 sm:p-6">
      <section className="overflow-hidden rounded-[2rem] border border-border/70 bg-card/80 shadow-2xl shadow-black/20">
        <div className="relative p-5 sm:p-7">
          <div className="pointer-events-none absolute right-0 top-0 h-48 w-80 rounded-full bg-fuchsia-400/10 blur-3xl" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Badge className="mb-3 border-fuchsia-300/30 bg-fuchsia-400/10 text-fuchsia-200">Rory list</Badge>
              <h1 className="font-expanded text-3xl font-black uppercase tracking-[0.08em] text-foreground sm:text-4xl">RORY</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
                Password + PIN protected profile-local notes for Rory's ideas and thoughts. No activity for one minute returns you to the Hermes root UI.
              </p>
            </div>
            <Button ghost onClick={() => void loadIdeas(token)} disabled={loading || saving || Boolean(busyId)} prefix={loading ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}>
              Refresh ideas
            </Button>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <SummaryPill label="Total" value={ideas.length} tone="text-foreground" />
        <SummaryPill label="Visible" value={sortedIdeas.length} tone="text-fuchsia-200" />
        <SummaryPill label="Auth" value="PIN" tone="text-success" />
        <SummaryPill label="Auto-lock" value="1m" tone="text-warning" />
      </section>

      <section className="rounded-3xl border border-border/70 bg-background-base/35 p-4 shadow-2xl shadow-black/10">
        <div className="grid gap-3 lg:grid-cols-[minmax(14rem,1fr)_auto] lg:items-start">
          <div className="grid gap-2">
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Add to Rory…" className="rounded-xl border border-border/70 bg-card/70 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-midground/70" />
            <textarea value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Thoughts" className="min-h-24 rounded-xl border border-border/70 bg-card/70 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-midground/70" />
          </div>
          <Button onClick={() => void createIdea()} disabled={saving} prefix={saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}>
            Add idea
          </Button>
        </div>
      </section>

      <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background-base/45 px-3 py-2">
        <Search className="size-4 text-muted-foreground" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter Rory notes and thoughts…" className="min-w-0 flex-1 bg-transparent py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-3xl border border-border/70 bg-card/70 p-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading Rory…
        </div>
      ) : sortedIdeas.length > 0 ? (
        <section className="overflow-hidden rounded-3xl border border-border/70 bg-background-base/35 shadow-2xl shadow-black/10">
          <div className="hidden border-b border-border/70 bg-card/70 px-4 py-2 text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground md:grid md:grid-cols-[minmax(16rem,1.4fr)_minmax(14rem,1fr)_9rem]">
            <span>Idea</span>
            <span>Updated</span>
            <span>Actions</span>
          </div>
          {sortedIdeas.map((idea) => (
            <IdeaRow
              key={idea.id}
              idea={idea}
              editing={editingId === idea.id}
              editForm={editForm}
              busy={busyId === idea.id}
              onEdit={() => startEdit(idea)}
              onChangeEdit={setEditForm}
              onSave={() => void saveEdit(idea)}
              onCancel={() => setEditingId(null)}
              onDelete={() => void deleteIdea(idea)}
            />
          ))}
        </section>
      ) : (
        <div className="rounded-3xl border border-border/70 bg-card/70 p-10 text-center text-sm text-muted-foreground">
          No Rory notes matched.
        </div>
      )}
    </main>
  );
}
