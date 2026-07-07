import {
  DEFAULT_SETTINGS,
  parseSettings,
  type Settings,
} from "@/lib/schemas/settings";
import { readJson, writeJson } from "@/lib/storage";

const STORAGE_KEY = "backrooms.settings.v1";

type Listener = (settings: Settings) => void;

let current: Settings = DEFAULT_SETTINGS;
let hydrated = false;
const listeners = new Set<Listener>();

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  current = parseSettings(readJson(STORAGE_KEY));
  hydrated = true;
}

export function getSettings(): Settings {
  hydrate();
  return current;
}

export function setSettings(patch: Partial<Settings>): Settings {
  hydrate();
  current = parseSettings({ ...current, ...patch });
  writeJson(STORAGE_KEY, current);
  for (const listener of listeners) listener(current);
  return current;
}

export function subscribeSettings(listener: Listener): () => void {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}
