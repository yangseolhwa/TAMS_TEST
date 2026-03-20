import { useEffect } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import styles from "./ConfirmModal.module.css";

const ConfirmModal = ({
  isOpen,
  title,
  desc,
  confirmLabel = "확인",
  cancelLabel = "취소",
  confirmVariant = "primary",
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <p className={styles.title}>{title}</p>
        {desc && <p className={styles.desc}>{desc}</p>}
        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={`${styles.confirmBtn} ${styles[confirmVariant]}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

ConfirmModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  desc: PropTypes.string,
  confirmLabel: PropTypes.string,
  cancelLabel: PropTypes.string,
  confirmVariant: PropTypes.oneOf(["primary", "danger"]),
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

export default ConfirmModal;