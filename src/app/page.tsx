import Link from "next/link";

export default function MainMenu() {
  return (
    <main className="menu-shell">
      <div style={{ textAlign: "center" }}>
        <h1 className="title">Backrooms</h1>
        <p className="subtitle">LEVEL 0 — THE LOBBY</p>
      </div>
      <nav className="menu-nav">
        <Link href="/game" className="menu-btn">
          Start Game
        </Link>
        <Link href="/skins" className="menu-btn">
          Skin Selection
          <span className="tag">soon</span>
        </Link>
        <Link href="/settings" className="menu-btn">
          Settings
        </Link>
        <Link href="/credits" className="menu-btn">
          Credits
        </Link>
      </nav>
    </main>
  );
}
