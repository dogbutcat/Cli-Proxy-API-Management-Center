import type { UsageAnalyticsMetricCard } from '../usageAnalyticsPresentation';
import styles from '../UsageAnalyticsPage.module.scss';

export function UsageAnalyticsCards({ cards }: { cards: UsageAnalyticsMetricCard[] }) {
  return (
    <section className={styles.metricGrid} aria-label="Usage analytics summary">
      {cards.map((card) => (
        <article className={styles.metricCard} key={card.key}>
          <p className={styles.metricLabel}>{card.label}</p>
          <strong className={styles.metricValue}>{card.value}</strong>
          <span className={styles.metricNote}>{card.note}</span>
        </article>
      ))}
    </section>
  );
}
