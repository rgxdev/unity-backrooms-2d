import { describe, expect, it } from "vitest";
import { MonsterStateMachine } from "./MonsterStateMachine";
import { MonsterState, type Perception } from "./types";

const P = (over: Partial<Perception> = {}): Perception => ({
  canSeePlayer: false,
  distanceToPlayer: Infinity,
  heardNoise: false,
  ...over,
});

describe("MonsterStateMachine", () => {
  it("starts in patrol", () => {
    expect(new MonsterStateMachine().current).toBe(MonsterState.Patrol);
  });

  it("chases when it sees the player in range", () => {
    const fsm = new MonsterStateMachine();
    fsm.update(0.1, P({ canSeePlayer: true, distanceToPlayer: 100 }));
    expect(fsm.current).toBe(MonsterState.Chase);
  });

  it("searches on noise while patrolling", () => {
    const fsm = new MonsterStateMachine();
    fsm.update(0.1, P({ heardNoise: true }));
    expect(fsm.current).toBe(MonsterState.Search);
  });

  it("attacks in range, then re-chases when out of range", () => {
    const fsm = new MonsterStateMachine();
    fsm.update(0.1, P({ canSeePlayer: true, distanceToPlayer: 100 }));
    fsm.update(0.1, P({ canSeePlayer: true, distanceToPlayer: 10 }));
    expect(fsm.current).toBe(MonsterState.Attack);
    fsm.update(0.1, P({ canSeePlayer: true, distanceToPlayer: 100 }));
    expect(fsm.current).toBe(MonsterState.Chase);
  });

  it("goes to lost when the player breaks sight during a chase", () => {
    const fsm = new MonsterStateMachine();
    fsm.update(0.1, P({ canSeePlayer: true, distanceToPlayer: 100 }));
    fsm.update(0.1, P({ canSeePlayer: false }));
    expect(fsm.current).toBe(MonsterState.Lost);
  });

  it("returns to search from lost after the timeout", () => {
    const fsm = new MonsterStateMachine({
      attackRange: 24,
      chaseRange: 220,
      searchTimeout: 4,
      lostTimeout: 2,
    });
    fsm.update(0.1, P({ canSeePlayer: true, distanceToPlayer: 100 }));
    fsm.update(0.1, P({ canSeePlayer: false }));
    fsm.update(2.5, P({ canSeePlayer: false }));
    expect(fsm.current).toBe(MonsterState.Search);
  });
});
