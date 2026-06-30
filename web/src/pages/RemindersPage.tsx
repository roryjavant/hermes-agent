import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { api } from "@/lib/api";
import type { ReminderItem } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ReminderFormState {
  title: string;
  notes: string;
  due_at: string;
}

type ReminderTone = "overdue" | "soon" | "upcoming" | "none" | "done";

const EMPTY_FORM: ReminderFormState = { title: "", notes: "", due_at: "" };

const TONE_META: Record<ReminderTone, { label: string; className: string; glow: string; textClassName: string; icon: typeof CircleDot }> = {
  overdue: {
    label: "Past due",
    className: "border-destructive/40 bg-destructive/10 text-destructive",
    glow: "bg-destructive shadow-[0_0_24px_rgba(255,107,107,0.55)]",
    textClassName: "text-destructive",
    icon: AlertTriangle,
  },
  soon: {
    label: "Due soon",
    className: "border-warning/40 bg-warning/10 text-warning",
    glow: "bg-warning shadow-[0_0_24px_rgba(242,201,76,0.55)]",
    textClassName: "text-warning",
    icon: CalendarClock,
  },
  upcoming: {
    label: "Upcoming",
    className: "border-cyan-300/35 bg-cyan-400/10 text-cyan-200",
    glow: "bg-cyan-300 shadow-[0_0_24px_rgba(103,232,249,0.45)]",
    textClassName: "text-cyan-200",
    icon: BellRing,
  },
  none: {
    label: "No date",
    className: "border-border/70 bg-background-base/60 text-muted-foreground",
    glow: "bg-muted-foreground/50",
    textClassName: "text-muted-foreground",
    icon: CircleDot,
  },
  done: {
    label: "Done",
    className: "border-success/40 bg-success/10 text-success",
    glow: "bg-success shadow-[0_0_24px_rgba(96,211,148,0.45)]",
    textClassName: "text-success",
    icon: CheckCircle2,
  },
};

function reminderTone(reminder: ReminderItem, now = Date.now()): ReminderTone {
  if (reminder.completed) return "done";
  if (!reminder.due_at) return "none";
  const due = new Date(reminder.due_at).getTime();
  if (Number.isNaN(due)) return "none";
  if (due < now) return "overdue";
  if (due - now <= 48 * 60 * 60 * 1000) return "soon";
  return "upcoming";
}

