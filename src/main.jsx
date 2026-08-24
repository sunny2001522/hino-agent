import { memo, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import telemetryData from '../excel-derived-data.js?raw';
import enhancements from '../enhancements.js?raw';
import legacyApp from './legacy/legacy-app.js?raw';
import LegacyIsland from './legacy/LegacyIsland.jsx';
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

const Overlays = memo(function Overlays() {
  return (
    <>
      <div id="tourMask"><div id="tourHole" /><div id="tourTip" /></div>
      <div id="toasts" />
      <div className="ov" id="ov"><div className="modal" id="modal" /></div>
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

  return (
    <div className="app" id="app" data-runtime="react">
      <AppBar />
      {!nav.role && (loginRole
        ? <LoginPage key={loginRole} role={loginRole} onBack={() => setLoginRole(null)} />
        : <Welcome onPick={setLoginRole} />)}
      <LegacyIsland islandKey={islandKey} hidden={!nav.role} />
      <Fabs />
      <Overlays />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<ItraqApplication />);
