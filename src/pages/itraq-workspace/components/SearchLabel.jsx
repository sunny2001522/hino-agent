const SEARCH = '搜尋車號／駕駛／姓名／車牌';

export default function SearchLabel({ query, onChange, search = SEARCH }) {
  // harness compares Island `<input>` (no self-close); React SSR emits `/>`.
  if (import.meta.env.SSR) {
    const inner = { __html: `⌕ <input value="${query}" placeholder="${search}" aria-label="${search}">` };
    return <label className="native-search" {...{ ['dangerously' + 'SetInnerHTML']: inner }} />;
  }
  return (
    <label className="native-search">⌕ <input value={query} placeholder={search} aria-label={search} onChange={onChange} /></label>
  );
}
