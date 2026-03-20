"use client";

import { memo, useState, useCallback } from "react";
import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PLATFORMS = [
  {
    id: "remoteok",
    label: "RemoteOK",
    color: "bg-blue-500/10 border-blue-500/30",
  },
  {
    id: "remotive",
    label: "Remotive",
    color: "bg-purple-500/10 border-purple-500/30",
  },
  { id: "github", label: "GitHub", color: "bg-gray-500/10 border-gray-500/30" },
  {
    id: "hn",
    label: "Hacker News",
    color: "bg-orange-500/10 border-orange-500/30",
  },
  { id: "yc", label: "Y Combinator", color: "bg-red-500/10 border-red-500/30" },
];

export const PlatformSelector = memo(({ onSelect, isLoading = false }) => {
  const [selected, setSelected] = useState([]);

  const togglePlatform = useCallback((platformId) => {
    setSelected((prev) => {
      if (prev.includes(platformId)) {
        return prev.filter((p) => p !== platformId);
      } else {
        return [...prev, platformId];
      }
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (selected.length > 0) {
      onSelect(selected);
    }
  }, [selected, onSelect]);

  const allSelected = selected.length === PLATFORMS.length;
  const noneSelected = selected.length === 0;

  return (
    <div className="mx-auto w-full max-w-3xl rounded-lg border border-border/50 bg-muted/30 p-6 space-y-4">
      <div className="space-y-2">
        <h3 className="font-semibold text-foreground">Select Job Platforms</h3>
        <p className="text-sm text-muted-foreground">
          Choose which platforms to search for jobs:
        </p>
      </div>

      {/* Platform Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {PLATFORMS.map((platform) => {
          const isSelected = selected.includes(platform.id);
          return (
            <button
              key={platform.id}
              onClick={() => togglePlatform(platform.id)}
              disabled={isLoading}
              className={cn(
                "relative flex items-center gap-2 rounded-lg border-2 p-3 transition-all",
                "hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-border/30 hover:bg-accent/50",
                platform.color,
              )}
            >
              <div className="flex-1 text-left">
                <span className="text-sm font-medium text-foreground">
                  {platform.label}
                </span>
              </div>
              {isSelected && <CheckIcon className="h-4 w-4 text-primary" />}
            </button>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <Button
          onClick={() => {
            setSelected(PLATFORMS.map((p) => p.id));
          }}
          variant="outline"
          size="sm"
          disabled={isLoading || allSelected}
        >
          Select All
        </Button>
        <Button
          onClick={() => setSelected([])}
          variant="outline"
          size="sm"
          disabled={isLoading || noneSelected}
        >
          Clear
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={noneSelected || isLoading}
          size="sm"
          className="ml-auto"
        >
          {isLoading ? "Processing..." : `Search (${selected.length})`}
        </Button>
      </div>
    </div>
  );
});

PlatformSelector.displayName = "PlatformSelector";
