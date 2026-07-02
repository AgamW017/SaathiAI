"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function useAuth() {
  const [authed, setAuthed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const isAuthed = sessionStorage.getItem("admin_authed") === "true";
    if (!isAuthed) {
      router.push("/admin");
    } else {
      setAuthed(true);
    }
  }, [router]);

  return authed;
}
