export default function MaintIcons({ car }) {
  const items = [['book-maintenance', '◷', '預約原廠保修'], ['maintenance-schedule', '▣', '查看保修週期排程'], ['edit-work-order', '✎', '編輯工單']];
  return (
    <span className="native-row-actions">
      {items.map(([key, icon, label]) => (
        <button key={key} type="button" className="native-icon-action" data-itraq-action={key} data-vehicle={car} aria-label={label} title={label}>{icon}</button>
      ))}
    </span>
  );
}
