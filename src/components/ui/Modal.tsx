import React from "react";

interface ModalProps {
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
}

export const Modal: React.FC<ModalProps> = ({ children, onClose, className = "modal-content", ariaLabel, ariaLabelledBy, ariaDescribedBy }) => {
  return (
    <div className="modal-overlay" onClick={() => onClose?.()}>
      <div
        className={className}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || "Dialog"}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
};

export default Modal;
