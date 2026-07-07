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
    });

    return () => {
      disposed = true;
      game?.destroy(true);
      game = null;
    };
  }, []);

  return <div ref={containerRef} className="game-viewport" />;
}
