import { getAuth } from "@clerk/nextjs/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function GET(req) {
  const auth = getAuth(req);

  if (!auth.userId) {
    return new Response(
      JSON.stringify({ error: "Unauthenticated (getAuth)" }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Use the session token, no custom JWT template
  const token = await auth.getToken(); // session_token by default

  if (!token) {
    return new Response(
      JSON.stringify({ error: "Missing Clerk session token" }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const res = await fetch(`${BACKEND_URL}/api/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();

  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
