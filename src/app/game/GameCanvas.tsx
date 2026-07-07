"use client";

import { useEffect, useRef } from "react";
import type Phaser from "phaser";

export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let game: Phaser.Game | null = null;
    let disposed = false;

    void import("@/game/core/createGame").then(({ createGame }) => {
      if (disposed || !containerRef.current) return;
      game = createGame(containerRef.current);
      // Dev-only handle so e2e/debug tooling can reach the running game.
      if (process.env.NODE_ENV !== "production") {
        (window as unknown as { __GAME__?: Phaser.Game }).__GAME__ = game;
      }
    });

    return () => {
      disposed = true;
      game?.destroy(true);
      game = null;
    };
  }, []);

  return <div ref={containerRef} className="game-viewport" />;
}
