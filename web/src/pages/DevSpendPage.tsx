import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  ChevronDown,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { api } from "@/lib/api";
import type { DevSpendCadence, DevSpendItem, DevSpendStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

type FormState = {
  vendor: string;
  category: string;
  kind: string;
  cadence: DevSpendCadence;
  amount: string;
  currency: string;
  next_due: string;
  status: DevSpendStatus;
  source: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  vendor: "",
  category: "AI API",
  kind: "subscription",
  cadence: "monthly",
  amount: "",
  currency: "USD",
  next_due: "",
  status: "active",
  source: "manual",
  notes: "",
};

const CADENCES: DevSpendCadence[] = ["monthly", "annual", "usage", "one-time"];
const STATUSES: DevSpendStatus[] = ["active", "watching", "cancelled"];

const STATUS_DOT: Record<DevSpendStatus, string> = {
  active: "bg-success",
  watching: "bg-warning",
  cancelled: "bg-text-tertiary/50",
};

function monthlyEquivalent(item: DevSpendItem): number {
  if (item.status === "cancelled") return 0;
  if (item.cadence === "annual") return item.amount / 12;
  if (item.cadence === "one-time") return 0;
  return item.amount;
}

function money(value: number, currency = "USD"): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD", maximumFractionDigits: 2 }).format(value || 0);
}

function dueLabel(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function dueSoon(value: string | null): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const days = (date.getTime() - Date.now()) / 86_400_000;
  return days >= 0 && days <= 7;
}

function toForm(item: DevSpendItem): FormState {
  return {
    vendor: item.vendor,
    category: item.category,
    kind: item.kind,
    cadence: item.cadence,
    amount: item.amount ? String(item.amount) : "",
    currency: item.currency || "USD",
    next_due: item.next_due ? item.next_due.slice(0, 10) : "",
    status: item.status,
    source: item.source,
    notes: item.notes,
  };
}