function dueLabel(value: string | null): string {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function toInputDateTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function SummaryPill({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background-base/45 px-4 py-3">
      <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-mono-ui text-2xl", tone)}>{value}</div>
    </div>
  );
}

function ReminderRow({
  reminder,
  editing,
  editForm,
  busy,
  onToggle,
  onEdit,
  onChangeEdit,
  onSave,
  onCancel,
  onDelete,
}: {
  reminder: ReminderItem;
  editing: boolean;
  editForm: ReminderFormState;
  busy: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onChangeEdit: (next: ReminderFormState) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const tone = reminderTone(reminder);
  const meta = TONE_META[tone];
  const Icon = meta.icon;

  return (
    <div className="group grid gap-3 border-b border-border/50 bg-card/45 px-3 py-3 transition-colors hover:bg-card/75 md:grid-cols-[minmax(16rem,1.4fr)_minmax(10rem,0.7fr)_minmax(14rem,1fr)_14rem] md:items-center md:px-4">
      <div className="flex min-w-0 items-start gap-3">
        <button
          type="button"
          onClick={onToggle}
          disabled={busy}
          className={cn("mt-1 h-3 w-3 shrink-0 rounded-full", meta.glow, busy && "opacity-50")}
          aria-label={reminder.completed ? "Mark reminder incomplete" : "Mark reminder complete"}
        />
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-xl border", meta.className)}>
          <Icon className="size-4" />
        </span>
        {editing ? (
          <div className="grid min-w-0 flex-1 gap-2">
            <input
              value={editForm.title}
              onChange={(event) => onChangeEdit({ ...editForm, title: event.target.value })}
              className="rounded-xl border border-border/70 bg-background-base/70 px-3 py-2 text-sm text-foreground outline-none focus:border-midground/70"
              placeholder="Reminder title"
            />
            <textarea
              value={editForm.notes}
              onChange={(event) => onChangeEdit({ ...editForm, notes: event.target.value })}
              className="min-h-20 rounded-xl border border-border/70 bg-background-base/70 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-midground/70"
              placeholder="Notes"
            />
          </div>
        ) : (
          <div className="min-w-0">
            <h2 className={cn("truncate font-expanded text-sm font-black uppercase tracking-[0.08em] text-foreground", reminder.completed && "text-muted-foreground line-through")}>
              {reminder.title}
            </h2>
            {reminder.notes ? <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-text-secondary">{reminder.notes}</p> : <p className="mt-1 text-sm text-muted-foreground">No notes</p>}
          </div>
        )}
      </div>

      <div className="min-w-0 text-xs">
        {editing ? (
          <input
            type="datetime-local"
            value={editForm.due_at}
            onChange={(event) => onChangeEdit({ ...editForm, due_at: event.target.value })}
            className="w-full rounded-xl border border-border/70 bg-background-base/70 px-3 py-2 font-mono-ui text-xs text-foreground outline-none focus:border-midground/70"
          />
        ) : (
          <>
            <p className={cn("font-mono-ui uppercase tracking-[0.08em]", meta.textClassName)}>{meta.label}</p>
            <p className="mt-0.5 text-text-secondary">{dueLabel(reminder.due_at)}</p>
          </>
        )}
      </div>

      <div className="min-w-0 text-xs text-muted-foreground">
        <p className="font-mono-ui uppercase tracking-[0.08em] text-muted-foreground">Updated</p>
        <p className="mt-0.5 text-text-secondary">{dueLabel(reminder.updated_at)}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        {editing ? (
          <>
            <button
              type="button"
              onClick={onSave}
              disabled={busy}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-success/40 bg-success/10 px-2 font-expanded text-[0.65rem] font-bold uppercase tracking-[0.14em] text-success transition-colors hover:bg-success/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Save
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="inline-flex h-8 items-center justify-center rounded-xl border border-border/70 bg-background-base/60 px-2 font-expanded text-[0.65rem] font-bold uppercase tracking-[0.14em] text-foreground transition-colors hover:border-midground/50 hover:bg-card disabled:cursor-not-allowed disabled:opacity-40"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onToggle}
              disabled={busy}
              className={cn(
                "inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border px-2 font-expanded text-[0.65rem] font-bold uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                reminder.completed
                  ? "border-border/70 bg-background-base/60 text-muted-foreground hover:border-midground/50 hover:bg-card"
                  : "border-success/45 bg-success/10 text-success hover:bg-success/15",
              )}
              aria-label={reminder.completed ? "Mark reminder not done" : "Mark reminder done"}
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
              {reminder.completed ? "Undo" : "Done"}
            </button>
            <button
              type="button"
              onClick={onEdit}
              disabled={busy}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-border/70 bg-background-base/60 px-2 font-expanded text-[0.65rem] font-bold uppercase tracking-[0.14em] text-foreground transition-colors hover:border-midground/50 hover:bg-card disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Pencil className="size-3.5" />
              Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 px-2 font-expanded text-[0.65rem] font-bold uppercase tracking-[0.14em] text-destructive transition-colors hover:bg-destructive/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ReminderFormState>(EMPTY_FORM);
  const [form, setForm] = useState<ReminderFormState>(EMPTY_FORM);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const result = await api.getReminders({ timeoutMs: 12000 });
      setReminders(result.reminders);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const sortedReminders = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle ? reminders.filter((item) => `${item.title} ${item.notes} ${item.due_at ?? ""}`.toLowerCase().includes(needle)) : reminders;
    const rank: Record<ReminderTone, number> = { overdue: 0, soon: 1, upcoming: 2, none: 3, done: 4 };
    return [...filtered].sort((a, b) => {
      const toneDiff = rank[reminderTone(a)] - rank[reminderTone(b)];
      if (toneDiff !== 0) return toneDiff;
      const aDue = a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER;
      return aDue - bDue || a.title.localeCompare(b.title);
    });
  }, [query, reminders]);

  const counts = useMemo(() => {
    return reminders.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[reminderTone(item)] += 1;
        return acc;
      },
      { total: 0, overdue: 0, soon: 0, upcoming: 0, none: 0, done: 0 },
    );
  }, [reminders]);

  const createReminder = async () => {
    if (!form.title.trim()) {
      setError("Reminder title is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await api.createReminder({ title: form.title, notes: form.notes, due_at: form.due_at || null });
      setReminders((prev) => [...prev, result.reminder]);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (reminder: ReminderItem) => {
    setEditingId(reminder.id);
    setEditForm({ title: reminder.title, notes: reminder.notes, due_at: toInputDateTime(reminder.due_at) });
  };

  const saveEdit = async (reminder: ReminderItem) => {
    setBusyId(reminder.id);
    setError(null);
    try {
      const result = await api.updateReminder(reminder.id, { title: editForm.title, notes: editForm.notes, due_at: editForm.due_at || null });
      setReminders((prev) => prev.map((item) => (item.id === reminder.id ? result.reminder : item)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const toggleReminder = async (reminder: ReminderItem) => {
    setBusyId(reminder.id);
    setError(null);
    try {
      const result = await api.updateReminder(reminder.id, { completed: !reminder.completed });
      setReminders((prev) => prev.map((item) => (item.id === reminder.id ? result.reminder : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const deleteReminder = async (reminder: ReminderItem) => {
    setBusyId(reminder.id);
    setError(null);
    try {
      await api.deleteReminder(reminder.id);
      setReminders((prev) => prev.filter((item) => item.id !== reminder.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 sm:p-6">
      <section className="overflow-hidden rounded-[2rem] border border-border/70 bg-card/80 shadow-2xl shadow-black/20">
        <div className="relative p-5 sm:p-7">
          <div className="pointer-events-none absolute right-0 top-0 h-48 w-80 rounded-full bg-midground/10 blur-3xl" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Badge className="mb-3 border-cyan-300/30 bg-cyan-400/10 text-cyan-200">Personal reminder lights</Badge>
              <h1 className="font-expanded text-3xl font-black uppercase tracking-[0.08em] text-foreground sm:text-4xl">Reminders</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
                Quick profile-local reminders with date-based light language: red past due, yellow due in the next 48 hours, cyan upcoming, gray no date, green completed.
              </p>
            </div>
            <Button ghost onClick={() => void load()} disabled={loading || saving || Boolean(busyId)} prefix={loading ? <Loader2 className="size-4 animate-spin" /> : <BellRing className="size-4" />}>
              Refresh reminders
            </Button>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryPill label="Total" value={counts.total} tone="text-foreground" />
        <SummaryPill label="Past due" value={counts.overdue} tone="text-destructive" />
        <SummaryPill label="Soon" value={counts.soon} tone="text-warning" />
        <SummaryPill label="Upcoming" value={counts.upcoming} tone="text-cyan-200" />
        <SummaryPill label="No date" value={counts.none} tone="text-muted-foreground" />
        <SummaryPill label="Done" value={counts.done} tone="text-success" />
      </section>

      <section className="rounded-3xl border border-border/70 bg-background-base/35 p-4 shadow-2xl shadow-black/10">
        <div className="grid gap-3 lg:grid-cols-[minmax(14rem,1fr)_minmax(12rem,0.8fr)_auto] lg:items-start">
          <div className="grid gap-2">
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Add a reminder…"
              className="rounded-xl border border-border/70 bg-card/70 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-midground/70"
            />
            <textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Notes"
              className="min-h-20 rounded-xl border border-border/70 bg-card/70 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-midground/70"
            />
          </div>
          <input
            type="datetime-local"
            value={form.due_at}
            onChange={(event) => setForm({ ...form, due_at: event.target.value })}
            className="rounded-xl border border-border/70 bg-card/70 px-3 py-2 font-mono-ui text-sm text-foreground outline-none focus:border-midground/70"
          />
          <Button onClick={() => void createReminder()} disabled={saving} prefix={saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}>
            Add reminder
          </Button>
        </div>
      </section>

      <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background-base/45 px-3 py-2">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter reminders, notes, due dates…"
          className="min-w-0 flex-1 bg-transparent py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-3xl border border-border/70 bg-card/70 p-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading reminders…
        </div>
      ) : sortedReminders.length > 0 ? (
        <section className="overflow-hidden rounded-3xl border border-border/70 bg-background-base/35 shadow-2xl shadow-black/10">
          <div className="hidden border-b border-border/70 bg-card/70 px-4 py-2 text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground md:grid md:grid-cols-[minmax(16rem,1.4fr)_minmax(10rem,0.7fr)_minmax(14rem,1fr)_14rem]">
            <span>Reminder</span>
            <span>Due</span>
            <span>Updated</span>
            <span>Actions</span>
          </div>
          {sortedReminders.map((reminder) => (
            <ReminderRow
              key={reminder.id}
              reminder={reminder}
              editing={editingId === reminder.id}
              editForm={editForm}
              busy={busyId === reminder.id}
              onToggle={() => void toggleReminder(reminder)}
              onEdit={() => startEdit(reminder)}
              onChangeEdit={setEditForm}
              onSave={() => void saveEdit(reminder)}
              onCancel={() => setEditingId(null)}
              onDelete={() => void deleteReminder(reminder)}
            />
          ))}
        </section>
      ) : (
        <div className="rounded-3xl border border-border/70 bg-card/70 p-10 text-center text-sm text-muted-foreground">
          No reminders matched.
        </div>
      )}
    </main>
  );
}
