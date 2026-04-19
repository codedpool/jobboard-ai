import { getAuth } from "@clerk/nextjs/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function POST(req, { params }) {
  const auth = getAuth(req);
  if (!auth.userId) {
    return Response.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const token = await auth.getToken();
  if (!token) {
    return Response.json({ error: "Missing token" }, { status: 401 });
  }

  const { userId } = await params;

  const res = await fetch(
    `${BACKEND_URL}/api/admin/users/${encodeURIComponent(userId)}/unrestrict`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const data = await res.json().catch(() => ({}));
  return Response.json(data, { status: res.status });
}
