// app-web/src/api/client.js
export async function apiGet(path) {
  const base = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";
  const res = await fetch(base + path);
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} - ${t}`);
  }
  return res.json();
}
