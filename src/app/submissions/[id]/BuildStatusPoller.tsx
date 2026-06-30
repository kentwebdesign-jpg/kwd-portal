"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// While a build is running, refresh the page every few seconds so the live
// build stage (and the final result) appear without a manual reload.
export default function BuildStatusPoller() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}
