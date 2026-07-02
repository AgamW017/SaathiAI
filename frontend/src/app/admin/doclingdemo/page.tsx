"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { marked } from "marked";
import { useAuth } from "../components/useAuth";
import { TopBar } from "../components/TopBar";

function DoclingDemo() {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [markdown, setMarkdown] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (f: File) => {
    setFile(f);
    setMarkdown("");
    setError(null);
    setLoading(true);

    const formData = new FormData();
    formData.append("file", f);

    try {
      const res = await fetch("http://localhost:4000/admin/docling-demo", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Parse failed");
      
      setMarkdown(typeof data.markdown === "string" ? data.markdown : "");
      setPages(typeof data.pages === "number" ? data.pages : null);
    } catch (err: any) {
      setError(typeof err.message === "string" ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  }, [processFile]);

  const [renderedHtml, setRenderedHtml] = useState<string>("");

  useEffect(() => {
    if (!markdown) { setRenderedHtml(""); return; }
    const html = marked.parse(markdown);
    if (typeof html === "string") {
      setRenderedHtml(html);
    } else {
      html.then(setRenderedHtml);
    }
  }, [markdown]);

  const panelStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    background: "#1a2330",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "16px",
    overflow: "hidden",
  };

  const panelHeaderStyle: React.CSSProperties = {
    padding: "12px 18px",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    fontSize: "12px",
    fontWeight: 700,
    color: "#8a96a3",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexShrink: 0,
  };

  return (
    <div style={{
      display: "flex",
      gap: "16px",
      height: "calc(100vh - 120px)",
      minHeight: "600px",
    }}>
      {/* ── LEFT: Upload ── */}
      <div style={{ ...panelStyle, maxWidth: "340px", flex: "0 0 340px" }}>
        <div style={panelHeaderStyle}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
          Document
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => inputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? "#fa5d00" : "rgba(255,255,255,0.15)"}`,
              borderRadius: "14px",
              padding: "32px 20px",
              textAlign: "center",
              cursor: "pointer",
              background: dragOver ? "rgba(250,93,0,0.06)" : "rgba(255,255,255,0.02)",
              transition: "all 0.15s ease",
              marginBottom: "20px",
            }}
          >
            <div style={{ fontSize: "32px", marginBottom: "10px" }}>📄</div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "#fff", marginBottom: "6px" }}>
              Drop document here
            </div>
            <div style={{ fontSize: "12px", color: "#6b7a8d" }}>
              PDF, DOCX, PNG, JPG · max 20 MB
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
              style={{ display: "none" }}
              onChange={handleFileInput}
            />
          </div>

          {/* File info */}
          {file && (
            <div style={{
              background: "rgba(255,255,255,0.04)", borderRadius: "10px",
              padding: "12px 14px", marginBottom: "14px",
              border: "1px solid rgba(255,255,255,0.07)",
            }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#e2e8f0", wordBreak: "break-all" }}>
                {file.name}
              </div>
              <div style={{ fontSize: "11px", color: "#6b7a8d", marginTop: "4px" }}>
                {(file.size / 1024).toFixed(1)} KB · {file.type || "unknown type"}
                {pages !== null && <span> · {pages} page{pages !== 1 ? "s" : ""}</span>}
              </div>
            </div>
          )}

          {/* Status */}
          {loading && (
            <div style={{
              background: "rgba(0,64,56,0.3)", borderRadius: "10px",
              padding: "12px 16px", color: "#4ade80",
              fontSize: "13px", display: "flex", alignItems: "center", gap: "10px",
              border: "1px solid rgba(34,197,94,0.15)",
            }}>
              <span style={{
                display: "inline-block", width: "14px", height: "14px",
                border: "2px solid rgba(74,222,128,0.3)", borderTopColor: "#4ade80",
                borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0,
              }} />
              Running Docling…
            </div>
          )}

          {error && (
            <div style={{
              background: "rgba(220,38,38,0.1)", borderRadius: "10px",
              padding: "12px 16px", color: "#f87171", fontSize: "13px",
              border: "1px solid rgba(220,38,38,0.2)",
            }}>
              {error}
            </div>
          )}

          {markdown && !loading && (
            <div style={{
              background: "rgba(34,197,94,0.08)", borderRadius: "10px",
              padding: "12px 16px", color: "#4ade80", fontSize: "13px",
              border: "1px solid rgba(34,197,94,0.15)",
              display: "flex", alignItems: "center", gap: "8px",
            }}>
              ✓ Parsed — {markdown.length.toLocaleString()} chars
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Markdown code + Rendered ── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Top half: raw markdown */}
        <div style={{ ...panelStyle, flex: 1 }}>
          <div style={panelHeaderStyle}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
            Raw Markdown
            {markdown && (
              <button
                onClick={() => navigator.clipboard.writeText(markdown)}
                style={{
                  marginLeft: "auto", padding: "3px 10px", borderRadius: "6px",
                  border: "1px solid rgba(255,255,255,0.15)", background: "transparent",
                  color: "#8a96a3", fontSize: "11px", cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Copy
              </button>
            )}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "0" }}>
            {markdown ? (
              <pre style={{
                margin: 0, padding: "16px 18px",
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                fontSize: "12px", lineHeight: 1.7,
                color: "#a8c4d4", background: "transparent",
                whiteSpace: "pre-wrap", wordBreak: "break-word",
                minHeight: "100%",
              }}>
                {markdown}
              </pre>
            ) : (
              <div style={{
                height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                color: "#3a4556", fontSize: "13px",
              }}>
                {loading ? "Parsing…" : "Upload a document to see markdown"}
              </div>
            )}
          </div>
        </div>

        {/* Bottom half: rendered */}
        <div style={{ ...panelStyle, flex: 1 }}>
          <div style={panelHeaderStyle}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
            Rendered Output
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
            {renderedHtml ? (
              <div
                className="docling-rendered"
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
                style={{
                  color: "#c8d6e5",
                  fontSize: "14px",
                  lineHeight: 1.75,
                  fontFamily: "system-ui, sans-serif",
                }}
              />
            ) : (
              <div style={{
                height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                color: "#3a4556", fontSize: "13px",
              }}>
                {loading ? "Rendering…" : "Rendered document will appear here"}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .docling-rendered h1 { color: #e2e8f0; font-size: 20px; margin: 0 0 12px; }
        .docling-rendered h2 { color: #e2e8f0; font-size: 17px; margin: 18px 0 8px; }
        .docling-rendered h3 { color: #e2e8f0; font-size: 15px; margin: 14px 0 6px; }
        .docling-rendered p { margin: 0 0 12px; }
        .docling-rendered ul, .docling-rendered ol { padding-left: 20px; margin: 0 0 12px; }
        .docling-rendered li { margin-bottom: 4px; }
        .docling-rendered code { background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; font-size: 12px; font-family: monospace; }
        .docling-rendered pre { background: rgba(0,0,0,0.3); padding: 14px; border-radius: 8px; overflow-x: auto; margin: 0 0 12px; }
        .docling-rendered table { border-collapse: collapse; width: 100%; margin: 0 0 14px; }
        .docling-rendered th, .docling-rendered td { border: 1px solid rgba(255,255,255,0.1); padding: 8px 12px; text-align: left; }
        .docling-rendered th { background: rgba(255,255,255,0.06); color: #e2e8f0; font-weight: 600; }
        .docling-rendered blockquote { border-left: 3px solid #fa5d00; margin: 0 0 12px; padding: 8px 14px; background: rgba(250,93,0,0.06); color: #8a96a3; }
        .docling-rendered a { color: #60a5fa; }
        .docling-rendered strong { color: #e2e8f0; }
        .docling-rendered hr { border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 16px 0; }
      `}</style>
    </div>
  );
}

export default function DoclingDemoPage() {
  const authed = useAuth();

  if (!authed) return null;

  return (
    <div style={{
      minHeight: "100vh", background: "#0f161e",
      fontFamily: "system-ui, sans-serif", color: "#fff",
    }}>
      <TopBar />
      <div style={{ padding: "24px" }}>
        <DoclingDemo />
      </div>
    </div>
  );
}
