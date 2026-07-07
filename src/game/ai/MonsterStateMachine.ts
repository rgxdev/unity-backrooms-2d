import {
  DEFAULT_AI_CONFIG,
  MonsterState,
  type AiConfig,
  type Perception,
} from "./types";

/**
 * Deterministic monster brain. Pure logic (no Phaser refs) so behaviour can be
 * unit tested. The scene owns movement; this only decides the current state.
 */
export class MonsterStateMachine {
  private state: MonsterState = MonsterState.Patrol;
  private timer = 0;
  private readonly config: AiConfig;

  constructor(config: AiConfig = DEFAULT_AI_CONFIG) {
    this.config = config;
  }

  get current(): MonsterState {
    return this.state;
  }

  reset(): void {
    this.state = MonsterState.Patrol;
    this.timer = 0;
  }

  private transition(next: MonsterState): void {
    if (next !== this.state) {
      this.state = next;
      this.timer = 0;
    }
  }

  update(delta: number, perception: Perception): MonsterState {
    this.timer += delta;
    const { attackRange, chaseRange, searchTimeout, lostTimeout } = this.config;
    const seen = perception.canSeePlayer;
    const dist = perception.distanceToPlayer;

    switch (this.state) {
      case MonsterState.Patrol:
        if (seen && dist <= chaseRange) this.transition(MonsterState.Chase);
        else if (perception.heardNoise) this.transition(MonsterState.Search);
        break;

      case MonsterState.Search:
        if (seen && dist <= chaseRange) this.transition(MonsterState.Chase);
        else if (this.timer >= searchTimeout)
          this.transition(MonsterState.Patrol);
        break;

      case MonsterState.Chase:
        if (seen && dist <= attackRange) this.transition(MonsterState.Attack);
        else if (!seen) this.transition(MonsterState.Lost);
        break;

      case MonsterState.Attack:
        if (!seen || dist > attackRange) this.transition(MonsterState.Chase);
        break;

      case MonsterState.Lost:
        if (seen && dist <= chaseRange) this.transition(MonsterState.Chase);
        else if (this.timer >= lostTimeout)
          this.transition(MonsterState.Search);
        break;
    }

    return this.state;
  }
}
