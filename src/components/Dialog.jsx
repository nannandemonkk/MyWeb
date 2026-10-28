import { useEffect, useId, useRef } from "react";
import Icon from "./Icon";

export default function Dialog({ open, onClose, title, subtitle, children }) {
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function closeFromBackdrop(event) {
    if (event.target !== ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
  }

  return (
    <dialog ref={ref} className="dialog" aria-labelledby={titleId} onClose={onClose} onClick={closeFromBackdrop}>
      <div className="dialog-header">
        <div><h2 id={titleId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        <button className="icon-button" onClick={onClose} aria-label="关闭对话框"><Icon name="close" /></button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
