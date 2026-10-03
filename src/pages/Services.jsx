import { whatsappHref } from '../lib/season-design';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Flower2,
  Trees,
  Sprout,
  Leaf,
  Check,
  Sparkles,
  Building2,
  ShieldCheck,
  RefreshCcw,
  Hotel,
  Star
} from 'lucide-react';

const serviceItems = [
  {
    key: 'hospitality', icon: Hotel,
    ar: 'تنسيق الفنادق والضيافة', en: 'Hotels & Hospitality Styling',
    arBody: 'تنسيق اللوبيات والمداخل وطاولات الاستقبال والفازات المركزية، مع برامج توريد وتجديد تتوافق مع هوية المنشأة.',
    enBody: 'Lobby, entrance, reception-table and statement-vase styling with refresh programs tailored to the property identity.',
    image: '/assets/services/hospitality-signature.webp',
    tagAr: 'ضيافة', tagEn: 'Hospitality', featured: true
  },
  {
    key: 'floral', icon: Flower2,
    ar: 'تنسيق الورد الطبيعي', en: 'Natural Floral Styling',
    arBody: 'تصاميم زهرية راقية للطاولات والمداخل والمساحات البارزة، من التكوينات اليومية إلى المشاهد الكبيرة.',
    enBody: 'Refined floral compositions for tables, entrances and focal spaces, from everyday styling to statement installations.',
    image: '/assets/services/hospitality-pink.webp',
    tagAr: 'ورد طبيعي', tagEn: 'Natural florals'
  },
  {
    key: 'bouquets', icon: Sparkles,
    ar: 'تنسيق الباقات والهدايا الزهرية', en: 'Bouquets & Floral Gifting',
    arBody: 'باقات مناسبات واستقبال وهدايا شركات بتنسيق متوازن وألوان وخامات يتم اختيارها حسب المناسبة والهوية.',
    enBody: 'Occasion, welcome and corporate floral gifting with palettes and materials selected around the moment and brand.',
    image: '/assets/services/bouquet-roses.webp',
    tagAr: 'باقات', tagEn: 'Bouquets'
  },
  {
    key: 'indoor', icon: Trees,
    ar: 'النباتات الداخلية', en: 'Indoor Planting',
    arBody: 'اختيار وتوريد نباتات داخلية وأشجار ظل وفق الإضاءة والارتفاعات وحركة المكان، مع توزيع بصري مدروس.',
    enBody: 'Indoor foliage and trees selected around light, scale and movement, then placed to create a considered visual rhythm.',
    image: '/assets/services/indoor-croton.webp',
    tagAr: 'نباتات داخلية', tagEn: 'Indoor plants'
  },
  {
    key: 'landscape', icon: Sprout,
    ar: 'الحدائق والتشجير والنخيل', en: 'Landscaping, Trees & Palms',
    arBody: 'توريد وزراعة الأشجار والنخيل والسيكاس والشجيرات، وتطوير الأحواض والمساحات الخارجية من الاختيار حتى التنفيذ.',
    enBody: 'Supply and planting of trees, palms, cycas and shrubs, with outdoor beds developed from selection through execution.',
    image: '/assets/services/outdoor-cycas.webp',
    tagAr: 'تشجير', tagEn: 'Landscape', featured: true
  },
  {
    key: 'planters', icon: Star,
    ar: 'الفازات والمراكن والأحواض', en: 'Vases, Planters & Containers',
    arBody: 'اختيار قطع مودرن وكلاسيكية بأحجام وخامات متنوعة لتصبح الفازة أو المركن جزءًا من هوية المشهد، لا مجرد وعاء.',
    enBody: 'Modern and classic vessels in varied scales and finishes, selected as part of the visual identity — not merely containers.',
    image: '/assets/services/vase-sculpture.webp',
    tagAr: 'فازات ومراكن', tagEn: 'Vases & planters'
  },
  {
    key: 'care', icon: Leaf,
    ar: 'الصيانة والعناية النباتية', en: 'Plant Care & Maintenance',
    arBody: 'زيارات مجدولة للري والتنظيف والتقليم والتغذية والمعالجات النباتية ومتابعة الجودة والاستبدال عند الحاجة.',
    enBody: 'Scheduled watering, cleaning, pruning, nutrition, treatments, quality checks and replacement when required.',
    image: '/assets/services/indoor-scene.webp',
    tagAr: 'عناية مستمرة', tagEn: 'Ongoing care'
  },
  {
    key: 'seasonal', icon: RefreshCcw,
    ar: 'المناسبات والتجديد الموسمي', en: 'Events & Seasonal Refresh',
    arBody: 'تجديد المشاهد الزهرية والنباتية للمواسم والمناسبات، مع حلول مرنة للفنادق والضيافة خلال مواسم الحج والعمرة.',
    enBody: 'Seasonal floral and botanical refreshes with flexible hotel and hospitality support during Hajj and Umrah peaks.',
    image: '/assets/services/corporate-floral.webp',
    tagAr: 'مواسم ومناسبات', tagEn: 'Seasonal styling'
  }
];

