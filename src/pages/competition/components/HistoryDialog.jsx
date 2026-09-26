import { useEffect, useRef, useState } from 'react';

const SHELL = {
  driver: '自己的本期名次',
  fleet: '一區',
  lead: '全台',
};

const period =
  typeof window !== 'undefined' ? window.HINO_EXCEL_DATA?.meta?.period : null;

export default function HistoryDialog({ role }) {
  const [open, setOpen] = useState(false);
  const dlgRef = useRef(null);
  const title = SHELL[role] ?? '';

  useEffect(() => {
    const el = dlgRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  return (
    <>
      <button type="button" className="hist-btn" onClick={() => setOpen(true)}>
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
        <div className="hist-body">
          {title ? <h3 className="hist-shell-title">{title}</h3> : null}
          {period ? <p className="hist-period">資料期間：{period}</p> : null}
        </div>
      </dialog>
    </>
  );
}
