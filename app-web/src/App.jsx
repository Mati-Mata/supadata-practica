// App.jsx
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
  const [state, setState] = useState("idle"); // idle | loading | error
  const [out, setOut] = useState(null);
  const [err, setErr] = useState("");

  // Filtrado
  const [q, setQ] = useState("");
  const [onlyMatches, setOnlyMatches] = useState(true);

  // Favoritos + cajón
  const [favs, setFavs] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerWidth = 360;

  // Acordeones (RAW / Markdown)
  const [showRawPanel, setShowRawPanel] = useState(true);
  const [showMdPanel, setShowMdPanel] = useState(true);

  // Refs para selección de texto (raw/markdown)
  const refRaw = useRef(null);
  const refMd = useRef(null);

  useEffect(() => {
    setFavs(loadFavorites());
  }, []);

  const favImageSet = useMemo(
    () =>
      new Set(
        favs.filter((f) => f.kind === "image").map((f) => f.imageUrl)
      ),
    [favs]
  );

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
      url,
      mode,
      createdAt: new Date().toISOString(),
    };
    const next = [item, ...favs];
    setFavs(next);
    saveFavorites(next);
  }

  function addFavoriteImage(imageUrl, alt = "") {
    if (!imageUrl) return;
    // Evitar duplicados
    if (favImageSet.has(imageUrl)) return;
    const item = {
      id: uid(),
      kind: "image",
      imageUrl,
      alt,
      url,
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
      setState("loading");
      setErr("");
      setOut(null);
      if (!url) throw new Error("Ingresa una URL");

      if (mode === "transcript") {
        const data = await apiGet(
          `/api/transcript?url=${encodeURIComponent(
            url
          )}&mode=native&text=true`
        );
        setOut(data);
      } else {
        const data = await apiGet(
          `/api/scrape?url=${encodeURIComponent(url)}`
        );
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
    try {
      return new URL(url);
    } catch {
      return null;
    }
  }, [url]);

  // ---- Componente IMG con botón "★ Guardar" que cambia a "✓ Guardado" ----
  function ImgWithFavorite(props) {
    const { src = "", alt = "", ...rest } = props;
    let finalSrc = src;
    if (base && src && !/^https?:\/\//i.test(src)) {
      finalSrc = new URL(src, base).toString();
    }
    const [hover, setHover] = useState(false);
    const isSaved = favImageSet.has(finalSrc);

    return (
      <span
        style={{
          position: "relative",
          display: "inline-block",
          lineHeight: 0,
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <img
          src={finalSrc}
          alt={alt}
          {...rest}
          style={{
            maxWidth: "100%",
            height: "auto",
            borderRadius: 10,
            border: "1px solid rgba(148,163,184,0.4)",
          }}
        />
        {(hover || isSaved) && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!isSaved) addFavoriteImage(finalSrc, alt);
            }}
            title={
              isSaved
                ? "Imagen guardada"
                : "Guardar imagen como favorita"
            }
            disabled={isSaved}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid rgba(15,23,42,0.4)",
              background: isSaved
                ? "rgba(16,185,129,0.95)"
                : "rgba(15,23,42,0.9)",
              color: "white",
              cursor: isSaved ? "default" : "pointer",
              fontWeight: 700,
              fontSize: 12,
              boxShadow: "0 4px 10px rgba(0,0,0,0.35)",
            }}
          >
            {isSaved ? "✓ Guardado" : "★ Guardar"}
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
        <h2
          style={{
            fontSize: 20,
            fontWeight: 600,
            marginBottom: 12,
            textAlign: "left",
            color: "#e5e7eb",
          }}
        >
          Transcripción
        </h2>

        {/* Filtros */}
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginBottom: 8,
            flexWrap: "wrap",
          }}
        >
          <input
            style={{
              flex: 1,
              minWidth: 220,
              padding: 10,
              borderRadius: 999,
              border: "1px solid #1f2937",
              background: "#020617",
              color: "#e5e7eb",
              outline: "none",
            }}
            placeholder="Palabra clave (ej: api, javascript, supadata)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: "#cbd5f5",
            }}
          >
            <input
              type="checkbox"
              checked={onlyMatches}
              onChange={(e) => setOnlyMatches(e.target.checked)}
            />
            Mostrar solo coincidencias
          </label>
        </div>

        <p style={{ margin: "4px 0 12px", color: "#9ca3af", fontSize: 13 }}>
          {q
            ? `Coincidencias: ${filtered.length}`
            : `Líneas totales: ${lines.length}`}
        </p>

        {/* Acordeón RAW */}
        <div
          style={{
            marginTop: 8,
            borderRadius: 14,
            border: "1px solid #1f2937",
            background:
              "radial-gradient(circle at top left,#020617,#020617 50%,#020617)",
            overflow: "hidden",
          }}
        >
          <button
            onClick={() => setShowRawPanel((v) => !v)}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "10px 14px",
              background: "rgba(15,23,42,0.9)",
              border: "none",
              borderBottom: showRawPanel ? "1px solid #1f2937" : "none",
              color: "#e5e7eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              fontWeight: 500,
              fontSize: 14,
            }}
          >
            <span>Texto plano (RAW)</span>
            <span style={{ fontSize: 18 }}>
              {showRawPanel ? "▾" : "▸"}
            </span>
          </button>

          {showRawPanel && (
            <div
              style={{
                padding: 12,
                maxHeight: 480,
                overflow: "auto",
                background: "#020617",
              }}
            >
              <pre
                ref={refRaw}
                style={{
                  whiteSpace: "pre-wrap",
                  margin: 0,
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: "#e5e7eb",
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                }}
              >
                {show.join("\n")}
              </pre>
            </div>
          )}
        </div>
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
        <h2
          style={{
            fontSize: 20,
            fontWeight: 600,
            marginBottom: 12,
            textAlign: "left",
            color: "#e5e7eb",
          }}
        >
          Contenido Web (Markdown)
        </h2>

        {/* Filtros */}
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginBottom: 8,
            flexWrap: "wrap",
          }}
        >
          <input
            style={{
              flex: 1,
              minWidth: 220,
              padding: 10,
              borderRadius: 999,
              border: "1px solid #1f2937",
              background: "#020617",
              color: "#e5e7eb",
              outline: "none",
            }}
            placeholder="Palabra clave (ej: api, node, docs)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: "#cbd5f5",
            }}
          >
            <input
              type="checkbox"
              checked={onlyMatches}
              onChange={(e) => setOnlyMatches(e.target.checked)}
            />
            Mostrar solo coincidencias
          </label>
        </div>

        <p style={{ margin: "4px 0 12px", color: "#9ca3af", fontSize: 13 }}>
          {q
            ? `Coincidencias: ${filtered.length}`
            : `Líneas totales: ${lines.length}`}
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            marginTop: 4,
          }}
        >
          {/* Acordeón RAW filtrado */}
          <div
            style={{
              borderRadius: 14,
              border: "1px solid #1f2937",
              background: "#020617",
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => setShowRawPanel((v) => !v)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 14px",
                background: "rgba(15,23,42,0.9)",
                border: "none",
                borderBottom: showRawPanel ? "1px solid #1f2937" : "none",
                color: "#e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                fontWeight: 500,
                fontSize: 14,
              }}
            >
              <span>Texto plano filtrado (RAW)</span>
              <span style={{ fontSize: 18 }}>
                {showRawPanel ? "▾" : "▸"}
              </span>
            </button>

            {showRawPanel && (
              <div
                style={{
                  padding: 12,
                  maxHeight: 320,
                  overflow: "auto",
                }}
              >
                <pre
                  ref={refRaw}
                  style={{
                    whiteSpace: "pre-wrap",
                    margin: 0,
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: "#e5e7eb",
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                  }}
                >
                  {show.join("\n")}
                </pre>
              </div>
            )}
          </div>

          {/* Acordeón Markdown completo */}
          <div
            style={{
              borderRadius: 14,
              border: "1px solid #1f2937",
              background: "#020617",
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => setShowMdPanel((v) => !v)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 14px",
                background: "rgba(15,23,42,0.9)",
                border: "none",
                borderBottom: showMdPanel ? "1px solid #1f2937" : "none",
                color: "#e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                fontWeight: 500,
                fontSize: 14,
              }}
            >
              <span>Contenido renderizado (Markdown)</span>
              <span style={{ fontSize: 18 }}>
                {showMdPanel ? "▾" : "▸"}
              </span>
            </button>

            {showMdPanel && (
              <div
                ref={refMd}
                style={{
                  padding: 14,
                  background:
                    "radial-gradient(circle at top left,#0f172a,#020617)",
                  borderRadius: "0 0 14px 14px",
                }}
              >
                <ReactMarkdown
                  components={{
                    img: (props) => <ImgWithFavorite {...props} />,
                    a: ({ href = "", ...rest }) => {
                      let finalHref = href;
                      if (
                        base &&
                        href &&
                        !/^https?:\/\//i.test(href)
                      ) {
                        finalHref = new URL(href, base).toString();
                      }
                      return (
                        <a
                          href={finalHref}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            color: "#38bdf8",
                            textDecoration: "underline",
                          }}
                          {...rest}
                        />
                      );
                    },
                  }}
                >
                  {content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>

        {/* Info extra */}
        <div style={{ marginTop: 16, color: "#e5e7eb" }}>
          {out?.name && (
            <p style={{ marginBottom: 4 }}>
              <strong>Título:</strong> {out.name}
            </p>
          )}
          {out?.description && (
            <p style={{ marginBottom: 8 }}>
              <strong>Descripción:</strong> {out.description}
            </p>
          )}
          {Array.isArray(out?.urls) && out.urls.length > 0 && (
            <>
              <h3
                style={{
                  marginTop: 12,
                  marginBottom: 6,
                  fontSize: 15,
                }}
              >
                Enlaces encontrados
              </h3>
              <ul
                style={{
                  paddingLeft: 18,
                  margin: 0,
                  fontSize: 13,
                  color: "#cbd5f5",
                }}
              >
                {out.urls.slice(0, 10).map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </>
    );
  }

  // Guardar selección de texto (raw/markdown)
  function handleSaveSelection() {
    const selText = getSelectionFromContent();
    addFavoriteText(selText);
    try {
      window.getSelection()?.removeAllRanges();
    } catch {}
  }

  // ---- UI del cajón lateral de favoritos ----
  function FavoritesDrawer() {
    return (
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100vh",
          width: drawerOpen ? drawerWidth : 0,
          background: "#020617",
          borderLeft: drawerOpen ? "1px solid #1f2937" : "none",
          boxShadow: drawerOpen
            ? "0 0 24px rgba(0,0,0,0.4)"
            : "none",
          overflow: "hidden",
          transition: "width 220ms ease",
          zIndex: 50,
          pointerEvents: drawerOpen ? "auto" : "none",
          color: "#e5e7eb",
        }}
        aria-hidden={!drawerOpen}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: 12,
            borderBottom: "1px solid #1f2937",
            background:
              "linear-gradient(to right,#0f172a,#020617)",
          }}
        >
          <strong>⭐ Favoritos ({favs.length})</strong>
          <button
            onClick={() => setDrawerOpen(false)}
            aria-label="Cerrar"
            style={{
              borderRadius: 999,
              border: "1px solid #1f2937",
              padding: "4px 8px",
              background: "#020617",
              color: "#e5e7eb",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            padding: 12,
            height: "calc(100% - 48px)",
            overflow: "auto",
          }}
        >
          {favs.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: 13 }}>
              Aún no guardas favoritos. Selecciona texto en el contenido
              o guarda imágenes desde el botón “★”.
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "grid",
                gap: 12,
              }}
            >
              {favs.map((f) => (
                <li
                  key={f.id}
                  style={{
                    border: "1px solid #1f2937",
                    borderRadius: 10,
                    padding: 10,
                    background:
                      "radial-gradient(circle at top left,#020617,#020617 60%,#020617)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "#9ca3af",
                      marginBottom: 6,
                    }}
                  >
                    {new Date(f.createdAt).toLocaleString()} —{" "}
                    {f.mode} — {f.url}
                  </div>

                  {f.kind === "image" ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                      }}
                    >
                      <img
                        src={f.imageUrl}
                        alt={f.alt || ""}
                        style={{
                          maxWidth: 160,
                          height: "auto",
                          borderRadius: 6,
                          border:
                            "1px solid rgba(148,163,184,0.5)",
                        }}
                      />
                      <div
                        style={{
                          fontSize: 13,
                          color: "#e5e7eb",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {f.alt ? (
                          <div>
                            <strong>alt:</strong> {f.alt}
                          </div>
                        ) : null}
                        <div>
                          <strong>URL imagen:</strong> {f.imageUrl}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <pre
                      style={{
                        whiteSpace: "pre-wrap",
                        margin: 0,
                        fontSize: 13,
                        color: "#e5e7eb",
                      }}
                    >
                      {f.text}
                    </pre>
                  )}

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      onClick={() => copyFavorite(f)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: "1px solid #1f2937",
                        background:
                          "linear-gradient(to right,#0f172a,#020617)",
                        color: "#e5e7eb",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      {f.kind === "image"
                        ? "Copiar URL"
                        : "Copiar texto"}
                    </button>
                    {f.kind === "image" && (
                      <a
                        href={f.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <button
                          style={{
                            padding: "6px 10px",
                            borderRadius: 999,
                            border: "1px solid #1f2937",
                            background:
                              "linear-gradient(to right,#0f172a,#020617)",
                            color: "#e5e7eb",
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          Abrir imagen
                        </button>
                      </a>
                    )}
                    <button
                      onClick={() => removeFavorite(f.id)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: "1px solid #b91c1c",
                        background:
                          "linear-gradient(to right,#7f1d1d,#450a0a)",
                        color: "#fee2e2",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    );
  }

  // ---- Render principal ----
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at top,#0b1120,#020617)",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "32px 16px",
        boxSizing: "border-box",
        color: "#e5e7eb",
      }}
    >
      {/* Botón flotante para abrir/cerrar cajón */}
      <button
        onClick={() => setDrawerOpen((v) => !v)}
        title="Abrir favoritos"
        style={{
          position: "fixed",
          top: 16,
          right: drawerOpen ? drawerWidth + 24 : 24,
          zIndex: 60,
          padding: "8px 14px",
          borderRadius: 999,
          border: "1px solid #1f2937",
          background:
            "linear-gradient(to right,#38bdf8,#0ea5e9,#0369a1)",
          color: "#0b1120",
          boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
          transition: "right 220ms ease",
          fontWeight: 700,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        ⭐ Favoritos ({favs.length})
      </button>

      <main
        style={{
          width: "100%",
          maxWidth: 1100,
          background:
            "radial-gradient(circle at top left,#020617,#020617 55%,#020617)",
          borderRadius: 18,
          border: "1px solid rgba(148,163,184,0.3)",
          padding: 24,
          boxShadow: "0 20px 40px rgba(0,0,0,0.45)",
        }}
      >
        <header style={{ marginBottom: 20, textAlign: "center" }}>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: 0.5,
            }}
          >
            WebText Master by MM
          </h1>
          <p
            style={{
              marginTop: 6,
              fontSize: 13,
              color: "#9ca3af",
            }}
          >
            Extrae, filtra y guarda lo mejor del texto de la web y tus
            videos.
          </p>
        </header>

        <section
          style={{
            marginBottom: 18,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              color: "#cbd5f5",
            }}
          >
            Modo:
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid #1f2937",
                background: "#020617",
                color: "#e5e7eb",
                outline: "none",
                fontSize: 13,
              }}
            >
              <option value="transcript">
                Transcripción (video)
              </option>
              <option value="scrape">Leer Web (Markdown)</option>
            </select>
          </label>

          <input
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 999,
              border: "1px solid #1f2937",
              background: "#020617",
              color: "#e5e7eb",
              outline: "none",
              fontSize: 14,
            }}
            placeholder={
              mode === "transcript"
                ? "Pega URL de YouTube/TikTok/Instagram/X"
                : "Pega URL de una página web"
            }
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />

          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 4,
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={run}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: "none",
                background:
                  "linear-gradient(to right,#22c55e,#16a34a)",
                color: "#022c22",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Consultar
            </button>
            <button
              onClick={handleSaveSelection}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: "1px solid #1f2937",
                background:
                  "linear-gradient(to right,#0f172a,#020617)",
                color: "#e5e7eb",
                fontWeight: 500,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Guardar selección de texto ★
            </button>
          </div>

          {state === "loading" && (
            <p style={{ marginTop: 8, color: "#e5e7eb", fontSize: 13 }}>
              Cargando…
            </p>
          )}
          {state === "error" && (
            <p
              style={{
                marginTop: 8,
                color: "#fecaca",
                fontSize: 13,
              }}
            >
              {err}
            </p>
          )}
        </section>

        {out && (
          <section
            style={{
              marginTop: 8,
              marginBottom: 4,
            }}
          >
            {mode === "transcript"
              ? renderTranscript()
              : renderScrape()}
          </section>
        )}

        {/* Cajón lateral */}
        <FavoritesDrawer />
      </main>
    </div>
  );
}
