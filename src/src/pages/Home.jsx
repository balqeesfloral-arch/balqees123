import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Flower2,
  Trees,
  Sprout,
  Leaf,
  ShieldCheck,
  Sparkles,
  RefreshCcw,
  Building2,
  Check,
  Star,
  Hotel,
  Sofa,
  Landmark
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Ornament from '../components/Ornament';

const heroSlides = [
  {
    image: '/assets/home/hero-hotel.webp',
    ar: 'تنسيقات فندقية تصنع الانطباع الأول',
    en: 'Hotel styling that shapes the first impression',
    tagAr: 'فنادق وضيافة',
    tagEn: 'Hotels & Hospitality'
  },
  {
    image: '/assets/home/hero-grand.webp',
    ar: 'مشهد نباتي يليق بأفخم مساحات الاستقبال',
    en: 'Botanical scenes for premium arrival spaces',
    tagAr: 'لوبيات ومداخل',
    tagEn: 'Lobbies & Entrances'
  },
  {
    image: '/assets/home/hero-lobby.webp',
    ar: 'ورد طبيعي، فازات مختارة، وعناية مستمرة',
    en: 'Natural flowers, curated vases, continuous care',
    tagAr: 'تنسيق وعناية',
    tagEn: 'Styling & Care'
  }
];

const solutions = [
  {
    key: 'hospitality', icon: Building2,
    titleAr: 'حلول الفنادق والضيافة', titleEn: 'Hospitality Solutions',
    bodyAr: 'تنسيق اللوبيات والمداخل والطاولات، توريد دوري، تبديل مرن، وتجهيز يتماشى مع هوية المنشأة.',
    bodyEn: 'Lobby, entrance and table styling with scheduled supply, flexible refresh cycles and hotel-ready execution.',
    image: '/assets/home/hotel-table.webp'
  },
  {
    key: 'floral', icon: Flower2,
    titleAr: 'تنسيق الورد الطبيعي', titleEn: 'Natural Floral Styling',
    bodyAr: 'تنسيقات كبيرة وصغيرة مصممة للمشهد والمناسبة، مع اختيار أصناف وألوان تتناغم مع المكان.',
    bodyEn: 'Large and intimate arrangements tailored to the setting, occasion and visual identity.',
    image: '/assets/home/floral-signature.webp'
  },
  {
    key: 'plants', icon: Trees,
    titleAr: 'النباتات الداخلية والمراكن', titleEn: 'Indoor Plants & Planters',
    bodyAr: 'توريد نباتات ظل وأشجار داخلية ومراكن فاخرة، مع اختيار المقاس والنوع حسب الإضاءة ومساحة الموقع.',
    bodyEn: 'Indoor trees, foliage and premium planters selected around light levels, scale and space usage.',
    image: '/assets/home/indoor-planters.webp'
  },
  {
    key: 'landscape', icon: Sprout,
    titleAr: 'الحدائق والتشجير', titleEn: 'Landscaping & Planting',
    bodyAr: 'تنفيذ وتطوير المساحات الخضراء، المداخل، الأحواض الخارجية، وتنسيق النباتات بما يخدم حركة المكان.',
    bodyEn: 'Green-space development, entrances, outdoor beds and planting layouts built around the site.',
    image: '/assets/home/outdoor-landscape.webp'
  },
  {
    key: 'care', icon: Leaf,
    titleAr: 'الصيانة والعناية النباتية', titleEn: 'Plant Care & Maintenance',
    bodyAr: 'ري وتقليم وتنظيف ومغذيات ومعالجات نباتية ومتابعة صحة النبات واستبدال التالف عند الحاجة.',
    bodyEn: 'Watering, pruning, cleaning, nutrition, plant treatments, health checks and replacement when required.',
    image: '/assets/home/indoor-garden.webp'
  },
  {
    key: 'vases', icon: Sparkles,
    titleAr: 'الفازات والمراكن وحلول الري', titleEn: 'Vases, Planters & Watering',
    bodyAr: 'اختيار وتوريد فازات ومراكن متناسقة مع الديكور، بما فيها خيارات الري الذاتي والحلول العملية للمواقع.',
    bodyEn: 'Curated vases and planters that fit the interior, including self-watering and practical site solutions.',
    image: '/assets/home/planter-palm.webp'
  },
  {
    key: 'pilgrims', icon: ShieldCheck,
    titleAr: 'حلول ضيوف الرحمن', titleEn: 'Hajj & Umrah Hospitality',
    bodyAr: 'تجهيز موسمي للفنادق ومرافق الضيافة خلال الحج والعمرة، مع رفع الجاهزية وسرعة التوريد والتجديد.',
    bodyEn: 'Seasonal readiness for hotels and hospitality facilities during Hajj and Umrah with fast replenishment.',
    image: '/assets/home/premium-arrangement.webp'
  },
  {
    key: 'events', icon: RefreshCcw,
    titleAr: 'المناسبات والتجديد الموسمي', titleEn: 'Events & Seasonal Refresh',
    bodyAr: 'تنسيق مناسبات وهوية موسمية للمداخل والطاولات والمساحات، مع تغيير التكوينات حسب المناسبة.',
    bodyEn: 'Event styling and seasonal refresh programs for entrances, tables and shared spaces.',
    image: '/assets/home/event-roses.webp'
  }
];

