export const seasonInteractions = {
  default: { delay: 1050, label: ['افتح الوردة لقراءة رسالة بلقيس', 'Bloom the rose to read your welcome'], hint: ['المس الوردة', 'Tap to bloom'] },
  ramadan: { delay: 420, label: ['أضئ الفانوس لقراءة تهنئة رمضان', 'Light the lantern for your Ramadan greeting'], hint: ['أضئ الفانوس', 'Light the lantern'] },
  eid: { delay: 400, label: ['أطلق المدفع لقراءة تهنئة العيد', 'Fire the ceremonial cannon for your Eid greeting'], hint: ['أطلق بهجة العيد', 'Celebrate Eid'] },
  adha: { delay: 650, label: ['افتح هدية عيد الأضحى', 'Open your Eid Al-Adha gift'], hint: ['افتح هدية العيد', 'Open your Eid gift'] },
  hajj: { delay: 700, label: ['ابدأ رحلة الترحيب بضيوف الرحمن', 'Take off for a heartfelt Hajj welcome'], hint: ['رحلة مباركة', 'A blessed journey'] },
  national: { delay: 1050, label: ['صب القهوة لقراءة تهنئة اليوم الوطني', 'Pour Saudi coffee for your National Day greeting'], hint: ['تفضّل قهوتك', 'Your Saudi coffee'] },
};

// Photographic atlases supply the object states. SVG is only used for the liquid
// and flight trail; the objects themselves keep their natural material texture.
export default function SeasonObject({ seasonKey }) {
  return <span className={`season-object scene-${seasonKey}`} aria-hidden="true" key={seasonKey}>
    <span className="object-ground"/>
    {seasonKey === 'default' && <span className="rose-object">{[0, 1, 2, 3].map(frame => <span key={frame} className={`object-sprite rose-frame rose-frame-${frame}`}/>)}</span>}
    {seasonKey === 'ramadan' && <span className="lantern-object"><span className="lantern-light"/><span className="object-sprite lantern-off"/><span className="object-sprite lantern-on"/></span>}
    {seasonKey === 'eid' && <span className="cannon-object"><img className="cannon-body" src="/assets/interactions/cannon.webp" alt="" draggable="false"/><span className="cannon-flash"/><span className="cannon-smoke smoke-one"/><span className="cannon-smoke smoke-two"/></span>}
    {seasonKey === 'adha' && <span className="gift-object"><span className="object-sprite gift-closed"/><span className="object-sprite gift-open"/></span>}
    {seasonKey === 'hajj' && <span className="flight-object"><svg className="flight-trail" viewBox="0 0 100 100" fill="none"><path d="M90 84 C80 85 64 78 51 63 S27 39 16 26"/></svg><img className="plane-body" src="/assets/interactions/plane.webp" alt="" draggable="false"/></span>}
    {seasonKey === 'national' && <span className="coffee-object">
      <span className="object-sprite coffee-pot"/><span className="object-sprite coffee-cup"/><span className="coffee-surface"/>
      <svg className="coffee-stream" viewBox="0 0 100 100" fill="none"><path d="M33.5 21.5 C35 34 27 51 26 69"/><path className="stream-highlight" d="M33.5 21.5 C35 34 27 51 26 69"/></svg>
    </span>}
  </span>;
}
