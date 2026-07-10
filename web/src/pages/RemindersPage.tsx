import { useEffect, useMemo, useState, type ButtonHTMLAttributes, type CSSProperties, type FormEvent, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Bell,
  Check,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Volume2,
} from "lucide-react";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { api } from "@/lib/api";
import type { ReminderItem } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ReminderFormState {
  title: string;
  notes: string;
  due_at: string;
  priority: boolean;
  category: ReminderCategory;
  notify_enabled: boolean;
  voice_enabled: boolean;
}

type ReminderCategory = "work" | "other";

type ReminderTone = "overdue" | "soon" | "upcoming" | "none" | "done";

type StatusFilter = ReminderTone | "all";

const EMPTY_FORM: ReminderFormState = { title: "", notes: "", due_at: "", priority: false, category: "work", notify_enabled: false, voice_enabled: false };

const TONE_META: Record<ReminderTone, { label: string; text: string; dot: string; circle: string }> = {
  overdue: { label: "Past due", text: "text-destructive", dot: "bg-destructive", circle: "border-destructive/70 hover:bg-destructive/10" },
  soon: { label: "Due soon", text: "text-warning", dot: "bg-warning", circle: "border-warning/70 hover:bg-warning/10" },
  upcoming: { label: "Upcoming", text: "text-cyan-200", dot: "bg-cyan-300", circle: "border-cyan-300/60 hover:bg-cyan-400/10" },
  none: { label: "No date", text: "text-muted-foreground", dot: "bg-muted-foreground/60", circle: "border-border hover:bg-white/5" },
  done: { label: "Done", text: "text-success", dot: "bg-success", circle: "border-success/60 bg-success/15 text-success" },
};

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "overdue", label: "Past due" },
  { id: "soon", label: "Due soon" },
  { id: "upcoming", label: "Upcoming" },
  { id: "none", label: "No date" },
  { id: "done", label: "Done" },
];

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

function reminderCategory(reminder: ReminderItem): ReminderCategory {
  return reminder.category === "other" ? "other" : "work";
}

function reminderSpeechText(reminder: ReminderItem): string {
  const note = reminder.notes?.trim();
  return note ? `Reminder: ${reminder.title}. ${note}` : `Reminder: ${reminder.title}.`;
}

function speakReminder(reminder: ReminderItem): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(reminderSpeechText(reminder));
  utterance.rate = 0.95;
  utterance.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

const GHOST_INPUT =
  "rounded-lg border border-transparent bg-black/25 px-3 py-2 text-xs text-foreground placeholder:text-text-tertiary/70 focus:border-midground/30 focus:outline-none";

function IconToggle({
  pressed,
  onChange,
  label,
  activeClass,
  children,
}: {
  pressed: boolean;
  onChange: (next: boolean) => void;
  label: string;
  activeClass: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onClick={() => onChange(!pressed)}
      className={cn(
        "grid size-8 place-items-center rounded-lg text-text-tertiary transition-colors hover:bg-white/8 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-midground/60",
        pressed && activeClass,
      )}
    >
      {children}
    </button>
  );
}

function ToggleCluster({ form, onChange }: { form: ReminderFormState; onChange: (next: ReminderFormState) => void }) {
  return (
    <div className="flex items-center gap-1">
      <IconToggle
        pressed={form.priority}
        onChange={(priority) => onChange({ ...form, priority })}
        label="Priority !"
        activeClass="bg-warning/15 text-warning"
      >
        <span className="font-mono-ui text-sm font-bold">!</span>
      </IconToggle>
      <IconToggle
        pressed={form.notify_enabled}
        onChange={(notify_enabled) => onChange({ ...form, notify_enabled })}
        label="Notify me"
        activeClass="bg-cyan-400/12 text-cyan-200"
      >
        <Bell className="size-3.5" />
      </IconToggle>
      <IconToggle
        pressed={form.voice_enabled}
        onChange={(voice_enabled) => onChange({ ...form, voice_enabled, notify_enabled: voice_enabled ? true : form.notify_enabled })}
        label="Voice it"
        activeClass="bg-midground/15 text-midground"
      >
        <Volume2 className="size-3.5" />
      </IconToggle>
    </div>
  );
}

