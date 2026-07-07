"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearCustomSound,
  getAllCustomSounds,
  saveCustomSound,
  subscribeCustomSounds,
  type SoundSlot,
} from "@/lib/custom-sounds-store";
import { FEATURES } from "@/lib/feature-flags";

export function useCustomSounds(): {
  active: Set<SoundSlot>;
  upload: (slot: SoundSlot, file: File) => Promise<void>;
  reset: (slot: SoundSlot) => Promise<void>;
} {
  const [active, setActive] = useState<Set<SoundSlot>>(new Set());

  const refresh = useCallback(() => {
    if (!FEATURES.customSoundEffects) return;
    getAllCustomSounds().then((blobs) => {
      setActive(new Set(Object.keys(blobs) as SoundSlot[]));
    });
  }, []);

  useEffect(() => {
    if (!FEATURES.customSoundEffects) return;
    refresh();
    return subscribeCustomSounds(refresh);
  }, [refresh]);

  const upload = useCallback(async (slot: SoundSlot, file: File) => {
    await saveCustomSound(slot, file);
  }, []);

  const reset = useCallback(async (slot: SoundSlot) => {
    await clearCustomSound(slot);
  }, []);

  return { active, upload, reset };
}
