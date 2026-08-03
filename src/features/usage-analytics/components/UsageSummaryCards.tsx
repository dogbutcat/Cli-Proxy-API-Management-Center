import type { UsageSummaryCard } from '../usageAnalyticsPresentation';
import styles from '../UsageAnalyticsPage.module.scss';

interface UsageSummaryCardsProps {
  cards: UsageSummaryCard[];
}

const accentMap: Record<string, string> = {
  amber: styles.summaryAccentAmber,
  blue: styles.summaryAccentBlue,
  cyan: styles.summaryAccentCyan,
  green: styles.summaryAccentGreen,
  red: styles.summaryAccentRed,
  teal: styles.summaryAccentTeal,
};

const toneMap: Record<string, string> = {
  good: styles.tonegood,
  warn: styles.tonewarn,
  bad: styles.tonebad,
};

const variantMap: Record<string, string> = {
  primary: styles.usageSummaryCardPrimary,
  secondary: styles.usageSummaryCardSecondary,
};

export function UsageSummaryCards({ cards }: UsageSummaryCardsProps) {
  if (!cards.length) return null;
  return (
    <div className={styles.usageSummaryGrid}>
      {cards.map((card, i) => {
        const cls = [
          styles.usageSummaryCard,
          card.accent ? accentMap[card.accent] : '',
          card.variant ? variantMap[card.variant] : '',
        ]
          .filter(Boolean)
          .join(' ');

        const valueCls = [
          styles.usageSummaryValue,
          card.tone ? toneMap[card.tone] : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <div key={i} className={cls}>
            <div className={styles.usageSummaryCardHeader}>
              <div className={styles.usageSummaryLabel}>{card.label}</div>
            </div>
            <div className={styles.usageSummaryCardBody}>
              <div className={styles.usageSummaryValueWrap}>
                <div className={valueCls} title={card.valueTitle}>
                  {card.value}
                </div>
              </div>
              <div className={styles.usageSummaryMeta}>{card.meta}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function UsageSummarySection({ cards }: UsageSummaryCardsProps) {
  return <UsageSummaryCards cards={cards} />;
}
