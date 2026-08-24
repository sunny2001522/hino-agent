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

function hookReactNav(setNav) {
  const origLogin = window.login;
  window.login = (role) => {
    origLogin(role);
    const first = ROLE_TABS[role][0];
    setNav({ role, tab: first.id, itraqPage: first.page ?? null });
  };

  const origLogout = window.logout;
  window.logout = () => {
    origLogout();
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
      <button className="barbtn" id="logoutButton" type="button">登出</button>
    </div>
  );
});

const Fabs = memo(function Fabs() {
  return (
    <>
      <button className="aifab" id="aifab" data-react style={{ display: 'none' }} type="button">AI<br />助理<span className="dt2" /></button>
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
      bindLegacyControl('logoutButton', 'logout');
      bindLegacyControl('aifab', 'openAIChat');
      bindLegacyControl('simfab', 'openSimPanel');
      hookReactNav(setNav);
    } catch (error) {
      console.error('Unable to start iTRAQ application', error);
      document.getElementById('screen').innerHTML = '<div class="empty"><b>頁面載入失敗</b><p>請重新整理後再試。</p></div>';
    }
  }, []);

  const islandKey = nav.role ? `${nav.role}-${nav.tab}-${nav.itraqPage ?? ''}` : 'welcome';

  return (
    <div className="app" id="app" data-runtime="react">
      <AppBar />
      <LegacyIsland islandKey={islandKey} />
      <Fabs />
      <Overlays />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<ItraqApplication />);
