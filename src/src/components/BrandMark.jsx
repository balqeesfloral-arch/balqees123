export default function BrandMark({ compact = false }) {
  return (
    <div className={`brand-mark ${compact ? 'compact' : ''}`} aria-label="Balqees Floral">
      <img className="brand-symbol-image" src="/assets/brand/balqees-symbol.webp" alt="" aria-hidden="true" />
      {!compact && <span><b>بلقيس</b><small>BALQEES FLORAL</small></span>}
    </div>
  );
}
