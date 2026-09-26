export default function IconActions({ items }) {
  return (
    <span className="native-row-actions">
      {items.map(([key, icon, label]) => (
        <button key={key} type="button" className="native-icon-action" data-itraq-action={key} aria-label={label} title={label}>{icon}</button>
      ))}
    </span>
  );
}
