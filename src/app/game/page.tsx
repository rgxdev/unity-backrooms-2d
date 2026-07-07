"use client";

import Link from "next/link";
import GameCanvas from "./GameCanvas";

export default function GamePage() {
  return (
    <main>
      <GameCanvas />
      <Link
        href="/"
        style={{
          position: "fixed",
          top: 12,
          left: 12,
          zIndex: 10,
          padding: "6px 12px",
          background: "rgba(10,10,6,0.8)",
          border: "1px solid #2a2818",
          color: "#9a9376",
          fontFamily: "monospace",
          fontSize: "0.75rem",
          letterSpacing: "0.1rem",
        }}
      >
        &larr; MENU
      </Link>
    </main>
  );
}