const packages = [
  {
    key: 'signature',
    ar: 'باقة التوقيع', en: 'Signature',
    arSub: 'لمشهد واحد يحتاج حضورًا واضحًا', enSub: 'For one focal space that needs a clear statement',
    arItems: ['تنسيق فازة أو نقطة بصرية رئيسية', 'اختيار الورد أو النبات والخامة المناسبة', 'تنفيذ وترتيب في الموقع', 'خيارات للتجديد الدوري'],
    enItems: ['One statement vase or focal point', 'Curated flowers, foliage and vessel', 'On-site styling and placement', 'Optional refresh cycle']
  },
  {
    key: 'hospitality',
    ar: 'باقة الضيافة', en: 'Hospitality',
    arSub: 'للفنادق واللوبيات والاستقبالات', enSub: 'For hotels, lobbies and reception spaces',
    arItems: ['تنسيق المداخل واللوبي', 'فازات وطاولات استقبال', 'نباتات داخلية ومراكن مختارة', 'برنامج توريد وتجديد', 'متابعة وعناية دورية'],
    enItems: ['Lobby and entrance styling', 'Reception tables and statement vases', 'Curated indoor plants and planters', 'Scheduled supply and refresh', 'Ongoing care'],
    featured: true
  },
  {
    key: 'landscape',
    ar: 'باقة المشهد المتكامل', en: 'Landscape Scene',
    arSub: 'للمساحات الداخلية والخارجية الأكبر', enSub: 'For larger indoor and outdoor environments',
    arItems: ['معاينة وفهم طبيعة الموقع', 'اختيار الأشجار والنباتات والمراكن', 'توريد وزراعة وتوزيع', 'تنسيق الأحواض والمسارات الخضراء', 'خطة عناية بعد التنفيذ'],
    enItems: ['Site assessment', 'Plant, tree and planter selection', 'Supply, planting and placement', 'Bed and green-zone styling', 'Post-installation care plan']
  },
  {
    key: 'care',
    ar: 'باقة العناية المستمرة', en: 'Continuous Care',
    arSub: 'للحفاظ على المشهد بأفضل حالة', enSub: 'To keep the botanical scene at its best',
    arItems: ['زيارات مجدولة', 'ري وتنظيف وتقليم', 'تغذية ومعالجات نباتية', 'مراجعة الفازات والمراكن', 'استبدال حسب الحاجة'],
    enItems: ['Scheduled visits', 'Watering, cleaning and pruning', 'Nutrition and plant treatments', 'Vase and planter checks', 'Replacement when needed']
  }
];

