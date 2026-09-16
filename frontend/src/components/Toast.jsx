export function Toast({ toast }) {
  return <div className={`toast ${toast ? "show" : ""} ${toast?.type || ""}`}>{toast?.message || ""}</div>;
}
