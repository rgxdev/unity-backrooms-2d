import Link from "next/link";

const PLACEHOLDER_SLOTS = 6;

export default function SkinsPage() {
  return (
    <main className="page">
      <h1>Skin Selection</h1>
      <p className="hint">
        Character skins are on the roadmap. Slots below are placeholders — the
        selection UI and swappable sprite atlases arrive in a later milestone.
      </p>
      <div className="skin-grid">
        {Array.from({ length: PLACEHOLDER_SLOTS }, (_, i) => (
          <div key={i} className="skin-card">
            {i === 0 ? "DEFAULT" : "LOCKED"}
          </div>
        ))}
      </div>
      <Link href="/" className="back-link">
        &larr; Back to menu
      </Link>
    </main>
  );
}
