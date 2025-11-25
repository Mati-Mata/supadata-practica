import { useState } from "react";
import { apiGet } from "./api/client";
import ReactMarkdown from "react-markdown";

function normalizeText(t = "") {
  return String(t ?? "");
}

function getLines(text) {
  return normalizeText(text).split(/\r?\n/);
}

function filterLines(lines, q) {
  if (!q) return lines;
  const needle = q.toLowerCase();
  return lines.filter((ln) => ln.toLowerCase().includes(needle));
}

export default function App() {
  const [mode, setMode] = useState("transcript"); // transcript | scrape
  const [url, setUrl] = useState("");
  const [state, setState] = useState("idle");     // idle | loading | error
  const [out, setOut] = useState(null);
  const [err, setErr] = useState("");

  // NUEVO: filtrado
  const [q, setQ] = useState("");
  const [onlyMatches, setOnlyMatches] = useState(true);

  async function run() {
    try {
      setState("loading"); setErr(""); setOut(null);
      if (!url) throw new Error("Ingresa una URL");

      if (mode === "transcript") {
        const data = await apiGet(
          `/api/transcript?url=${encodeURIComponent(url)}&mode=native&text=true`
        );
        setOut(data);
      } else {
        const data = await apiGet(`/api/scrape?url=${encodeURIComponent(url)}`);
        setOut(data);
      }
      setState("idle");
    } catch (e) {
      setErr(e.message || "Error desconocido");
      setState("error");
    }
  }

  // Helpers de render según modo
  function renderTranscript() {
    // Puede venir como {status:'completed', content:'...'} o directo {content:'...'}
    const content = out?.content ?? "";
    const lines = getLines(content);
    const filtered = filterLines(lines, q);
    const show = onlyMatches ? filtered : lines;

    return (
      <>
        <h2>Transcripción</h2>

        {/* Controles de filtrado */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <input
            style={{ flex: 1, padding: 8 }}
            placeholder="Palabra clave (ej: api, javascript, supadata)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={onlyMatches}
              onChange={(e) => setOnlyMatches(e.target.checked)}
            />
            Mostrar solo coincidencias
          </label>
        </div>

        <p style={{ margin: "4px 0 8px" }}>
          {q ? `Coincidencias: ${filtered.length}` : `Líneas totales: ${lines.length}`}
        </p>

        <pre
          style={{
            whiteSpace: "pre-wrap",
            background: "#f6f8fa",
            padding: 12,
            borderRadius: 8,
            maxHeight: 480,
            overflow: "auto",
          }}
        >
          {show.join("\n")}
        </pre>
      </>
    );
  }

  function renderScrape() {
    const content = out?.content ?? "";
    const lines = getLines(content);
    const filtered = filterLines(lines, q);
    const show = onlyMatches ? filtered : lines;

    return (
      <>
        <h2>Contenido Web (Markdown)</h2>

        {/* Controles de filtrado */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <input
            style={{ flex: 1, padding: 8 }}
            placeholder="Palabra clave (ej: api, node, docs)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={onlyMatches}
              onChange={(e) => setOnlyMatches(e.target.checked)}
            />
            Mostrar solo coincidencias
          </label>
        </div>

        <p style={{ margin: "4px 0 8px" }}>
          {q ? `Coincidencias: ${filtered.length}` : `Líneas totales: ${lines.length}`}
        </p>

        {/* Vista filtrada (texto plano) */}
        <details open style={{ marginBottom: 12 }}>
          <summary style={{ cursor: "pointer", userSelect: "none" }}>
            {onlyMatches ? "Resultados filtrados" : "Contenido (sin filtrar)"}
          </summary>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "#f6f8fa",
              padding: 12,
              borderRadius: 8,
              maxHeight: 320,
              overflow: "auto",
            }}
          >
            {show.join("\n")}
          </pre>
        </details>

        {/* Vista completa en Markdown (para lectura) */}
        <div
          style={{
            background: "#f6f8fa",
            padding: 12,
            borderRadius: 8,
          }}
        >
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>

        {out?.name && <p><strong>Título:</strong> {out.name}</p>}
        {out?.description && <p><strong>Descripción:</strong> {out.description}</p>}
        {Array.isArray(out?.urls) && out.urls.length > 0 && (
          <>
            <h3>Enlaces encontrados</h3>
            <ul>
              {out.urls.slice(0, 10).map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </>
        )}
      </>
    );
  }

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 900, margin: "40px auto" }}>
      <h1>SupaData Demo</h1>

      <label style={{ display: "block", marginBottom: 8 }}>
        Modo:&nbsp;
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="transcript">Transcripción (video)</option>
          <option value="scrape">Leer Web (Markdown)</option>
        </select>
      </label>

      <input
        style={{ width: "100%", padding: 8, marginBottom: 8 }}
        placeholder={
          mode === "transcript"
            ? "Pega URL de YouTube/TikTok/Instagram/X"
            : "Pega URL de una página web"
        }
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <button onClick={run} style={{ padding: "8px 12px" }}>Consultar</button>

      {state === "loading" && <p style={{ marginTop: 12 }}>Cargando…</p>}
      {state === "error" && (
        <p style={{ marginTop: 12, color: "crimson" }}>{err}</p>
      )}

      {out && (
        <section style={{ marginTop: 16 }}>
          {mode === "transcript" ? renderTranscript() : renderScrape()}
        </section>
      )}
    </main>
  );
}