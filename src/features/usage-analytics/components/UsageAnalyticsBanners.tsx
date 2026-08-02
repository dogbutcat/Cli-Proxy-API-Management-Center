import type { UsageAnalyticsBanner } from '../usageAnalyticsPresentation';
import styles from '../UsageAnalyticsPage.module.scss';

export function UsageAnalyticsBanners({ banners }: { banners: UsageAnalyticsBanner[] }) {
  if (!banners.length) return null;
  return (
    <section className={styles.bannerStack} aria-label="Usage analytics status">
      {banners.map((banner) => (
        <div className={`${styles.banner} ${styles[`banner_${banner.tone}`]}`} key={banner.key}>
          {banner.text}
        </div>
      ))}
    </section>
  );
}
