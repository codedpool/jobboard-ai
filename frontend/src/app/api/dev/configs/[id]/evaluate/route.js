import { getAuth } from "@clerk/nextjs/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function POST(req, context) {
  const { id } = await context.params; // params is a Promise in app router
  const { searchParams } = new URL(req.url);
  const limit = searchParams.get("limit") || "10";

  const auth = getAuth(req);
  const token =
    auth && auth.sessionId ? await auth.getToken().catch(() => null) : null;

  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const res = await fetch(
    `${BACKEND_URL}/api/configs/${id}/evaluate?limit=${limit}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const body = await res.text();

  return new Response(body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "application/json",
    },
  });
}
