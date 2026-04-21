"use client";

import { memo } from "react";
import {
  ArrowUpRight,
  BriefcaseIcon,
  Clock,
  Globe2,
  MapPinIcon,
} from "lucide-react";

const SOURCE_LABELS = {
  hn: "HN",
  hackernews: "HN",
  remoteok: "RemoteOK",
  remotive: "Remotive",
  github: "GitHub",
  linkedin: "LinkedIn",
  indeed: "Indeed",
  glassdoor: "Glassdoor",
  google: "Google",
  wellfound: "Wellfound",
  reddit: "Reddit",
  yc: "YC",
  ycombinator: "YC",
};

const getSourceLabel = (src) =>
  SOURCE_LABELS[String(src || "").toLowerCase()] || src || "—";

function scoreTone(score) {
  if (score == null) return "text-slate-500";
  if (score >= 75) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 55) return "text-sky-600 dark:text-sky-400";
  return "text-slate-500 dark:text-slate-400";
}

function scoreChipTone(score) {
  if (score == null)
    return "bg-slate-100 text-slate-500 ring-slate-200/70 dark:bg-slate-800/60 dark:text-slate-400 dark:ring-slate-700/70";
  if (score >= 75)
    return "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/40";
  if (score >= 55)
    return "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900/40";
  return "bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-900/60 dark:text-slate-400 dark:ring-slate-800/70";
}

function formatSalary({ salary_min, salary_max, salary_currency }) {
  if (salary_min == null && salary_max == null) return null;
  const sym = salary_currency === "USD" || !salary_currency ? "$" : "";
  const fmt = (n) => {
    if (n == null) return "";
    if (n >= 1000) return `${Math.round(n / 1000)}k`;
    return String(n);
  };
  const lo = fmt(salary_min);
  const hi = fmt(salary_max);
  if (lo && hi) return `${sym}${lo}–${sym}${hi}`;
  return `${sym}${lo || hi}`;
}

function relativeTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  const days = Math.round(diff / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 8) return `${weeks}w ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}

const JobListMessage = memo(({ content }) => {
  if (!content) return null;

  const match = content.match(/<!--JOBS:(.*?)-->/s);
  if (!match) return null;

  let payload;
  try {
    payload = JSON.parse(match[1]);
  } catch (err) {
    console.error("Failed to parse JOBS payload", err);
    return null;
  }

  const jobs = payload.jobs || [];
  if (jobs.length === 0) {
    return (
      <div className="mt-3 rounded-2xl border border-slate-200/80 bg-white/50 px-5 py-6 text-center text-sm text-slate-500 dark:border-slate-800/80 dark:bg-slate-900/40 dark:text-slate-400">
        <BriefcaseIcon className="mx-auto mb-2 h-6 w-6 opacity-60" />
        No strong matches yet. Try loosening the constraints.
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  );
});

JobListMessage.displayName = "JobListMessage";

const JobCard = memo(({ job }) => {
  const matches = job.matches || {};
  const posted = relativeTime(job.date_posted) || relativeTime(job.created_at);
  const salary = formatSalary(job);

  return (
    <a
      href={job.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/70 p-4 transition hover:border-slate-300 hover:bg-white hover:shadow-[0_12px_36px_-16px_rgba(15,23,42,0.22)] dark:border-slate-800/80 dark:bg-slate-900/40 dark:hover:border-slate-700 dark:hover:bg-slate-900/70"
    >
      {/* thin gradient line on hover */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent opacity-0 transition group-hover:opacity-100" />

      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h4 className="truncate text-[15px] font-semibold text-slate-900 dark:text-white">
              {job.title}
            </h4>
          </div>
          <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
            {job.company || "—"}
            <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
            {getSourceLabel(job.source)}
          </p>
        </div>

        {job.score != null && (
          <span
            className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${scoreChipTone(
              job.score,
            )}`}
          >
            {job.score}% match
          </span>
        )}
        <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-slate-900 dark:group-hover:text-white" />
      </div>

      {/* Meta row: location / salary / posted / remote */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-slate-500 dark:text-slate-400">
        {job.location && (
          <span className="inline-flex items-center gap-1">
            <MapPinIcon className="h-3.5 w-3.5" />
            {job.location}
          </span>
        )}
        {job.is_remote && (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
            <Globe2 className="h-3 w-3" />
            remote
          </span>
        )}
        {salary && (
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {salary}
          </span>
        )}
        {posted && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {posted}
          </span>
        )}
      </div>

      {/* Per-dimension bars — this is the signal users have been missing */}
      {(matches.skills_match != null ||
        matches.seniority_match != null ||
        matches.location_match != null) && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <DimensionBar label="Skills" value={matches.skills_match} />
          <DimensionBar label="Seniority" value={matches.seniority_match} />
          <DimensionBar label="Location" value={matches.location_match} />
        </div>
      )}

      {job.reason && (
        <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
          {job.reason}
        </p>
      )}
    </a>
  );
});

JobCard.displayName = "JobCard";

function DimensionBar({ label, value }) {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  const hasValue = value != null;
  const barTone = !hasValue
    ? "bg-slate-200 dark:bg-slate-700"
    : pct >= 75
      ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
      : pct >= 55
        ? "bg-gradient-to-r from-sky-400 to-violet-500"
        : "bg-slate-300 dark:bg-slate-600";
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500">
        <span>{label}</span>
        <span className={`font-mono ${scoreTone(value)}`}>
          {hasValue ? pct : "—"}
        </span>
      </div>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-full rounded-full ${barTone}`}
          style={{ width: hasValue ? `${pct}%` : "0%" }}
        />
      </div>
    </div>
  );
}

export default JobListMessage;
