// server/index.js (proxy SupaData)
import "dotenv/config";
import express from "express";
import cors from "cors";
// Compatibilidad Node < 18:
let fetchFn = globalThis.fetch;
if (!fetchFn) {
  const { default: nodeFetch } = await import("node-fetch");
  fetchFn = nodeFetch;
}

const app = express();
app.use(cors());
app.use(express.json());

const API_BASE = "https://api.supadata.ai/v1";
const API_KEY = process.env.SUPADATA_API_KEY;
const PORT = process.env.PORT || 3000;

if (!API_KEY) console.warn("⚠️ Falta SUPADATA_API_KEY en server/.env");

async function sfetch(pathOrUrl, init = {}) {
  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `${API_BASE}${pathOrUrl}`;
  const res = await fetchFn(url, {
    ...init,
    headers: {
      "x-api-key": API_KEY,
      ...(init.headers || {})
    }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`Upstream ${res.status}: ${text}`);
    err.status = res.status;
    throw err;
  }
  const ct = res.headers.get?.("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.get("/api/transcript", async (req, res) => {
  try {
    const { url, mode = "native", text = "true" } = req.query;
    if (!url) return res.status(400).json({ error: "Falta ?url=" });

    const first = await sfetch(
      `/transcript?url=${encodeURIComponent(url)}&mode=${encodeURIComponent(
        mode
      )}&text=${encodeURIComponent(text)}`
    );

    if (first?.jobId) {
      for (let i = 0; i < 12; i++) {
        await sleep(1000);
        const status = await sfetch(`/transcript/${first.jobId}`);
        if (status?.status === "completed") return res.json(status);
        if (status?.status === "failed")
          return res.status(502).json({ error: status.error || "Job failed" });
      }
      return res.status(202).json({ status: "processing", jobId: first.jobId });
    }
    return res.json(first);
  } catch (err) {
    const code = err.status && err.status >= 400 ? err.status : 500;
    return res.status(code).json({ error: err.message });
  }
});

app.get("/api/scrape", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "Falta ?url=" });
    const data = await sfetch(`/web/scrape?url=${encodeURIComponent(url)}`);
    return res.json(data);
  } catch (err) {
    const code = err.status && err.status >= 400 ? err.status : 500;
    return res.status(code).json({ error: err.message });
  }
});

app.get("/", (_, res) => res.send("SupaData proxy running"));

app.listen(PORT, () => {
  console.log(`Proxy listo en http://localhost:${PORT}`);
});
