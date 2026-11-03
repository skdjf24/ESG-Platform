"use client";

import { useEffect, useState } from "react";

export interface AiServiceStatus {
  configured: boolean;
  provider: string;
  model: string;
  loading: boolean;
  reachable: boolean;
}

const initialStatus: AiServiceStatus = { configured: false, provider: "", model: "", loading: true, reachable: true };

export function useAiStatus() {
  const [status, setStatus] = useState<AiServiceStatus>(initialStatus);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/ai/status", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("AI_STATUS_UNAVAILABLE");
        const value = await response.json() as Partial<AiServiceStatus>;
        setStatus({ configured: value.configured === true, provider: typeof value.provider === "string" ? value.provider : "", model: typeof value.model === "string" ? value.model : "", loading: false, reachable: true });
      })
      .catch((cause) => {
        if ((cause as Error).name !== "AbortError") setStatus({ ...initialStatus, loading: false, reachable: false });
      });
    return () => controller.abort();
  }, []);
  return status;
}
