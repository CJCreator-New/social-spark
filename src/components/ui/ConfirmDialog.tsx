import React from "react";
import Modal from "@/components/ui/Modal";

interface ConfirmProps {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmProps> = ({
  title,
  message,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}) => {
  const [loading, setLoading] = React.useState(false);
  const titleId = React.useId();
  const messageId = React.useId();

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      onClose={onCancel}
      className="modal-content"
      ariaLabel={title || "Confirm dialog"}
      ariaLabelledBy={titleId}
      ariaDescribedBy={messageId}
    >
      <div className="modal-header">
        <h1 id={titleId} style={{ fontSize: "1.2rem", margin: 0 }}>
          {title || "Confirm"}
        </h1>
        <button className="modal-close" onClick={onCancel} aria-label="Close dialog">
          ✕
        </button>
      </div>
      <div className="modal-body">
        <div id={messageId} style={{ whiteSpace: "pre-wrap", color: "var(--text2)" }}>
          {message}
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-g" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </button>
        <button className="btn btn-p" onClick={handleConfirm} disabled={loading}>
          {loading ? "…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
