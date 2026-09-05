import { memo, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import telemetryData from '../excel-derived-data.js?raw';
import enhancements from '../enhancements.js?raw';
import legacyApp from './legacy/legacy-app.js?raw';
import LegacyIsland from './legacy/LegacyIsland.jsx';
import DriverHome from './pages/DriverHome.jsx';
import FleetOverview from './pages/FleetOverview.jsx';
import ItraqWorkspace from './pages/ItraqWorkspace.jsx';
import LeadCompetition from './pages/LeadCompetition.jsx';
import LeadDrivers from './pages/LeadDrivers.jsx';
import LeadFocus from './pages/LeadFocus.jsx';
import LeadKpi from './pages/LeadKpi.jsx';
import ShipperShipments from './pages/ShipperShipments.jsx';
import { ROLE_TABS, tabSpec } from './legacy/tabs.js';
import './legacy/legacy.css';
import '../enhancements.css';

function runClassicScript(source) {
  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.textContent = source;
  document.body.appendChild(script);
  script.remove();
}

function bindLegacyControl(id, handler) {
  const element = document.getElementById(id);
  if (!element) return;
  element.onclick = () => window[handler]?.();
}

function applyChrome(role) {
  document.body.classList.toggle('office', role === 'fleet' || role === 'lead');
  const aifab = document.getElementById('aifab');
  const simfab = document.getElementById('simfab');
  if (aifab) aifab.style.display = role ? 'grid' : 'none';
  if (simfab) simfab.style.display = 'none';
}

const REACT_PAGES = {
  'driver:home': DriverHome,
  'fleet:decision': FleetOverview,
  'fleet:settings': ItraqWorkspace,
  'lead:settings': ItraqWorkspace,
  'fleet:data': ItraqWorkspace,
  'lead:data': ItraqWorkspace,
  'fleet:task': ItraqWorkspace,
  'lead:task': ItraqWorkspace,
  'fleet:maintenance': ItraqWorkspace,
  'lead:maintenance': ItraqWorkspace,
  'fleet:fleet': ItraqWorkspace,
  'lead:fleet': ItraqWorkspace,
  'fleet:history': ItraqWorkspace,
  'lead:history': ItraqWorkspace,
  'shipper:track': ShipperShipments,
  'shipper:orders': ShipperShipments,
  'lead:kpi': LeadKpi,
  'lead:focus': LeadFocus,
  'lead:drivers': LeadDrivers,
  'lead:competition': LeadCompetition,
};

const IDENTITIES = [
  { key: 'fleet', label: '車隊管理', color: '#2e9e4f' },
  { key: 'lead', label: '總負責人', color: '#0d9488' },
  { key: 'driver', label: '車輛使用者', color: '#4a6cf0' },
  { key: 'shipper', label: '貨主', color: '#2e9e4f' },
  { key: 'competition', label: '競賽', color: '#c45c12', href: 'pages/competition/driver/index.html' },
];

function accountPhone(role) {
  return window.ACCOUNTS?.[role]?.phone ?? '';
}

function Welcome({ onPick }) {
  return (
    <div className="screen" data-react>
      <div className="welcome welcome-simple">
        <div className="wpick">
          <div className="lbl">選擇身份</div>
          <div className="identity-grid">
            {IDENTITIES.map((role) => (
              <button
                key={role.key}
                type="button"
                className="idcard idcard-simple"
                style={{ '--role-color': role.color }}
                onClick={() => {
                  if (role.href) {
                    location.href = role.href;
                    return;
                  }
                  if (!window.ACCOUNTS) return;
                  onPick(role.key);
                }}
              >
                <span>{role.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginPage({ role, onBack }) {
  const inputRef = useRef(null);
  const meta = IDENTITIES.find((item) => item.key === role);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [role]);

  function submit() {
    const value = (inputRef.current?.value || '').trim();
    if (!value) {
      window.toast?.('請先輸入手機號碼', '請確認手機號碼後再登入。', 'wn');
      return;
    }
    window.login?.(role);
  }

  return (
    <div className="screen" data-react>
      <div className="loginpg">
        <button type="button" className="back" onClick={onBack}>← 返回選擇身份</button>
        <h2 style={{ color: meta.color }}>{meta.label} 登入</h2>
        <div className="field">
          <label>手機號碼</label>
          <input ref={inputRef} id="loginInput" type="text" inputMode="tel" defaultValue={accountPhone(role)} aria-label="手機號碼" autoComplete="tel" />
        </div>
        <button type="button" className="btn pri block" onClick={submit}>登入</button>
      </div>
    </div>
  );
}

function hookReactNav(setNav, setLoginRole) {
  const origLogin = window.login;
  window.login = (role) => {
    origLogin(role);
    applyChrome(role);
    const first = ROLE_TABS[role][0];
    setNav({ role, tab: first.id, itraqPage: first.page ?? null });
  };

  const origLogout = window.logout;
  window.logout = () => {
    origLogout();
    applyChrome(null);
  };

  window.renderWelcome = () => {
    const appbar = document.getElementById('appbar');
    const tabbar = document.getElementById('tabbar');
    if (appbar) {
      appbar.style.display = 'none';
      appbar.classList.remove('mobile-nav-open');
    }
    if (tabbar) tabbar.style.display = 'none';
    const menuToggle = document.getElementById('menuToggle');
    if (menuToggle) menuToggle.hidden = true;
    applyChrome(null);
    setLoginRole(null);
    setNav({ role: null, tab: null, itraqPage: null });
  };

  const origGoto = window.gotoTab;
  window.gotoTab = (id) => {
    origGoto(id);
    setNav((prev) => ({
      role: prev.role,
      tab: id,
      itraqPage: tabSpec(prev.role, id)?.page ?? null,
    }));
  };

  document.getElementById('tabbar')?.addEventListener('click', (event) => {
    const sub = event.target.closest('[data-header-page]');
    if (!sub) return;
    setNav((prev) => ({
      ...prev,
      tab: sub.dataset.headerTab || prev.tab,
      itraqPage: Number(sub.dataset.headerPage),
    }));
  });

  window.__itraqSetPage = (n) => setNav((prev) => ({ ...prev, itraqPage: Number(n) }));
}

const AppBar = memo(function AppBar() {
  return (
    <div className="appbar" id="appbar" data-react style={{ display: 'none' }}>
      <div className="logo">iTRAQ</div>
      <button className="menuToggle" id="menuToggle" type="button" aria-label="開啟導覽選單" aria-expanded="false" hidden>☰</button>
      <nav className="tabbar" id="tabbar" style={{ display: 'none' }} />
      <button className="noticebtn" id="noticeButton" type="button" aria-label="通知中心">♧<span /></button>
      <div className="whoami"><div className="nm" id="waName">—</div><div className="rl" id="waRole">—</div></div>
      <button className="barbtn" id="logoutButton" type="button" onClick={() => window.logout?.()}>登出</button>
    </div>
  );
});

const Fabs = memo(function Fabs() {
  return (
    <>
      <button className="aifab" id="aifab" data-react style={{ display: 'none' }} type="button" onClick={() => window.openAIChat?.()}>AI<br />助理<span className="dt2" /></button>
      <button className="simfab" id="simfab" data-react style={{ display: 'none' }} type="button">模擬<br />事件</button>
    </>
  );
});

let toastSeq = 0;

function Toasts() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    window.__toastPush = (t, m, k) => {
      const id = ++toastSeq;
      setToasts((prev) => [...prev, { id, t, m, k, exiting: false }]);
      setTimeout(() => {
        setToasts((prev) => prev.map((x) => (x.id === id ? { ...x, exiting: true } : x)));
        setTimeout(() => {
          setToasts((prev) => prev.filter((x) => x.id !== id));
        }, 300);
      }, 4200);
    };
    return () => { window.__toastPush = undefined; };
  }, []);

  return (
    <div id="toasts">
      {toasts.map(({ id, t, m, k, exiting }) => (
        <div
          key={id}
          className={`toast ${k || ''}`}
          style={{
            pointerEvents: 'auto',
            ...(exiting ? { opacity: 0, transform: 'translateY(12px)' } : {}),
          }}
          dangerouslySetInnerHTML={{ __html: `<b>${t}</b>${m || ''}` }}
        />
      ))}
    </div>
  );
}

function ChatBody({ headHtml, greetingHtml, sugHtml, placeholder }) {
  return (
    <div className="chatwrap">
      <div className="chathd">
        <div className="ci">AI</div>
        <div dangerouslySetInnerHTML={{ __html: headHtml }} />
      </div>
      <div className="chatlog" id="chatlog" dangerouslySetInnerHTML={{ __html: greetingHtml }} />
      <div className="chips2" id="chatChips" dangerouslySetInnerHTML={{ __html: sugHtml }} />
      <div className="chatin">
        <input id="chatInput" type="text" placeholder={placeholder} onKeyDown={(e) => { if (e.key === 'Enter') window.aiAskInput?.(); }} />
        <button className="send" id="chatSend" type="button" onClick={() => window.aiAskInput?.()}>↑</button>
      </div>
    </div>
  );
}

function Modal() {
  const [state, setState] = useState({ open: false, html: '', chat: null });

  useEffect(() => {
    window.__modalShow = (h) => setState({ open: true, html: h, chat: null });
    window.__modalClose = () => setState((prev) => ({ ...prev, open: false }));
    window.__chatOpen = (chat) => setState({ open: true, html: '', chat });
    return () => {
      window.__modalShow = undefined;
      window.__modalClose = undefined;
      window.__chatOpen = undefined;
    };
  }, []);

  return (
    <div className={`ov${state.open ? ' on' : ''}`} id="ov">
      {state.chat ? (
        <div className="modal" id="modal"><div className="grip" /><ChatBody {...state.chat} /></div>
      ) : (
        <div
          className="modal"
          id="modal"
          dangerouslySetInnerHTML={{ __html: state.html ? `<div class="grip"></div>${state.html}` : '' }}
        />
      )}
    </div>
  );
}

const Overlays = memo(function Overlays() {
  return (
    <>
      <div id="tourMask"><div id="tourHole" /><div id="tourTip" /></div>
      <Toasts />
      <Modal />
    </>
  );
});

function ItraqApplication() {
  const [nav, setNav] = useState({ role: null, tab: null, itraqPage: null });
  const [loginRole, setLoginRole] = useState(null);
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    try {
      runClassicScript(telemetryData);
      runClassicScript(legacyApp);
      runClassicScript(enhancements);

      // enhancements splice 的 .render 仍指向 legacy innerHTML；converted tab 改 no-op 避免寫進 Island
      for (const [role, tabs] of Object.entries(ROLE_TABS)) {
        for (const tab of tabs) {
          if (!tab.converted) continue;
          const entry = window.TABS?.[role]?.find((item) => item.id === tab.id);
          if (entry) entry.render = () => {};
        }
      }

      bindLegacyControl('menuToggle', 'toggleMobileNav');
      bindLegacyControl('noticeButton', 'openItraqNotifications');
      hookReactNav(setNav, setLoginRole);
    } catch (error) {
      console.error('Unable to start iTRAQ application', error);
      document.getElementById('screen').innerHTML = '<div class="empty"><b>頁面載入失敗</b><p>請重新整理後再試。</p></div>';
    }
  }, []);

  useEffect(() => {
    applyChrome(nav.role);
  }, [nav.role]);

  const islandKey = nav.role ? `${nav.role}-${nav.tab}-${nav.itraqPage ?? ''}` : 'welcome';
  const currentTab = nav.role && nav.tab ? tabSpec(nav.role, nav.tab) : null;
  const converted = currentTab?.converted ?? false;
  const liveVideo = nav.tab === 'monitor' && nav.itraqPage === 3;
  const ReactPage = converted ? REACT_PAGES[`${nav.role}:${nav.tab}`] : liveVideo ? ItraqWorkspace : null;

  return (
    <div className="app" id="app" data-runtime="react">
      <AppBar />
      {!nav.role && (loginRole
        ? <LoginPage key={loginRole} role={loginRole} onBack={() => setLoginRole(null)} />
        : <Welcome onPick={setLoginRole} />)}
      {nav.role && ReactPage && <ReactPage key={islandKey} pageNo={nav.itraqPage} />}
      <LegacyIsland islandKey={islandKey} hidden={!nav.role || converted || liveVideo} />
      <Fabs />
      <Overlays />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<ItraqApplication />);
