import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet } from "./api/client";
import ReactMarkdown from "react-markdown";

// --- Utils de texto/filtrado ---
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

// --- LocalStorage helpers para favoritos ---
const FAVS_KEY = "supadata:favorites";
function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAVS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveFavorites(favs) {
  localStorage.setItem(FAVS_KEY, JSON.stringify(favs));
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export default function App() {
  const [mode, setMode] = useState("transcript"); // transcript | scrape
  const [url, setUrl] = useState("");
  const [state, setState] = useState("idle");     // idle | loading | error
  const [out, setOut] = useState(null);
  const [err, setErr] = useState("");

  // Filtrado
  const [q, setQ] = useState("");
  const [onlyMatches, setOnlyMatches] = useState(true);

  // Favoritos
  const [favs, setFavs] = useState([]);

  // Refs para selección de texto (raw/markdown)
  const refRaw = useRef(null);
  const refMd = useRef(null);

  useEffect(() => {
    setFavs(loadFavorites());
  }, []);

  // ---- Favoritos: texto o imagen ----
  function addFavoriteText(text) {
    const clean = (text || "").trim();
    if (!clean) {
      alert("Selecciona texto dentro del contenido para guardarlo.");
      return;
    }
    const item = {
      id: uid(),
      kind: "text",
      text: clean,
      url,          // URL fuente
      mode,         // transcript | scrape
      createdAt: new Date().toISOString(),
    };
    const next = [item, ...favs];
    setFavs(next);
    saveFavorites(next);
  }

  function addFavoriteImage(imageUrl, alt = "") {
    if (!imageUrl) return;
    const item = {
      id: uid(),
      kind: "image",
      imageUrl,
      alt,
      url,          // URL fuente
      mode,
      createdAt: new Date().toISOString(),
    };
    const next = [item, ...favs];
    setFavs(next);
    saveFavorites(next);
  }

  function removeFavorite(id) {
    const next = favs.filter((f) => f.id !== id);
    setFavs(next);
    saveFavorites(next);
  }

  async function copyFavorite(fav) {
    try {
      const toCopy = fav.kind === "image" ? fav.imageUrl : fav.text;
      await navigator.clipboard.writeText(toCopy);
    } catch {}
  }

  // Capturar selección de texto solo dentro de nuestros contenedores
  function getSelectionFromContent() {
    const sel = window.getSelection?.();
    if (!sel || sel.isCollapsed) return "";
    const range = sel.getRangeAt(0);
    const inRaw = refRaw.current?.contains(range.commonAncestorContainer);
    const inMd = refMd.current?.contains(range.commonAncestorContainer);
    if (!inRaw && !inMd) return "";
    return sel.toString();
  }

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

  // Base para resolver URLs relativas en imágenes/enlaces
  const base = useMemo(() => {
    try { return new URL(url); } catch { return null; }
  }, [url]);

  // ---- Componente IMG con botón "★ Guardar" al hover ----
  function ImgWithFavorite(props) {
    const { src = "", alt = "", ...rest } = props;
    let finalSrc = src;
    if (base && src && !/^https?:\/\//i.test(src)) {
      finalSrc = new URL(src, base).toString();
    }
    const [hover, setHover] = useState(false);

    return (
      <span
        style={{ position: "relative", display: "inline-block", lineHeight: 0 }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <img
          src={finalSrc}
          alt={alt}
          {...rest}
          style={{ maxWidth: "100%", height: "auto", borderRadius: 6 }}
        />
        {hover && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              addFavoriteImage(finalSrc, alt);
            }}
            title="Guardar imagen como favorita"
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              padding: "6px 10px",
              borderRadius: 16,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "rgba(255,255,255,0.9)",
              cursor: "pointer",
              fontWeight: 600,
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            }}
          >
            ★ Guardar
          </button>
        )}
      </span>
    );
  }

  // ---- Render transcript (texto) ----
  function renderTranscript() {
    const content = out?.content ?? "";
    const lines = getLines(content);
    const filtered = filterLines(lines, q);
    const show = onlyMatches ? filtered : lines;

    return (
      <>
        <h2>Transcripción</h2>

        {/* Filtros */}
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

        {/* RAW (seleccionable) */}
        <pre
          ref={refRaw}
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

  // ---- Render scrape (markdown + filtrado) ----
  function renderScrape() {
    const content = out?.content ?? "";
    const lines = getLines(content);
    const filtered = filterLines(lines, q);
    const show = onlyMatches ? filtered : lines;

    return (
      <>
        <h2>Contenido Web (Markdown)</h2>

        {/* Filtros */}
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

        {/* RAW filtrado (seleccionable) */}
        <details open style={{ marginBottom: 12 }}>
          <summary style={{ cursor: "pointer", userSelect: "none" }}>
            {onlyMatches ? "Resultados filtrados" : "Contenido (sin filtrar)"}
          </summary>
          <pre
            ref={refRaw}
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

        {/* Markdown completo (con botón de favorito sobre imágenes) */}
        <div
          ref={refMd}
          style={{
            background: "#f6f8fa",
            padding: 12,
            borderRadius: 8,
          }}
        >
          <ReactMarkdown
            components={{
              img: (props) => <ImgWithFavorite {...props} />,
              a: ({ href = "", ...rest }) => {
                let finalHref = href;
                if (base && href && !/^https?:\/\//i.test(href)) {
                  finalHref = new URL(href, base).toString();
                }
                return <a href={finalHref} target="_blank" rel="noreferrer" {...rest} />;
              },
            }}
          >
            {content}
          </ReactMarkdown>
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

  // Guardar selección de texto (raw/markdown)
  function handleSaveSelection() {
    const selText = getSelectionFromContent();
    addFavoriteText(selText);
    try { window.getSelection()?.removeAllRanges(); } catch {}
  }

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 1000, margin: "40px auto" }}>
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

      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button onClick={run} style={{ padding: "8px 12px" }}>Consultar</button>
        <button onClick={handleSaveSelection} style={{ padding: "8px 12px" }}>
          Guardar selección de texto ★
        </button>
      </div>

      {state === "loading" && <p style={{ marginTop: 12 }}>Cargando…</p>}
      {state === "error" && (
        <p style={{ marginTop: 12, color: "crimson" }}>{err}</p>
      )}

      {out && (
        <section style={{ marginTop: 16 }}>
          {mode === "transcript" ? renderTranscript() : renderScrape()}
        </section>
      )}

      {/* Panel de favoritos */}
      <section style={{ marginTop: 28 }}>
        <h2>⭐ Favoritos</h2>
        {favs.length === 0 ? (
          <p>
            Aún no guardas favoritos. Selecciona texto del contenido y usa
            “Guardar selección de texto”, o pasa el mouse sobre una imagen y
            pulsa “★ Guardar”.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
            {favs.map((f) => (
              <li key={f.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>
                  {new Date(f.createdAt).toLocaleString()} — {f.mode} — {f.url}
                </div>

                {f.kind === "image" ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <img
                      src={f.imageUrl}
                      alt={f.alt || ""}
                      style={{ maxWidth: 220, height: "auto", borderRadius: 6 }}
                    />
                    <div style={{ fontSize: 13, color: "#333" }}>
                      {f.alt ? <div><strong>alt:</strong> {f.alt}</div> : null}
                      <div><strong>URL imagen:</strong> {f.imageUrl}</div>
                    </div>
                  </div>
                ) : (
                  <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{f.text}</pre>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <button onClick={() => copyFavorite(f)}>
                    {f.kind === "image" ? "Copiar URL" : "Copiar texto"}
                  </button>
                  {f.kind === "image" && (
                    <a href={f.imageUrl} target="_blank" rel="noreferrer">
                      <button>Abrir imagen</button>
                    </a>
                  )}
                  <button onClick={() => removeFavorite(f.id)}>Eliminar</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