const plantGallery = [
  { image: '/assets/services/indoor-croton.webp', ar: 'ألوان نباتية داخلية', en: 'Interior botanical color' },
  { image: '/assets/services/indoor-dracaena.webp', ar: 'نباتات ظل بهوية هادئة', en: 'Calm indoor foliage' },
  { image: '/assets/services/outdoor-palms.webp', ar: 'نخيل وأشجار للمشاريع', en: 'Palms & project-scale trees' },
  { image: '/assets/services/outdoor-flowerbed.webp', ar: 'زهور وتغطيات موسمية', en: 'Seasonal color & groundcover' }
];

const vaseGallery = [
  { image: '/assets/services/vase-sculpture.webp', ar: 'قطع نحتية مودرن', en: 'Sculptural modern forms' },
  { image: '/assets/services/vase-white-art.webp', ar: 'فازات بيضاء بطابع معماري', en: 'Architectural white vessels' },
  { image: '/assets/services/planter-terrazzo.webp', ar: 'أحواض تيرازو وملامس طبيعية', en: 'Terrazzo & tactile planters' },
  { image: '/assets/services/planter-black.webp', ar: 'مراكن لامعة للمداخل الراقية', en: 'Gloss planters for premium entrances' }
];

const copy = {
  ar: {
    heroEyebrow: 'BALQEES SERVICES · خدمات بلقيس',
    heroTitleA: 'خدمات نباتية وزهرية',
    heroTitleB: 'تُصمَّم للمكان.',
    heroBody: 'من تنسيق الورد والباقات إلى النباتات الداخلية، الفازات، التشجير، الحدائق والصيانة؛ نبني حلاً متكاملاً يناسب الفنادق والضيافة والمساحات الراقية.',
    heroPrimary: 'استعرض الخدمات', heroSecondary: 'اطلب معاينة',
    heroNote: 'أعمال حقيقية · حلول مخصصة · بدون أسعار ثابتة',
    servicesEyebrow: 'من الفكرة إلى العناية', servicesTitle: 'ثمانية مجالات. تجربة واحدة متكاملة.',
    servicesBody: 'نربط التوريد والاختيار والتنسيق والتنفيذ والعناية في منظومة واضحة، بدل أن تبقى كل خدمة منفصلة عن الأخرى.',
    hospitalityEyebrow: 'HOSPITALITY SIGNATURE', hospitalityTitle: 'للضيافة التي تريد أن يتجدد الانطباع… كل يوم.',
    hospitalityBody: 'اللوبي ليس مساحة نضع فيها وردًا فقط. هو نقطة الوصول الأولى؛ لذلك نربط الفازة، الارتفاع، اللون، حركة الضيف، جدول التجديد والعناية في مشهد واحد متوازن.',
    hospitalityPoints: ['لوبيات ومداخل', 'طاولات الاستقبال', 'فازات مركزية', 'توريد وتجديد دوري', 'نباتات داخلية', 'جاهزية المواسم'],
    vasesEyebrow: 'VASE & PLANTER ATELIER', vasesTitle: 'الفازة جزء من التصميم.',
    vasesBody: 'نختار القطعة وفق المقياس واللون والخامة والمكان؛ من الفازات النحتية إلى المراكن الكبيرة والأحواض الخارجية.',
    plantsEyebrow: 'BOTANICAL PALETTE', plantsTitle: 'اختيارات نباتية أوسع من مجرد “أخضر”.',
    plantsBody: 'ألوان، أوراق، ارتفاعات وملامس مختلفة تسمح لنا ببناء تكوين نباتي يناسب شخصية كل موقع وظروفه.',
    packagesEyebrow: 'SERVICE PACKAGES', packagesTitle: 'باقات منظمة… وليست قوالب جامدة.',
    packagesBody: 'هذه الباقات نقطة بداية لتوضيح نطاق الخدمة. العرض النهائي يتشكل بعد فهم الموقع والاحتياج، لذلك لا نضع أسعارًا ثابتة.',
    packageBtn: 'اطلب تصور الباقة',
    processEyebrow: 'BALQEES METHOD', processTitle: 'من أول صورة للموقع… إلى مشهد يعيش.',
    steps: [
      ['01', 'معاينة وفهم الموقع', 'المساحة، الإضاءة، حركة الزوار، الهوية والاحتياج التشغيلي.'],
      ['02', 'اختيار التكوين والخامات', 'نباتات، ورد، فازات، مراكن، ارتفاعات وألوان مناسبة للمشهد.'],
      ['03', 'توريد وتنفيذ منظم', 'تجهيز وتسليم وترتيب يحافظ على نظافة الموقع وجودة النتيجة.'],
      ['04', 'متابعة وتجديد وعناية', 'برنامج مرن للحفاظ على جودة المشهد بعد التنفيذ.']
    ],
    ctaEyebrow: 'ابدأ بالمكان', ctaTitle: 'أرسل صورة المساحة أو مخططها… ونبني لك اتجاهًا يناسبها.',
    ctaBody: 'يمكنك البدء بصورة واحدة للموقع. نرتب معك نوع الخدمة، نطاق العمل، المعاينة والخطوة التالية.', ctaBtn: 'تواصل عبر واتساب',
    realWork: 'صور حقيقية من أعمال وتوريدات بلقيس'
  },
  en: {
    heroEyebrow: 'BALQEES SERVICES',
    heroTitleA: 'Botanical & floral services',
    heroTitleB: 'designed around the space.',
    heroBody: 'From floral styling and bouquets to indoor planting, vases, landscaping, trees and ongoing care — one integrated service for hotels, hospitality and premium spaces.',
    heroPrimary: 'Explore services', heroSecondary: 'Request a site visit',
    heroNote: 'Real work · Tailored solutions · No fixed pricing',
    servicesEyebrow: 'From concept to care', servicesTitle: 'Eight disciplines. One coherent experience.',
    servicesBody: 'We connect supply, curation, styling, execution and care into one clear system rather than treating each task in isolation.',
    hospitalityEyebrow: 'HOSPITALITY SIGNATURE', hospitalityTitle: 'For hospitality where the first impression needs to stay fresh.',
    hospitalityBody: 'A lobby is not simply a place to put flowers. It is the first arrival moment, so we connect vessel, scale, color, guest flow, refresh cycle and care into one balanced scene.',
    hospitalityPoints: ['Lobbies & entrances', 'Reception tables', 'Statement vases', 'Scheduled refresh', 'Indoor planting', 'Seasonal readiness'],
    vasesEyebrow: 'VASE & PLANTER ATELIER', vasesTitle: 'The vessel is part of the design.',
    vasesBody: 'We select pieces around scale, color, material and context — from sculptural vases to large planters and outdoor containers.',
    plantsEyebrow: 'BOTANICAL PALETTE', plantsTitle: 'A botanical palette that goes beyond “green”.',
    plantsBody: 'Different colors, leaves, heights and textures let us build a living composition suited to each space and its conditions.',
    packagesEyebrow: 'SERVICE PACKAGES', packagesTitle: 'Structured packages — never rigid templates.',
    packagesBody: 'These packages define a useful starting scope. The final proposal is shaped after understanding the site and need, so we do not list fixed prices.',
    packageBtn: 'Request this package',
    processEyebrow: 'BALQEES METHOD', processTitle: 'From the first site photo… to a living scene.',
    steps: [
      ['01', 'Understand the site', 'Space, lighting, visitor flow, identity and operational needs.'],
      ['02', 'Curate plants & materials', 'Flowers, foliage, vessels, planters, scale and palette.'],
      ['03', 'Supply & execute', 'Organized delivery and placement with a clean, professional finish.'],
      ['04', 'Maintain & refresh', 'A flexible care program that protects the scene after installation.']
    ],
    ctaEyebrow: 'START WITH THE SPACE', ctaTitle: 'Send us a photo or plan of the space — we will build a direction around it.',
    ctaBody: 'One photo is enough to begin. We can then define service type, scope, site visit and the next step.', ctaBtn: 'Contact on WhatsApp',
    realWork: 'Real imagery from Balqees work and supply'
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
    }, { threshold: 0.1, rootMargin: '0px 0px -50px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`services-reveal ${className}`}>{children}</div>;
}

export default function Services({ lang }) {
  const ar = lang === 'ar';
  const t = copy[lang];
  const [activeService, setActiveService] = useState('hospitality');
  const currentService = serviceItems.find((item) => item.key === activeService) || serviceItems[0];

  const whatsapp = (messageAr, messageEn) => whatsappHref(ar ? messageAr : messageEn);
  const generalWhatsApp = whatsapp(
    'السلام عليكم، أرغب في طلب معاينة أو عرض مخصص لخدمات بلقيس.',
    'Hello, I would like to request a site visit or tailored proposal from Balqees Floral.'
  );

  return (
    <div className="services-luxury">
      <section className="services-hero shell">
        <div className="services-hero-copy">
          <span className="services-kicker">{t.heroEyebrow}</span>
          <h1><span>{t.heroTitleA}</span>{t.heroTitleB}</h1>
          <p>{t.heroBody}</p>
          <div className="services-hero-actions">
            <a className="btn services-btn-primary" href="#service-universe">{t.heroPrimary}<ArrowUpRight size={18}/></a>
            <a className="btn services-btn-secondary" href={generalWhatsApp} target="_blank" rel="noreferrer">{t.heroSecondary}</a>
          </div>
          <div className="services-hero-note"><ShieldCheck size={16}/><span>{t.heroNote}</span></div>
        </div>

        <div className="services-hero-visual">
          <img src="/assets/services/hero-hospitality.webp" alt={ar ? 'تنسيق زهور فاخر في مساحة ضيافة' : 'Premium floral styling in a hospitality space'} fetchPriority="high" decoding="async" />
          <div className="services-hero-overlay" />
          <div className="services-hero-stamp"><small>01</small><strong>{ar ? 'ضيافة' : 'HOSPITALITY'}</strong><span>{t.realWork}</span></div>
          <div className="services-hero-mini">
            <img src="/assets/services/hospitality-pink.webp" alt="" loading="lazy" decoding="async" />
            <div><small>{ar ? 'تفاصيل حقيقية' : 'Real details'}</small><strong>{ar ? 'ورد · فازات · تنفيذ' : 'Florals · vessels · execution'}</strong></div>
          </div>
        </div>

        <nav className="services-quick-nav" aria-label={ar ? 'فئات الخدمات' : 'Service categories'}>
          {serviceItems.map((item) => {
            const Icon = item.icon;
            return <button key={item.key} type="button" onClick={() => { setActiveService(item.key); document.getElementById('service-universe')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
              <Icon size={16}/><span>{ar ? item.ar : item.en}</span>
            </button>;
          })}
        </nav>
      </section>

      <section id="service-universe" className="services-universe shell">
        <Reveal className="services-heading-row">
          <div>
            <span className="services-kicker">{t.servicesEyebrow}</span>
            <h2>{t.servicesTitle}</h2>
          </div>
          <p>{t.servicesBody}</p>
        </Reveal>

        <div className="services-editorial-grid">
          {serviceItems.map((item, index) => {
            const Icon = item.icon;
            const active = activeService === item.key;
            return (
              <Reveal key={item.key} className={`service-editorial-card ${item.featured ? 'is-featured' : ''} ${active ? 'is-active' : ''}`}>
                <article onMouseEnter={() => setActiveService(item.key)}>
                  <div className="service-card-media">
                    <img src={item.image} alt={ar ? item.ar : item.en} loading="lazy" decoding="async" />
                    <div className="service-card-shade" />
                    <span className="service-card-number">{String(index + 1).padStart(2, '0')}</span>
                    <span className="service-card-tag"><Icon size={14}/>{ar ? item.tagAr : item.tagEn}</span>
                  </div>
                  <div className="service-card-copy">
                    <h3>{ar ? item.ar : item.en}</h3>
                    <p>{ar ? item.arBody : item.enBody}</p>
                    <a href={whatsapp(`السلام عليكم، أرغب في الاستفسار عن خدمة: ${item.ar}`, `Hello, I would like to ask about: ${item.en}`)} target="_blank" rel="noreferrer">
                      {ar ? 'ناقش هذه الخدمة' : 'Discuss this service'}<ArrowUpRight size={16}/>
                    </a>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>

        <Reveal className="services-focus-panel">
          <div className="services-focus-media">
            <img key={currentService.image} src={currentService.image} alt="" loading="lazy" decoding="async" />
          </div>
          <div className="services-focus-copy">
            <span>{ar ? 'اختيارك الحالي' : 'Current focus'}</span>
            <div className="services-focus-icon">{(() => { const Icon = currentService.icon; return <Icon size={24}/>; })()}</div>
            <h3>{ar ? currentService.ar : currentService.en}</h3>
            <p>{ar ? currentService.arBody : currentService.enBody}</p>
            <div className="services-focus-chips">
              <span>{ar ? 'حل مخصص للموقع' : 'Site-specific'}</span>
              <span>{ar ? 'تنفيذ احترافي' : 'Professional execution'}</span>
              <span>{ar ? 'خيارات متابعة' : 'Care options'}</span>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="services-hospitality shell">
        <Reveal className="services-hospitality-layout">
          <div className="services-hospitality-copy">
            <span className="services-kicker">{t.hospitalityEyebrow}</span>
            <h2>{t.hospitalityTitle}</h2>
            <p>{t.hospitalityBody}</p>
            <div className="services-hospitality-pills">{t.hospitalityPoints.map((item) => <span key={item}><Check size={14}/>{item}</span>)}</div>
            <a href={whatsapp('السلام عليكم، أرغب في مناقشة حلول بلقيس للفنادق والضيافة.', 'Hello, I would like to discuss Balqees hospitality solutions.')} className="services-inline-link" target="_blank" rel="noreferrer">
              {ar ? 'اطلب تصورًا للفندق' : 'Request a hotel concept'}<ArrowUpRight size={17}/>
            </a>
          </div>
          <div className="services-hospitality-collage">
            <figure className="hospitality-main"><img src="/assets/services/hospitality-signature.webp" alt="" loading="lazy" decoding="async"/><figcaption>{ar ? 'تنسيق لوبي' : 'Lobby styling'}</figcaption></figure>
            <figure className="hospitality-side"><img src="/assets/services/corporate-floral.webp" alt="" loading="lazy" decoding="async"/><figcaption>{ar ? 'نقطة استقبال' : 'Reception detail'}</figcaption></figure>
            <figure className="hospitality-side second"><img src="/assets/services/hospitality-pink.webp" alt="" loading="lazy" decoding="async"/><figcaption>{ar ? 'تكوينات موسمية' : 'Seasonal compositions'}</figcaption></figure>
          </div>
        </Reveal>
      </section>

      <section className="services-vase-section shell">
        <Reveal className="services-centered-heading">
          <span className="services-kicker">{t.vasesEyebrow}</span>
          <h2>{t.vasesTitle}</h2>
          <p>{t.vasesBody}</p>
        </Reveal>
        <div className="services-vase-gallery">
          {vaseGallery.map((item, index) => (
            <Reveal key={item.image} className={`services-vase-tile vase-${index + 1}`}>
              <figure><img src={item.image} alt={ar ? item.ar : item.en} loading="lazy" decoding="async"/><figcaption><small>{String(index + 1).padStart(2, '0')}</small><span>{ar ? item.ar : item.en}</span></figcaption></figure>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="services-plants-section shell">
        <Reveal className="services-plants-head">
          <div><span className="services-kicker">{t.plantsEyebrow}</span><h2>{t.plantsTitle}</h2></div>
          <p>{t.plantsBody}</p>
        </Reveal>
        <div className="services-plant-gallery">
          {plantGallery.map((item, index) => (
            <Reveal key={item.image} className={`services-plant-tile plant-${index + 1}`}>
              <figure><img src={item.image} alt={ar ? item.ar : item.en} loading="lazy" decoding="async"/><div className="services-plant-overlay"><small>0{index + 1}</small><strong>{ar ? item.ar : item.en}</strong></div></figure>
            </Reveal>
          ))}
        </div>
        <Reveal className="services-landscape-proof">
          <div className="landscape-proof-image"><img src="/assets/services/outdoor-cycas-install.webp" alt={ar ? 'تنفيذ زراعة سيكاس في موقع مشروع' : 'Cycas planting at a project site'} loading="lazy" decoding="async"/></div>
          <div className="landscape-proof-copy">
            <span>{ar ? 'من التوريد إلى الأرض' : 'FROM SUPPLY TO SITE'}</span>
            <h3>{ar ? 'نختار، نورد، نزرع… ثم نتابع.' : 'We curate, supply, plant — then keep caring.'}</h3>
            <p>{ar ? 'في التشجير الخارجي لا تكفي صورة النبات في المشتل؛ نراعي الحجم، طريقة النقل، موقع الزراعة، التربة والمشهد النهائي.' : 'Outdoor planting is more than selecting a nursery plant. We consider scale, transport, planting position, soil and the final visual scene.'}</p>
          </div>
        </Reveal>
      </section>

      <section className="services-packages shell">
        <Reveal className="services-centered-heading packages-heading">
          <span className="services-kicker">{t.packagesEyebrow}</span>
          <h2>{t.packagesTitle}</h2>
          <p>{t.packagesBody}</p>
        </Reveal>
        <div className="services-package-grid">
          {packages.map((pack, index) => {
            const items = ar ? pack.arItems : pack.enItems;
            return (
              <Reveal key={pack.key} className={`services-package-card ${pack.featured ? 'featured' : ''}`}>
                <article>
                  <div className="package-topline"><span>0{index + 1}</span>{pack.featured && <em>{ar ? 'الأكثر شمولاً للضيافة' : 'Hospitality focus'}</em>}</div>
                  <h3>{ar ? pack.ar : pack.en}</h3>
                  <p>{ar ? pack.arSub : pack.enSub}</p>
                  <ul>{items.map((item) => <li key={item}><Check size={15}/><span>{item}</span></li>)}</ul>
                  <a href={whatsapp(`السلام عليكم، أرغب في طلب تصور لـ ${pack.ar}.`, `Hello, I would like a proposal for the ${pack.en} package.`)} target="_blank" rel="noreferrer">{t.packageBtn}<ArrowUpRight size={16}/></a>
                </article>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section className="services-process shell">
        <Reveal className="services-process-head">
          <span className="services-kicker">{t.processEyebrow}</span>
          <h2>{t.processTitle}</h2>
        </Reveal>
        <div className="services-process-grid">
          {t.steps.map(([num, title, body]) => (
            <Reveal key={num} className="services-process-step">
              <article><span>{num}</span><h3>{title}</h3><p>{body}</p></article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="services-final-cta shell">
        <Reveal className="services-cta-card">
          <div className="services-cta-image"><img src="/assets/services/outdoor-silver.webp" alt="" loading="lazy" decoding="async"/></div>
          <div className="services-cta-copy">
            <span className="services-kicker">{t.ctaEyebrow}</span>
            <h2>{t.ctaTitle}</h2>
            <p>{t.ctaBody}</p>
            <a className="btn services-btn-primary" href={generalWhatsApp} target="_blank" rel="noreferrer">{t.ctaBtn}<ArrowUpRight size={18}/></a>
          </div>
          <div className="services-cta-orbit" aria-hidden="true"><i/><i/><i/></div>
        </Reveal>
      </section>
    </div>
  );
}
