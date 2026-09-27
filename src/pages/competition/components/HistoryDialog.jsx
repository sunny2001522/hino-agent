import { useEffect, useRef, useState } from 'react';
import { CATS, mvps, quarterRanks, rankOf } from '../score.js';

const SHELL = {
  driver: '自己的本期名次',
  fleet: '一區',
  lead: '全台',
};

const period =
  typeof window !== 'undefined' ? window.HINO_EXCEL_DATA?.meta?.period : null;

function ownCar() {
  const data = typeof window !== 'undefined' ? window.HINO_EXCEL_DATA : null;
  if (!data) return null;
  const code = data.accountBindings.driver_code;
  const region = data.regions.find(r => r.id === code[0]);
  return region?.drivers[+code.slice(1)] ?? null;
}

const LEAD_TABS = [
  { id: 'quarter', label: '每季區域排名' },
  { id: 'mvp', label: 'MVP' },
];

const FLEET_TABS = [
  { id: 'team', label: '全隊歷史紀錄' },
  { id: 'car', label: '個別歷史紀錄' },
];

function HistTabs({ tabs, tab, onPick }) {
  return (
    <div className="hist-tabs" role="tablist">
      {tabs.map(t => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={tab === t.id}
          className={tab === t.id ? 'on' : undefined}
          onClick={() => onPick(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function LeadHistory() {
  const [tab, setTab] = useState('quarter');
  const quarters = CATS.map(cat => quarterRanks(cat));
  const champs = mvps();
  return (
    <>
      <HistTabs tabs={LEAD_TABS} tab={tab} onPick={setTab} />
      {tab === 'quarter' ? (
      <ul className="hist-rows" role="tabpanel">
        {(quarters[0] || []).map(m0 => (
          <li key={m0.label} className="hist-car">
            <strong>{m0.label}</strong>
            {m0.ranks.map(base => (
              <span key={base.id}>
                {base.name}
                {' '}
                {CATS.map((cat, i) => {
                  const month = quarters[i].find(m => m.label === m0.label);
                  const row = month?.ranks.find(r => r.id === base.id);
                  return row ? `${cat.name} 第 ${row.rank} / ${month.ranks.length} · ${row.v}` : null;
                }).filter(Boolean).join(' · ')}
              </span>
            ))}
          </li>
        ))}
      </ul>
      ) : (
      <ul className="hist-rows" role="tabpanel">
        {champs.map(m => (
          <li key={m.id} className="hist-row">
            <span>{CATS.find(c => c.id === m.id)?.name}</span>
            <span>{m.c}</span>
            <span>{m.score}</span>
          </li>
        ))}
      </ul>
      )}
    </>
  );
}

function FleetHistory() {
  const data = typeof window !== 'undefined' ? window.HINO_EXCEL_DATA : null;
  const rid = data?.accountBindings?.lead_region;
  const region = data?.regions?.find(r => r.id === rid);
  const [tab, setTab] = useState('team');
  const [pick, setPick] = useState(null);
  if (!region) return <p className="hist-empty">無法載入</p>;
  const cars = [...region.drivers].sort((a, b) => (a.c < b.c ? -1 : a.c > b.c ? 1 : 0));
  const car = cars.find(d => d.c === pick) ?? cars[0];
  const months = CATS.map(cat => quarterRanks(cat));
  const labels = (months[0] || []).filter(m => m.ranks.some(row => row.id === rid)).map(m => m.label);
  const quarterList = labels.length ? (
    <ul className="hist-rows">
      {labels.map(label => (
        <li key={label} className="hist-car">
          <strong>{label}</strong>
          <span>
            {CATS.map((cat, i) => {
              const month = months[i].find(m => m.label === label);
              const row = month?.ranks.find(r => r.id === rid);
              return row ? `${cat.name} 第 ${row.rank} / ${month.ranks.length} · ${row.v}` : null;
            }).filter(Boolean).join(' · ')}
          </span>
        </li>
      ))}
    </ul>
  ) : null;

  return (
    <>
      <HistTabs tabs={FLEET_TABS} tab={tab} onPick={setTab} />
      {tab === 'team' ? (
      <div role="tabpanel">
      {cars.length ? (
        <ul className="hist-rows">
          {cars.map(d => (
            <li key={d.c} className="hist-car">
              <strong>{d.c}</strong>
              <span>
                {CATS.map(cat => {
                  const { rank, total } = rankOf(cat, d.c);
                  return `${cat.name} ${cat.score(d)} 第 ${rank} / ${total}`;
                }).join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {quarterList}
      </div>
      ) : (
      <div role="tabpanel">
        {car ? (
          <>
            <label>
              車號{' '}
              <select value={car.c} onChange={e => setPick(e.target.value)}>
                {cars.map(d => <option key={d.c}>{d.c}</option>)}
              </select>
            </label>
            <p className="hist-period">{car.c}・所屬{region.name}季分數與區排名（區級，非單車）</p>
            {quarterList ?? <p className="hist-empty">{region.name}沒有季紀錄</p>}
          </>
        ) : (
          <p className="hist-empty">該區沒有車</p>
        )}
      </div>
      )}
    </>
  );
}

function DriverRanks() {
  const me = ownCar();
  if (!me) return <p className="hist-empty">無法載入</p>;
  return (
    <ul className="hist-rows">
      {CATS.map(cat => {
        const { rank, total } = rankOf(cat, me.c);
        return (
          <li key={cat.id} className="hist-row">
            <span>{cat.name}</span>
            <span>{cat.score(me)}</span>
            <span>第 {rank} / {total}</span>
          </li>
        );
      })}
    </ul>
  );
}

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
          {role === 'driver' ? <DriverRanks /> : null}
          {open && role === 'fleet' ? <FleetHistory /> : null}
          {open && role === 'lead' ? <LeadHistory /> : null}
        </div>
      </dialog>
    </>
  );
}
