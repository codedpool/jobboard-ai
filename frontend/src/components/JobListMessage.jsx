"use client";

import { memo } from "react";
import {
  MapPinIcon,
  ExternalLinkIcon,
  BriefcaseIcon,
} from "lucide-react";

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
        <div className="rounded-xl border border-border/50 bg-muted/30 px-4 py-6 text-center">
          <BriefcaseIcon className="mx-auto mb-2 size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
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
  if (score >= 70) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
  if (score >= 40) return "bg-amber-500/15 text-amber-400 border-amber-500/20";
  return "bg-red-500/15 text-red-400 border-red-500/20";
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
      className="group flex flex-col gap-2 rounded-xl border border-border/50 bg-card/50 p-3.5 transition-all duration-200 hover:border-border hover:bg-card hover:shadow-md hover:shadow-black/5"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="truncate font-medium text-sm text-foreground group-hover:text-primary transition-colors">
            {job.title}
            {job.company && (
              <span className="ml-1.5 font-normal text-muted-foreground">
                at {job.company}
              </span>
            )}
          </h4>
        </div>
        <ExternalLinkIcon className="size-3.5 shrink-0 text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Source badge */}
        <span className="inline-flex items-center rounded-md border border-border/50 bg-muted/50 px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
          {getSourceLabel(job.source)}
        </span>

        {/* Location */}
        {job.location && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPinIcon className="size-3" />
            {job.location}
          </span>
        )}

        {/* Score badge */}
        {job.score != null && (
          <span
            className={`ml-auto inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-semibold ${getScoreColor(job.score)}`}
          >
            {job.score}%
          </span>
        )}
      </div>

      {/* Reason */}
      {job.reason && (
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground/80">
          {job.reason}
        </p>
      )}
    </a>
  );
});

JobCard.displayName = "JobCard";

export default JobListMessage;
