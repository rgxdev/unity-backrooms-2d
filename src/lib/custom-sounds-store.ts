/**
 * Lets players replace the game's synthesised horror cues with their own MP3
 * files — stored locally (IndexedDB, never uploaded anywhere) and picked up
 * by AudioManager the moment they're saved. Kept separate from the JSON
 * settings-store since these are binary blobs, not small serialisable state.
 */
export const SOUND_SLOTS = [
  { id: "scream", label: "Scream — the chase's \"don't look away\" grab" },
  { id: "roar", label: "Roar — pursuit begins" },
  { id: "growl", label: "Growl — lurking presence nearby" },
  { id: "bark", label: "Bark — Hound presence nearby" },
  { id: "shriek", label: "Shriek — jump-scare stinger" },
  { id: "moan", label: "Moan — guttural ambient anomaly" },
  { id: "laugh", label: "Laugh — creepy ambient anomaly" },
  { id: "bang", label: "Bang — sudden slam ambient anomaly" },
  { id: "whisper", label: "Whisper — distant ambient anomaly" },
  { id: "howl", label: "Howl — distant Hound ambient anomaly" },
] as const;

export type SoundSlot = (typeof SOUND_SLOTS)[number]["id"];

const DB_NAME = "backrooms-custom-sounds";
const DB_VERSION = 1;
const STORE = "sounds";
export const CUSTOM_SOUNDS_EVENT = "backrooms:custom-sounds-changed";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Persists `file` as the sound for `slot` and notifies any listening
 *  AudioManager instances to reload it. */
export async function saveCustomSound(slot: SoundSlot, file: File): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(file, slot);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  window.dispatchEvent(new Event(CUSTOM_SOUNDS_EVENT));
}

/** Removes a custom sound, reverting that cue to its synthesised default. */
export async function clearCustomSound(slot: SoundSlot): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(slot);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  window.dispatchEvent(new Event(CUSTOM_SOUNDS_EVENT));
}

/** Every custom sound currently stored, keyed by slot. Returns an empty
 *  object (never throws) if IndexedDB is unavailable — callers just fall
 *  back to the synthesised cues. */
export async function getAllCustomSounds(): Promise<Partial<Record<SoundSlot, Blob>>> {
  try {
    const db = await openDb();
    const out = await new Promise<Partial<Record<SoundSlot, Blob>>>(
      (resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const cursorReq = tx.objectStore(STORE).openCursor();
        const result: Partial<Record<SoundSlot, Blob>> = {};
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor) {
            result[cursor.key as SoundSlot] = cursor.value as Blob;
            cursor.continue();
          } else {
            resolve(result);
          }
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      },
    );
    db.close();
    return out;
  } catch {
    return {};
  }
}

/** Fires whenever a custom sound is saved or cleared, anywhere in the app. */
export function subscribeCustomSounds(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CUSTOM_SOUNDS_EVENT, listener);
  return () => window.removeEventListener(CUSTOM_SOUNDS_EVENT, listener);
}
