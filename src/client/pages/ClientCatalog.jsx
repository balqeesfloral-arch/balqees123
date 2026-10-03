import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Boxes, Building2, Check, ChevronDown, CircleDollarSign, Eye,
  Flower2, GalleryVerticalEnd, Layers3, LoaderCircle, MapPinned, PackagePlus, Palette,
  Search, SlidersHorizontal, Sparkles, Star, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useBalqeesCart } from '../../lib/cart';
import { useClientPortal } from '../ClientPortalContext';
import '../institutional-catalog.css';

const AVAILABILITY = {
  requestable:['متاح للطلب','Requestable'], quantity_dependent:['حسب الكمية','Quantity dependent'],
  preorder:['طلب مسبق','Pre-order'], seasonal:['موسمي','Seasonal'], unavailable:['غير متاح حاليًا','Unavailable']
};
const PRICING = {
  visible:['السعر المؤسسي','Institutional price'], from:['ابتداءً من','From'],
  quote:['حسب عرض السعر','Quotation required'], contract_only:['حسب العقد','Contract pricing']
};
function money(value,lang){ if(value===null||value===undefined||value==='') return null; return new Intl.NumberFormat(lang==='ar'?'ar-SA':'en-SA',{style:'currency',currency:'SAR',maximumFractionDigits:2}).format(Number(value)); }
function publicMedia(path){ if(!path) return ''; if(/^https?:\/\//i.test(path)) return path; return supabase.storage.from('catalog-media').getPublicUrl(path).data?.publicUrl||''; }
function label(row,ar){ return ar?(row?.name_ar||row?.title_ar):(row?.name_en||row?.title_en||row?.name_ar||row?.title_ar); }
function text(row,ar){ return ar?(row?.description_ar||row?.body_ar):(row?.description_en||row?.body_en||row?.description_ar||row?.body_ar); }

export default function ClientCatalog(){
  const { lang, organization, session, permissions } = useClientPortal();
  const ar=lang==='ar'; const navigate=useNavigate(); const cart=useBalqeesCart();
  const [products,setProducts]=useState([]); const [spaces,setSpaces]=useState([]); const [styles,setStyles]=useState([]);
  const [collections,setCollections]=useState([]); const [collectionProducts,setCollectionProducts]=useState([]);
  const [campaigns,setCampaigns]=useState([]); const [campaignProducts,setCampaignProducts]=useState([]); const [campaignCollections,setCampaignCollections]=useState([]);
  const [inspiration,setInspiration]=useState([]); const [inspirationProducts,setInspirationProducts]=useState([]);
  const [categories,setCategories]=useState([]); const [sites,setSites]=useState([]); const [siteId,setSiteId]=useState('');
  const [query,setQuery]=useState(''); const [spaceId,setSpaceId]=useState(''); const [styleId,setStyleId]=useState(''); const [availability,setAvailability]=useState('');
  const [showFilters,setShowFilters]=useState(false); const [selected,setSelected]=useState(null); const [compare,setCompare]=useState([]);
  const [loading,setLoading]=useState(true); const [adding,setAdding]=useState(''); const [notice,setNotice]=useState('');

  async function loadFacets(){
    if(!organization?.id) return;
    const [s,st,c,cp,cam,camp,camc,ins,insp,cats,sitesRes]=await Promise.all([
      supabase.from('catalog_spaces').select('*').order('sort_order'),
      supabase.from('catalog_styles').select('*').order('sort_order'),
      supabase.from('catalog_collections').select('*').order('is_featured',{ascending:false}).order('sort_order'),
      supabase.from('catalog_collection_products').select('*').order('sort_order'),
      supabase.from('catalog_campaigns').select('*').order('sort_order'),
      supabase.from('catalog_campaign_products').select('*').order('sort_order'),
      supabase.from('catalog_campaign_collections').select('*').order('sort_order'),
      supabase.from('catalog_inspiration').select('*').order('sort_order'),
      supabase.from('catalog_inspiration_products').select('*').order('sort_order'),
      supabase.from('product_categories').select('id,name_ar,name_en').eq('is_active',true).order('sort_order'),
      supabase.from('organization_sites').select('id,name_ar,name_en,is_default,is_active').eq('organization_id',organization.id).eq('is_active',true).order('is_default',{ascending:false}),
    ]);
    setSpaces(s.data||[]); setStyles(st.data||[]); setCollections(c.data||[]); setCollectionProducts(cp.data||[]);
    setCampaigns(cam.data||[]); setCampaignProducts(camp.data||[]); setCampaignCollections(camc.data||[]);
    setInspiration(ins.data||[]); setInspirationProducts(insp.data||[]); setCategories(cats.data||[]); setSites(sitesRes.data||[]);
    if(!siteId && sitesRes.data?.length) setSiteId((sitesRes.data.find(x=>x.is_default)||sitesRes.data[0]).id);
  }
  async function loadProducts(nextSite=siteId){
    if(!organization?.id) return;
    setLoading(true);
    const {data,error}=await supabase.rpc('get_organization_catalog_products',{p_organization_id:organization.id,p_site_id:nextSite||null});
    if(!error) setProducts(data||[]);
    setLoading(false);
  }
  useEffect(()=>{ loadFacets(); },[organization?.id]);
  useEffect(()=>{ if(organization?.id) loadProducts(siteId); },[organization?.id,siteId]);
  useEffect(()=>{
    if(!organization?.id) return undefined;
    const channel=supabase.channel(`institutional-catalog-${organization.id}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'catalog_collections'},()=>loadFacets())
      .on('postgres_changes',{event:'*',schema:'public',table:'catalog_campaigns'},()=>loadFacets())
      .subscribe();
    return()=>{supabase.removeChannel(channel);};
  },[organization?.id]);

  const categoryMap=useMemo(()=>Object.fromEntries(categories.map(x=>[x.id,x])),[categories]);
  const productMap=useMemo(()=>Object.fromEntries(products.map(x=>[x.id,x])),[products]);
  const collectionMap=useMemo(()=>Object.fromEntries(collections.map(x=>[x.id,x])),[collections]);
  const visible=useMemo(()=>products.filter(p=>{
    const cat=categoryMap[p.category_id]; const hay=`${p.name_ar||''} ${p.name_en||''} ${p.short_description_ar||''} ${p.short_description_en||''} ${(p.tags||[]).join(' ')} ${cat?.name_ar||''} ${cat?.name_en||''}`.toLowerCase();
    if(query && !hay.includes(query.toLowerCase())) return false;
    if(spaceId && !(p.space_ids||[]).includes(spaceId)) return false;
    if(styleId && !(p.style_ids||[]).includes(styleId)) return false;
    if(availability && p.availability_mode!==availability) return false;
    return true;
  }),[products,query,spaceId,styleId,availability,categoryMap]);

  const activeCampaign=campaigns[0]||null;
  const campaignProductRows=activeCampaign?campaignProducts.filter(x=>x.campaign_id===activeCampaign.id).map(x=>productMap[x.product_id]).filter(Boolean):[];
  const campaignCollectionRows=activeCampaign?campaignCollections.filter(x=>x.campaign_id===activeCampaign.id).map(x=>collectionMap[x.collection_id]).filter(Boolean):[];

  async function persistOrgCart(product,qty){
    if(!organization?.id||!session?.user?.id) return;
    const {data:existing}=await supabase.from('organization_cart_items').select('quantity').eq('organization_id',organization.id).eq('user_id',session.user.id).eq('product_id',product.id).maybeSingle();
    await supabase.from('organization_cart_items').upsert({organization_id:organization.id,user_id:session.user.id,product_id:product.id,quantity:Number(existing?.quantity||0)+Number(qty||1),updated_at:new Date().toISOString()},{onConflict:'organization_id,user_id,product_id'});
  }
  async function addProduct(product,qty){
    if(!permissions.placeOrders||product.availability_mode==='unavailable') return;
    setAdding(product.id); const amount=Math.max(Number(product.min_order_quantity||1),Number(qty||1));
    cart.add({...product,stock_mode:'made_to_order'},amount,{unit_price_snapshot:product.display_price});
    await persistOrgCart(product,amount);
    setNotice(ar?'تمت إضافة العنصر إلى مسودة الطلب.':'Item added to the request draft.');
    window.setTimeout(()=>setNotice(''),2600); setAdding('');
  }
  async function addGroup(rows){
    if(!permissions.placeOrders) return;
    for(const row of rows){ const p=productMap[row.product_id]; if(p&&p.availability_mode!=='unavailable') await addProduct(p,Number(row.recommended_quantity||1)); }
  }
  function toggleCompare(id){ setCompare(v=>v.includes(id)?v.filter(x=>x!==id):(v.length>=3?v:[...v,id])); }

  return <div className="client-page institutional-catalog-page">
    <header className="client-page-head catalog-page-head"><div><span><GalleryVerticalEnd/>{ar?'كتالوج بلقيس للمنشآت':'BALQEES INSTITUTIONAL CATALOG'}</span><h2>{ar?'كتالوج المنشآت':'Organization catalog'}</h2><p>{ar?'اختر ما يناسب مساحتكم.' : 'Choose what fits your spaces.'}</p></div>{permissions.placeOrders?<button className="client-primary" onClick={()=>navigate('/portal/request')}><PackagePlus/>{ar?'فتح مسودة الطلب':'Open request draft'}{cart.count>0&&<b>{cart.count}</b>}</button>:<span className="catalog-readonly-pill">{ar?'عرض فقط حسب صلاحياتك':'Read-only for your role'}</span>}</header>

    {notice&&<div className="catalog-toast"><Check/>{notice}</div>}

    <section className="catalog-context-bar"><div><MapPinned/><span><small>{ar?'الموقع الحالي':'ACTIVE SITE'}</small><select value={siteId} onChange={e=>setSiteId(e.target.value)}><option value="">{ar?'كل المواقع / بدون تسعير عقد':'All sites / no contract price'}</option>{sites.map(s=><option key={s.id} value={s.id}>{label(s,ar)}</option>)}</select></span></div><div className="catalog-search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={ar?'ابحث بالاسم، الفئة، الوصف أو الوسوم…':'Search name, category, description or tags…'}/></div><button className={`client-secondary ${showFilters?'active':''}`} onClick={()=>setShowFilters(v=>!v)}><SlidersHorizontal/>{ar?'الفلاتر':'Filters'}</button></section>

    {showFilters&&<section className="catalog-filters-panel"><label>{ar?'المساحة':'Space'}<select value={spaceId} onChange={e=>setSpaceId(e.target.value)}><option value="">{ar?'كل المساحات':'All spaces'}</option>{spaces.map(s=><option key={s.id} value={s.id}>{label(s,ar)}</option>)}</select></label><label>{ar?'الأسلوب':'Style'}<select value={styleId} onChange={e=>setStyleId(e.target.value)}><option value="">{ar?'كل الأساليب':'All styles'}</option>{styles.map(s=><option key={s.id} value={s.id}>{label(s,ar)}</option>)}</select></label><label>{ar?'التوفر':'Availability'}<select value={availability} onChange={e=>setAvailability(e.target.value)}><option value="">{ar?'الكل':'All'}</option>{Object.entries(AVAILABILITY).map(([k,v])=><option key={k} value={k}>{v[ar?0:1]}</option>)}</select></label><button onClick={()=>{setSpaceId('');setStyleId('');setAvailability('')}}>{ar?'مسح الفلاتر':'Clear filters'}</button></section>}

    {activeCampaign&&<section className="catalog-campaign" style={{backgroundImage:activeCampaign.banner_path?`linear-gradient(90deg,rgba(19,33,24,.88),rgba(19,33,24,.38)),url(${publicMedia(activeCampaign.banner_path)})`:undefined}}><div><span><Sparkles/>{ar?'اختيار بلقيس الآن':'BALQEES FEATURED'}</span><h3>{label(activeCampaign,ar)}</h3><p>{text(activeCampaign,ar)}</p><div>{campaignProductRows.slice(0,3).map(p=><button key={p.id} onClick={()=>setSelected(p)}>{label(p,ar)}</button>)}{campaignCollectionRows.slice(0,2).map(c=><button key={c.id} onClick={()=>document.getElementById(`collection-${c.id}`)?.scrollIntoView({behavior:'smooth'})}>{label(c,ar)}</button>)}</div></div></section>}

    {spaces.length>0&&<section className="catalog-spaces"><header><div><small>{ar?'اكتشف حسب المكان':'DISCOVER BY SPACE'}</small><h3>{ar?'أين تريد التجهيز؟':'Where are you styling?'}</h3></div></header><div>{spaces.map(s=><button key={s.id} className={spaceId===s.id?'active':''} onClick={()=>setSpaceId(spaceId===s.id?'':s.id)} style={{backgroundImage:s.cover_path?`linear-gradient(180deg,rgba(15,35,23,.08),rgba(15,35,23,.78)),url(${publicMedia(s.cover_path)})`:undefined}}><Flower2/><strong>{label(s,ar)}</strong><small>{text(s,ar)}</small></button>)}</div></section>}

    {collections.length>0&&<section className="catalog-collections"><header><div><small>{ar?'مجموعات جاهزة للمشتريات':'CURATED COLLECTIONS'}</small><h3>{ar?'مجموعات بلقيس للمساحات':'Collections for hospitality spaces'}</h3></div></header><div className="catalog-collection-grid">{collections.map(c=>{const rows=collectionProducts.filter(x=>x.collection_id===c.id);return <article id={`collection-${c.id}`} key={c.id}><div className="catalog-collection-cover">{c.cover_path?<img src={publicMedia(c.cover_path)} alt=""/>:<Layers3/>}{c.is_featured&&<span><Star/> {ar?'مختارة':'Featured'}</span>}</div><div><h4>{label(c,ar)}</h4><p>{text(c,ar)}</p>{Array.isArray(c.gallery_paths)&&c.gallery_paths.length>0&&<div className="catalog-content-gallery">{c.gallery_paths.slice(0,4).map((img,i)=><img key={`${img}-${i}`} src={publicMedia(img)} alt="" loading="lazy"/> )}</div>}<small>{ar?`${rows.length} عناصر`:`${rows.length} items`}</small><footer><button onClick={()=>addGroup(rows)} disabled={!permissions.placeOrders}><PackagePlus/>{ar?'أضف المجموعة لمسودة الطلب':'Add collection to request'}</button></footer></div></article>})}</div></section>}

    <section className="catalog-products-section"><header><div><small>{ar?'الكتالوج المؤسسي':'PROCUREMENT CATALOG'}</small><h3>{ar?`${visible.length} عنصر متاح لمنشأتكم`:`${visible.length} items available to your organization`}</h3></div>{compare.length>1&&<button className="client-secondary" onClick={()=>document.getElementById('catalog-compare')?.scrollIntoView({behavior:'smooth'})}><Eye/>{ar?'مقارنة':'Compare'} ({compare.length})</button>}</header>
      {loading?<div className="catalog-loading"><LoaderCircle className="spin"/><span>{ar?'جاري تجهيز الكتالوج الخاص بمنشأتكم…':'Preparing your organization catalog…'}</span></div>:visible.length?<div className="catalog-product-grid">{visible.map(p=><ProductCard key={p.id} p={p} ar={ar} lang={lang} category={categoryMap[p.category_id]} adding={adding===p.id} compared={compare.includes(p.id)} onOpen={()=>setSelected(p)} onAdd={()=>addProduct(p,Number(p.min_order_quantity||1))} onCompare={()=>toggleCompare(p.id)}/>)}</div>:<div className="catalog-empty"><Boxes/><h4>{ar?'لا توجد عناصر مطابقة':'No matching items'}</h4><p>{ar?'جرّب فلترًا آخر.' : 'Try another filter.'}</p></div>}
    </section>

    {compare.length>1&&<Comparison id="catalog-compare" products={compare.map(id=>productMap[id]).filter(Boolean)} ar={ar} lang={lang} spaces={spaces} styles={styles} onRemove={toggleCompare}/>} 

    {inspiration.length>0&&<section className="catalog-inspiration"><header><div><small>{ar?'لوحات إلهام':'INSPIRATION BOARDS'}</small><h3>{ar?'ابدأ من إحساس المساحة':'Start from the mood of the space'}</h3></div></header><div>{inspiration.map(i=>{const rows=inspirationProducts.filter(x=>x.inspiration_id===i.id);return <article key={i.id} style={{backgroundImage:i.cover_path?`linear-gradient(180deg,rgba(14,28,19,.05),rgba(14,28,19,.84)),url(${publicMedia(i.cover_path)})`:undefined}}><span><Palette/></span><h4>{label(i,ar)}</h4><p>{text(i,ar)}</p>{Array.isArray(i.gallery_paths)&&i.gallery_paths.length>0&&<div className="catalog-inspiration-gallery">{i.gallery_paths.slice(0,3).map((img,n)=><img key={`${img}-${n}`} src={publicMedia(img)} alt="" loading="lazy"/>)}</div>}<button onClick={()=>addGroup(rows)} disabled={!rows.length||!permissions.placeOrders}>{ar?'حوّلها لمسودة طلب':'Use this board in a request'}</button></article>})}</div></section>}

    {selected&&<ProductDetail product={selected} ar={ar} lang={lang} spaces={spaces} styles={styles} onClose={()=>setSelected(null)} onAdd={()=>addProduct(selected,Number(selected.min_order_quantity||1))}/>} 
  </div>;
}

function ProductCard({p,ar,lang,category,adding,compared,onOpen,onAdd,onCompare}){
  const price=money(p.display_price,lang); const unavailable=p.availability_mode==='unavailable';
  return <article className={`institutional-product ${unavailable?'unavailable':''}`}><button className="institutional-product-media" onClick={onOpen}>{p.image_url?<img src={p.image_url} alt=""/>:<Flower2/>}{p.exclusive_for_org&&<span className="exclusive"><Sparkles/>{ar?'حصري لمنشأتكم':'Exclusive'}</span>}{p.ordered_before&&<span className="ordered"><Check/>{ar?'سبق طلبه':'Ordered before'}</span>}</button><div className="institutional-product-body"><small>{ar?(category?.name_ar||'كتالوج بلقيس'):(category?.name_en||category?.name_ar||'Balqees catalog')}</small><h4>{ar?p.name_ar:(p.name_en||p.name_ar)}</h4><p>{ar?(p.short_description_ar||p.description_ar):(p.short_description_en||p.short_description_ar||p.description_en||p.description_ar)}</p><div className="institutional-product-meta"><span>{AVAILABILITY[p.availability_mode]?.[ar?0:1]||p.availability_mode}</span>{p.suitable_indoor&&<span>{ar?'داخلي':'Indoor'}</span>}{p.suitable_outdoor&&<span>{ar?'خارجي':'Outdoor'}</span>}</div><div className="institutional-product-price"><small>{PRICING[p.pricing_mode]?.[ar?0:1]}</small><strong>{price||(ar?'يُحدد ضمن العرض':'Set in quotation')}</strong></div><footer><button className="compare" onClick={onCompare}><span className={compared?'checked':''}>{compared&&<Check/>}</span>{ar?'مقارنة':'Compare'}</button><button className="add" disabled={unavailable||adding} onClick={onAdd}>{adding?<LoaderCircle className="spin"/>:<PackagePlus/>}{ar?'أضف للطلب':'Add to request'}</button></footer></div></article>;
}
function ProductDetail({product,ar,lang,spaces,styles,onClose,onAdd}){
  const spaceNames=spaces.filter(x=>(product.space_ids||[]).includes(x.id)); const styleNames=styles.filter(x=>(product.style_ids||[]).includes(x.id));
  const gallery=[product.image_url,...(Array.isArray(product.gallery)?product.gallery:[])].filter((x,i,a)=>x&&a.indexOf(x)===i);
  const [activeImage,setActiveImage]=useState(gallery[0]||'');
  return <div className="catalog-modal" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><article><header><button onClick={onClose}><X/></button><small>{ar?'تفاصيل العنصر':'ITEM DETAILS'}</small><h3>{ar?product.name_ar:(product.name_en||product.name_ar)}</h3></header><div className="catalog-detail-grid"><div className="catalog-detail-media">{activeImage?<img src={publicMedia(activeImage)} alt=""/>:<Flower2/>}{gallery.length>1&&<div className="catalog-product-gallery">{gallery.map((img,i)=><button key={`${img}-${i}`} className={activeImage===img?'active':''} onClick={()=>setActiveImage(img)}><img src={publicMedia(img)} alt="" loading="lazy"/></button>)}</div>}</div><div className="catalog-detail-copy"><p>{ar?(product.description_ar||product.short_description_ar):(product.description_en||product.short_description_en||product.description_ar)}</p><section><h4>{ar?'يناسب':'Suitable for'}</h4><div>{spaceNames.map(x=><span key={x.id}>{label(x,ar)}</span>)}{styleNames.map(x=><span key={x.id}>{label(x,ar)}</span>)}</div></section>{Object.keys(product.dimensions||{}).length>0&&<section><h4>{ar?'المقاسات':'Dimensions'}</h4><pre>{JSON.stringify(product.dimensions,null,2)}</pre></section>}{(product.care_ar||product.care_en)&&<section><h4>{ar?'العناية':'Care'}</h4><p>{ar?product.care_ar:(product.care_en||product.care_ar)}</p></section>}{(product.light_ar||product.light_en)&&<section><h4>{ar?'الإضاءة':'Light'}</h4><p>{ar?product.light_ar:(product.light_en||product.light_ar)}</p></section>}<div className="catalog-detail-price"><span><small>{PRICING[product.pricing_mode]?.[ar?0:1]}</small><strong>{money(product.display_price,lang)||(ar?'يحدد ضمن عرض السعر':'Set in quotation')}</strong></span><button className="client-primary" onClick={onAdd} disabled={product.availability_mode==='unavailable'}><PackagePlus/>{ar?'أضف لمسودة الطلب':'Add to request draft'}</button></div></div></div></article></div>;
}
function Comparison({id,products,ar,lang,spaces,styles,onRemove}){
  return <section id={id} className="catalog-comparison"><header><div><small>{ar?'مقارنة مؤسسية':'PRODUCT COMPARISON'}</small><h3>{ar?'قارن قبل إضافتها للطلب':'Compare before requesting'}</h3></div></header><div className="catalog-compare-table"><div className="catalog-compare-row head"><b>{ar?'الخاصية':'Attribute'}</b>{products.map(p=><span key={p.id}><button onClick={()=>onRemove(p.id)}><X/></button><strong>{ar?p.name_ar:(p.name_en||p.name_ar)}</strong></span>)}</div>{[
    [ar?'السعر':'Price',p=>money(p.display_price,lang)||PRICING[p.pricing_mode]?.[ar?0:1]],
    [ar?'التوفر':'Availability',p=>AVAILABILITY[p.availability_mode]?.[ar?0:1]],
    [ar?'المساحات':'Spaces',p=>spaces.filter(x=>(p.space_ids||[]).includes(x.id)).map(x=>label(x,ar)).join(' · ')||'—'],
    [ar?'الأساليب':'Styles',p=>styles.filter(x=>(p.style_ids||[]).includes(x.id)).map(x=>label(x,ar)).join(' · ')||'—'],
    [ar?'مهلة التوريد':'Lead time',p=>ar?(p.lead_time_ar||'—'):(p.lead_time_en||p.lead_time_ar||'—')]
  ].map(([name,fn])=><div className="catalog-compare-row" key={name}><b>{name}</b>{products.map(p=><span key={p.id}>{fn(p)}</span>)}</div>)}</div></section>;
}
