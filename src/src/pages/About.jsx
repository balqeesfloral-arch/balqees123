import { Leaf, Gem, Repeat2 } from 'lucide-react';
import SectionTitle from '../components/SectionTitle';
import Ornament from '../components/Ornament';
import { copy } from '../lib/content';
export default function About({lang}) {
 const t=copy[lang], ar=lang==='ar';
 return <section className="page-section shell about-page">
   <SectionTitle eyebrow="BALQEES FLORAL" title={t.aboutPageTitle} body={t.aboutBody}/>
   <div className="about-manifesto"><div className="about-arch"><Ornament/></div><div><span className="eyebrow">{ar?'فلسفتنا':'Our philosophy'}</span><h2>{ar?'المشهد الطبيعي الناجح لا يلفت النظر إلى نفسه؛ بل يجعل المكان كله أجمل.':'The best natural scene does not compete with the space; it makes the whole space feel better.'}</h2><p>{ar?'لهذا نبتعد عن المبالغة، ونبحث عن التوازن بين النبات، الخامة، الإضاءة، الحركة، ومتطلبات التشغيل اليومية.':'That is why we avoid excess and seek balance between plant life, material, light, movement and daily operations.'}</p></div></div>
   <SectionTitle eyebrow={ar?'ما نؤمن به':'What we value'} title={t.values}/>
   <div className="value-grid">
     <div><Leaf/><h3>{t.natural}</h3><p>{ar?'نختار الحلول الطبيعية التي تعيش مع المكان وتخدمه.':'Natural choices that live well within the space.'}</p></div>
     <div><Gem/><h3>{t.detail}</h3><p>{ar?'من الوعاء إلى الارتفاع والتوزيع، كل تفصيل محسوب.':'From vessel to height and placement, every detail is considered.'}</p></div>
     <div><Repeat2/><h3>{t.continuity}</h3><p>{ar?'نهتم بما بعد التنفيذ بقدر اهتمامنا بلحظة التسليم.':'We care about what happens after installation as much as delivery day.'}</p></div>
   </div>
 </section>
}
