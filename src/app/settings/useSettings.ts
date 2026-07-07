"use client";

import { useSyncExternalStore } from "react";
import {
  getSettings,
  setSettings,
  subscribeSettings,
} from "@/lib/settings-store";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/schemas/settings";

export function useSettings(): {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
} {
  const settings = useSyncExternalStore(
    subscribeSettings,
    getSettings,
    () => DEFAULT_SETTINGS,
  );
  return { settings, update: setSettings };
}
