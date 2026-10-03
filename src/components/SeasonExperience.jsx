import { useSeason } from '../lib/season-design';

export default function SeasonExperience({ lang, compact = false }) {
  const { season } = useSeason();
  const i = lang === 'ar' ? 0 : 1;
  return <div className={`season-photograph ${compact ? 'is-compact' : ''}`} key={season.key}>
    <picture>
      <source media="(max-width: 640px)" srcSet={season.image.replace('.webp', '-mobile.webp')} />
      <img src={season.image} alt={season.alt[i]} style={{ objectPosition: season.position }} fetchPriority="high" decoding="async" width="1536" height="1024" />
    </picture>
    <div className="photograph-shade" aria-hidden="true" />
    {season.key === 'ramadan' && <div className="lantern-ambience" aria-hidden="true" />}
    {!compact && <div className="photograph-caption"><span className="caption-rule" /><span>{season.caption[i]}</span></div>}
    {!compact && season.key === 'hajj' && <a className="photo-credit" href="https://unsplash.com/photos/ceNCWYqL8DY" target="_blank" rel="noreferrer">Sam Riz / Unsplash</a>}
  </div>;
}
