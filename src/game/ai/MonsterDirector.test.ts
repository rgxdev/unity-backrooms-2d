import { describe, expect, it } from "vitest";
import { GamePhase, MonsterDirector } from "./MonsterDirector";

const S = (over: Partial<{ inPursuitTrigger: boolean; atExit: boolean }> = {}) => ({
  inPursuitTrigger: false,
  atExit: false,
  ...over,
});

describe("MonsterDirector", () => {
  it("starts ambient", () => {
    expect(new MonsterDirector().current).toBe(GamePhase.Ambient);
  });

  it("stays ambient until the pursuit trigger", () => {
    const d = new MonsterDirector();
    d.update(S());
    expect(d.current).toBe(GamePhase.Ambient);
  });

  it("arms pursuit when the player enters the trigger", () => {
    const d = new MonsterDirector();
    d.update(S({ inPursuitTrigger: true }));
    expect(d.current).toBe(GamePhase.Pursuit);
  });

  it("stays in pursuit once armed, even after leaving the trigger", () => {
    const d = new MonsterDirector();
    d.update(S({ inPursuitTrigger: true }));
    d.update(S({ inPursuitTrigger: false }));
    expect(d.current).toBe(GamePhase.Pursuit);
  });

  it("escapes when the player reaches the exit during a chase", () => {
    const d = new MonsterDirector();
    d.update(S({ inPursuitTrigger: true }));
    d.update(S({ atExit: true }));
    expect(d.current).toBe(GamePhase.Escaped);
  });

  it("can escape straight from ambient by reaching the exit", () => {
    const d = new MonsterDirector();
    d.update(S({ atExit: true }));
    expect(d.current).toBe(GamePhase.Escaped);
  });

  it("escaped is terminal", () => {
    const d = new MonsterDirector();
    d.update(S({ atExit: true }));
    d.update(S({ inPursuitTrigger: true, atExit: false }));
    expect(d.current).toBe(GamePhase.Escaped);
  });
});
