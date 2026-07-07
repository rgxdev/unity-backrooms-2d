import { z } from "zod";

export const SettingsSchema = z.object({
  version: z.literal(1),
  masterVolume: z.number().min(0).max(1),
  musicVolume: z.number().min(0).max(1),
  sfxVolume: z.number().min(0).max(1),
  skinId: z.string().min(1).max(64),
  showFps: z.boolean(),
});

export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  masterVolume: 0.8,
  musicVolume: 0.6,
  sfxVolume: 0.8,
  skinId: "default",
  showFps: false,
};

export function parseSettings(input: unknown): Settings {
  const result = SettingsSchema.safeParse(input);
  return result.success ? result.data : DEFAULT_SETTINGS;
}
