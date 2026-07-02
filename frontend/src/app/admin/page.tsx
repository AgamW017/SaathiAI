"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    // If already logged in, redirect to whatsapp
    if (sessionStorage.getItem("admin_authed") === "true") {
      router.push("/admin/whatsapp");
    }
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (user === "admin" && pass === "admin") {
      sessionStorage.setItem("admin_authed", "true");
      router.push("/admin/whatsapp");
    } else {
      setError("Invalid credentials");
      // setPass("");
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0f161e",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, sans-serif",
    }}>
      <div style={{
        background: "#1a2330",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "20px",
        padding: "40px",
        width: "360px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{
            width: "48px", height: "48px", borderRadius: "12px",
            background: "#fa5d00",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: "12px",
          }}>
            <svg width="26" height="26" viewBox="0 0 36 36" fill="none">
              <path d="M9 27c0-5 4-8.5 9-8.5s9 3.5 9 8.5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="18" cy="13" r="5" fill="#fff" />
            </svg>
          </div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "#fff" }}>SaathiAI Admin</div>
          <div style={{ fontSize: "13px", color: "#6b7a8d", marginTop: "4px" }}>Internal tools & demos</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#8a96a3", display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Username
            </label>
            <input
              type="text"
              value={user}
              onChange={(e) => { setUser(e.target.value); setError(""); }}
              placeholder="admin"
              style={{
                width: "100%", padding: "11px 14px", borderRadius: "10px",
                border: "1.5px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.05)", color: "#fff",
                fontSize: "14px", fontFamily: "inherit", outline: "none",
                boxSizing: "border-box",
              }}
              autoFocus
            />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#8a96a3", display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Password
            </label>
            <input
              type="password"
              value={pass}
              onChange={(e) => { setPass(e.target.value); setError(""); }}
              placeholder="••••••"
              style={{
                width: "100%", padding: "11px 14px", borderRadius: "10px",
                border: `1.5px solid ${error ? "#dc2626" : "rgba(255,255,255,0.1)"}`,
                background: "rgba(255,255,255,0.05)", color: "#fff",
                fontSize: "14px", fontFamily: "inherit", outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <div style={{ fontSize: "13px", color: "#f87171", background: "rgba(220,38,38,0.1)", padding: "10px 14px", borderRadius: "8px", border: "1px solid rgba(220,38,38,0.2)" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            style={{
              marginTop: "6px", padding: "12px", borderRadius: "10px",
              border: "none", background: "#004038", color: "#fff",
              fontSize: "14px", fontWeight: 600, cursor: "pointer",
              fontFamily: "inherit", transition: "background 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#005c50"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#004038"; }}
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
