/** @param {{ catId: string, onChange: (id: string) => void, items: { id: string, name: string, score: number | string, color: string, sub: string }[] }} props */
export default function CatTabs({ catId, onChange, items }) {
  return (
    <nav className="dash-tabs">
      {items.map(t => (
        <button
          key={t.id}
          type="button"
          data-cat={t.id}
          className={catId === t.id ? 'on' : undefined}
          onClick={() => onChange(t.id)}
        >
          <div className="tn">{t.name}</div>
          <div className="tv" style={{ color: t.color }}>{t.score}</div>
          <div className="tr">{t.sub}</div>
        </button>
      ))}
    </nav>
  );
}
