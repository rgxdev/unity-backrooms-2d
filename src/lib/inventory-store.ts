import {
  DEFAULT_INVENTORY,
  parseInventory,
  type Inventory,
} from "@/lib/schemas/inventory";
import { readJson, writeJson } from "@/lib/storage";

const STORAGE_KEY = "backrooms.inventory.v1";

type Listener = (inventory: Inventory) => void;

let current: Inventory = DEFAULT_INVENTORY;
let hydrated = false;
const listeners = new Set<Listener>();

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  current = parseInventory(readJson(STORAGE_KEY));
  hydrated = true;
}

function commit(next: Inventory): Inventory {
  current = parseInventory(next);
  writeJson(STORAGE_KEY, current);
  for (const listener of listeners) listener(current);
  return current;
}

export function getInventory(): Inventory {
  hydrate();
  return current;
}

export function subscribeInventory(listener: Listener): () => void {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getItemCount(id: string): number {
  hydrate();
  return current.items[id] ?? 0;
}

export function hasItem(id: string): boolean {
  return getItemCount(id) > 0;
}

/** Adds `amount` (default 1) of item `id` and persists the result. */
export function addItem(id: string, amount = 1): Inventory {
  hydrate();
  const items = { ...current.items, [id]: (current.items[id] ?? 0) + amount };
  return commit({ ...current, items });
}

/** Removes up to `amount` (default 1) of item `id`; clamps at zero. */
export function removeItem(id: string, amount = 1): Inventory {
  hydrate();
  const items = { ...current.items };
  const next = Math.max(0, (items[id] ?? 0) - amount);
  if (next === 0) delete items[id];
  else items[id] = next;
  return commit({ ...current, items });
}

export function clearInventory(): Inventory {
  hydrate();
  return commit({ ...current, items: {} });
}
