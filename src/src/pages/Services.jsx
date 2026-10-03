import { ArrowUpRight, Flower2, Trees, Sprout, Leaf, Check } from 'lucide-react';
import { copy, services } from '../lib/content';
import SectionTitle from '../components/SectionTitle';
const icons = { Flower2, Trees, Sprout, Leaf };
export default function Services({ lang }) {
  const t=copy[lang], ar=lang==='ar';
  return <section className="page-section shell">
    <SectionTitle eyebrow={ar?'الخدمات':'Services'} title={t.servicesTitle} body={t.servicesIntro}/>
    <div className="catalog-grid">
      {services.map((s,i)=>{ const Icon=icons[s.icon]; return <article className="catalog-card" key={s.key}>
        <div className="catalog-top"><span>0{i+1}</span><Icon size={30}/></div>
        <h2>{ar?s.ar:s.en}</h2><p>{ar?s.descAr:s.descEn}</p>
        <ul>
          <li><Check size={16}/>{ar?'حل مناسب لطبيعة الموقع':'Site-specific solution'}</li>
          <li><Check size={16}/>{ar?'تنفيذ وترتيب احترافي':'Professional delivery'}</li>
          <li><Check size={16}/>{ar?'إمكانية خطة عناية دورية':'Optional scheduled care'}</li>
        </ul>
        <a className="btn primary" href={`https://wa.me/966583799559?text=${encodeURIComponent(ar?`السلام عليكم، أرغب بطلب خدمة: ${s.ar}`:`Hello, I would like to request: ${s.en}`)}`} target="_blank" rel="noreferrer">{t.request}<ArrowUpRight size={17}/></a>
      </article>})}
    </div>
  </section>
}
