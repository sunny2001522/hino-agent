import { useEffect, useRef, useState } from 'react';

const TABS = [
  { id: 'personal', label: '個人歷史紀錄', body: '這是個人歷史紀錄' },
  { id: 'team', label: '團隊歷史紀錄', body: '這是團隊歷史紀錄' },
  { id: 'summary', label: '總結', body: '這是總結的紀錄' },
];

export default function HistoryDialog() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(TABS[0].id);
  const dlgRef = useRef(null);

  useEffect(() => {
    const el = dlgRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  const current = TABS.find(t => t.id === tab) ?? TABS[0];

  return (
    <>
      <button type="button" className="hist-btn" onClick={() => { setTab(TABS[0].id); setOpen(true); }}>
        歷史
      </button>
      <dialog
        className="ai-dialog hist-dialog"
        ref={dlgRef}
        onClose={() => setOpen(false)}
        onClick={e => {
          if (e.target === e.currentTarget) dlgRef.current?.close();
        }}
      >
        <div className="chathd">
          <strong>歷史</strong>
          <button type="button" className="ai-x" onClick={() => dlgRef.current?.close()}>關閉</button>
        </div>
        <div className="hist-tabs" role="tablist">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? 'on' : undefined}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="hist-body" role="tabpanel">{current.body}</div>
      </dialog>
    </>
  );
}