function payloadFromForm(form: FormState) {
  return {
    vendor: form.vendor.trim(),
    category: form.category.trim() || "AI API",
    kind: form.kind.trim() || "subscription",
    cadence: form.cadence,
    amount: Number.parseFloat(form.amount || "0") || 0,
    currency: (form.currency.trim() || "USD").toUpperCase(),
    next_due: form.next_due || null,
    status: form.status,
    source: form.source.trim() || "manual",
    notes: form.notes.trim(),
  };
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("space-y-1.5 text-[10px] uppercase tracking-[0.18em] text-text-tertiary", className)}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value, hint, accent }: { label: string; value: string; hint: string; accent?: boolean }) {
  return (
    <div className="px-5 py-4">
      <p className={cn("text-[10px] uppercase tracking-[0.2em]", accent ? "text-warning/80" : "text-text-tertiary")}>{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

const INPUT = "w-full rounded-lg border border-border/70 bg-black/30 px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none transition-colors placeholder:text-text-tertiary/70 focus:border-midground/60";

export default function DevSpendPage() {
  const [items, setItems] = useState<DevSpendItem[]>([]);
  const [discovery, setDiscovery] = useState<{ email_scan_available: boolean; sources: { id: string; label: string; status: string; detail: string }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getDevSpend();
      setItems(response.items);
      setDiscovery(response.discovery);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load development spend");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const activeItems = useMemo(() => items.filter((item) => item.status !== "cancelled"), [items]);
  const totals = useMemo(() => {
    const monthly = activeItems.reduce((sum, item) => sum + monthlyEquivalent(item), 0);
    const annual = monthly * 12;
    const unknown = activeItems.filter((item) => item.amount === 0 || item.cadence === "usage").length;
    return { monthly, annual, unknown };
  }, [activeItems]);
  const byCategory = useMemo(() => {
    const groups = new Map<string, DevSpendItem[]>();
    for (const item of items) {
      const list = groups.get(item.category) ?? [];
      list.push(item);
      groups.set(item.category, list);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a));
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [items]);
  const availableSources = useMemo(
    () => (discovery ? discovery.sources.filter((source) => source.status === "available").length : 0),
    [discovery],
  );

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const payload = payloadFromForm(form);
    if (!payload.vendor) {
      setError("Vendor is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        const response = await api.updateDevSpendItem(editingId, payload);
        setItems((current) => current.map((item) => item.id === editingId ? response.item : item));
      } else {
        const response = await api.createDevSpendItem(payload);
        setItems((current) => [...current, response.item]);
      }
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save development spend item");
    } finally {
      setSaving(false);
    }
  };

  const edit = (item: DevSpendItem) => {
    setEditingId(item.id);
    setForm(toForm(item));
    setFormOpen(true);
  };

  const remove = async (item: DevSpendItem) => {
    setError(null);
    try {
      await api.deleteDevSpendItem(item.id);
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
      if (editingId === item.id) closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete development spend item");
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 lg:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-warning/80">Development Endeavor Spend</p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">Dev Spend</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI/API subscriptions and cloud usage. Seeded candidates stay in “watching” until confirmed from billing or email.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            aria-label="Refresh"
            className="rounded-lg border border-border/70 bg-black/25 p-2 text-foreground transition-colors hover:bg-white/8"
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </button>
          <button
            type="button"
            onClick={() => (formOpen ? closeForm() : setFormOpen(true))}
            className="inline-flex items-center gap-2 rounded-lg bg-warning px-3 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
          >
            <Plus className="size-4" />
            Add item
          </button>
        </div>
      </div>

      <Card className="border-border/70 bg-black/20">
        <CardContent className="grid grid-cols-1 divide-y divide-border/50 p-0 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Stat accent label="Monthly run rate" value={money(totals.monthly)} hint={`${money(totals.annual)} annualized`} />
          <Stat label="Tracked vendors" value={String(items.length)} hint={`${activeItems.length} active or watching`} />
          <Stat label="Needs confirmation" value={String(totals.unknown)} hint="Usage-based or $0 placeholders" />
        </CardContent>
      </Card>

      {discovery && (
        <Card className="border-border/70 bg-black/20">
          <CardContent className="p-0">
            <button
              type="button"
              onClick={() => setSourcesOpen((open) => !open)}
              aria-expanded={sourcesOpen}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <div className="flex items-center gap-2.5">
                <span className={cn("size-1.5 rounded-full", discovery.email_scan_available ? "bg-success" : "bg-warning")} />
                <h2 className="text-sm font-medium text-foreground">Subscription discovery sources</h2>
                <span className="text-xs text-muted-foreground">{availableSources} of {discovery.sources.length} connected</span>
              </div>
              <ChevronDown className={cn("size-4 text-text-tertiary transition-transform", sourcesOpen && "rotate-180")} />
            </button>
            {sourcesOpen && (
              <div className="border-t border-border/50">
                {discovery.sources.map((source) => (
                  <div key={source.id} className="flex items-baseline gap-3 border-b border-border/40 px-4 py-2.5 last:border-b-0">
                    <span className={cn("size-1.5 shrink-0 translate-y-[-1px] rounded-full", source.status === "available" ? "bg-success" : "bg-warning/70")} />
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">
                        {source.label}
                        <span className={cn("ml-2 text-[10px] uppercase tracking-[0.14em]", source.status === "available" ? "text-success" : "text-warning/80")}>
                          {source.status.replace("_", " ")}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{source.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

      {formOpen && (
        <Card className="border-warning/25 bg-black/20">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-foreground">{editingId ? `Edit ${form.vendor || "item"}` : "New spend item"}</h2>
              <button type="button" onClick={closeForm} aria-label="Close form" className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-white/8 hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
            <form onSubmit={save} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Vendor">
                <input className={INPUT} value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="OpenAI API" />
              </Field>
              <Field label="Category">
                <input className={INPUT} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </Field>
              <Field label="Kind">
                <input className={INPUT} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} placeholder="subscription / usage" />
              </Field>
              <Field label="Cadence">
                <select className={INPUT} value={form.cadence} onChange={(e) => setForm({ ...form, cadence: e.target.value as DevSpendCadence })}>
                  {CADENCES.map((cadence) => <option key={cadence}>{cadence}</option>)}
                </select>
              </Field>
              <Field label="Amount">
                <input className={INPUT} inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="20" />
              </Field>
              <Field label="Next due">
                <input className={INPUT} type="date" value={form.next_due} onChange={(e) => setForm({ ...form, next_due: e.target.value })} />
              </Field>
              <Field label="Status">
                <select className={INPUT} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as DevSpendStatus })}>
                  {STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </Field>
              <Field label="Notes" className="sm:col-span-2 lg:col-span-4">
                <textarea className={cn(INPUT, "min-h-16")} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Billing URL, plan, API key owner, cancellation notes, or email evidence." />
              </Field>
              <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-warning px-3 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-60">
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  {editingId ? "Save changes" : "Add spend item"}
                </button>
                <button type="button" onClick={closeForm} className="rounded-lg border border-border/70 px-3 py-2 text-sm text-foreground transition-colors hover:bg-white/8">Cancel</button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading spend data…</div>
      ) : (
        <div className="space-y-4">
          {byCategory.map(([category, categoryItems]) => {
            const categoryMonthly = categoryItems.reduce((sum, item) => sum + monthlyEquivalent(item), 0);
            return (
              <section key={category} className="space-y-2" aria-label={`${category} spending`}>
                <div className="flex items-baseline justify-between px-1">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                    {category} <span className="ml-1 font-normal text-muted-foreground">{categoryItems.length}</span>
                  </h2>
                  <span className="text-xs tabular-nums text-muted-foreground">{money(categoryMonthly)}/mo</span>
                </div>
                <div className="overflow-hidden rounded-xl border border-border/70 bg-black/20">
                  <div className="grid grid-cols-[1.6fr_0.9fr_0.6fr_0.6fr_0.5fr_4.5rem] items-center gap-3 border-b border-border/60 px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-text-tertiary">
                    <span>Vendor</span><span>Status</span><span className="text-right">Amount</span><span className="text-right">Monthly</span><span className="text-right">Due</span><span />
                  </div>
                  {categoryItems.map((item) => (
                    <div key={item.id} className="group grid grid-cols-[1.6fr_0.9fr_0.6fr_0.6fr_0.5fr_4.5rem] items-center gap-3 border-b border-border/40 px-4 py-2.5 text-sm transition-colors last:border-b-0 hover:bg-white/4">
                      <button type="button" onClick={() => edit(item)} className="min-w-0 text-left" title={item.notes || undefined}>
                        <span className={cn("block truncate font-medium", item.status === "cancelled" ? "text-text-tertiary line-through" : "text-foreground")}>{item.vendor}</span>
                        <span className="block truncate text-xs text-muted-foreground">{[item.kind, item.kind === item.cadence ? null : item.cadence, item.source].filter(Boolean).join(" · ")}</span>
                      </button>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className={cn("size-1.5 rounded-full", STATUS_DOT[item.status])} />
                        {item.status}
                      </span>
                      <span className={cn("text-right tabular-nums", item.amount === 0 ? "text-text-tertiary" : "text-foreground")}>
                        {item.amount === 0 ? "—" : money(item.amount, item.currency)}
                      </span>
                      <span className={cn("text-right tabular-nums", monthlyEquivalent(item) === 0 ? "text-text-tertiary" : "text-foreground")}>
                        {monthlyEquivalent(item) === 0 ? "—" : money(monthlyEquivalent(item), item.currency)}
                      </span>
                      <span className={cn("text-right text-xs tabular-nums", dueSoon(item.next_due) ? "text-warning" : "text-muted-foreground")}>
                        {dueLabel(item.next_due)}
                      </span>
                      <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        <button type="button" onClick={() => edit(item)} aria-label={`Edit ${item.vendor}`} className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-white/8 hover:text-foreground"><Pencil className="size-3.5" /></button>
                        <button type="button" onClick={() => void remove(item)} aria-label={`Delete ${item.vendor}`} className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
