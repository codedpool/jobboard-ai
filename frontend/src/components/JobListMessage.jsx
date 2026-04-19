"use client";

import { memo } from "react";
import { MapPinIcon, ExternalLinkIcon, BriefcaseIcon } from "lucide-react";

/**
 * Renders job tiles from a raw assistant message content string.
 * Extracts the <!--JOBS:{...}--> payload and renders interactive cards.
 */
const JobListMessage = memo(({ content }) => {
  if (!content) return null;

  const match = content.match(/<!--JOBS:(.*?)-->/s);
  if (!match) return null;

  try {
    const payload = JSON.parse(match[1]);
    const jobs = payload.jobs || [];

    if (jobs.length === 0) {
      return (
        <div className="group relative rounded-3xl border border-white/20 bg-gradient-to-br from-white/12 via-white/8 to-white/4 backdrop-blur-2xl px-6 py-8 text-center overflow-hidden shadow-2xl shadow-black/30">
          {/* Inset light effect */}
          <div className="absolute inset-0 rounded-3xl border border-white/30 pointer-events-none" />
          {/* Subtle light reflection */}
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl" />

          <BriefcaseIcon className="relative mx-auto mb-3 size-10 text-white/40" />
          <p className="relative text-sm font-medium text-white/70">
            No jobs found for this search. Try refining your criteria!
          </p>
        </div>
      );
    }

    return (
      <div className="mt-2 space-y-2.5">
        <div className="grid gap-2.5 sm:grid-cols-1">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      </div>
    );
  } catch (err) {
    console.error("Failed to parse JOBS payload", err);
    return null;
  }
});

JobListMessage.displayName = "JobListMessage";

function getScoreColor(score) {
  if (score == null) return "bg-muted text-muted-foreground";
  if (score >= 70)
    return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
  if (score >= 40) return "bg-amber-500/15 text-amber-400 border-amber-500/20";
  return "bg-red-500/15 text-red-400 border-red-500/20";
}

function getScoreColorPremium(score) {
  if (score == null)
    return "border-white/20 bg-gradient-to-br from-white/10 to-white/5 text-white/65 backdrop-blur-sm";
  if (score >= 70)
    return "border-emerald-500/50 bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 text-emerald-200 backdrop-blur-sm group-hover:border-emerald-500/70 group-hover:from-emerald-500/30 group-hover:to-emerald-500/15";
  if (score >= 40)
    return "border-amber-500/50 bg-gradient-to-br from-amber-500/20 to-amber-500/10 text-amber-200 backdrop-blur-sm group-hover:border-amber-500/70 group-hover:from-amber-500/30 group-hover:to-amber-500/15";
  return "border-red-500/50 bg-gradient-to-br from-red-500/20 to-red-500/10 text-red-200 backdrop-blur-sm group-hover:border-red-500/70 group-hover:from-red-500/30 group-hover:to-red-500/15";
}

function getSourceLabel(source) {
  const labels = {
    hn: "HN",
    hackernews: "HN",
    remoteok: "RemoteOK",
    remotive: "Remotive",
    github: "GitHub",
    linkedin: "LinkedIn",
    indeed: "Indeed",
    glassdoor: "Glassdoor",
    wellfound: "Wellfound",
    reddit: "Reddit",
    yc: "YC",
    ycombinator: "YC",
  };
  return labels[source?.toLowerCase()] || source || "Unknown";
}

const JobCard = memo(({ job }) => {
  return (
    <a
      href={job.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col gap-3 rounded-2xl border border-white/20 bg-gradient-to-br from-white/12 via-white/8 to-white/4 p-4 backdrop-blur-2xl transition-all duration-500 hover:border-white/30 hover:from-white/16 hover:via-white/12 hover:to-white/6 hover:shadow-2xl hover:shadow-blue-500/30 overflow-hidden"
    >
      {/* Inset light border for glass effect */}
      <div className="absolute inset-0 rounded-2xl border border-white/30 pointer-events-none opacity-0 group-hover:opacity-40 transition-opacity duration-500" />

      {/* Animated gradient overlay on hover */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-400/0 via-purple-400/0 to-blue-400/0 opacity-0 transition-all duration-500 group-hover:from-blue-500/8 group-hover:via-purple-500/5 group-hover:to-transparent pointer-events-none" />

      {/* Light reflection shimmer */}
      <div className="absolute inset-x-0 -top-20 h-40 bg-gradient-to-b from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-full blur-2xl" />

      {/* Header */}
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="truncate font-semibold text-sm text-white/95 group-hover:text-white transition-all duration-300 drop-shadow-sm">
            {job.title}
            {job.company && (
              <span className="ml-2 font-normal text-white/55 group-hover:text-white/80 transition-colors duration-300">
                @ {job.company}
              </span>
            )}
          </h4>
        </div>
        <ExternalLinkIcon className="relative size-4 shrink-0 text-white/40 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:text-white/90 group-hover:translate-x-0.5" />
      </div>

      {/* Meta row */}
      <div className="relative flex flex-wrap items-center gap-2">
        {/* Source badge */}
        <span className="inline-flex items-center rounded-lg border border-white/25 bg-gradient-to-br from-white/10 to-white/5 px-2.5 py-1 text-xs font-semibold text-white/75 transition-all duration-300 group-hover:border-white/35 group-hover:from-white/15 group-hover:to-white/8 group-hover:text-white/95 backdrop-blur-sm">
          {getSourceLabel(job.source)}
        </span>

        {/* Location */}
        {job.location && (
          <span className="inline-flex items-center gap-1.5 text-xs text-white/55 transition-all duration-300 group-hover:text-white/80">
            <MapPinIcon className="size-3.5" />
            {job.location}
          </span>
        )}

        {/* Score badge */}
        {job.score != null && (
          <span
            className={`ml-auto inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-bold transition-all duration-300 ${getScoreColorPremium(job.score)}`}
          >
            {job.score}%
          </span>
        )}
      </div>

      {/* Reason */}
      {job.reason && (
        <p className="relative line-clamp-2 text-xs leading-relaxed text-white/65 transition-colors duration-300 group-hover:text-white/85">
          {job.reason}
        </p>
      )}
    </a>
  );
});

JobCard.displayName = "JobCard";

export default JobListMessage;
