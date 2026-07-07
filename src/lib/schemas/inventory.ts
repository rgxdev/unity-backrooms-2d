import { z } from "zod";

export const InventorySchema = z.object({
  version: z.literal(1),
  /** Item id -> quantity collected. Absent id means zero. */
  items: z.record(z.string().min(1).max(64), z.number().int().nonnegative()),
});

export type Inventory = z.infer<typeof InventorySchema>;

export const DEFAULT_INVENTORY: Inventory = {
  version: 1,
  items: {},
};

export function parseInventory(input: unknown): Inventory {
  const result = InventorySchema.safeParse(input);
  return result.success ? result.data : DEFAULT_INVENTORY;
}
