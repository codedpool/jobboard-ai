"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export default function DevPage() {
  const { isSignedIn, user } = useUser();
  const [configs, setConfigs] = useState([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [fetchingId, setFetchingId] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState("");

  async function loadConfigs() {
    setLoadingConfigs(true);
    setError("");
    try {
      const res = await fetch("/api/dev/configs");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Error ${res.status}`);
      }
      setConfigs(data);
    } catch (e) {
      setError(e.message || "Failed to load configs");
    } finally {
      setLoadingConfigs(false);
    }
  }

  async function runFetch(configId) {
    setFetchingId(configId);
    setError("");
    setLastResult(null);
    try {
      const res = await fetch(`/api/dev/configs/${configId}/fetch`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.error || `Error ${res.status}`);
      }
      setLastResult(data);
    } catch (e) {
      setError(e.message || "Fetch failed");
    } finally {
      setFetchingId(null);
    }
  }

  useEffect(() => {
    if (isSignedIn) {
      loadConfigs();
    }
  }, [isSignedIn]);

  if (!isSignedIn) {
    return (
      <main className="flex h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Sign in to use dev tools.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 space-y-4 bg-background">
      <h1 className="text-xl font-semibold">Dev Tools</h1>
      <p className="text-sm text-muted-foreground">
        User: {user?.id} ({user?.primaryEmailAddress?.emailAddress || "no email"})
      </p>

      <div className="flex items-center gap-3">
        <Button onClick={loadConfigs} disabled={loadingConfigs}>
          {loadingConfigs ? "Loading configs..." : "Reload configs"}
        </Button>
        {error && (
          <span className="text-sm text-red-500">
            {error}
          </span>
        )}
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Job Configs</h2>
        {configs.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No configs yet. Create one from the chat by describing a job search and selecting platforms.
          </p>
        )}
        <ul className="space-y-2">
          {configs.map((c) => (
            <li
              key={c.id}
              className="border border-border rounded-md p-3 text-sm space-y-1"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{c.parsed_role || c.raw_query}</div>
                  <div className="text-xs text-muted-foreground">
                    Platforms: {(c.platforms || []).join(", ") || "none"} · Seniority: {c.seniority || "any"}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => runFetch(c.id)}
                  disabled={fetchingId === c.id}
                >
                  {fetchingId === c.id ? "Fetching..." : "Fetch jobs"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {lastResult && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Last Fetch Result</h2>
          <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
            {JSON.stringify(
              {
                config_id: lastResult.config_id,
                counts: lastResult.counts,
                total_inserted: lastResult.total_inserted,
              },
              null,
              2
            )}
          </pre>
        </section>
      )}
    </main>
  );
}
