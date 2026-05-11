import { useMemo } from "react";
import PropTypes from "prop-types";
import styles from "./DataTable.module.css";

// 키워드 일치 부분을 <mark>로 감싸는 헬퍼
const applyHighlight = (text, keyword) => {
  if (!keyword || text == null || text === "") return text;
  const str = String(text);
  const kw  = keyword.toLowerCase();
  const parts = [];
  let lastIdx = 0;
  let idx = str.toLowerCase().indexOf(kw, lastIdx);

  while (idx !== -1) {
    if (idx > lastIdx) parts.push(str.slice(lastIdx, idx));
    parts.push(
      <mark key={idx} className={styles.highlight}>
        {str.slice(idx, idx + keyword.length)}
      </mark>
    );
    lastIdx = idx + keyword.length;
    idx = str.toLowerCase().indexOf(kw, lastIdx);
  }
  if (lastIdx < str.length) parts.push(str.slice(lastIdx));
  return parts.length > 1 ? <>{parts}</> : text;
};

const DataTable = ({
  columns,
  rows,
  statusMap,
  selectable = true,
  selectedIds = [],
  onSelectionChange = () => {},
  totalCount,
  highlight,
  maxHeight,
}) => {
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const allChecked =
    rows.length > 0 && rows.every((row) => selectedIdSet.has(row.id));

  const handleAllChange = () => {
    if (allChecked) {
      onSelectionChange([]);
    } else {
      onSelectionChange(rows.map((row) => row.id));
    }
  };

  const handleRowChange = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(Array.from(next));
  };

  const renderCell = (col, row) => {
    if (col.renderCell) return col.renderCell(row);

    const value = row[col.key];

    if (col.type === "assetType") {
      if (!value) return <span className={styles.dash}>—</span>;
      return (
        <span className={`${styles.badge} ${styles[`assetType_${value}`]}`}>
          {value}
        </span>
      );
    }

    if (col.type === "status") {
      if (!statusMap || !statusMap[value])
        return <span className={styles.dash}>—</span>;
      const { label, color } = statusMap[value];
      return (
        <span className={`${styles.badge} ${styles[`status_${color}`]}`}>
          {label}
        </span>
      );
    }

    if (value == null || value === "") {
      return <span className={styles.dash}>—</span>;
    }

    return highlight ? applyHighlight(value, highlight) : value;
  };

  // 컬럼 너비 스타일 계산
  const getColStyle = (col) => {
  if (col.width) return { width: col.width, flexShrink: 0 };
  if (col.key === 'no') return { width: '48px', flexShrink: 0 };
  return { flex: 1 };
} ;
  const checkboxColStyle = { width: '40px', flexShrink: 0 };

  return (
    <div className={styles.wrapper}>
      <div className={styles.tableWrapper}>

        {/* 헤더 — 스크롤 밖 */}
        <div className={styles.thead}>
          {selectable && (
            <div className={styles.thCheckbox} style={checkboxColStyle}>
              <input
                type="checkbox"
                checked={allChecked}
                onChange={handleAllChange}
                className={styles.checkbox}
              />
            </div>
          )}
          {columns.map((col) => (
            <div key={col.key} className={styles.th} style={getColStyle(col)}>
              {col.label}
            </div>
          ))}
        </div>

        {/* 본문 — 스크롤 영역 */}
        <div className={styles.tbody} style={maxHeight ? { maxHeight } : undefined}>
          {rows.length === 0 ? (
            <div className={styles.emptyRow}>
              데이터가 없습니다.
            </div>
          ) : (
            rows.map((row) => (
              <div
                key={row.id}
                className={`${styles.tr} ${selectedIdSet.has(row.id) ? styles.selected : ""}`}
              >
                {selectable && (
                  <div className={styles.tdCheckbox} style={checkboxColStyle}>
                    <input
                      type="checkbox"
                      checked={selectedIdSet.has(row.id)}
                      onChange={() => handleRowChange(row.id)}
                      className={styles.checkbox}
                    />
                  </div>
                )}
                {columns.map((col) => (
                  <div key={col.key} className={styles.td} style={getColStyle(col)}>
                    {renderCell(col, row)}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

      </div>

      {totalCount !== undefined && (
        <p className={styles.totalCount}>총 {totalCount}건</p>
      )}
    </div>
  );
};

DataTable.propTypes = {
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      key:   PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      type:  PropTypes.oneOf(["status", "assetType", "dash"]),
      width: PropTypes.string,
    })
  ).isRequired,
  rows: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    })
  ).isRequired,
  statusMap: PropTypes.objectOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      color: PropTypes.string.isRequired,
    })
  ),
  selectable:        PropTypes.bool,
  selectedIds:       PropTypes.array,
  onSelectionChange: PropTypes.func,
  totalCount:        PropTypes.number,
  highlight:         PropTypes.string,
  maxHeight:         PropTypes.string,
};

export default DataTable;
