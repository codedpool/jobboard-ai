"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export default function DevPage() {
  const { isSignedIn, user } = useUser();
  const [configs, setConfigs] = useState([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [fetchingId, setFetchingId] = useState(null);
  const [evaluatingId, setEvaluatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [lastEvalResult, setLastEvalResult] = useState(null);
  const [resultsId, setResultsId] = useState(null);
  const [viewingResults, setViewingResults] = useState(null);
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

  async function viewResults(configId) {
    setResultsId(configId);
    setError("");
    setViewingResults(null);
    try {
      const res = await fetch(`/api/dev/configs/${configId}/results?limit=15`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.error || `Error ${res.status}`);
      }
      setViewingResults(data);
    } catch (e) {
      setError(e.message || "Failed to load results");
    } finally {
      setResultsId(null);
    }
  }

  async function runEvaluate(configId) {
    setEvaluatingId(configId);
    setError("");
    setLastEvalResult(null);
    try {
      const res = await fetch(
        `/api/dev/configs/${configId}/evaluate?limit=10`,
        {
          method: "POST",
        },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.error || `Error ${res.status}`);
      }
      setLastEvalResult(data);
    } catch (e) {
      setError(e.message || "Evaluate failed");
    } finally {
      setEvaluatingId(null);
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

  async function deleteConfig(configId) {
    setDeletingId(configId);
    setError("");
    try {
      const res = await fetch(`/api/dev/configs/${configId}`, {
        method: "DELETE",
      });

      // Even if config returns 404, it's already deleted on the backend,
      // so remove it from the UI without showing an error
      if (res.status === 404 || res.ok) {
        setConfigs(configs.filter((c) => c.id !== configId));
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || data.error || `Error ${res.status}`);
      }
    } catch (e) {
      setError(e.message || "Delete failed");
    } finally {
      setDeletingId(null);
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
        User: {user?.id} (
        {user?.primaryEmailAddress?.emailAddress || "no email"})
      </p>

      <div className="flex items-center gap-3">
        <Button onClick={loadConfigs} disabled={loadingConfigs}>
          {loadingConfigs ? "Loading configs..." : "Reload configs"}
        </Button>
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Job Configs</h2>
        {configs.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No configs yet. Create one from the chat by describing a job search
            and selecting platforms.
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
                  <div className="font-medium">
                    {c.parsed_role || c.raw_query}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Platforms: {(c.platforms || []).join(", ") || "none"} ·
                    Seniority: {c.seniority || "any"}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => runFetch(c.id)}
                    disabled={fetchingId === c.id}
                  >
                    {fetchingId === c.id ? "Fetching..." : "Fetch jobs"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runEvaluate(c.id)}
                    disabled={evaluatingId === c.id}
                  >
                    {evaluatingId === c.id ? "Evaluating..." : "Evaluate"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => viewResults(c.id)}
                    disabled={resultsId === c.id}
                  >
                    {resultsId === c.id ? "Loading..." : "View Results"}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteConfig(c.id)}
                    disabled={deletingId === c.id}
                  >
                    {deletingId === c.id ? "Deleting..." : "Delete"}
                  </Button>
                </div>
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
                skipped: lastResult.skipped,
                total_skipped: lastResult.total_skipped,
              },
              null,
              2,
            )}
          </pre>
        </section>
      )}

      {lastEvalResult && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Last Evaluate Result</h2>
          <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto max-h-96">
            {JSON.stringify(lastEvalResult, null, 2)}
          </pre>
        </section>
      )}

      {viewingResults && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">
            Results for {viewingResults.config_id}
          </h2>
          <p className="text-xs text-muted-foreground">
            Total: {viewingResults.count} jobs
          </p>
          <div className="space-y-3">
            {viewingResults.jobs.map((job) => (
              <div
                key={job.id}
                className="border border-border rounded-md p-3 bg-muted/50 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-semibold">{job.title}</div>
                    <div className="text-muted-foreground">{job.company}</div>
                    <div className="text-muted-foreground">
                      {job.location || "Remote"}
                    </div>
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      {job.source}
                    </a>
                  </div>
                  <div className="text-right">
                    {job.score !== null && (
                      <div>
                        <div className="font-semibold text-lg">
                          {job.score}%
                        </div>
                        <div className="text-muted-foreground ">
                          {job.reason || "—"}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
