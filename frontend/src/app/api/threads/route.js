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

// GET /api/threads → list threads
export async function GET(req) {
  const token = await getClerkToken(req);
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const res = await fetch(`${BACKEND_URL}/api/threads`, {
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

// POST /api/threads → create thread
export async function POST(req) {
  const token = await getClerkToken(req);
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is OK for creating a thread
  }

  const res = await fetch(`${BACKEND_URL}/api/threads`, {
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

// DELETE /api/threads → delete thread (body contains { threadId })
export async function DELETE(req) {
  const token = await getClerkToken(req);
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Missing threadId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { threadId } = body;
  if (!threadId) {
    return new Response(JSON.stringify({ error: "Missing threadId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const res = await fetch(`${BACKEND_URL}/api/threads/${threadId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 204) {
    return new Response(null, { status: 204 });
  }

  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
