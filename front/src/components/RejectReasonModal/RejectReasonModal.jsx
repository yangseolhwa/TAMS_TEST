import { useEffect } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import styles from "./RejectReasonModal.module.css";

const RejectReasonModal = ({
  isOpen,
  rejectReason,
  onReasonChange,
  onConfirm,
  onCancel,
  isPending,
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
        <p className={styles.title}>반려 사유를 입력해주세요.</p>
        <p className={styles.desc}>사유는 선택 항목입니다. 입력하지 않아도 반려 처리됩니다.</p>
        <textarea
          className={styles.textarea}
          placeholder="반려 사유 입력 (선택)"
          value={rejectReason}
          onChange={(e) => onReasonChange(e.target.value)}
        />
        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel}>
            취소
          </button>
          <button
            className={styles.confirmBtn}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "처리 중..." : "반려"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

RejectReasonModal.propTypes = {
  isOpen:        PropTypes.bool.isRequired,
  rejectReason:  PropTypes.string.isRequired,
  onReasonChange: PropTypes.func.isRequired,
  onConfirm:     PropTypes.func.isRequired,
  onCancel:      PropTypes.func.isRequired,
  isPending:     PropTypes.bool,
};

export default RejectReasonModal;
