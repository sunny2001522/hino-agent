// Mirrors enhancements.js TABS after splice. converted flips in later page commits.
export const ROLE_TABS = {
  fleet: [
    { id: 'comp', l: '競賽', converted: true },
    { id: 'overview', l: '管理總覽', converted: true },
    { id: 'monitor', l: '即時監控', converted: true, page: 2 },
    { id: 'history', l: '歷史車輛', converted: true, page: 4 },
    { id: 'task', l: '任務派遣', converted: true, page: 6 },
    { id: 'maintenance', l: '保修系統', converted: true, page: 7 },
    { id: 'data', l: '數據中心', converted: true, page: 9 },
    { id: 'fleet', l: '車隊管理', converted: true, page: 11 },
    { id: 'settings', l: '系統設定', converted: true, page: 16 },
    { id: 'decision', l: '智慧夥伴', converted: true },
  ],
  lead: [
    { id: 'comp', l: '競賽', converted: true },
    { id: 'monitor', l: '即時監控', converted: true, page: 2 },
    { id: 'history', l: '歷史車輛', converted: true, page: 4 },
    { id: 'task', l: '任務派遣', converted: true, page: 6 },
    { id: 'maintenance', l: '保修系統', converted: true, page: 7 },
    { id: 'data', l: '數據中心', converted: true, page: 9 },
    { id: 'fleet', l: '車隊管理', converted: true, page: 11 },
    { id: 'settings', l: '系統設定', converted: true, page: 16 },
    { id: 'kpi', l: '本區管理', converted: true },
    { id: 'focus', l: '管理重點', converted: true },
    { id: 'drivers', l: '駕駛', converted: true },
    { id: 'competition', l: '安全競賽', converted: true },
    { id: 'partner', l: '智慧夥伴', converted: true },
  ],
  driver: [
    { id: 'comp', l: '競賽', converted: true },
    { id: 'home', l: '我的車況', converted: true },
    { id: 'partner', l: '改善與回報', converted: true },
  ],
  shipper: [
    { id: 'track', l: '追蹤', converted: true },
    { id: 'orders', l: '我的貨件', converted: true },
  ],
};

export function tabSpec(role, tabId) {
  return ROLE_TABS[role]?.find(tab => tab.id === tabId);
}