function CategorySelect({
  value,
  onChange,
  className,
}: {
  value: ReminderCategory;
  onChange: (next: ReminderCategory) => void;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as ReminderCategory)}
      aria-label="Reminder section"
      className={cn(GHOST_INPUT, "cursor-pointer", className)}
    >
      <option value="work">Work</option>
      <option value="other">Everything else</option>
    </select>
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
  onPriorityToggle,
  dragHandleProps,
  sortableDisabled = false,
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
  onPriorityToggle: () => void;
  dragHandleProps?: ButtonHTMLAttributes<HTMLButtonElement>;
  sortableDisabled?: boolean;
}) {
  const tone = reminderTone(reminder);
  const meta = TONE_META[tone];

  if (editing) {
    return (
      <div className="space-y-2 bg-white/[0.03] px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={editForm.title}
            onChange={(event) => onChangeEdit({ ...editForm, title: event.target.value })}
            className={cn(GHOST_INPUT, "min-w-0 flex-1")}
            placeholder="Reminder title"
          />
          <input
            type="datetime-local"
            value={editForm.due_at}
            onChange={(event) => onChangeEdit({ ...editForm, due_at: event.target.value })}
            className={cn(GHOST_INPUT, "font-mono-ui")}
          />
        </div>
        <textarea
          value={editForm.notes}
          onChange={(event) => onChangeEdit({ ...editForm, notes: event.target.value })}
          className={cn(GHOST_INPUT, "min-h-16 w-full resize-y leading-5")}
          placeholder="Notes (optional)"
        />
        <div className="flex flex-wrap items-center gap-2">
          <CategorySelect value={editForm.category} onChange={(category) => onChangeEdit({ ...editForm, category })} />
          <ToggleCluster form={editForm} onChange={onChangeEdit} />
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:bg-white/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-midground/14 px-3.5 py-1.5 text-xs font-semibold text-midground transition-colors hover:bg-midground/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-2.5 px-3 py-2.5 transition-colors hover:bg-white/[0.03] sm:px-4">
      <button
        type="button"
        disabled={busy || sortableDisabled || !dragHandleProps}
        className="mt-1 grid size-5 shrink-0 cursor-grab place-items-center rounded text-text-tertiary/50 opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-0"
        aria-label="Drag to reorder reminder"
        title={sortableDisabled ? "Clear filters to reorder" : "Drag to reorder"}
        {...dragHandleProps}
      >
        <GripVertical className="size-3.5" />
      </button>

      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors disabled:cursor-not-allowed",
          meta.circle,
          tone !== "done" && "text-transparent hover:text-current",
        )}
        aria-label={reminder.completed ? "Mark reminder not done" : "Mark reminder done"}
        title={reminder.completed ? "Undo done" : "Done"}
      >
        {busy ? <Loader2 className={cn("size-3 animate-spin", meta.text)} /> : <Check className={cn("size-3", tone !== "done" && meta.text, tone !== "done" && "opacity-0 transition-opacity group-hover:opacity-60")} />}
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn("break-words text-sm leading-5 text-foreground", reminder.completed && "text-muted-foreground line-through")}>
          {reminder.title}
          {reminder.priority ? (
            <span className="ml-2 font-mono-ui text-sm font-bold text-warning" aria-label="Priority reminder" title="Priority">
              !
            </span>
          ) : null}
        </p>
        {reminder.notes ? <p className="mt-0.5 whitespace-pre-wrap text-xs leading-5 text-text-tertiary">{reminder.notes}</p> : null}
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        <div
          className="text-right font-mono-ui text-[0.68rem] leading-5"
          title={`Updated ${dueLabel(reminder.updated_at)}`}
        >
          <span className={meta.text}>{meta.label}</span>
          {reminder.due_at ? <span className="ml-1.5 text-text-tertiary max-sm:hidden">{dueLabel(reminder.due_at)}</span> : null}
        </div>
        {reminder.notify_enabled ? <Bell className="size-3 text-cyan-200/70" aria-label="Notifications on" /> : null}
        {reminder.voice_enabled ? <Volume2 className="size-3 text-midground/70" aria-label="Voice on" /> : null}
        <div className="flex items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            disabled={busy}
            className="grid size-6 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-white/8 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Edit reminder"
            title="Edit"
          >
            <Pencil className="size-3" />
          </button>
          <button
            type="button"
            onClick={onPriorityToggle}
            disabled={busy}
            className={cn(
              "grid size-6 place-items-center rounded-md font-mono-ui text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              reminder.priority ? "text-warning hover:bg-warning/10" : "text-text-tertiary hover:bg-white/8 hover:text-warning",
            )}
            aria-pressed={reminder.priority}
            aria-label={reminder.priority ? "Remove reminder priority" : "Mark reminder priority"}
            title={reminder.priority ? "Remove priority" : "Priority"}
          >
            !
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="grid size-6 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-white/8 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Delete reminder"
            title="Delete"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SortableReminderRow(props: Parameters<typeof ReminderRow>[0]) {
  const { reminder } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: reminder.id, disabled: props.editing || props.busy || props.sortableDisabled });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
    position: isDragging ? "relative" : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "bg-card opacity-90 shadow-xl shadow-black/30")}>
      <ReminderRow {...props} dragHandleProps={{ ...attributes, ...listeners }} />
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [reminderPendingDeletion, setReminderPendingDeletion] = useState<ReminderItem | null>(null);

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

  const filtersActive = Boolean(query.trim()) || statusFilter !== "all";

  const sortedReminders = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let filtered = needle
      ? reminders.filter((item) => `${item.title} ${item.notes} ${item.due_at ?? ""} ${reminderCategory(item) === "work" ? "work" : "everything else other"}`.toLowerCase().includes(needle))
      : reminders;
    if (statusFilter !== "all") filtered = filtered.filter((item) => reminderTone(item) === statusFilter);
    return [...filtered].sort(
      (a, b) =>
        Number(a.completed) - Number(b.completed) ||
        a.order_index - b.order_index ||
        a.created_at.localeCompare(b.created_at) ||
        a.title.localeCompare(b.title),
    );
  }, [query, statusFilter, reminders]);

  const remindersByCategory = useMemo(() => {
    const work = sortedReminders.filter((item) => reminderCategory(item) === "work");
    const other = sortedReminders.filter((item) => reminderCategory(item) === "other");
    return [
      { key: "work" as const, title: "Work", reminders: work },
      { key: "other" as const, title: "Everything else", reminders: other },
    ];
  }, [sortedReminders]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const reorderReminders = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || filtersActive) return;
    const currentIds = sortedReminders.map((item) => item.id);
    const oldIndex = currentIds.indexOf(String(active.id));
    const newIndex = currentIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const orderedIds: string[] = arrayMove(currentIds, oldIndex, newIndex);
    const byId = new Map(reminders.map((item) => [item.id, item]));
    const optimistic = orderedIds.map((id: string, index: number) => ({ ...byId.get(id)!, order_index: index }));
    setReminders(optimistic);
    setError(null);
    try {
      const result = await api.reorderReminders(orderedIds);
      setReminders(result.reminders);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      void load();
    }
  };

  const counts = useMemo(() => {
    return reminders.reduce(
      (acc, item) => {
        acc.all += 1;
        acc[reminderTone(item)] += 1;
        return acc;
      },
      { all: 0, overdue: 0, soon: 0, upcoming: 0, none: 0, done: 0 } as Record<StatusFilter, number>,
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
      if ((form.notify_enabled || form.voice_enabled) && "Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission().catch(() => undefined);
      }
      const result = await api.createReminder({
        title: form.title,
        notes: form.notes,
        due_at: form.due_at || null,
        priority: form.priority,
        category: form.category,
        notify_enabled: form.notify_enabled || form.voice_enabled,
        voice_enabled: form.voice_enabled,
      });
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
    setEditForm({
      title: reminder.title,
      notes: reminder.notes,
      due_at: toInputDateTime(reminder.due_at),
      priority: reminder.priority,
      category: reminderCategory(reminder),
      notify_enabled: reminder.notify_enabled,
      voice_enabled: reminder.voice_enabled,
    });
  };

  const saveEdit = async (reminder: ReminderItem) => {
    setBusyId(reminder.id);
    setError(null);
    try {
      if ((editForm.notify_enabled || editForm.voice_enabled) && "Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission().catch(() => undefined);
      }
      const result = await api.updateReminder(reminder.id, {
        title: editForm.title,
        notes: editForm.notes,
        due_at: editForm.due_at || null,
        priority: editForm.priority,
        category: editForm.category,
        notify_enabled: editForm.notify_enabled || editForm.voice_enabled,
        voice_enabled: editForm.voice_enabled,
        notified_at: null,
      });
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

  const toggleReminderPriority = async (reminder: ReminderItem) => {
    setBusyId(reminder.id);
    setError(null);
    try {
      const result = await api.updateReminder(reminder.id, { priority: !reminder.priority });
      setReminders((prev) => prev.map((item) => (item.id === reminder.id ? result.reminder : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      for (const reminder of reminders) {
        if (!reminder.notify_enabled || reminder.completed || reminder.notified_at || !reminder.due_at) continue;
        const due = new Date(reminder.due_at).getTime();
        if (Number.isNaN(due) || due > now) continue;
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(reminder.title, { body: reminder.notes || "Reminder due now" });
        }
        if (reminder.voice_enabled) speakReminder(reminder);
        void api.updateReminder(reminder.id, { notified_at: new Date().toISOString() }).then((result) => {
          setReminders((prev) => prev.map((item) => (item.id === reminder.id ? result.reminder : item)));
        }).catch((err) => setError(err instanceof Error ? err.message : String(err)));
      }
    };
    tick();
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, [reminders]);

  const deleteReminder = async (reminder: ReminderItem) => {
    setBusyId(reminder.id);
    setError(null);
    try {
      await api.deleteReminder(reminder.id);
      setReminders((prev) => prev.filter((item) => item.id !== reminder.id));
      setReminderPendingDeletion(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const submitQuickAdd = (event: FormEvent) => {
    event.preventDefault();
    void createReminder();
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-expanded text-2xl font-black uppercase tracking-[0.08em] text-foreground">Reminders</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-text-secondary">
            Profile-local reminders with due-date lights — overdue, due within 48 hours, upcoming, undated, done.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || saving || Boolean(busyId)}
          aria-label="Refresh reminders"
          title="Refresh reminders"
          className="grid size-8 place-items-center rounded-lg text-text-tertiary transition-colors hover:bg-white/8 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
        </button>
      </header>

      {error ? (
        <div role="alert" className="rounded-xl bg-rose-500/10 px-4 py-3 text-xs leading-5 text-rose-100">
          {error}
        </div>
      ) : null}

      <Card className="overflow-hidden border-border/50 bg-card/60 shadow-lg shadow-black/10 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
        <CardContent className="p-3">
          <form onSubmit={submitQuickAdd} className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Add a reminder…"
                className={cn(GHOST_INPUT, "min-w-0 flex-1 py-2.5 text-sm")}
              />
              <input
                type="datetime-local"
                value={form.due_at}
                onChange={(event) => setForm({ ...form, due_at: event.target.value })}
                aria-label="Due date"
                className={cn(GHOST_INPUT, "font-mono-ui")}
              />
              <button
                type="submit"
                disabled={saving}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-midground/14 px-4 py-2 text-xs font-semibold text-midground transition-colors hover:bg-midground/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                Add
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="Notes (optional)"
                aria-label="Reminder notes"
                className={cn(GHOST_INPUT, "min-w-0 flex-1 bg-transparent hover:bg-black/20 focus:bg-black/25")}
              />
              <CategorySelect value={form.category} onChange={(category) => setForm({ ...form, category })} />
              <ToggleCluster form={form} onChange={setForm} />
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/50 bg-card/60 shadow-lg shadow-black/10 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-border/40 px-3 py-2.5">
            {STATUS_FILTERS.map((filter) => {
              const active = statusFilter === filter.id;
              const count = counts[filter.id];
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setStatusFilter(filter.id)}
                  aria-pressed={active}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-midground/60",
                    active ? "bg-white/8 text-foreground shadow-[inset_0_0_0_1px_rgba(241,226,177,0.25)]" : "text-text-tertiary hover:bg-white/5 hover:text-text-secondary",
                  )}
                >
                  {filter.id !== "all" ? <span className={cn("size-1.5 rounded-full", TONE_META[filter.id as ReminderTone].dot)} aria-hidden="true" /> : null}
                  {filter.label}
                  <span className="font-mono-ui text-[0.65rem] text-text-tertiary">{count}</span>
                </button>
              );
            })}
            <div className="ml-auto flex min-w-0 items-center gap-2 rounded-lg bg-black/20 px-2.5 py-1.5">
              <Search className="size-3.5 shrink-0 text-text-tertiary" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter…"
                aria-label="Filter reminders"
                className="w-32 min-w-0 bg-transparent text-xs text-foreground outline-none placeholder:text-text-tertiary/70 focus:w-44 sm:w-40 sm:transition-[width]"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-xs text-text-tertiary">
              <Loader2 className="size-4 animate-spin" /> Loading reminders…
            </div>
          ) : sortedReminders.length > 0 ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void reorderReminders(event)}>
              <SortableContext items={sortedReminders.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                {remindersByCategory.map((section) =>
                  section.reminders.length > 0 ? (
                    <div key={section.key}>
                      <div className="flex items-baseline justify-between px-4 pb-1 pt-3">
                        <h2 className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-midground">{section.title}</h2>
                        <span className="font-mono-ui text-[0.62rem] text-text-tertiary">{section.reminders.length}</span>
                      </div>
                      <div className="divide-y divide-border/30">
                        {section.reminders.map((reminder) => (
                          <SortableReminderRow
                            key={reminder.id}
                            reminder={reminder}
                            editing={editingId === reminder.id}
                            editForm={editForm}
                            busy={busyId === reminder.id}
                            sortableDisabled={filtersActive}
                            onToggle={() => void toggleReminder(reminder)}
                            onEdit={() => startEdit(reminder)}
                            onChangeEdit={setEditForm}
                            onSave={() => void saveEdit(reminder)}
                            onCancel={() => setEditingId(null)}
                            onDelete={() => setReminderPendingDeletion(reminder)}
                            onPriorityToggle={() => void toggleReminderPriority(reminder)}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null,
                )}
              </SortableContext>
            </DndContext>
          ) : (
            <p className="p-10 text-center text-xs text-text-tertiary">
              {filtersActive ? "No reminders match the current filters." : "No reminders yet — add the first one above."}
            </p>
          )}

          <div className="border-t border-border/40 px-4 py-2 text-right font-mono-ui text-[0.62rem] text-text-tertiary/70">
            {filtersActive ? "clear filters to drag-reorder" : "drag rows to reorder"}
          </div>
        </CardContent>
      </Card>
      <ConfirmDialog
        open={Boolean(reminderPendingDeletion)}
        title="Delete reminder?"
        description={reminderPendingDeletion ? `This will permanently delete “${reminderPendingDeletion.title}”.` : undefined}
        confirmLabel="Delete reminder"
        destructive
        loading={Boolean(reminderPendingDeletion && busyId === reminderPendingDeletion.id)}
        onCancel={() => setReminderPendingDeletion(null)}
        onConfirm={() => {
          if (reminderPendingDeletion) void deleteReminder(reminderPendingDeletion);
        }}
      />
    </main>
  );
}
