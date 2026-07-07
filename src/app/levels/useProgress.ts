"use client";

import { useSyncExternalStore } from "react";
import {
  getProgress,
  selectLevel,
  subscribeProgress,
} from "@/lib/progress-store";
import { DEFAULT_PROGRESS, type Progress } from "@/lib/schemas/progress";

export function useProgress(): {
  progress: Progress;
  select: (index: number) => void;
} {
  const progress = useSyncExternalStore(
    subscribeProgress,
    getProgress,
    () => DEFAULT_PROGRESS,
  );
  return { progress, select: selectLevel };
}
