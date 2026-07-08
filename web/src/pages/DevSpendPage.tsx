import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  WalletCards,
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
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1 text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
      <span>{label}</span>
      {children}
    </label>
  );
}

const INPUT = "w-full rounded-lg border border-border/70 bg-black/30 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-text-tertiary/70 focus:border-midground/60";

export default function DevSpendPage() {
  const [items, setItems] = useState<DevSpendItem[]>([]);
  const [discovery, setDiscovery] = useState<{ email_scan_available: boolean; sources: { id: string; label: string; status: string; detail: string }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

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
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

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
      setForm(EMPTY_FORM);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save development spend item");
    } finally {
      setSaving(false);
    }
  };

  const edit = (item: DevSpendItem) => {
    setEditingId(item.id);
    setForm(toForm(item));
  };

  const remove = async (item: DevSpendItem) => {
    setError(null);
    try {
      await api.deleteDevSpendItem(item.id);
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
      if (editingId === item.id) {
        setEditingId(null);
        setForm(EMPTY_FORM);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete development spend item");
    }
  };

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-warning/80">Development Endeavor Spend</p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">Dev Spend</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Track AI/API subscriptions and cloud usage in one place. Seeded candidates stay in “watching” until you confirm the amount from billing or email.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-black/25 px-3 py-2 text-sm text-foreground hover:bg-white/8"
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border-warning/20 bg-warning/8">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-warning/80">Monthly run rate</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{money(totals.monthly)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Annualized: {money(totals.annual)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-black/20">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Tracked vendors</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{items.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">{activeItems.length} active or watching</p>
          </CardContent>
        </Card>
        <Card className="border-cyan-300/20 bg-cyan-400/8">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/80">Needs confirmation</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{totals.unknown}</p>
            <p className="mt-1 text-xs text-muted-foreground">Usage-based or $0 placeholders</p>
          </CardContent>
        </Card>
      </div>

      {discovery && (
        <Card className="border-border/70 bg-black/20">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              {discovery.email_scan_available ? <CheckCircle2 className="size-4 text-success" /> : <AlertCircle className="size-4 text-warning" />}
              <h2 className="text-sm font-semibold text-foreground">Subscription discovery sources</h2>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {discovery.sources.map((source) => (
                <div key={source.id} className="rounded-lg border border-border/60 bg-black/25 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{source.label}</p>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.16em]", source.status === "available" ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>{source.status.replace("_", " ")}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{source.detail}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

      <Card className="border-border/70 bg-black/20">
        <CardContent className="p-4">
          <form onSubmit={save} className="grid gap-3 lg:grid-cols-12">
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
            <div className="lg:col-span-12">
              <textarea className={cn(INPUT, "min-h-20")} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Billing URL, plan, API key owner, cancellation notes, or email evidence." />
            </div>
            <div className="flex gap-2 lg:col-span-12">
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-warning px-3 py-2 text-sm font-medium text-black disabled:opacity-60">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                {editingId ? "Save spend item" : "Add spend item"}
              </button>
              {editingId && (
                <button type="button" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); }} className="rounded-lg border border-border/70 px-3 py-2 text-sm text-foreground hover:bg-white/8">Cancel edit</button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading spend data…</div>
      ) : (
        <div className="space-y-4">
          {byCategory.map(([category, categoryItems]) => (
            <section key={category} className="space-y-2" aria-label={`${category} spending`}>
              <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                <WalletCards className="size-4 text-warning" />
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">{category}</h2>
                <span className="text-xs text-muted-foreground">{categoryItems.length}</span>
              </div>
              <div className="overflow-hidden rounded-xl border border-border/70 bg-black/20">
                <div className="grid grid-cols-[1.4fr_0.8fr_0.7fr_0.7fr_1fr_auto] gap-3 border-b border-border/60 px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-text-tertiary">
                  <span>Vendor</span><span>Status</span><span>Amount</span><span>Monthly</span><span>Next due / Source</span><span>Actions</span>
                </div>
                {categoryItems.map((item) => (
                  <div key={item.id} className="grid grid-cols-[1.4fr_0.8fr_0.7fr_0.7fr_1fr_auto] gap-3 border-b border-border/40 px-3 py-3 text-sm last:border-b-0">
                    <button type="button" onClick={() => edit(item)} className="text-left">
                      <span className="font-medium text-foreground">{item.vendor}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{item.kind} · {item.cadence}{item.notes ? ` · ${item.notes}` : ""}</span>
                    </button>
                    <span className={cn("w-fit rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.14em]", item.status === "active" && "bg-success/15 text-success", item.status === "watching" && "bg-warning/15 text-warning", item.status === "cancelled" && "bg-white/8 text-text-tertiary")}>{item.status}</span>
                    <span className="text-foreground"><DollarSign className="mr-1 inline size-3 text-text-tertiary" />{money(item.amount, item.currency)}</span>
                    <span className="text-foreground">{money(monthlyEquivalent(item), item.currency)}</span>
                    <span className="text-xs text-muted-foreground">{dueLabel(item.next_due)}<br />{item.source}</span>
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => edit(item)} className="rounded-lg border border-border/70 px-2 py-1 text-xs text-foreground hover:bg-white/8">Edit</button>
                      <button type="button" onClick={() => void remove(item)} aria-label={`Delete ${item.vendor}`} className="rounded-lg p-1.5 text-text-tertiary hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
