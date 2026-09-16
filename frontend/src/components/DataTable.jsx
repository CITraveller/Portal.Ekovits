export function DataTable({ headers, rows, empty = "No records." }) {
  return (
    <table className="data-table">
      <thead><tr>{headers.map(header => <th key={header}>{header}</th>)}</tr></thead>
      <tbody>
        {rows.length ? rows : <tr><td colSpan={headers.length}>{empty}</td></tr>}
      </tbody>
    </table>
  );
}
