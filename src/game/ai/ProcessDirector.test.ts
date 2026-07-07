import { describe, expect, it } from "vitest";
import { ANOMALY_TYPES, ProcessDirector } from "./ProcessDirector";

const CONFIG = { minIntervalMs: 1000, maxIntervalMs: 2000 };

describe("ProcessDirector", () => {
  it("does not fire on the very first update", () => {
    const d = new ProcessDirector(CONFIG, () => 0.5);
    expect(d.update(0)).toBeNull();
  });

  it("does not fire before the rolled interval elapses", () => {
    const d = new ProcessDirector(CONFIG, () => 0.5);
    d.update(0); // rolls a 1500ms interval
    expect(d.update(1000)).toBeNull();
    expect(d.update(1499)).toBeNull();
  });

  it("fires once the interval elapses, then reschedules", () => {
    const d = new ProcessDirector(CONFIG, () => 0.5);
    d.update(0); // nextAt = 1500
    expect(d.update(1500)).not.toBeNull();
    // Freshly rescheduled another 1500ms out — shouldn't fire again yet.
    expect(d.update(1600)).toBeNull();
    expect(d.update(3000)).not.toBeNull();
  });

  it("picks a valid anomaly type", () => {
    const d = new ProcessDirector(CONFIG, () => 0.99);
    d.update(0);
    const fired = d.update(10_000);
    expect(fired).not.toBeNull();
    expect(ANOMALY_TYPES).toContain(fired);
  });

  it("reset() clears the schedule so the next update rolls fresh", () => {
    const d = new ProcessDirector(CONFIG, () => 0.5);
    d.update(0);
    d.update(1500);
    d.reset();
    expect(d.update(1500)).toBeNull();
  });
});
