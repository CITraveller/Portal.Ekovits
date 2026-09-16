export function Modal({ children, onClose }) {
  if (!children) return null;
  return (
    <div className="modal" role="dialog" aria-modal="true" onMouseDown={(event) => { if (event.target.className === "modal") onClose(); }}>
      <div className="modal-card">
        <button className="close" aria-label="Close" onClick={onClose}>x</button>
        {children}
      </div>
    </div>
  );
}
