"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();

  const tabBtn = (path: string, label: string, icon: React.ReactNode) => {
    const active = pathname === path;
    return (
      <Link
        href={path}
        style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "8px 18px", borderRadius: "10px", border: "none",
          background: active ? "rgba(255,255,255,0.1)" : "transparent",
          color: active ? "#fff" : "#6b7a8d",
          fontSize: "14px", fontWeight: active ? 600 : 400,
          textDecoration: "none", fontFamily: "inherit", transition: "all 0.15s",
        }}
      >
        {icon}
        {label}
      </Link>
    );
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "16px",
      padding: "12px 24px",
      borderBottom: "1px solid rgba(255,255,255,0.07)",
      background: "#131d28",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginRight: "16px" }}>
        <div style={{
          width: "30px", height: "30px", borderRadius: "8px", background: "#fa5d00",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="16" height="16" viewBox="0 0 36 36" fill="none">
            <path d="M9 27c0-5 4-8.5 9-8.5s9 3.5 9 8.5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="18" cy="13" r="5" fill="#fff" />
          </svg>
        </div>
        <span style={{ fontSize: "15px", fontWeight: 700 }}>SaathiAI Admin</span>
      </div>

      {tabBtn("/admin/whatsapp", "Bot Status",
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
      )}
      {tabBtn("/admin/doclingdemo", "Docling Demo",
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
      )}

      <button
        onClick={() => {
          sessionStorage.removeItem("admin_authed");
          router.push("/admin");
        }}
        style={{
          marginLeft: "auto", padding: "6px 14px", borderRadius: "8px",
          border: "1px solid rgba(220,38,38,0.3)", background: "transparent",
          color: "#f87171", fontSize: "13px", cursor: "pointer", fontFamily: "inherit",
        }}
      >
        Sign out
      </button>
    </div>
  );
}
