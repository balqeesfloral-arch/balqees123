import Ornament from '../components/Ornament';
import SectionTitle from '../components/SectionTitle';
import { copy, projects } from '../lib/content';
export default function Projects({lang}) {
  const t=copy[lang], ar=lang==='ar';
  return <section className="page-section shell">
    <SectionTitle eyebrow={ar?'أعمال بلقيس':'Balqees work'} title={t.projectsTitle} body={t.projectsIntro}/>
    <div className="projects-grid">
      {projects.map((p,i)=><article className={`portfolio-card visual-${(i%4)+1}`} key={i}>
        <div className="portfolio-art"><Ornament/></div>
        <div className="portfolio-info"><span>{String(i+1).padStart(2,'0')}</span><div><small>{ar?p.categoryAr:p.categoryEn}</small><h3>{ar?p.titleAr:p.titleEn}</h3></div></div>
      </article>)}
    </div>
  </section>
}