const showcase = [
  { image: '/assets/home/hero-hotel.webp', ar: 'لوبي فندقي', en: 'Hotel Lobby', className: 'wide' },
  { image: '/assets/home/floral-pink.webp', ar: 'تنسيق ورد', en: 'Floral Styling' },
  { image: '/assets/home/hotel-gold.webp', ar: 'فازات فاخرة', en: 'Statement Vases' },
  { image: '/assets/home/indoor-planters.webp', ar: 'نباتات داخلية', en: 'Indoor Plants' },
  { image: '/assets/home/outdoor-landscape.webp', ar: 'تشجير خارجي', en: 'Outdoor Planting' },
  { image: '/assets/home/premium-arrangement.webp', ar: 'تنسيق ضيافة', en: 'Hospitality Styling', className: 'wide' }
];

const curationItems = [
  {
    key: 'lobby',
    image: '/assets/home/hero-grand.webp',
    titleAr: 'تنسيق لوبي فاخر',
    titleEn: 'Luxury lobby styling',
    eyebrowAr: 'مختارات مميزة',
    eyebrowEn: 'Curated selection',
    bodyAr: 'مشهد نباتي متوازن للمداخل الفاخرة ومساحات الاستقبال، يربط الورد الطبيعي بالمراكن والتوزيع البصري بانسجام احترافي.',
    bodyEn: 'A balanced botanical statement for premium lobbies and entrance zones, uniting flowers, planters and visual rhythm.'
  },
  {
    key: 'vases',
    image: '/assets/home/hotel-gold.webp',
    titleAr: 'فازات ومراكن بلمسة تنفيذية',
    titleEn: 'Executive vases & planters',
    eyebrowAr: 'تفاصيل تصنع الفرق',
    eyebrowEn: 'Details that elevate',
    bodyAr: 'اختيارات فاخرة تضيف حضورًا راقيًا للطاولات والزوايا والنقاط البصرية، مع عناية بالتناسق اللوني والخاماتي.',
    bodyEn: 'Premium pieces that elevate tables, corners and focal points with careful attention to material and palette.'
  },
  {
    key: 'indoor',
    image: '/assets/home/indoor-planters.webp',
    titleAr: 'نباتات داخلية محسوبة للمكان',
    titleEn: 'Indoor greenery with intent',
    eyebrowAr: 'توازن طبيعي مدروس',
    eyebrowEn: 'A deliberate natural balance',
    bodyAr: 'توزيع نباتي يراعي الإضاءة والحركة والارتفاعات، لخلق هوية حية تبدو أنيقة من كل زاوية.',
    bodyEn: 'Planting layouts shaped around light, movement and scale so the space feels alive from every angle.'
  },
  {
    key: 'floral',
    image: '/assets/home/floral-pink.webp',
    titleAr: 'ورد طبيعي بطابع مميز',
    titleEn: 'Natural florals with signature charm',
    eyebrowAr: 'ذوق بلقيس',
    eyebrowEn: 'The Balqees touch',
    bodyAr: 'تنسيق طبيعي ناعم يناسب المكاتب، الضيافة الراقية والمناسبات، مع حضور بصري يلفت دون مبالغة.',
    bodyEn: 'A softer floral statement for offices, premium hospitality and events with elegant visual impact.'
  }
];

