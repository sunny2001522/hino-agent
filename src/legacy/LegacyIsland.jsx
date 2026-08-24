import { useRef } from 'react';

// ponytail: keep this host node stable. A React `key` remount would orphan
// legacy-app.js's `const screen = getElementById('screen')` and white-screen.
// Page replace is still total: renderXxx() does innerHTML; maps call remove().
export default function LegacyIsland({ islandKey }) {
  const ref = useRef(null);
  return <div className="screen" id="screen" ref={ref} data-island-key={islandKey} />;
}
