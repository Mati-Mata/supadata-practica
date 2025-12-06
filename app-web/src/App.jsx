import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet } from "./api/client";
import ReactMarkdown from "react-markdown";
import "./app.css";

/* ---------------- Utils de texto/filtrado ---------------- */
function normalizeText(t = "") { return String(t ?? ""); }
function getLines(text) { return normalizeText(text).split(/\r?\n/); }
function filterLines(lines, q) {
  if (!q) return lines;
  const needle = q.toLowerCase();
  return lines.filter((ln) => ln.toLowerCase().includes(needle));
}

/* ---------------- LocalStorage favoritos ---------------- */
const FAVS_KEY = "supadata:favorites";
function loadFavorites() { try { return JSON.parse(localStorage.getItem(FAVS_KEY) || "[]"); } catch { return []; } }
function saveFavorites(favs) { localStorage.setItem(FAVS_KEY, JSON.stringify(favs)); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

export default function App() {
  const [mode, setMode] = useState("transcript"); // transcript | scrape
  const [url, setUrl] = useState("");
  const [state, setState] = useState("idle");     // idle | loading | error
  const [out, setOut] = useState(null);
  const [err, setErr] = useState("");

  // Filtrado
  const [q, setQ] = useState("");
  const [onlyMatches, setOnlyMatches] = useState(true);

  // Favoritos + cajón
  const [favs, setFavs] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Acordeones
  const [rawOpen, setRawOpen] = useState(true);
  const [mdOpen, setMdOpen] = useState(true);

  // Refs selección
  const refRaw = useRef(null);
  const refMd = useRef(null);

  useEffect(() => { setFavs(loadFavorites()); }, []);
  const favImageSet = useMemo(() => new Set(favs.filter(f => f.kind === "image").map(f => f.imageUrl)), [favs]);

  /* ---------------- Favoritos ---------------- */
  function addFavoriteText(text) {
    const clean = (text || "").trim();
    if (!clean) { alert("Selecciona texto dentro del contenido para guardarlo."); return; }
    const item = { id: uid(), kind: "text", text: clean, url, mode, createdAt: new Date().toISOString() };
    const next = [item, ...favs]; setFavs(next); saveFavorites(next);
  }
  function addFavoriteImage(imageUrl, alt = "") {
    if (!imageUrl || favImageSet.has(imageUrl)) return;
    const item = { id: uid(), kind: "image", imageUrl, alt, url, mode, createdAt: new Date().toISOString() };
    const next = [item, ...favs]; setFavs(next); saveFavorites(next);
  }
  function removeFavorite(id) { const next = favs.filter(f => f.id !== id); setFavs(next); saveFavorites(next); }
  async function copyFavorite(fav) { try { await navigator.clipboard.writeText(fav.kind === "image" ? fav.imageUrl : fav.text); } catch {} }

  function getSelectionFromContent() {
    const sel = window.getSelection?.(); if (!sel || sel.isCollapsed) return "";
    const range = sel.getRangeAt(0);
    const inRaw = refRaw.current?.contains(range.commonAncestorContainer);
    const inMd = refMd.current?.contains(range.commonAncestorContainer);
    if (!inRaw && !inMd) return ""; return sel.toString();
  }
  function handleSaveSelection() {
    const selText = getSelectionFromContent(); addFavoriteText(selText);
    try { window.getSelection()?.removeAllRanges(); } catch {}
  }

  async function run() {
    try {
      setState("loading"); setErr(""); setOut(null);
      if (!url) throw new Error("Ingresa una URL");
      if (mode === "transcript") {
        const data = await apiGet(`/api/transcript?url=${encodeURIComponent(url)}&mode=native&text=true`);
        setOut(data);
      } else {
        const data = await apiGet(`/api/scrape?url=${encodeURIComponent(url)}`);
        setOut(data);
      }
      setState("idle");
    } catch (e) {
      setErr(e.message || "Error desconocido"); setState("error");
    }
  }

  // Resolver URLs relativas en Markdown
  const base = useMemo(() => { try { return new URL(url); } catch { return null; } }, [url]);

  function ImgWithFavorite(props) {
    const { src = "", alt = "", ...rest } = props;
    let finalSrc = src;
    if (base && src && !/^https?:\/\//i.test(src)) finalSrc = new URL(src, base).toString();
    const [hover, setHover] = useState(false);
    const isSaved = favImageSet.has(finalSrc);

    return (
      <span style={{ position: "relative", display: "inline-block", lineHeight: 0 }}
            onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <img src={finalSrc} alt={alt} {...rest} style={{ maxWidth: "100%", height: "auto", borderRadius: 8 }} />
        {(hover || isSaved) && (
          <button
            className={`img-save ${isSaved ? "saved" : ""}`}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!isSaved) addFavoriteImage(finalSrc, alt); }}
            title={isSaved ? "Imagen guardada" : "Guardar imagen como favorita"}
            disabled={isSaved}
          >
            {isSaved ? "✓ Guardado" : "★ Guardar"}
          </button>
        )}
      </span>
    );
  }

  /* ---------------- Render transcript (RAW) ---------------- */
  function RenderTranscript() {
    const content = out?.content ?? "";
    const lines = getLines(content);
    const filtered = filterLines(lines, q);
    const show = onlyMatches ? filtered : lines;

    return (
      <div className="section">
        <div className="accordion">
          <div className="acc-head" onClick={() => setRawOpen(v => !v)}>
            <span className="acc-title">Transcripción (RAW)</span>
            <button className="acc-btn">{rawOpen ? "Ocultar ▲" : "Mostrar ▼"}</button>
          </div>
          {rawOpen && (
            <div className="acc-body">
              <div className="row" style={{ marginBottom: 8 }}>
                <input className="input" style={{ flex: 1 }} placeholder="Palabra clave (ej: api, javascript, supadata)"
                       value={q} onChange={(e) => setQ(e.target.value)} />
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="checkbox" checked={onlyMatches} onChange={(e) => setOnlyMatches(e.target.checked)} />
                  Mostrar solo coincidencias
                </label>
              </div>
              <p style={{ margin: "6px 0 10px" }}>
                {q ? `Coincidencias: ${filtered.length}` : `Líneas totales: ${lines.length}`}
              </p>
              <pre ref={refRaw} className="pre">{show.join("\n")}</pre>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ---------------- Render scrape (RAW + Markdown, en acordeones) ---------------- */
  function RenderScrape() {
    const content = out?.content ?? "";
    const lines = getLines(content);
    const filtered = filterLines(lines, q);
    const show = onlyMatches ? filtered : lines;

    return (
      <div className="section stack">
        {/* Acordeón RAW */}
        <div className="accordion">
          <div className="acc-head" onClick={() => setRawOpen(v => !v)}>
            <span className="acc-title">Resultados filtrados (RAW)</span>
            <button className="acc-btn">{rawOpen ? "Ocultar ▲" : "Mostrar ▼"}</button>
          </div>
          {rawOpen && (
            <div className="acc-body">
              <div className="row" style={{ marginBottom: 8 }}>
                <input className="input" style={{ flex: 1 }} placeholder="Palabra clave (ej: api, node, docs)"
                       value={q} onChange={(e) => setQ(e.target.value)} />
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="checkbox" checked={onlyMatches} onChange={(e) => setOnlyMatches(e.target.checked)} />
                  Mostrar solo coincidencias
                </label>
              </div>
              <p style={{ margin: "6px 0 10px" }}>
                {q ? `Coincidencias: ${filtered.length}` : `Líneas totales: ${lines.length}`}
              </p>
              <pre ref={refRaw} className="pre">{show.join("\n")}</pre>
            </div>
          )}
        </div>

        {/* Acordeón Markdown */}
        <div className="accordion">
          <div className="acc-head" onClick={() => setMdOpen(v => !v)}>
            <span className="acc-title">Contenido Web (Markdown)</span>
            <button className="acc-btn">{mdOpen ? "Ocultar ▲" : "Mostrar ▼"}</button>
          </div>
          {mdOpen && (
            <div className="acc-body">
              <div ref={refMd} className="card" style={{ padding: 14 }}>
                <ReactMarkdown
                  components={{
                    img: (props) => <ImgWithFavorite {...props} />,
                    a: ({ href = "", ...rest }) => {
                      let final = href;
                      if (base && href && !/^https?:\/\//i.test(href)) final = new URL(href, base).toString();
                      return <a href={final} target="_blank" rel="noreferrer" {...rest} />;
                    },
                  }}
                >
                  {content}
                </ReactMarkdown>
              </div>

              {/* Meta opcional */}
              {out?.name && <p className="meta"><strong>Título:</strong> {out.name}</p>}
              {out?.description && <p className="meta"><strong>Descripción:</strong> {out.description}</p>}
              {Array.isArray(out?.urls) && out.urls.length > 0 && (
                <>
                  <h3 style={{ marginTop: 8 }}>Enlaces encontrados</h3>
                  <ul>
                    {out.urls.slice(0, 10).map((u) => <li key={u}>{u}</li>)}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ---------------- Cajón de favoritos ---------------- */
  function FavoritesDrawer() {
    return (
      <>
        <button className="drawer-btn" onClick={() => setDrawerOpen(v => !v)}>
          ⭐ Favoritos ({favs.length})
        </button>

        <aside className={`drawer ${drawerOpen ? "open" : ""}`} aria-hidden={!drawerOpen}>
          <div className="drawer-head">
            <strong>⭐ Favoritos ({favs.length})</strong>
            <button className="btn btn-ghost" onClick={() => setDrawerOpen(false)} aria-label="Cerrar">✕</button>
          </div>
          <div className="drawer-body">
            {favs.length === 0 ? (
              <p className="meta">
                Aún no guardas favoritos. Selecciona texto o guarda imágenes desde “★”.
              </p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
                {favs.map((f) => (
                  <li key={f.id} className="card" style={{ padding: 10 }}>
                    <div className="meta">
                      {new Date(f.createdAt).toLocaleString()} — {f.mode} — {f.url}
                    </div>

                    {f.kind === "image" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <img src={f.imageUrl} alt={f.alt || ""} style={{ maxWidth: 160, height: "auto", borderRadius: 6 }} />
                        <div style={{ fontSize: 13, color: "var(--text)", overflowWrap: "anywhere" }}>
                          {f.alt ? <div><strong>alt:</strong> {f.alt}</div> : null}
                          <div><strong>URL imagen:</strong> {f.imageUrl}</div>
                        </div>
                      </div>
                    ) : (
                      <pre className="pre" style={{ maxHeight: 200 }}>{f.text}</pre>
                    )}

                    <div className="row" style={{ marginTop: 8 }}>
                      <button className="btn" onClick={() => copyFavorite(f)}>
                        {f.kind === "image" ? "Copiar URL" : "Copiar texto"}
                      </button>
                      {f.kind === "image" && (
                        <a href={f.imageUrl} target="_blank" rel="noreferrer">
                          <button className="btn">Abrir imagen</button>
                        </a>
                      )}
                      <button className="btn" onClick={() => removeFavorite(f.id)}>Eliminar</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </>
    );
  }

  /* ---------------- UI principal ---------------- */
  return (
    <div className="app-shell">
      <h1 className="title">WebText Master by MM</h1>
      <p className="subtitle">Transcribe videos o lee páginas web, filtra por palabra y guarda tus fragmentos o imágenes favoritas ✨</p>

      <FavoritesDrawer />

      <div className="card stack">
        <div className="row">
          <label className="kbd">Modo</label>
          <select className="select" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="transcript">Transcripción (video)</option>
            <option value="scrape">Leer Web (Markdown)</option>
          </select>
        </div>

        <input
          className="input"
          placeholder={mode === "transcript" ? "URL de YouTube/TikTok/Instagram/X" : "URL de una página web"}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />

        <div className="row">
          <button className="btn btn-primary" onClick={run}>Consultar</button>
          <button className="btn" onClick={handleSaveSelection}>Guardar selección de texto ★</button>
        </div>

        {state === "loading" && <p>⏳ Cargando…</p>}
        {state === "error" && <p style={{ color: "#fca5a5" }}>⚠️ {err}</p>}
      </div>

      {out && (mode === "transcript" ? <RenderTranscript /> : <RenderScrape />)}
    </div>
  );
}
