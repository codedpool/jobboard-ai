export default function JobListMessage({ message }) {
  if (!message) return null;

  // Extract text depending on whether it's an AI SDK v6 UIMessage
  // (where content lives in parts) or standard string.
  let text = "";
  if (Array.isArray(message.parts)) {
    text = message.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text || "")
      .join("");
  } else if (typeof message.content === "string") {
    text = message.content;
  }

  if (!text) return null;

  const match = text.match(/<!--JOBS:(.*?)-->/s);
  if (!match) return null;

  try {
    const payload = JSON.parse(match[1]);
    const jobs = payload.jobs || [];

    if (jobs.length === 0) {
      return (
        <div className="text-gray-600">No jobs found in this payload.</div>
      );
    }

    return (
      <div className="flex flex-col gap-2 my-2">
        <p>Here are your latest {jobs.length} jobs:</p>
        <div className="space-y-3">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="border rounded-md p-3 text-sm bg-white dark:bg-zinc-900 drop-shadow-sm"
            >
              <div className="font-semibold text-base mb-1">
                {job.title}{" "}
                {job.company && (
                  <span className="font-normal text-gray-700 dark:text-gray-300">
                    - {job.company}
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 mb-2">
                {job.source} &middot; {job.location || "Location N/A"} &middot;
                Score: {job.score ?? "N/A"}
              </div>
              {job.reason && (
                <div className="text-xs text-gray-700 dark:text-gray-300 mt-1 mb-2 italic">
                  {job.reason}
                </div>
              )}
              <a
                href={job.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-block font-medium"
              >
                View job
              </a>
            </div>
          ))}
        </div>
      </div>
    );
  } catch (err) {
    console.error("Failed to parse JOBS payload", err);
    return null;
  }
}
