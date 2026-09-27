export default function NativePager() {
  return (
    <div className="native-pager">
      <button type="button" className="native-page-size" data-itraq-action="page-size">每頁資料筆數: 10⌄</button>
      <span>
        <button type="button" data-itraq-page="prev">‹</button>
        <button type="button" className="on" data-itraq-page="1">1</button>
        <button type="button" data-itraq-page="2">2</button>
        <button type="button" data-itraq-page="3">3</button>
        <button type="button" data-itraq-page="4">4</button>
        <button type="button" data-itraq-page="next">›</button>
      </span>
    </div>
  );
}
