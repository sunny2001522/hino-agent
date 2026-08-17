import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import telemetryData from '../excel-derived-data.js?raw';
import enhancements from '../enhancements.js?raw';
import legacyApp from './legacy/legacy-app.js?raw';
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

function ItraqApplication() {
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    try {
      // Keep the existing renderer in a classic-script boundary: it preserves every
      // existing iTRAQ layout, inline action, hover menu and responsive behavior.
      runClassicScript(telemetryData);
      runClassicScript(legacyApp);
      runClassicScript(enhancements);

      bindLegacyControl('menuToggle', 'toggleMobileNav');
      bindLegacyControl('noticeButton', 'openItraqNotifications');
      bindLegacyControl('logoutButton', 'logout');
      bindLegacyControl('aifab', 'openAIChat');
      bindLegacyControl('simfab', 'openSimPanel');
    } catch (error) {
      console.error('Unable to start iTRAQ application', error);
      document.getElementById('screen').innerHTML = '<div class="empty"><b>頁面載入失敗</b><p>請重新整理後再試。</p></div>';
    }
  }, []);

  return (
    <div className="app" id="app" data-runtime="react">
      <div className="appbar" id="appbar" style={{ display: 'none' }}>
        <div className="logo">iTRAQ</div>
        <button className="menuToggle" id="menuToggle" type="button" aria-label="開啟導覽選單" aria-expanded="false" hidden>☰</button>
        <nav className="tabbar" id="tabbar" style={{ display: 'none' }} />
        <button className="noticebtn" id="noticeButton" type="button" aria-label="通知中心">♧<span /></button>
        <div className="whoami"><div className="nm" id="waName">—</div><div className="rl" id="waRole">—</div></div>
        <button className="barbtn" id="logoutButton" type="button">登出</button>
      </div>

      <div className="screen" id="screen" />

      <button className="aifab" id="aifab" style={{ display: 'none' }} type="button">AI<br />助理<span className="dt2" /></button>
      <button className="simfab" id="simfab" style={{ display: 'none' }} type="button">模擬<br />事件</button>

      <div id="tourMask"><div id="tourHole" /><div id="tourTip" /></div>
      <div id="toasts" />
      <div className="ov" id="ov"><div className="modal" id="modal" /></div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<ItraqApplication />);