const sectorPills = [
  { icon: Hotel, ar: 'الفنادق', en: 'Hotels' },
  { icon: Landmark, ar: 'الضيافة الموسمية', en: 'Seasonal hospitality' },
  { icon: Sofa, ar: 'اللوبيات والمكاتب', en: 'Lobbies & offices' },
  { icon: Star, ar: 'تنسيقات راقية', en: 'Premium styling' }
];

const text = {
  ar: {
    eyebrow: 'بلقيس الورد · مكة المكرمة',
    titleA: 'نصنع للمكان',
    titleB: 'حضوراً حيّاً لا يُنسى.',
    body: 'حلول متكاملة للزهور والنباتات والحدائق والفازات والصيانة، مصممة للفنادق والضيافة والمساحات التي ترى في التفاصيل جزءاً من هويتها.',
    primary: 'استكشف الحلول', secondary: 'اطلب معاينة',
    proof1: 'توريد وتنفيذ', proof2: 'عناية دورية', proof3: 'حلول مخصصة للموقع',
    solutionsEyebrow: 'من التوريد إلى العناية', solutionsTitle: 'منظومة نباتية متكاملة للمكان.',
    solutionsBody: 'لا نتعامل مع الورد والنبات كقطعة منفصلة؛ نربط الاختيار، الفازة أو المركن، التوزيع، الري، التجديد والصيانة في خدمة واحدة متماسكة.',
    hotelsEyebrow: 'BALQEES HOSPITALITY', hotelsTitle: 'الفندق يحتاج مشهداً يتجدد… لا تنسيقاً ليوم واحد.',
    hotelsBody: 'نبني برنامجاً يناسب حركة الضيوف وهوية المنشأة: تنسيق، توريد دوري، تبديل، متابعة وصيانة؛ مع مرونة أعلى في مواسم الذروة والحج والعمرة.',
    hotelPills: ['لوبيات ومداخل', 'طاولات الاستقبال', 'فازات مركزية', 'نباتات داخلية', 'توريد دوري', 'صيانة مستمرة'],
    workEyebrow: 'أعمال حقيقية من مشاريعنا', workTitle: 'صور تتكلم عن مستوى التنفيذ.',
    workBody: 'انتقينا من أعمال بلقيس الصور التي تعكس جودة التنفيذ وتنوع الحلول، دون استخدام صور مخزنة أو مشاهد لا تمثل عملنا.',
    promiseEyebrow: 'ما بعد التركيب', promiseTitle: 'الجمال يحتاج نظاماً يحافظ عليه.',
    promiseBody: 'برنامج العناية لدينا يمكن أن يشمل الجدولة، الري، التنظيف، التقليم، التغذية، المعالجة النباتية، تبديل الورد والنباتات ومراجعة المراكن والفازات.',
    steps: ['معاينة وفهم الموقع', 'اختيار الأنواع والخامات', 'تنفيذ وتسليم منظم', 'متابعة وتجديد وصيانة'],
    ctaEyebrow: 'ابدأ من المكان', ctaTitle: 'أرسل لنا صورة المساحة، ونبني لك تصوراً يناسبها.', ctaBtn: 'تواصل عبر واتساب',
    scroll: 'اكتشف بلقيس',
    selectedEyebrow: 'اختيار احترافي من أعمالنا',
    selectedTitle: 'مختارات فاخرة تليق بالواجهة الأولى.',
    selectedBody: 'عرض تفاعلي يبرز بعض الأعمال الأكثر أناقة بصريًا، حتى تكون الصفحة الرئيسية أقرب لمشهد تقديمي فاخر لا مجرد معرض صور.'
  },
  en: {
    eyebrow: 'Balqees Floral · Makkah',
    titleA: 'We give spaces',
    titleB: 'a living presence worth remembering.',
    body: 'Integrated floral, planting, landscaping, planter and maintenance solutions for hotels, hospitality and spaces where detail is part of the identity.',
    primary: 'Explore solutions', secondary: 'Request a site visit',
    proof1: 'Supply & execution', proof2: 'Scheduled care', proof3: 'Site-specific solutions',
    solutionsEyebrow: 'From supply to care', solutionsTitle: 'A complete botanical system for the space.',
    solutionsBody: 'We connect plant selection, vases and planters, placement, watering, refresh cycles and maintenance into one coherent service.',
    hotelsEyebrow: 'BALQEES HOSPITALITY', hotelsTitle: 'A hotel needs a scene that keeps evolving — not a one-day arrangement.',
    hotelsBody: 'We build a program around guest flow and property identity: styling, scheduled supply, refresh, follow-up and maintenance, with extra flexibility during Hajj and Umrah peaks.',
    hotelPills: ['Lobbies & entrances', 'Reception tables', 'Statement vases', 'Indoor plants', 'Scheduled supply', 'Ongoing care'],
    workEyebrow: 'Real work from our projects', workTitle: 'Execution quality you can actually see.',
    workBody: 'We selected images that best represent the range and finish of Balqees projects — no stock imagery and no filler.',
    promiseEyebrow: 'Beyond installation', promiseTitle: 'Great botanical styling needs a system to preserve it.',
    promiseBody: 'Our care program can include scheduling, watering, cleaning, pruning, nutrition, plant treatments, flower and plant replacement, and planter or vase checks.',
    steps: ['Assess the site', 'Select plants & materials', 'Deliver with precision', 'Maintain & refresh'],
    ctaEyebrow: 'Start with the space', ctaTitle: 'Send us a photo of your space and we will build a direction around it.', ctaBtn: 'Contact on WhatsApp',
    scroll: 'Discover Balqees',
    selectedEyebrow: 'Professionally curated from our work',
    selectedTitle: 'A richer homepage selection with premium visual presence.',
    selectedBody: 'An interactive feature section that presents some of the most elegant Balqees scenes — closer to a luxury presentation than a simple image gallery.'
  }
};

