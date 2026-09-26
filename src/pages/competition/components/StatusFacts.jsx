/** @param {{ facts: { ok: boolean, detail: string, keep: string, fix: string }[] }} props */
export default function StatusFacts({ facts }) {
  const keep = facts.filter(f => f.ok);
  const note = facts.filter(f => !f.ok);
  return (
    <>
      {keep.length > 0 && (
        <>
          <h3 className="keep">繼續保持</h3>
          <ul>{keep.map((f, i) => <li key={i}>{f.keep}（{f.detail}）</li>)}</ul>
        </>
      )}
      {note.length > 0 && (
        <>
          <h3 className="note">需要注意</h3>
          <ul>{note.map((f, i) => <li key={i}>{f.detail}</li>)}</ul>
          <h3>可以怎麼改進</h3>
          <ul>{note.map((f, i) => <li key={i}>{f.fix}</li>)}</ul>
        </>
      )}
    </>
  );
}
