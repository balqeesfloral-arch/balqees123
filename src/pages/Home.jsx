import { useState } from 'react';
import { ArrowUpLeft, ArrowUpRight, ArrowDown, Check, MoveUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import SeasonExperience from '../components/SeasonExperience';
import { useSeason, whatsappHref } from '../lib/season-design';

const collections = [
  { image: '/assets/home/hotel-table.webp', ar: 'فنّ الضيافة', en: 'Floral hospitality', small: ['فنادق ولوبيات', 'HOTELS & LOBBIES'] },
  { image: '/assets/home/premium-arrangement.webp', ar: 'تنسيق الورد', en: 'Flowers, composed', small: ['زهور طبيعية', 'NATURAL FLOWERS'] },
  { image: '/assets/home/indoor-planters.webp', ar: 'حياة خضراء', en: 'Living greenery', small: ['نباتات وعناية', 'PLANTS & CARE'] },
];
const curation = [
  { ar: 'الفنادق والضيافة', en: 'Hospitality', image: '/assets/home/hero-hotel.webp', title: ['انطباع أول، يبقى.', 'A first impression that stays.'], body: ['نختار الزهور والفازات والارتفاعات بما ينسجم مع هوية الفندق، ثم نرتب التوريد والتجديد والعناية؛ ليبقى الاستقبال في أجمل صورة.', 'Flowers, vessels and scale chosen around your hotel’s identity, with coordinated supply, refresh and care to keep every arrival beautiful.'] },
  { ar: 'الفازات والتفاصيل', en: 'Vases & details', image: '/assets/home/hotel-gold.webp', title: ['جمال التفاصيل الصغيرة.', 'Beauty in the smallest details.'], body: ['الخامة واللون والمقياس تصنع فرقًا. نختار الفازات والمراكن لتنسجم مع المساحة وتمنح التكوين الزهري حضوره المناسب.', 'Material, colour and scale make a difference. We choose vessels that belong in your space and give every floral composition its presence.'] },
  { ar: 'الحدائق والعناية', en: 'Gardens & care', image: '/assets/home/outdoor-landscape.webp', title: ['طبيعة تنمو مع المكان.', 'Nature that grows with you.'], body: ['من اختيار النبات وفق الضوء والمساحة إلى الزراعة والعناية الدورية. نتعامل مع المساحة الخضراء كجزء حيّ من المكان.', 'From selecting plants for light and scale to planting and scheduled care, we treat greenery as a living part of your space.'] },
];
export default function Home({ lang }) {
  const ar = lang === 'ar', i = ar ? 0 : 1;
  const { season } = useSeason();
  const [selected, setSelected] = useState(0);
  const c = curation[selected];
  const Arrow = ar ? ArrowUpLeft : ArrowUpRight;
  return <>
    <section className="signature-hero" aria-labelledby="hero-title">
      <SeasonExperience lang={lang}/>
      <div className="hero-inner shell"><div className="hero-copy" key={season.key}>
        <div className="hero-eyebrow"><span/>{season.eyebrow[i]}</div>
        <h1 id="hero-title">{season.title[i]}<em>{season.accent[i]}</em></h1>
        <p className="hero-description">{season.body[i]}</p>
        <div className="hero-actions"><Link className="btn hero-primary" to="/services">{ar ? 'اكتشف عالم بلقيس' : 'Discover Balqees'}<Arrow size={19}/></Link><a className="hero-contact" href={whatsappHref()} target="_blank" rel="noreferrer">{ar ? 'لنتحدث عن مساحتك' : 'Let’s talk about your space'}</a></div>
        <div className="hero-footnote"><span className="tiny-diamond"/>{season.note[i]}</div>
      </div></div>
      <a className="hero-scroll" href="#our-world" aria-label={ar ? 'اكتشف المزيد' : 'Discover more'}><ArrowDown size={16}/><span>{ar ? 'اكتشف المزيد' : 'EXPLORE'}</span></a>
      <div className="hero-edition" aria-hidden="true"><span>{season.number}</span><small>— 06</small></div>
    </section>

    <section className="world-section shell" id="our-world">
      <div className="editorial-heading"><div><span className="eyebrow">{ar ? 'عالم بلقيس' : 'THE WORLD OF BALQEES'}</span><h2>{ar ? 'طبيعة تليق بالمكان.' : 'Nature that belongs.'}</h2></div><p>{ar ? 'زهور تُختار بذوق، ونباتات تُصاغ بعناية. نربط التوريد والتنسيق والصيانة في تجربة واحدة، من مكة المكرمة.' : 'Thoughtfully chosen flowers and carefully composed greenery. Supply, styling and care, brought together in Makkah.'}</p></div>
      <div className="collection-grid">{collections.map((item, index) => <Link className="collection-card" to="/services" key={item.en}>
        <div className="collection-image"><img src={item.image} alt={ar ? item.ar : item.en} loading="lazy" width="800" height="960"/><span className="collection-number">0{index + 1}</span><span className="collection-arrow"><Arrow size={22}/></span></div>
        <div className="collection-caption"><div><span>{item.small[i]}</span><h3>{ar ? item.ar : item.en}</h3></div><span className="collection-line"/></div>
      </Link>)}</div>
      <div className="world-baseline"><span>{ar ? 'توريد · تنسيق · تنفيذ · عناية' : 'SUPPLY · STYLE · INSTALL · CARE'}</span><Link className="text-link" to="/services">{ar ? 'جميع خدماتنا' : 'All our services'}<Arrow size={17}/></Link></div>
    </section>
    <section className="atelier-section">
      <div className="atelier-layout shell"><div className="atelier-copy"><span className="eyebrow">{ar ? 'التفاصيل تصنع الفرق' : 'CONSIDERED IN EVERY DETAIL'}</span><h2>{ar ? 'نرى المكان،' : 'We see your space.'}<br/><em>{ar ? 'ثم نختار له.' : 'Then we create.'}</em></h2>
        <div className="curation-tabs" role="tablist" aria-label={ar ? 'مجالات التنسيق' : 'Styling disciplines'}>{curation.map((item, index) => <button id={`curation-tab-${index}`} key={item.en} role="tab" aria-selected={selected === index} aria-controls="curation-panel" tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={e => { if (['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) { e.preventDefault(); const next = e.key === 'Home' ? 0 : e.key === 'End' ? 2 : (index + (e.key === (ar ? 'ArrowLeft' : 'ArrowRight') ? 1 : 2)) % 3; setSelected(next); document.getElementById(`curation-tab-${next}`)?.focus(); } }}>{ar ? item.ar : item.en}</button>)}</div>
        <div id="curation-panel" className="curation-copy" role="tabpanel" aria-labelledby={`curation-tab-${selected}`} key={selected}><h3>{c.title[i]}</h3><p>{c.body[i]}</p></div>
        <a href={whatsappHref()} className="text-link light-link" target="_blank" rel="noreferrer">{ar ? 'اطلب معاينة لمساحتك' : 'Arrange a site visit'}<Arrow size={18}/></a>
      </div><div className="atelier-photo"><img key={c.image} src={c.image} alt={ar ? c.ar : c.en} loading="lazy" width="1000" height="1200"/><div className="atelier-photo-label"><span>THE BALQEES TOUCH</span><small>{ar ? 'من واقع أعمالنا' : 'FROM OUR WORK'}</small></div></div></div>
    </section>
    <section className="work-preview shell"><div className="editorial-heading"><div><span className="eyebrow">{ar ? 'مختارات من أعمالنا' : 'SELECTED WORK'}</span><h2>{ar ? 'حين تصبح الفكرة واقعًا.' : 'Ideas, brought to life.'}</h2></div><Link className="text-link" to="/projects">{ar ? 'شاهد الأعمال' : 'View our work'}<Arrow size={17}/></Link></div>
      <div className="work-preview-grid">{[
        ['/assets/home/floral-signature.webp', ['تنسيق زهور الضيافة', 'Hospitality florals']],
        ['/assets/home/hero-grand.webp', ['حضور في مساحة الاستقبال', 'A statement on arrival']],
        ['/assets/home/indoor-garden.webp', ['حدائق تنبض بالحياة', 'Gardens that feel alive']],
      ].map(([image,title],j) => <Link to="/projects" className={`work-preview-item work-item-${j}`} key={image}><img src={image} alt={title[i]} loading="lazy"/><div><span>{title[i]}</span><MoveUpRight size={22}/></div></Link>)}</div>
    </section>
    <section className="care-strip shell">{(ar ? ['ورد ونباتات طبيعية', 'تنسيق يناسب هوية المكان', 'عناية وتجديد مستمر'] : ['Natural flowers & plants', 'Styling that reflects your space', 'Ongoing care & refresh']).map(label => <span key={label}><Check size={17}/>{label}</span>)}</section>
    <section className="contact-invitation"><div className="shell contact-invitation-inner"><span className="eyebrow">{ar ? 'الحكاية تبدأ من مساحتك' : 'EVERY STORY BEGINS WITH A SPACE'}</span><h2>{ar ? 'لنصنع شيئًا جميلًا، معًا.' : 'Let’s create something beautiful.'}</h2><a className="btn primary" href={whatsappHref()} target="_blank" rel="noreferrer">{ar ? 'تواصل مع بلقيس' : 'Talk to Balqees'}<Arrow size={19}/></a><span className="invitation-location">{ar ? 'مكة المكرمة، المملكة العربية السعودية' : 'Makkah, Saudi Arabia'}</span></div></section>
  </>;
}
