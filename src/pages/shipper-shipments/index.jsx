import { useEffect, useState } from 'react';

export default function ShipperShipments() {
  const [, bump] = useState(0);

  useEffect(() => {
    window.onShipperPushChange = () => bump((n) => n + 1);
    return () => {
      window.onShipperPushChange = undefined;
    };
  }, []);

  const list = window.myOrders();
  const completed = list.filter((order) => window.shipmentStatus(order) === '已完成').length;
  const active = list.length - completed;

  return (
    <div className="screen" data-react>
      <section className="shipper-overview">
        <div className="sh">
          <h2>我的貨件</h2>
        </div>
        <div className="shipper-totals">
          <div>
            <span>進行中</span>
            <b>{active}</b>
          </div>
          <div>
            <span>已完成</span>
            <b>{completed}</b>
          </div>
          <div>
            <span>全部貨件</span>
            <b>{list.length}</b>
          </div>
        </div>
        <div className="shipment-list">
          {list.map((order, index) => {
            const state = window.shipmentStatus(order);
            const enabled = window.shipperPushState[order.id];
            return (
              <article key={order.id} className="shipment-card">
                <div className="shipment-top">
                  <b>{window.shipmentLabel(index)}</b>
                  <span className={`shipment-status ${state === '已完成' ? 'done' : 'active'}`}>{state}</span>
                </div>
                <div className="shipment-vehicle">
                  <span>車輛編號</span>
                  <strong>{order.car}</strong>
                </div>
                <div className="shipment-updated">
                  <span>最後更新</span>
                  <b>{window.shipmentUpdatedAt(order)}</b>
                </div>
                <div className="acts">
                  <button type="button" className="btn pri sm" onClick={() => window.openShipmentDetail(order.id)}>
                    查看貨況
                  </button>
                  <button type="button" className="btn gho sm" onClick={() => window.toggleShipperPush(order.id)}>
                    {enabled ? '已開啟推播' : '開啟推播'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <div className="private-note">
        <b>資訊範圍：</b>僅顯示貨件狀態、車輛編號與最後更新時間；不提供地圖、司機聯絡方式或取消貨件。
      </div>
    </div>
  );
}
