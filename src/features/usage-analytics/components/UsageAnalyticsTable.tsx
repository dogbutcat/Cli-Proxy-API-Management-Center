import type { UsageAnalyticsStatRow } from '../usageAnalyticsModel';
import {
  rowCostText,
  rowLatencyText,
  rowRateText,
  rowTokensText,
} from '../usageAnalyticsPresentation';
import styles from '../UsageAnalyticsPage.module.scss';

export type UsageAnalyticsTableProps = {
  title: string;
  emptyText: string;
  rows: UsageAnalyticsStatRow[];
  onDrilldown?: (row: UsageAnalyticsStatRow) => void;
};

export function UsageAnalyticsTable({
  title,
  emptyText,
  rows,
  onDrilldown,
}: UsageAnalyticsTableProps) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2>{title}</h2>
        <span>{rows.length.toLocaleString()} rows</span>
      </div>
      {rows.length ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Provider</th>
                <th>Calls</th>
                <th>Tokens</th>
                <th>Cost</th>
                <th>Success</th>
                <th>Latency</th>
                <th>Flags</th>
                {onDrilldown && <th>Drilldown</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.kind}:${row.id}`}>
                  <td>
                    <strong>{row.label}</strong>
                    {row.secondaryLabel && <small>{row.secondaryLabel}</small>}
                  </td>
                  <td>{row.provider || '-'}</td>
                  <td>{row.calls.toLocaleString()}</td>
                  <td>{rowTokensText(row)}</td>
                  <td>{rowCostText(row)}</td>
                  <td>{rowRateText(row)}</td>
                  <td>{rowLatencyText(row)}</td>
                  <td>
                    <span className={styles.flagList}>
                      {row.zeroTokenCalls > 0 && <span>Zero token</span>}
                      {row.priceState === 'missing' && <span>Missing price</span>}
                      {row.priceState === 'unknown' && <span>Price unknown</span>}
                    </span>
                  </td>
                  {onDrilldown && (
                    <td>
                      <button
                        className={styles.inlineButton}
                        type="button"
                        onClick={() => onDrilldown(row)}
                      >
                        Open
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={styles.emptyText}>{emptyText}</p>
      )}
    </section>
  );
}