function Reveal({ children, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        node.classList.add('is-visible');
        observer.unobserve(node);
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -40px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`home-reveal ${className}`}>{children}</div>;
}

export default function Home({ lang }) {
  const ar = lang === 'ar';
  const t = text[lang];
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const [activeCuration, setActiveCuration] = useState(0);

  useEffect(() => {
    if (paused) return undefined;
    const id = window.setInterval(() => {
      setSlide((current) => (current + 1) % heroSlides.length);
    }, 5600);
    return () => window.clearInterval(id);
  }, [paused]);

  const current = heroSlides[slide];
  const curation = curationItems[activeCuration];
  const whatsapp = `https://wa.me/966583799559?text=${encodeURIComponent(ar ? 'السلام عليكم، أرغب في طلب معاينة أو عرض لخدمات بلقيس.' : 'Hello, I would like to request a Balqees site visit or proposal.')}`;

  return (
    <div className="home-premium">
      <section className="premium-hero shell" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        <div className="hero-season-glow" aria-hidden="true" />
        <div className="premium-hero-media">
          {heroSlides.map((item, index) => (
            <img
              key={item.image}
              src={item.image}
              alt=""
              className={`premium-hero-image ${index === slide ? 'active' : ''}`}
              loading={index === 0 ? 'eager' : 'lazy'}
            />
          ))}
          <div className="premium-hero-shade" />
          <div className="premium-image-credit">
            <span>{ar ? current.tagAr : current.tagEn}</span>
            <strong>{String(slide + 1).padStart(2, '0')}</strong>
          </div>
          <div className="premium-hero-floating-card">
            <small>{ar ? 'اختيار بصري راقٍ' : 'A premium visual pick'}</small>
            <strong>{ar ? current.ar : current.en}</strong>
          </div>

          <div className="premium-hero-filmstrip" aria-label={ar ? 'مختارات سريعة من الواجهة' : 'Quick visual selection'}>
            {heroSlides.map((item, index) => (
              <button
                key={`thumb-${item.image}`}
                type="button"
                className={`premium-hero-thumb ${index === slide ? 'active' : ''}`}
                onClick={() => setSlide(index)}
                aria-label={ar ? item.ar : item.en}
              >
                <img src={item.image} alt="" loading="lazy" />
                <span>{ar ? item.tagAr : item.tagEn}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="premium-hero-copy">
          <span className="premium-kicker">{t.eyebrow}</span>
          <h1><span>{t.titleA}</span>{t.titleB}</h1>
          <p>{t.body}</p>
          <div className="premium-hero-actions">
            <a className="btn premium-primary" href="#solutions">{t.primary}<ArrowUpRight size={18}/></a>
            <a className="btn premium-secondary" href={whatsapp} target="_blank" rel="noreferrer">{t.secondary}</a>
          </div>
          <div className="premium-proof-row">
            {[t.proof1, t.proof2, t.proof3].map((item) => <span key={item}><Check size={14}/>{item}</span>)}
          </div>

          <div className="premium-hero-editorial">
            <div className="premium-hero-editorial-card">
              <small>{ar ? 'الواجهة الأساسية — Premium Base' : 'Premium base direction'}</small>
              <strong>{ar ? 'فخامة نباتية موجهة للفنادق والشركات.' : 'Botanical luxury for hotels and corporate spaces.'}</strong>
              <p>{ar ? 'اعتمدنا صور أعمال حقيقية، عمقًا بصريًا هادئًا، وحضورًا راقيًا يبتعد عن أي أسلوب طفولي أو رسومي ضعيف.' : 'Built around real project imagery, calm visual depth and an elevated tone — far from playful or low-grade illustrations.'}</p>
            </div>
            <div className="premium-hero-editorial-tags">
              <span>{ar ? 'فازات ومراكن' : 'Vases & planters'}</span>
              <span>{ar ? 'عقود صيانة' : 'Maintenance plans'}</span>
              <span>{ar ? 'ضيوف الرحمن' : 'Pilgrim hospitality'}</span>
            </div>
          </div>
        </div>

        <div className="premium-hero-nav" aria-label="Hero gallery">
          {heroSlides.map((item, index) => (
            <button key={item.image} onClick={() => setSlide(index)} className={index === slide ? 'active' : ''} aria-label={`Slide ${index + 1}`}>
              <span>{String(index + 1).padStart(2, '0')}</span><i />
            </button>
          ))}
        </div>
        <a className="premium-scroll-cue" href="#solutions"><span>{t.scroll}</span><i /></a>
      </section>

      <Reveal className="premium-sector-band shell">
        {sectorPills.map((item) => {
          const Icon = item.icon;
          return (
            <div className="sector-pill" key={item.ar}>
              <span className="sector-pill-icon"><Icon size={17} /></span>
              <span>{ar ? item.ar : item.en}</span>
            </div>
          );
        })}
      </Reveal>

      <Reveal className="premium-intro shell">
        <div className="premium-intro-mark"><Ornament /></div>
        <div>
          <span className="premium-kicker">{t.solutionsEyebrow}</span>
          <h2>{t.solutionsTitle}</h2>
        </div>
        <p>{t.solutionsBody}</p>
      </Reveal>

      <Reveal>
        <section className="premium-curation shell">
          <div className="premium-curation-copy">
            <span className="premium-kicker">{t.selectedEyebrow}</span>
            <h2>{t.selectedTitle}</h2>
            <p>{t.selectedBody}</p>
            <div className="premium-curation-list">
              {curationItems.map((item, index) => (
                <button
                  key={item.key}
                  type="button"
                  className={activeCuration === index ? 'active' : ''}
                  onMouseEnter={() => setActiveCuration(index)}
                  onFocus={() => setActiveCuration(index)}
                  onClick={() => setActiveCuration(index)}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <b>{ar ? item.titleAr : item.titleEn}</b>
                </button>
              ))}
            </div>
          </div>

          <div className="premium-curation-visual">
            <img src={curation.image} alt={ar ? curation.titleAr : curation.titleEn} loading="lazy" />
            <div className="curation-visual-shade" />
            <div className="premium-curation-card">
              <small>{ar ? curation.eyebrowAr : curation.eyebrowEn}</small>
              <h3>{ar ? curation.titleAr : curation.titleEn}</h3>
              <p>{ar ? curation.bodyAr : curation.bodyEn}</p>
            </div>
          </div>
        </section>
      </Reveal>

      <section id="solutions" className="premium-solutions shell">
        {solutions.map((item, index) => {
          const Icon = item.icon;
          return (
            <Reveal className="solution-reveal" key={item.key}>
              <article className="premium-solution-card">
                <img src={item.image} alt="" loading="lazy" />
                <div className="solution-image-shade" />
                <div className="solution-card-top"><span>0{index + 1}</span><Icon size={22}/></div>
                <div className="solution-card-copy">
                  <h3>{ar ? item.titleAr : item.titleEn}</h3>
                  <p>{ar ? item.bodyAr : item.bodyEn}</p>
                  <a href={`https://wa.me/966583799559?text=${encodeURIComponent(ar ? `السلام عليكم، أرغب في الاستفسار عن: ${item.titleAr}` : `Hello, I would like to ask about: ${item.titleEn}`)}`} target="_blank" rel="noreferrer" aria-label={ar ? item.titleAr : item.titleEn}><ArrowUpRight size={17}/></a>
                </div>
              </article>
            </Reveal>
          );
        })}
      </section>

      <Reveal>
        <section className="premium-hospitality">
          <div className="shell premium-hospitality-grid">
            <div className="hospitality-image-stack">
              <img className="hospitality-main" src="/assets/home/hero-grand.webp" alt="" loading="lazy" />
              <img className="hospitality-float" src="/assets/home/hotel-gold.webp" alt="" loading="lazy" />
              <div className="hospitality-badge"><b>360°</b><span>{ar ? 'توريد · تنسيق · عناية' : 'Supply · Styling · Care'}</span></div>
            </div>
            <div className="hospitality-copy-premium">
              <span className="premium-kicker">{t.hotelsEyebrow}</span>
              <h2>{t.hotelsTitle}</h2>
              <p>{t.hotelsBody}</p>
              <div className="hospitality-pills">{t.hotelPills.map((pill) => <span key={pill}>{pill}</span>)}</div>
              <Link className="premium-text-link" to="/services">{ar ? 'استعرض خدماتنا الأساسية' : 'Explore core services'}<ArrowUpRight size={17}/></Link>
            </div>
          </div>
        </section>
      </Reveal>

      <section className="premium-work shell">
        <Reveal className="premium-work-head">
          <div><span className="premium-kicker">{t.workEyebrow}</span><h2>{t.workTitle}</h2></div>
          <p>{t.workBody}</p>
        </Reveal>
        <div className="premium-mosaic">
          {showcase.map((item, index) => (
            <Reveal className={`mosaic-reveal ${item.className || ''}`} key={item.image}>
              <article className={`premium-mosaic-card ${item.className || ''}`}>
                <img src={item.image} alt={ar ? item.ar : item.en} loading="lazy" />
                <div className="mosaic-shade" />
                <span>0{index + 1}</span>
                <h3>{ar ? item.ar : item.en}</h3>
              </article>
            </Reveal>
          ))}
        </div>
        <Reveal className="premium-work-action">
          <Link className="btn premium-secondary dark" to="/projects">{ar ? 'عرض صفحة الأعمال' : 'View work page'}<ArrowUpRight size={17}/></Link>
        </Reveal>
      </section>

      <Reveal>
        <section className="premium-care shell">
          <div className="care-copy">
            <span className="premium-kicker">{t.promiseEyebrow}</span>
            <h2>{t.promiseTitle}</h2>
            <p>{t.promiseBody}</p>
            <div className="care-steps">
              {t.steps.map((step, index) => <div key={step}><b>0{index + 1}</b><span>{step}</span></div>)}
            </div>
          </div>
          <div className="care-media">
            <img src="/assets/home/indoor-planters.webp" alt="" loading="lazy" />
            <div className="care-glass-card"><Leaf size={21}/><span>{ar ? 'خطة عناية قابلة للجدولة' : 'Scheduled care plans'}</span></div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="premium-cta shell" id="contact">
          <Ornament className="premium-cta-ornament" />
          <div>
            <span className="premium-kicker">{t.ctaEyebrow}</span>
            <h2>{t.ctaTitle}</h2>
          </div>
          <a className="btn premium-cta-btn" href={whatsapp} target="_blank" rel="noreferrer">{t.ctaBtn}<ArrowUpRight size={18}/></a>
        </section>
      </Reveal>
    </div>
  );
}
