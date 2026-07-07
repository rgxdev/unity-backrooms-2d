import Link from "next/link";

export default function CreditsPage() {
  return (
    <main className="page">
      <h1>Credits</h1>
      <p className="hint">
        Backrooms 2D — a browser-based pixel-art horror prototype.
      </p>
      <div className="field">
        <label>Engine</label>
        <span>Phaser</span>
      </div>
      <div className="field">
        <label>App Shell</label>
        <span>Next.js</span>
      </div>
      <div className="field">
        <label>Language</label>
        <span>TypeScript</span>
      </div>
      <Link href="/" className="back-link">
        &larr; Back to menu
      </Link>
    </main>
  );
}
