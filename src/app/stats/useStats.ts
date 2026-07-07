"use client";

import { useSyncExternalStore } from "react";
import { getStats, subscribeStats } from "@/lib/stats-store";
import { DEFAULT_STATS, type Stats } from "@/lib/schemas/stats";

export function useStats(): Stats {
  return useSyncExternalStore(subscribeStats, getStats, () => DEFAULT_STATS);
}
