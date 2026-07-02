"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../components/useAuth";
import { TopBar } from "../components/TopBar";

function BotStatus() {
  const [botStatus, setBotStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    async function fetchStatus() {
      try {
        const res = await fetch("http://localhost:4000/admin/bot-status");
        if (!res.ok) throw new Error("Failed to fetch status");
        const data = await res.json();
        setBotStatus(data);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();
    interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ maxWidth: "520px" }}>
      <div style={{
        background: "#1a2330", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "16px", padding: "28px",
      }}>
        <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#fff", margin: "0 0 20px" }}>
          WhatsApp Bot Status
        </h3>

        {loading && !botStatus ? (
          <p style={{ color: "#6b7a8d", textAlign: "center", padding: "20px 0" }}>Loading…</p>
        ) : error ? (
          <p style={{ color: "#f87171", textAlign: "center", padding: "20px 0" }}>Error: {error}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{
                width: "12px", height: "12px", borderRadius: "50%",
                background: botStatus?.connected ? "#22c55e" : "#eab308",
                animation: botStatus?.connected ? "none" : "pulse 1.5s infinite",
                display: "inline-block",
              }} />
              <span style={{ fontSize: "18px", fontWeight: 600, color: "#fff", textTransform: "capitalize" }}>
                {typeof botStatus?.status === 'string' ? botStatus.status.replace("_", " ") : "Unknown"}
              </span>
            </div>

            {botStatus?.qr && !botStatus?.connected && (
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: "13px", color: "#6b7a8d", marginBottom: "12px" }}>
                  Scan with WhatsApp
                </p>
                <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", display: "inline-block" }}>
                  <img src={botStatus.qr} alt="QR Code" style={{ width: "220px", height: "220px", display: "block" }} />
                </div>
              </div>
            )}

            {botStatus?.connected && (
              <div style={{
                background: "rgba(34,197,94,0.1)", color: "#4ade80",
                padding: "12px 20px", borderRadius: "10px",
                border: "1px solid rgba(34,197,94,0.2)", fontSize: "14px", textAlign: "center",
              }}>
                Bot connected and ready ✓
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}

export default function WhatsAppPage() {
  const authed = useAuth();

  if (!authed) return null;

  return (
    <div style={{
      minHeight: "100vh", background: "#0f161e",
      fontFamily: "system-ui, sans-serif", color: "#fff",
    }}>
      <TopBar />
      <div style={{ padding: "24px" }}>
        <BotStatus />
      </div>
    </div>
  );
}
