// Mirrors enhancements.js TABS after splice. converted flips in later page commits.
export const ROLE_TABS = {
  fleet: [
    { id: 'decision', l: '管理總覽', converted: false },
    { id: 'monitor', l: '即時監控', converted: false, page: 2 },
    { id: 'history', l: '歷史車輛', converted: false, page: 4 },
    { id: 'task', l: '任務派遣', converted: false, page: 6 },
    { id: 'maintenance', l: '保修系統', converted: false, page: 7 },
    { id: 'data', l: '數據中心', converted: false, page: 9 },
    { id: 'fleet', l: '車隊管理', converted: false, page: 11 },
    { id: 'settings', l: '系統設定', converted: false, page: 16 },
  ],
  lead: [
    { id: 'monitor', l: '即時監控', converted: false, page: 2 },
    { id: 'history', l: '歷史車輛', converted: false, page: 4 },
    { id: 'task', l: '任務派遣', converted: false, page: 6 },
    { id: 'maintenance', l: '保修系統', converted: false, page: 7 },
    { id: 'data', l: '數據中心', converted: false, page: 9 },
    { id: 'fleet', l: '車隊管理', converted: false, page: 11 },
    { id: 'settings', l: '系統設定', converted: false, page: 16 },
    { id: 'kpi', l: '本區管理', converted: true },
    { id: 'focus', l: '管理重點', converted: false },
    { id: 'drivers', l: '駕駛', converted: false },
    { id: 'competition', l: '安全競賽', converted: false },
  ],
  driver: [
    { id: 'home', l: '我的車況', converted: true },
  ],
  shipper: [
    { id: 'track', l: '追蹤', converted: true },
    { id: 'orders', l: '我的貨件', converted: true },
  ],
};

export function tabSpec(role, tabId) {
  return ROLE_TABS[role]?.find(tab => tab.id === tabId);
}
