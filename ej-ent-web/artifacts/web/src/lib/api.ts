const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function getToken(): string | null {
  return localStorage.getItem("access_token");
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
}

export async function register(email: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    let msg = "Registration failed. Please try again.";
    try {
      const body = await res.json();
      if (body?.detail || body?.message || body?.error) {
        msg = body.detail ?? body.message ?? body.error;
      }
    } catch {}
    throw new Error(msg);
  }
}

export async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    let msg = "Invalid credentials. Please try again.";
    try {
      const body = await res.json();
      if (body?.detail || body?.message || body?.error) {
        msg = body.detail ?? body.message ?? body.error;
      }
    } catch {}
    throw new Error(msg);
  }

  const data = await res.json();
  const token: string = data.access_token;
  if (!token) throw new Error("No access token returned from server.");
  return token;
}

export interface Record {
  id: string | number;
  title: string;
  description: string;
  created_at: string;
}

export async function getRecords(): Promise<Record[]> {
  const res = await fetch(`${API_BASE_URL}/records`, {
    headers: authHeaders(),
  });

  if (res.status === 401) {
    localStorage.removeItem("access_token");
    window.location.href = "/";
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) throw new Error("Failed to fetch records.");
  return res.json();
}

export async function createRecord(
  title: string,
  description: string,
): Promise<Record> {
  const res = await fetch(`${API_BASE_URL}/records`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ title, description }),
  });

  if (res.status === 401) {
    localStorage.removeItem("access_token");
    window.location.href = "/";
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    let msg = "Failed to create record.";
    try {
      const body = await res.json();
      if (body?.detail || body?.message || body?.error) {
        msg = body.detail ?? body.message ?? body.error;
      }
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export async function updateRecord(
  id: string | number,
  title: string,
  description: string,
): Promise<Record> {
  const res = await fetch(`${API_BASE_URL}/records/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ title, description }),
  });

  if (res.status === 401) {
    localStorage.removeItem("access_token");
    window.location.href = "/";
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    let msg = "Failed to update record.";
    try {
      const body = await res.json();
      if (body?.detail || body?.message || body?.error) {
        msg = body.detail ?? body.message ?? body.error;
      }
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export async function deleteRecord(id: string | number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/records/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  if (res.status === 401) {
    localStorage.removeItem("access_token");
    window.location.href = "/";
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    let msg = "Failed to delete record.";
    try {
      const body = await res.json();
      if (body?.detail || body?.message || body?.error) {
        msg = body.detail ?? body.message ?? body.error;
      }
    } catch {}
    throw new Error(msg);
  }
}
