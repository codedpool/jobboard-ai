"use client";

import { memo, useCallback, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Platform catalogue. The `group` tag drives the visual separation between
 * the big aggregators (surfaced first — these are the ones JobSpy scrapes
 * and where most serious hiring happens) and the niche/community boards.
 */
const PLATFORMS = [
  { id: "linkedin",  label: "LinkedIn",    hint: "the big one",        group: "aggregator" },
  { id: "indeed",    label: "Indeed",      hint: "broad coverage",     group: "aggregator" },
  { id: "google",    label: "Google Jobs", hint: "meta-aggregator",    group: "aggregator" },
  { id: "glassdoor", label: "Glassdoor",   hint: "salary + reviews",   group: "aggregator" },
  { id: "remoteok",  label: "RemoteOK",    hint: "remote-only",        group: "niche" },
  { id: "hn",        label: "Hacker News", hint: "startups",           group: "niche" },
];

const DEFAULT_SELECTED = ["linkedin", "indeed", "google", "remoteok"];

export const PlatformSelector = memo(({ onSelect, isLoading = false }) => {
  const [selected, setSelected] = useState(DEFAULT_SELECTED);

  const toggle = useCallback((id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }, []);

  const handleConfirm = useCallback(() => {
    if (selected.length > 0) onSelect(selected);
  }, [selected, onSelect]);

  const aggregators = PLATFORMS.filter((p) => p.group === "aggregator");
  const niche = PLATFORMS.filter((p) => p.group === "niche");

  return (
    <div className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200/80 bg-white/60 p-5 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/40">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          Where should I look?
        </p>
        <h3 className="mt-1 text-base font-semibold tracking-tight text-slate-900 dark:text-white">
          Pick your boards.{" "}
          <span className="font-serif-display italic font-normal text-slate-400 dark:text-slate-500">
            the big ones are pre-selected.
          </span>
        </h3>
      </div>

      <Section title="Job aggregators" platforms={aggregators} selected={selected} toggle={toggle} disabled={isLoading} />
      <Section title="Niche / community" platforms={niche} selected={selected} toggle={toggle} disabled={isLoading} />

      <div className="mt-5 flex items-center gap-2">
        <button
          onClick={() => setSelected(PLATFORMS.map((p) => p.id))}
          disabled={isLoading || selected.length === PLATFORMS.length}
          className="text-xs text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline disabled:opacity-40 dark:text-slate-400 dark:hover:text-slate-100"
        >
          Select all
        </button>
        <button
          onClick={() => setSelected([])}
          disabled={isLoading || selected.length === 0}
          className="text-xs text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline disabled:opacity-40 dark:text-slate-400 dark:hover:text-slate-100"
        >
          Clear
        </button>
        <Button
          onClick={handleConfirm}
          disabled={selected.length === 0 || isLoading}
          size="sm"
          className="ml-auto h-9 rounded-full bg-slate-900 px-4 text-sm text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Searching…
            </>
          ) : (
            `Search ${selected.length} board${selected.length === 1 ? "" : "s"}`
          )}
        </Button>
      </div>
    </div>
  );
});

PlatformSelector.displayName = "PlatformSelector";

function Section({ title, platforms, selected, toggle, disabled }) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {platforms.map((platform) => {
          const isSelected = selected.includes(platform.id);
          return (
            <button
              key={platform.id}
              onClick={() => toggle(platform.id)}
              disabled={disabled}
              className={cn(
                "group relative flex min-w-0 flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition",
                "disabled:cursor-not-allowed disabled:opacity-50",
                isSelected
                  ? "border-slate-900/40 bg-slate-900/[0.04] shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)] dark:border-white/30 dark:bg-white/[0.06]"
                  : "border-slate-200/80 bg-white/50 hover:border-slate-300 hover:bg-white dark:border-slate-800/80 dark:bg-slate-900/30 dark:hover:border-slate-700 dark:hover:bg-slate-900/60",
              )}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-slate-900 dark:text-white">
                  {platform.label}
                </span>
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition",
                    isSelected
                      ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                      : "border-slate-300 dark:border-slate-600",
                  )}
                >
                  {isSelected && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                </span>
              </div>
              <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                {platform.hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
