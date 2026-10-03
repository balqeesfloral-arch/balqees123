import SectionTitle from '../components/SectionTitle';
import SeasonExperience from '../components/SeasonExperience';
import { copy, projects } from '../lib/content';
const images = ['/assets/home/hero-hotel.webp', '/assets/home/hotel-gold.webp', '/assets/home/indoor-garden.webp', '/assets/home/outdoor-landscape.webp', '/assets/home/event-roses.webp', '/assets/services/indoor-dracaena.webp'];
export default function Projects({ lang }) {
  const t = copy[lang], ar = lang === 'ar';
  return <section className="page-section shell">
    <div className="page-heading-art"><SeasonExperience lang={lang} compact/><SectionTitle as="h1" eyebrow={ar ? 'أعمال بلقيس' : 'BALQEES WORK'} title={t.projectsTitle} body={ar ? 'من الورد إلى المشهد المتكامل. مختارات من صور أعمالنا وتوريداتنا في الضيافة والنباتات والحدائق.' : 'From individual blooms to complete botanical settings. Selected photographs of our hospitality, planting and landscaping work.'}/></div>
    <div className="projects-grid">{projects.map((p, i) => <article className="portfolio-card" key={p.titleEn}>
      <div className="portfolio-art"><img src={images[i]} alt={ar ? p.titleAr : p.titleEn} loading="lazy" width="800" height="1000"/></div>
      <div className="portfolio-info"><span>{String(i + 1).padStart(2, '0')}</span><div><small>{ar ? p.categoryAr : p.categoryEn}</small><h3>{ar ? p.titleAr : p.titleEn}</h3></div></div>
    </article>)}</div>
  </section>;
}
