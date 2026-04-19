"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import {
  ArrowUpRight,
  Ban,
  CheckCircle2,
  Gem,
  Gift,
  MoreHorizontalIcon,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PAGE_SIZE = 50;

export default function AdminPage() {
  const router = useRouter();
  const { user } = useUser();

  const [authState, setAuthState] = useState("checking"); // checking | ok | denied
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [actioningUserId, setActioningUserId] = useState(null);

  const [restrictTarget, setRestrictTarget] = useState(null); // user object
  const [reason, setReason] = useState("");

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/admin/me", { cache: "no-store" });
      if (r.status === 200) {
        setAuthState("ok");
      } else {
        setAuthState("denied");
      }
    })();
  }, []);

  useEffect(() => {
    if (authState !== "ok") return;
    const t = setTimeout(() => loadUsers(), 250);
    return () => clearTimeout(t);
  }, [query, offset, authState]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (authState !== "ok") return;
    loadStats();
  }, [authState]);

  const loadStats = useCallback(async () => {
    const r = await fetch("/api/admin/stats", { cache: "no-store" });
    if (r.ok) setStats(await r.json());
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    if (query.trim()) params.set("q", query.trim());
    const r = await fetch(`/api/admin/users?${params}`, { cache: "no-store" });
    if (r.ok) {
      const data = await r.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
    }
    setLoading(false);
  }, [query, offset]);

  const handleRestrict = useCallback(async () => {
    if (!restrictTarget) return;
    setActioningUserId(restrictTarget.id);
    const r = await fetch(
      `/api/admin/users/${encodeURIComponent(restrictTarget.id)}/restrict`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      },
    );
    setActioningUserId(null);
    if (r.ok) {
      setRestrictTarget(null);
      setReason("");
      await Promise.all([loadUsers(), loadStats()]);
    }
  }, [restrictTarget, reason, loadUsers, loadStats]);

  const handleUnrestrict = useCallback(
    async (u) => {
      setActioningUserId(u.id);
      const r = await fetch(
        `/api/admin/users/${encodeURIComponent(u.id)}/unrestrict`,
        { method: "POST" },
      );
      setActioningUserId(null);
      if (r.ok) await Promise.all([loadUsers(), loadStats()]);
    },
    [loadUsers, loadStats],
  );

  const handleGrantPlan = useCallback(
    async (u, plan) => {
      setActioningUserId(u.id);
      const r = await fetch(`/api/admin/users/${encodeURIComponent(u.id)}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      setActioningUserId(null);
      if (r.ok) await Promise.all([loadUsers(), loadStats()]);
    },
    [loadUsers, loadStats],
  );

  if (authState === "checking") {
    return (
      <Shell>
        <div className="flex h-[60vh] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
          Verifying access…
        </div>
      </Shell>
    );
  }

  if (authState === "denied") {
    return (
      <Shell>
        <div className="mx-auto flex h-[70vh] max-w-lg flex-col items-center justify-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
            <Ban className="h-6 w-6" />
          </span>
          <h1 className="mt-6 text-3xl font-semibold tracking-[-0.02em]">
            Not for you{" "}
            <span className="font-serif-display italic font-normal text-slate-400 dark:text-slate-500">
              — yet.
            </span>
          </h1>
          <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
            This area is restricted to administrators. If you think this is a
            mistake, have the owner set{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">
              publicMetadata.role = &quot;admin&quot;
            </code>{" "}
            on your Clerk account.
          </p>
          <Button
            asChild
            className="mt-8 h-10 rounded-full bg-slate-900 px-5 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-6xl px-6 pb-24 pt-10">
        <header className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Admin
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.025em] sm:text-5xl">
              Members &amp;{" "}
              <span className="font-serif-display italic font-normal text-slate-400 dark:text-slate-500">
                access
              </span>
            </h1>
            <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
              Who&rsquo;s using the product, when they were last active, and who
              shouldn&rsquo;t be here anymore.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="hidden text-sm text-slate-600 underline-offset-4 hover:underline dark:text-slate-400 sm:inline"
          >
            ← back to app
          </Link>
        </header>

        <section className="mt-10 grid grid-cols-1 gap-0 border-y border-slate-200/80 dark:border-slate-800/80 sm:grid-cols-3">
          <StatCell
            label="Total members"
            value={stats?.total_users ?? "—"}
            hint="across all time"
          />
          <StatCell
            label="Active this week"
            value={stats?.active_last_7d ?? "—"}
            hint="seen in the last 7 days"
            bordered
          />
          <StatCell
            label="Restricted"
            value={stats?.restricted_users ?? "—"}
            hint="currently blocked"
            bordered
            accent
          />
        </section>

        <div className="mt-10 flex items-center justify-between gap-4">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => {
                setOffset(0);
                setQuery(e.target.value);
              }}
              placeholder="Search by name, email, or user ID…"
              className="h-11 rounded-full border-slate-200/80 bg-white/60 pl-10 text-[15px] backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/40"
            />
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500">
            {loading ? "loading…" : `${total} ${total === 1 ? "member" : "members"}`}
          </div>
        </div>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/50 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/30">
          <div className="hidden grid-cols-[1.4fr_0.9fr_1.1fr_0.7fr_40px] items-center gap-4 border-b border-slate-200/80 px-5 py-3 text-[11px] uppercase tracking-[0.18em] text-slate-400 dark:border-slate-800/80 dark:text-slate-500 sm:grid">
            <span>Member</span>
            <span>Last seen</span>
            <span>Plan &amp; quota</span>
            <span>Status</span>
            <span />
          </div>

          {users.length === 0 && !loading ? (
            <div className="px-5 py-16 text-center text-sm text-slate-500 dark:text-slate-400">
              No members match that search.
            </div>
          ) : (
            <ul className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
              {users.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  onRestrict={() => {
                    setReason("");
                    setRestrictTarget(u);
                  }}
                  onUnrestrict={() => handleUnrestrict(u)}
                  onGrantPlan={(plan) => handleGrantPlan(u, plan)}
                  acting={actioningUserId === u.id}
                  isSelf={u.id === user?.id}
                />
              ))}
            </ul>
          )}
        </section>

        {total > PAGE_SIZE && (
          <div className="mt-6 flex items-center justify-center gap-3 text-sm">
            <Button
              variant="ghost"
              disabled={offset === 0 || loading}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="h-9 rounded-full"
            >
              ← Previous
            </Button>
            <span className="text-slate-500 dark:text-slate-400">
              {Math.floor(offset / PAGE_SIZE) + 1} /{" "}
              {Math.max(1, Math.ceil(total / PAGE_SIZE))}
            </span>
            <Button
              variant="ghost"
              disabled={offset + PAGE_SIZE >= total || loading}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="h-9 rounded-full"
            >
              Next →
            </Button>
          </div>
        )}
      </div>

      <Dialog
        open={!!restrictTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRestrictTarget(null);
            setReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="tracking-[-0.02em]">
              Restrict{" "}
              <span className="font-serif-display italic font-normal text-slate-500">
                {restrictTarget?.name || restrictTarget?.email || "this member"}
              </span>
              ?
            </DialogTitle>
            <DialogDescription className="text-[15px] leading-relaxed">
              Their API calls will return a 403. Their Clerk session stays
              active — they&rsquo;ll see a message, not a logout. You can lift
              this at any time.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            <label className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Reason (optional, for your records)
            </label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. spam behavior, pending investigation"
              className="mt-2 h-10 rounded-xl"
              autoFocus
            />
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="ghost"
              onClick={() => {
                setRestrictTarget(null);
                setReason("");
              }}
              className="rounded-full"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRestrict}
              disabled={actioningUserId === restrictTarget?.id}
              className="rounded-full bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              Restrict access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#fafaf7] text-slate-900 dark:bg-[#0a0a0f] dark:text-slate-100">
      <div className="aurora" aria-hidden />
      <div className="absolute inset-0 grid-fade" aria-hidden />

      <nav className="relative z-10 border-b border-slate-200/70 dark:border-slate-800/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/dashboard" className="group flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-[10px] bg-gradient-to-br from-slate-900 to-slate-700 dark:from-white dark:to-slate-300">
              <Sparkles className="h-3.5 w-3.5 text-white dark:text-slate-900" strokeWidth={2.5} />
            </span>
            <span className="text-sm font-semibold tracking-tight">
              Jobboard<span className="text-slate-400 dark:text-slate-500">·</span>AI
              <span className="ml-2 font-serif-display text-sm italic font-normal text-slate-400 dark:text-slate-500">
                / admin
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              App
            </Link>
            <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
          </div>
        </div>
      </nav>

      <div className="relative z-10">{children}</div>
    </main>
  );
}

function StatCell({ label, value, hint, bordered, accent }) {
  return (
    <div
      className={
        "px-6 py-7 " +
        (bordered ? "sm:border-l sm:border-slate-200/80 dark:sm:border-slate-800/80 " : "")
      }
    >
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p
        className={
          "mt-2 text-4xl font-semibold tracking-[-0.03em] " +
          (accent
            ? "text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-sky-500 dark:from-violet-300 dark:to-sky-300"
            : "")
        }
      >
        {value}
      </p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
  );
}

function UserRow({
  user,
  onRestrict,
  onUnrestrict,
  onGrantPlan,
  acting,
  isSelf,
}) {
  const initial = (user.name || user.email || "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <li className="grid grid-cols-1 items-center gap-3 px-5 py-4 transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/30 sm:grid-cols-[1.4fr_0.9fr_1.1fr_0.7fr_40px] sm:gap-4">
      <div className="flex min-w-0 items-center gap-3">
        {user.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image_url}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-sm font-medium text-slate-700 dark:from-slate-800 dark:to-slate-900 dark:text-slate-300">
            {initial}
          </span>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
              {user.name || user.email || user.id}
            </p>
            {user.role === "admin" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-300">
                <ShieldCheck className="h-3 w-3" />
                admin
              </span>
            )}
            {isSelf && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                you
              </span>
            )}
          </div>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {user.email || user.id}
          </p>
        </div>
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-400">
        {relativeTime(user.last_seen_at || user.last_sign_in_at)}
      </p>

      <PlanCell user={user} />

      <div className="text-sm">
        {user.is_restricted ? (
          <span
            title={user.restricted_reason || ""}
            className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
          >
            <Ban className="h-3 w-3" />
            restricted
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
            <CheckCircle2 className="h-3 w-3" />
            active
          </span>
        )}
      </div>

      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              disabled={isSelf || acting}
            >
              <MoreHorizontalIcon className="h-4 w-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuItem
              onClick={() => onGrantPlan("trial")}
              className="flex cursor-pointer items-center gap-2"
            >
              <Gift className="h-4 w-4 text-sky-600" />
              <div className="flex flex-col">
                <span className="text-sm">Grant 1-week trial</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  25 searches · expires in 7 days
                </span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onGrantPlan("unlimited")}
              className="flex cursor-pointer items-center gap-2"
            >
              <Gem className="h-4 w-4 text-violet-600" />
              <div className="flex flex-col">
                <span className="text-sm">Grant 3-month unlimited</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  no search cap · expires in 90 days
                </span>
              </div>
            </DropdownMenuItem>
            {user.plan !== "free" && (
              <DropdownMenuItem
                onClick={() => onGrantPlan("free")}
                className="flex cursor-pointer items-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="text-sm">Revert to free tier</span>
              </DropdownMenuItem>
            )}
            <div className="my-1 h-px bg-slate-200/70 dark:bg-slate-800/70" />
            {user.is_restricted ? (
              <DropdownMenuItem
                onClick={onUnrestrict}
                className="flex cursor-pointer items-center gap-2 text-emerald-700 dark:text-emerald-400"
              >
                <CheckCircle2 className="h-4 w-4" />
                Lift restriction
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={onRestrict}
                className="flex cursor-pointer items-center gap-2 text-rose-700 dark:text-rose-400"
              >
                <Ban className="h-4 w-4" />
                Restrict access…
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

function PlanCell({ user }) {
  const plan = user.plan || "free";
  const used = user.searches_used ?? 0;
  const limit = user.searches_limit; // null => unlimited
  const expires = user.plan_expires_at ? new Date(user.plan_expires_at) : null;
  const atLimit = typeof limit === "number" && used >= limit;

  const planConfig = {
    free: {
      label: "Free",
      Icon: Timer,
      chip:
        "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700",
    },
    trial: {
      label: "Trial",
      Icon: Gift,
      chip:
        "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900/50",
    },
    unlimited: {
      label: "Unlimited",
      Icon: Gem,
      chip:
        "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900/50",
    },
  }[plan] || planConfig?.free;

  const cfg = planConfig;
  const PlanIcon = cfg.Icon;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cfg.chip}`}
        >
          <PlanIcon className="h-3 w-3" />
          {cfg.label}
        </span>
        <span
          className={`text-xs ${
            atLimit
              ? "font-medium text-rose-600 dark:text-rose-400"
              : "text-slate-600 dark:text-slate-400"
          }`}
        >
          {limit === null ? "∞ searches" : `${used} / ${limit}`}
        </span>
      </div>
      {expires && (
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          expires {formatExpiry(expires)}
        </span>
      )}
    </div>
  );
}

function formatExpiry(date) {
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return "expired";
  const days = Math.round(diff / 86_400_000);
  if (days < 1) {
    const hours = Math.max(1, Math.round(diff / 3_600_000));
    return `in ${hours}h`;
  }
  if (days < 14) return `in ${days}d`;
  const weeks = Math.round(days / 7);
  if (weeks < 8) return `in ${weeks}w`;
  const months = Math.round(days / 30);
  return `in ${months}mo`;
}

function relativeTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const s = Math.round(diffMs / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 14) return `${days}d ago`;
  const wks = Math.round(days / 7);
  if (wks < 8) return `${wks}w ago`;
  return d.toLocaleDateString();
}
