import { DEFAULT_STATS, parseStats, type Stats } from "@/lib/schemas/stats";
import { readJson, writeJson } from "@/lib/storage";

const STORAGE_KEY = "backrooms.stats.v1";

type Listener = (stats: Stats) => void;

let current: Stats = DEFAULT_STATS;
let hydrated = false;
const listeners = new Set<Listener>();

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  current = parseStats(readJson(STORAGE_KEY));
  hydrated = true;
}

function commit(next: Stats): Stats {
  current = parseStats(next);
  writeJson(STORAGE_KEY, current);
  for (const listener of listeners) listener(current);
  return current;
}

export function getStats(): Stats {
  hydrate();
  return current;
}

export function subscribeStats(listener: Listener): () => void {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function recordRunStart(): Stats {
  hydrate();
  return commit({ ...current, runsStarted: current.runsStarted + 1 });
}

export function recordEscape(playTimeMs: number): Stats {
  hydrate();
  return commit({
    ...current,
    escapes: current.escapes + 1,
    playTimeMs: current.playTimeMs + Math.max(0, playTimeMs),
  });
}

export function recordDeath(playTimeMs: number): Stats {
  hydrate();
  return commit({
    ...current,
    deaths: current.deaths + 1,
    playTimeMs: current.playTimeMs + Math.max(0, playTimeMs),
  });
}

export function recordFall(playTimeMs: number): Stats {
  hydrate();
  return commit({
    ...current,
    falls: current.falls + 1,
    playTimeMs: current.playTimeMs + Math.max(0, playTimeMs),
  });
}
