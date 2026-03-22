import { useMemo } from "react";
import PropTypes from "prop-types";
import styles from "./DataTable.module.css";

const DataTable = ({
  columns,
  rows,
  statusMap,
  selectedIds,
  onSelectionChange,
  totalCount,
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
    // 컬럼에 커스텀 렌더러가 있으면 우선 사용
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

    if (col.type === "dash" || value == null || value === "") {
      return value ? value : <span className={styles.dash}>—</span>;
    }

    return value;
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thCheckboxCell}>
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={handleAllChange}
                  className={styles.checkbox}
                />
              </th>
              {columns.map((col) => (
                <th key={col.key} className={styles.th}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className={styles.emptyCell}
                >
                  데이터가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={`${styles.tr} ${
                    selectedIdSet.has(row.id) ? styles.selected : ""
                  }`}
                >
                  <td className={styles.checkboxCell}>
                    <input
                      type="checkbox"
                      checked={selectedIdSet.has(row.id)}
                      onChange={() => handleRowChange(row.id)}
                      className={styles.checkbox}
                    />
                  </td>
                  {columns.map((col) => (
                    <td key={col.key} className={styles.td}>
                      {renderCell(col, row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
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
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      type: PropTypes.oneOf(["status", "assetType", "dash"]),
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
  selectedIds: PropTypes.array.isRequired,
  onSelectionChange: PropTypes.func.isRequired,
  totalCount: PropTypes.number,
};

export default DataTable
