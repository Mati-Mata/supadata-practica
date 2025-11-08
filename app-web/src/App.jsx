import { useState } from "react";
import { apiGet } from "./api/client";
import ReactMarkdown from "react-markdown";

export default function App() {
  const [mode, setMode] = useState("transcript"); // transcript | scrape
  const [url, setUrl] = useState("");
  const [state, setState] = useState("idle");     // idle | loading | error
  const [out, setOut] = useState(null);
  const [err, setErr] = useState("");

  async function run() {
    try {
      setState("loading");
      setErr("");
      setOut(null);
      if (!url) throw new Error("Ingresa una URL");

      if (mode === "transcript") {
        // Por defecto: modo 'native' y 'text=true' para recibir texto plano si existe
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
          {mode === "transcript" ? (
            <>
              <h2>Transcripción</h2>
              {"status" in out ? (
                out.status === "completed" ? (
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      background: "#f6f8fa",
                      padding: 12,
                      borderRadius: 8,
                    }}
                  >
                    {out.content}
                  </pre>
                ) : (
                  <p>Procesando… vuelve a intentar en unos segundos.</p>
                )
              ) : (
                <pre
                  style={{
                    whiteSpace: "pre-wrap",
                    background: "#f6f8fa",
                    padding: 12,
                    borderRadius: 8,
                  }}
                >
                  {out.content}
                </pre>
              )}
            </>
          ) : (
            <>
              <h2>Contenido Web</h2>
              {/* Si viene content en Markdown, lo renderizamos; si no, lo mostramos como texto */}
              {out?.content ? (
                <div
                  style={{
                    background: "#f6f8fa",
                    padding: 12,
                    borderRadius: 8,
                  }}
                >
                  <ReactMarkdown>{out.content}</ReactMarkdown>
                </div>
              ) : (
                <pre
                  style={{
                    whiteSpace: "pre-wrap",
                    background: "#f6f8fa",
                    padding: 12,
                    borderRadius: 8,
                  }}
                >
                  {JSON.stringify(out, null, 2)}
                </pre>
              )}

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
          )}
        </section>
      )}
    </main>
  );
}

