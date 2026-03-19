import { getAuth } from "@clerk/nextjs/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

async function getClerkToken(req) {
  const auth = getAuth(req);
  if (!auth.userId) return null;
  try {
    return await auth.getToken();
  } catch {
    return null;
  }
}

// GET /api/threads/[id]/messages → list messages for a thread
export async function GET(req, { params }) {
  const token = await getClerkToken(req);
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { id } = await params;

  const res = await fetch(`${BACKEND_URL}/api/threads/${id}/messages`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

// POST /api/threads/[id]/messages → add message to thread
export async function POST(req, { params }) {
  const token = await getClerkToken(req);
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { id } = await params;
  const body = await req.json();

  const res = await fetch(`${BACKEND_URL}/api/threads/${id}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
