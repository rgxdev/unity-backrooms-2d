import { describe, expect, it } from "vitest";
import {
  addItem,
  clearInventory,
  getInventory,
  getItemCount,
  hasItem,
  removeItem,
} from "./inventory-store";

describe("inventory-store", () => {
  it("starts empty", () => {
    clearInventory();
    expect(getInventory().items).toEqual({});
    expect(hasItem("flashlight")).toBe(false);
  });

  it("accumulates quantity and persists across reads", () => {
    clearInventory();
    addItem("almondWater");
    addItem("almondWater");
    expect(getItemCount("almondWater")).toBe(2);
    expect(hasItem("almondWater")).toBe(true);
  });

  it("clamps removal at zero and drops the key", () => {
    clearInventory();
    addItem("flashlight", 1);
    removeItem("flashlight", 5);
    expect(getItemCount("flashlight")).toBe(0);
    expect(getInventory().items).not.toHaveProperty("flashlight");
  });
});
