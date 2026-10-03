import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell, Building2, Check, ChevronLeft, ChevronRight, CircleAlert, Crosshair,
  Heart, Home, Link2, LoaderCircle, Map, MapPin, MoreHorizontal, Navigation,
  PackageOpen, Pencil, Phone, Plus, RefreshCw, Search, ShieldCheck, ShoppingBag,
  Star, Store, Trash2, UserRound, Users, X,
} from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { supabase } from '../lib/supabase';
import { useBalqeesCart } from '../lib/cart';
import { hasGoogleMapsKey, loadGoogleMaps, mapsEmbedUrl, mapsSearchUrl, parseGoogleMapsUrl } from '../lib/googleMaps';
import './individual-account.css';

const MAKKAH_CENTER = { lat: 21.3891, lng: 39.8579 };
const CHECKOUT_DRAFT_KEY = userId => `balqees-individual-checkout-draft-v1:${userId}`;

function cleanPhone(value = '') { let digits=String(value||'').replace(/\D/g,''); if(digits.startsWith('00966')) digits=digits.slice(5); else if(digits.startsWith('966')) digits=digits.slice(3); if(digits.length===9&&digits.startsWith('5')) digits=`0${digits}`; return digits; }
function normalize(value = '') { return String(value || '').trim().toLowerCase().replace(/\s+/g, ' '); }
function shortPhone(value = '') {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 4) return value || '—';
  return `•••• ${digits.slice(-4)}`;
}
function addressTitle(address, ar) {
  return address?.label?.trim() || (ar ? 'عنوان محفوظ' : 'Saved address');
}
function addressLine(address, ar) {
  const text = address?.formatted_address?.trim();
  if (text) return text;
  return [address?.district, address?.city, address?.street].filter(Boolean).join(ar ? '، ' : ', ') || (ar ? 'بدون وصف نصي' : 'No text description');
}
function recipientTitle(recipient, ar) {
  return recipient?.label?.trim() || recipient?.full_name || (ar ? 'مستلم محفوظ' : 'Saved recipient');
}
function haversineMeters(aLat, aLng, bLat, bLng) {
  const values = [aLat, aLng, bLat, bLng].map(Number);
  if (values.some(v => !Number.isFinite(v))) return Infinity;
  const [lat1, lon1, lat2, lon2] = values;
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
function writeCheckoutDraft(userId, payload) {
  try {
    const key=CHECKOUT_DRAFT_KEY(userId);
    const current = JSON.parse(localStorage.getItem(key) || '{}');
    localStorage.setItem(key, JSON.stringify({ ...current, ...payload, updated_at: new Date().toISOString(), source: 'address_book' }));
    window.dispatchEvent(new CustomEvent('balqees:checkout-draft', { detail: payload }));
  } catch { /* local storage can be unavailable in privacy modes */ }
}

function AddressChrome({ lang, session, cartCount, children }) {
  const ar = lang === 'ar';
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    if (!session?.user?.id || !supabase) return;
    supabase.from('customer_profiles').select('full_name').eq('id', session.user.id).maybeSingle().then(({ data }) => setProfile(data || null));
  }, [session?.user?.id]);
  useEffect(() => { document.body.classList.add('individual-account-active'); return () => document.body.classList.remove('individual-account-active'); }, []);
  const fullName = profile?.full_name || session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || (ar ? 'عميل بلقيس' : 'Balqees client');
  const firstName = fullName.trim().split(/\s+/)[0];
  return <div className="individual-account-app individual-addresses-app" dir={ar ? 'rtl' : 'ltr'}>
    <header className="individual-topbar"><div className="individual-shell individual-topbar-inner">
      <Link to="/" className="individual-brand"><BrandMark/></Link>
      <div className="individual-topbar-center"><span>{ar ? 'العناوين والمستلمون' : 'ADDRESSES & RECIPIENTS'}</span><small>{ar ? 'حساب فردي' : 'INDIVIDUAL ACCOUNT'}</small></div>
      <div className="individual-top-actions">
        <button type="button" className="individual-icon-button" onClick={() => navigate('/account/notifications')} aria-label={ar ? 'الإشعارات' : 'Notifications'}><Bell size={19}/></button>
        <button type="button" className="individual-icon-button" onClick={() => navigate('/account/cart')} aria-label={ar ? 'السلة' : 'Cart'}><ShoppingBag size={19}/>{cartCount > 0 && <b>{Math.min(cartCount, 99)}</b>}</button>
        <button type="button" className="individual-profile-chip" onClick={() => navigate('/account/profile')}><span>{fullName.slice(0,1).toUpperCase()}</span><div><small>{ar ? 'مرحبًا' : 'Welcome'}</small><strong>{firstName}</strong></div></button>
      </div>
    </div></header>
    {children}
    <nav className="individual-mobile-dock">
      <Link to="/account"><Home/><span>{ar ? 'الرئيسية' : 'Home'}</span></Link>
      <Link to="/account/orders"><PackageOpen/><span>{ar ? 'طلباتي' : 'Orders'}</span></Link>
      <Link to="/store"><Store/><span>{ar ? 'المتجر' : 'Store'}</span></Link>
      <Link to="/account/favorites"><Heart/><span>{ar ? 'المفضلة' : 'Favorites'}</span></Link>
      <Link className="active" to="/account/profile"><UserRound/><span>{ar ? 'حسابي' : 'Account'}</span></Link>
    </nav>
  </div>;
}

function GoogleMapPicker({ lang, value, onChange }) {
  const ar = lang === 'ar';
  const mapRef = useRef(null);
  const searchRef = useRef(null);
  const instanceRef = useRef(null);
  const markerRef = useRef(null);
  const geocoderRef = useRef(null);
  const [status, setStatus] = useState(hasGoogleMapsKey() ? 'loading' : 'fallback');
  const [mapsLink, setMapsLink] = useState(value?.maps_url || '');
  const [geoLoading, setGeoLoading] = useState(false);
  const [mapError, setMapError] = useState('');

  function emitPoint(lat, lng, extra = {}) {
    const next = { ...(value || {}), latitude: Number(lat), longitude: Number(lng), maps_url: mapsSearchUrl({ lat, lng }), ...extra };
    onChange(next);
  }

  function reverseGeocode(maps, lat, lng) {
    if (!geocoderRef.current) geocoderRef.current = new maps.Geocoder();
    geocoderRef.current.geocode({ location: { lat, lng } }, (results, state) => {
      if (state !== 'OK' || !results?.[0]) return emitPoint(lat, lng);
      const result = results[0];
      const components = result.address_components || [];
      const part = type => components.find(item => item.types?.includes(type))?.long_name || '';
      emitPoint(lat, lng, {
        formatted_address: result.formatted_address || '',
        city: part('locality') || part('administrative_area_level_2') || value?.city || '',
        district: part('sublocality_level_1') || part('sublocality') || value?.district || '',
        street: part('route') || value?.street || '',
        building_number: part('street_number') || value?.building_number || '',
        postal_code: part('postal_code') || value?.postal_code || '',
      });
    });
  }

  useEffect(() => {
    if (!hasGoogleMapsKey()) { setStatus('fallback'); return undefined; }
    let disposed = false;
    let clickListener;
    let dragListener;
    let placeListener;
    loadGoogleMaps(lang).then(maps => {
      if (disposed || !mapRef.current) return;
      const lat = Number(value?.latitude);
      const lng = Number(value?.longitude);
      const center = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : MAKKAH_CENTER;
      const map = new maps.Map(mapRef.current, { center, zoom: Number.isFinite(lat) ? 17 : 12, disableDefaultUI: true, zoomControl: true, gestureHandling: 'greedy', clickableIcons: false, mapTypeControl: false });
      const marker = new maps.Marker({ position: center, map, draggable: true });
      instanceRef.current = map; markerRef.current = marker; geocoderRef.current = new maps.Geocoder();
      clickListener = map.addListener('click', event => {
        const point = { lat: event.latLng.lat(), lng: event.latLng.lng() };
        marker.setPosition(point); reverseGeocode(maps, point.lat, point.lng);
      });
      dragListener = marker.addListener('dragend', event => reverseGeocode(maps, event.latLng.lat(), event.latLng.lng()));
      if (searchRef.current && maps.places?.Autocomplete) {
        const autocomplete = new maps.places.Autocomplete(searchRef.current, { fields: ['formatted_address','geometry','address_components','name'], componentRestrictions: { country: 'sa' } });
        placeListener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          const location = place?.geometry?.location;
          if (!location) return;
          const point = { lat: location.lat(), lng: location.lng() };
          map.panTo(point); map.setZoom(17); marker.setPosition(point);
          reverseGeocode(maps, point.lat, point.lng);
        });
      }
      setStatus('ready');
    }).catch(() => { if (!disposed) { setStatus('fallback'); setMapError(ar ? 'تعذر تحميل الخريطة التفاعلية. يمكنك استخدام رابط Google Maps أو الإدخال اليدوي.' : 'Interactive map could not load. Use a Google Maps link or manual entry.'); } });
    return () => { disposed = true; clickListener?.remove?.(); dragListener?.remove?.(); placeListener?.remove?.(); };
  }, [lang]);

  useEffect(() => {
    const lat = Number(value?.latitude), lng = Number(value?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !instanceRef.current || !markerRef.current) return;
    const point = { lat, lng }; markerRef.current.setPosition(point); instanceRef.current.panTo(point);
  }, [value?.latitude, value?.longitude]);

  function locateMe() {
    if (!navigator.geolocation) return setMapError(ar ? 'المتصفح لا يدعم تحديد الموقع.' : 'Location is not supported by this browser.');
    setGeoLoading(true); setMapError('');
    navigator.geolocation.getCurrentPosition(position => {
      setGeoLoading(false);
      const lat = position.coords.latitude, lng = position.coords.longitude;
      if (instanceRef.current && markerRef.current) {
        instanceRef.current.panTo({ lat, lng }); instanceRef.current.setZoom(18); markerRef.current.setPosition({ lat, lng });
        if (window.google?.maps) reverseGeocode(window.google.maps, lat, lng); else emitPoint(lat, lng);
      } else emitPoint(lat, lng);
    }, () => { setGeoLoading(false); setMapError(ar ? 'لم نتمكن من الوصول لموقعك. يمكنك تحريك العلامة أو لصق رابط Google Maps.' : 'We could not access your location. Move the pin or paste a Google Maps link.'); }, { enableHighAccuracy: true, timeout: 12000 });
  }

  function usePastedLink() {
    const point = parseGoogleMapsUrl(mapsLink);
    if (!point) return setMapError(ar ? 'لم أجد إحداثيات واضحة في الرابط. افتح المكان في Google Maps وانسخ رابط الموقع.' : 'No coordinates were found in that link. Open the place in Google Maps and copy its location link.');
    setMapError(''); emitPoint(point.lat, point.lng, { maps_url: mapsLink });
  }

  const hasPoint = Number.isFinite(Number(value?.latitude)) && Number.isFinite(Number(value?.longitude));
  return <div className="individual-map-picker">
    <div className="individual-map-search-row">
      {status !== 'fallback' ? <label className="individual-map-search"><Search size={15}/><input ref={searchRef} placeholder={ar ? 'ابحث عن الحي، الشارع أو المكان' : 'Search district, street or place'}/></label> : <label className="individual-map-search"><Link2 size={15}/><input value={mapsLink} onChange={e => setMapsLink(e.target.value)} placeholder={ar ? 'الصق رابط Google Maps أو الإحداثيات' : 'Paste a Google Maps link or coordinates'}/><button type="button" onClick={usePastedLink}>{ar ? 'استخدم' : 'Use'}</button></label>}
      <button type="button" className="individual-locate-button" onClick={locateMe} disabled={geoLoading}>{geoLoading ? <LoaderCircle className="spin" size={16}/> : <Crosshair size={16}/>}<span>{ar ? 'موقعي' : 'My location'}</span></button>
    </div>
    {mapError && <div className="individual-map-note warn"><CircleAlert size={14}/><span>{mapError}</span></div>}
    {status === 'fallback' && !hasGoogleMapsKey() && <div className="individual-map-note"><Map size={14}/><span>{ar ? 'الخريطة التفاعلية تعمل تلقائيًا عند إضافة VITE_GOOGLE_MAPS_API_KEY. إلى ذلك الحين يمكنك تحديد موقعك الحالي أو لصق رابط Google Maps.' : 'Interactive mapping activates automatically when VITE_GOOGLE_MAPS_API_KEY is configured. You can still use your location or paste a Google Maps link.'}</span></div>}
    <div className="individual-map-canvas-wrap">
      {status !== 'fallback' ? <div ref={mapRef} className="individual-map-canvas"/> : hasPoint ? <iframe title={ar ? 'الموقع المحدد' : 'Selected location'} src={mapsEmbedUrl(value.latitude, value.longitude)} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/> : <div className="individual-map-placeholder"><Navigation size={28}/><strong>{ar ? 'حدد موقعك أو الصق رابطًا من Google Maps' : 'Use your location or paste a Google Maps link'}</strong><span>{ar ? 'سنحفظ الإحداثيات الدقيقة حتى لو تغيّرت صياغة العنوان لاحقًا.' : 'We keep precise coordinates even if the written address changes later.'}</span></div>}
      {status !== 'fallback' && status !== 'ready' && <div className="individual-map-loading"><LoaderCircle className="spin"/><span>{ar ? 'جارٍ تجهيز الخريطة…' : 'Preparing map…'}</span></div>}
    </div>
    {hasPoint && <div className="individual-selected-location"><MapPin size={16}/><div><small>{ar ? 'الموقع المحدد' : 'SELECTED LOCATION'}</small><strong>{value?.formatted_address || `${Number(value.latitude).toFixed(5)}, ${Number(value.longitude).toFixed(5)}`}</strong><span>{ar ? 'حرّك العلامة فوق مدخل المبنى إن أمكن.' : 'Place the pin over the building entrance when possible.'}</span></div></div>}
  </div>;
}

function WizardProgress({ ar, step, total }) {
  return <div className="individual-address-wizard-progress" aria-label={ar ? 'تقدم إضافة العنوان' : 'Address progress'}>
    {Array.from({ length: total }).map((_, index) => <i key={index} className={index <= step ? 'active' : ''}/>) }
  </div>;
}

function AddressWizard({ lang, initial, addresses, onClose, onSaved }) {
  const ar = lang === 'ar';
  const ArrowBack = ar ? ChevronRight : ChevronLeft;
  const ArrowNext = ar ? ChevronLeft : ChevronRight;
  const editing = Boolean(initial?.id);
  const [step, setStep] = useState(0);
  const [method, setMethod] = useState(initial?.latitude && initial?.longitude ? 'map' : 'manual');
  const [data, setData] = useState({
    label: initial?.label || '', city: initial?.city || '', district: initial?.district || '', street: initial?.street || '',
    building_number: initial?.building_number || '', unit_number: initial?.unit_number || '', postal_code: initial?.postal_code || '',
    short_address: initial?.short_address || '', formatted_address: initial?.formatted_address || '', latitude: initial?.latitude ?? null,
    longitude: initial?.longitude ?? null, maps_url: initial?.maps_url || '', access_notes: initial?.access_notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [duplicate, setDuplicate] = useState(null);

  const steps = editing ? 3 : 4;
  const contentStep = editing ? step + 1 : step;
  function patch(key, value) { setData(current => ({ ...current, [key]: value })); }

  function findDuplicate() {
    const candidate = addresses.find(address => {
      if (editing && address.id === initial.id) return false;
      const meters = haversineMeters(data.latitude, data.longitude, address.latitude, address.longitude);
      if (meters <= 30) return true;
      const a = normalize([data.city, data.district, data.street, data.building_number].filter(Boolean).join('|'));
      const b = normalize([address.city, address.district, address.street, address.building_number].filter(Boolean).join('|'));
      return a && b && a === b;
    });
    setDuplicate(candidate || null);
    return candidate;
  }

  function validateLocation() {
    if (method === 'map') {
      if (!Number.isFinite(Number(data.latitude)) || !Number.isFinite(Number(data.longitude))) { setError(ar ? 'حدد نقطة الموقع أولًا.' : 'Select a location point first.'); return false; }
      return true;
    }
    if (!data.city.trim()) { setError(ar ? 'اكتب المدينة.' : 'Enter the city.'); return false; }
    if (!data.district.trim()) { setError(ar ? 'اكتب الحي.' : 'Enter the district.'); return false; }
    return true;
  }

  function next() {
    setError('');
    if (!editing && step === 0) return setStep(1);
    if ((!editing && step === 1) || (editing && step === 0)) {
      if (!validateLocation()) return;
      return setStep(s => s + 1);
    }
    if ((!editing && step === 2) || (editing && step === 1)) {
      if (!data.city.trim()) return setError(ar ? 'نحتاج اسم المدينة قبل الحفظ.' : 'We need the city before saving.');
      return setStep(s => s + 1);
    }
  }

  async function save(force = false) {
    setError('');
    if (!force) {
      const found = findDuplicate();
      if (found) return;
    }
    setSaving(true);
    const payload = {
      label: data.label.trim() || null,
      city: data.city.trim(), district: data.district.trim() || null, street: data.street.trim() || null,
      building_number: data.building_number.trim() || null, unit_number: data.unit_number.trim() || null,
      postal_code: data.postal_code.trim() || null, short_address: data.short_address.trim() || null,
      formatted_address: data.formatted_address.trim() || [data.street, data.district, data.city].filter(Boolean).join(ar ? '، ' : ', '),
      latitude: Number.isFinite(Number(data.latitude)) ? Number(data.latitude) : null,
      longitude: Number.isFinite(Number(data.longitude)) ? Number(data.longitude) : null,
      maps_url: data.maps_url.trim() || (Number.isFinite(Number(data.latitude)) ? mapsSearchUrl({ lat: data.latitude, lng: data.longitude }) : null),
      access_notes: data.access_notes.trim() || null,
      updated_at: new Date().toISOString(),
    };
    let result;
    if (editing) result = await supabase.from('customer_addresses').update(payload).eq('id', initial.id).select('*').single();
    else result = await supabase.from('customer_addresses').insert({ ...payload, user_id: initial.user_id, is_active: true, is_default: addresses.length === 0 }).select('*').single();
    setSaving(false);
    if (result.error) return setError(ar ? 'تعذر حفظ العنوان الآن. راجع البيانات وحاول مرة أخرى.' : 'Could not save the address. Check the details and try again.');
    if (!editing && addresses.length === 0) await supabase.rpc('customer_set_default_address', { p_address_id: result.data.id });
    onSaved(result.data);
  }

  const isFinal = (!editing && step === 3) || (editing && step === 2);
  return <div className="individual-modal-overlay individual-address-modal-overlay" role="dialog" aria-modal="true">
    <div className="individual-address-wizard">
      <button type="button" className="individual-modal-close" onClick={onClose}><X size={16}/></button>
      <div className="individual-address-wizard-head"><span><MapPin size={18}/></span><div><small>{editing ? (ar ? 'تعديل العنوان' : 'EDIT ADDRESS') : (ar ? 'عنوان جديد' : 'NEW ADDRESS')}</small><h2>{!editing && step === 0 ? (ar ? 'كيف تحب تحدد موقعك؟' : 'How would you like to set the location?') : isFinal ? (ar ? 'راجع المكان قبل الحفظ' : 'Review before saving') : (ar ? 'خلّنا نكمل التفاصيل الضرورية فقط' : 'Only the necessary details')}</h2></div></div>
      <WizardProgress ar={ar} step={editing ? step : step} total={steps}/>
      <div className="individual-address-wizard-body">
        {!editing && step === 0 && <div className="individual-address-methods">
          <button type="button" className={method === 'map' ? 'active' : ''} onClick={() => { setMethod('map'); setStep(1); }}><span><Map size={24}/></span><strong>{ar ? 'تحديد على الخريطة' : 'Pick on Google Maps'}</strong><small>{ar ? 'ابحث، حرّك العلامة أو استخدم موقعك الحالي.' : 'Search, move the pin, or use your current location.'}</small></button>
          <button type="button" className={method === 'manual' ? 'active' : ''} onClick={() => { setMethod('manual'); setStep(1); }}><span><Pencil size={24}/></span><strong>{ar ? 'إدخال العنوان يدويًا' : 'Enter address manually'}</strong><small>{ar ? 'نطلب الحقول المهمة بالتدريج فقط.' : 'We only ask for what matters, progressively.'}</small></button>
        </div>}
        {((!editing && step === 1) || (editing && step === 0)) && <>
          {method === 'map' ? <GoogleMapPicker lang={lang} value={data} onChange={nextData => setData(current => ({ ...current, ...nextData }))}/> : <div className="individual-progressive-fields">
            <label><span>{ar ? 'المدينة' : 'City'} *</span><input value={data.city} onChange={e => patch('city', e.target.value)} placeholder={ar ? 'مثال: مكة المكرمة' : 'e.g. Makkah'}/></label>
            <label><span>{ar ? 'الحي' : 'District'} *</span><input value={data.district} onChange={e => patch('district', e.target.value)} placeholder={ar ? 'مثال: العوالي' : 'e.g. Al Awali'}/></label>
            <label className="wide"><span>{ar ? 'الشارع' : 'Street'}</span><input value={data.street} onChange={e => patch('street', e.target.value)} placeholder={ar ? 'اسم الشارع إن توفر' : 'Street name if available'}/></label>
          </div>}
        </>}
        {((!editing && step === 2) || (editing && step === 1)) && <div className="individual-progressive-fields compact">
          {method === 'map' && <>
            <label><span>{ar ? 'المدينة' : 'City'} *</span><input value={data.city} onChange={e => patch('city', e.target.value)}/></label>
            <label><span>{ar ? 'الحي' : 'District'}</span><input value={data.district} onChange={e => patch('district', e.target.value)}/></label>
            <label className="wide"><span>{ar ? 'الشارع' : 'Street'}</span><input value={data.street} onChange={e => patch('street', e.target.value)}/></label>
          </>}
          <label><span>{ar ? 'رقم المبنى' : 'Building no.'}</span><input value={data.building_number} onChange={e => patch('building_number', e.target.value)}/></label>
          <label><span>{ar ? 'رقم الوحدة — اختياري' : 'Unit no. — optional'}</span><input value={data.unit_number} onChange={e => patch('unit_number', e.target.value)}/></label>
          <label><span>{ar ? 'الرمز البريدي — اختياري' : 'Postal code — optional'}</span><input value={data.postal_code} onChange={e => patch('postal_code', e.target.value)}/></label>
          <label className="wide"><span>{ar ? 'معلومة تساعدنا عند الوصول' : 'Arrival note'}</span><textarea value={data.access_notes} onChange={e => patch('access_notes', e.target.value)} placeholder={ar ? 'مثال: مدخل الفندق من الجهة الشرقية، أو اتصل عند الوصول' : 'e.g. East hotel entrance, or call on arrival'}/></label>
        </div>}
        {isFinal && <div className="individual-address-review">
          <div className="individual-address-review-card"><span><MapPin size={20}/></span><div><small>{ar ? 'الموقع' : 'LOCATION'}</small><strong>{data.formatted_address || [data.street, data.district, data.city].filter(Boolean).join(ar ? '، ' : ', ')}</strong>{data.latitude && <a href={mapsSearchUrl({ lat: data.latitude, lng: data.longitude })} target="_blank" rel="noreferrer"><Navigation size={12}/>{ar ? 'فتح في Google Maps' : 'Open in Google Maps'}</a>}</div></div>
          <label className="individual-address-label-field"><span>{ar ? 'كيف تريد حفظ هذا المكان؟' : 'How would you like to save this place?'}</span><div className="individual-address-label-suggestions">{[(ar?'المنزل':'Home'),(ar?'العمل':'Work'),(ar?'منزل العائلة':'Family home')].map(item => <button type="button" key={item} className={data.label === item ? 'active' : ''} onClick={() => patch('label', item)}>{item}</button>)}</div><input value={data.label} onChange={e => patch('label', e.target.value)} placeholder={ar ? 'أو اكتب اسمًا آخر — اختياري' : 'Or type another name — optional'}/></label>
          {data.access_notes && <div className="individual-address-review-note"><Navigation size={14}/><span>{data.access_notes}</span></div>}
        </div>}
        {duplicate && <div className="individual-duplicate-warning"><CircleAlert size={17}/><div><strong>{ar ? `يبدو أن هذا الموقع محفوظ لديك باسم “${addressTitle(duplicate, ar)}”` : `This looks like your saved “${addressTitle(duplicate, ar)}” address`}</strong><p>{addressLine(duplicate, ar)}</p><div><button type="button" onClick={() => onSaved(duplicate)}>{ar ? 'استخدم العنوان الموجود' : 'Use saved address'}</button><button type="button" onClick={() => { setDuplicate(null); save(true); }}>{ar ? 'احفظ كعنوان جديد' : 'Save as new'}</button></div></div></div>}
        {error && <div className="individual-inline-error"><CircleAlert size={14}/><span>{error}</span></div>}
      </div>
      <div className="individual-address-wizard-foot">
        {(step > (editing ? 0 : 0)) && <button type="button" className="ghost" onClick={() => { setError(''); setDuplicate(null); setStep(s => Math.max(0, s - 1)); }}><ArrowBack size={15}/>{ar ? 'رجوع' : 'Back'}</button>}
        <div/>
        {!isFinal && !(!editing && step === 0) && <button type="button" className="primary" onClick={next}>{ar ? 'متابعة' : 'Continue'}<ArrowNext size={15}/></button>}
        {isFinal && <button type="button" className="primary" onClick={() => save(false)} disabled={saving}>{saving ? <LoaderCircle className="spin" size={15}/> : <Check size={15}/>} {ar ? 'حفظ العنوان' : 'Save address'}</button>}
      </div>
    </div>
  </div>;
}

function RecipientWizard({ lang, initial, addresses, recipients, onClose, onSaved, onNeedAddress }) {
  const ar = lang === 'ar';
  const editing = Boolean(initial?.id);
  const [data, setData] = useState({ label: initial?.label || '', full_name: initial?.full_name || '', phone: initial?.phone || '', default_address_id: initial?.default_address_id || '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const duplicate = useMemo(() => {
    const phone = cleanPhone(data.phone);
    if (!phone) return null;
    return recipients.find(item => item.id !== initial?.id && cleanPhone(item.phone) === phone) || null;
  }, [data.phone, recipients, initial?.id]);

  async function save() {
    if (!data.full_name.trim()) return setError(ar ? 'اكتب اسم المستلم.' : 'Enter the recipient name.');
    if (cleanPhone(data.phone).replace(/\D/g,'').length < 8) return setError(ar ? 'اكتب رقم جوال صحيحًا.' : 'Enter a valid mobile number.');
    if (duplicate && !editing) return setError(ar ? 'هذا الرقم محفوظ لديك بالفعل. استخدم المستلم الموجود بدل إنشاء نسخة مكررة.' : 'This phone number is already saved. Use the existing recipient instead.');
    setSaving(true); setError('');
    const payload = { label: data.label.trim() || null, full_name: data.full_name.trim(), phone: cleanPhone(data.phone), default_address_id: data.default_address_id || null, updated_at: new Date().toISOString(), is_active: true };
    let result;
    if (editing) result = await supabase.from('customer_recipients').update(payload).eq('id', initial.id).select('*').single();
    else result = await supabase.from('customer_recipients').insert({ ...payload, user_id: initial.user_id, is_favorite: recipients.length === 0 }).select('*').single();
    if (!result.error && data.default_address_id) await supabase.rpc('customer_set_recipient_default_address', { p_recipient_id: result.data.id, p_address_id: data.default_address_id });
    if (!result.error && !editing && recipients.length === 0) await supabase.rpc('customer_set_default_recipient', { p_recipient_id: result.data.id });
    setSaving(false);
    if (result.error) return setError(ar ? 'تعذر حفظ المستلم الآن.' : 'Could not save the recipient right now.');
    onSaved(result.data);
  }

  return <div className="individual-modal-overlay individual-address-modal-overlay" role="dialog" aria-modal="true">
    <div className="individual-recipient-wizard">
      <button type="button" className="individual-modal-close" onClick={onClose}><X size={16}/></button>
      <div className="individual-address-wizard-head"><span><UserRound size={18}/></span><div><small>{editing ? (ar ? 'تعديل مستلم' : 'EDIT RECIPIENT') : (ar ? 'مستلم جديد' : 'NEW RECIPIENT')}</small><h2>{ar ? 'بيانات قليلة تكفي للطلبات القادمة' : 'Just enough for faster future orders'}</h2></div></div>
      <div className="individual-recipient-form">
        <label><span>{ar ? 'الاسم المستخدم في الطلب' : 'Recipient full name'} *</span><input value={data.full_name} onChange={e => setData(current => ({ ...current, full_name: e.target.value }))} placeholder={ar ? 'مثال: فاطمة محمد' : 'e.g. Fatimah Mohammed'}/></label>
        <label><span>{ar ? 'رقم الجوال' : 'Mobile number'} *</span><input inputMode="tel" value={data.phone} onChange={e => setData(current => ({ ...current, phone: e.target.value }))} placeholder="05xxxxxxxx"/></label>
        <label><span>{ar ? 'كيف تريد أن يظهر لك في حسابك؟ — اختياري' : 'Account label — optional'}</span><input value={data.label} onChange={e => setData(current => ({ ...current, label: e.target.value }))} placeholder={ar ? 'مثال: الوالدة، أخي، صديقي' : 'e.g. Mother, Brother, Friend'}/></label>
        <div className="individual-recipient-address-choice"><span>{ar ? 'أين يستلم عادة؟' : 'Usual delivery address'}</span>{addresses.length ? <div className="individual-address-radio-list">{addresses.map(address => <button type="button" key={address.id} className={data.default_address_id === address.id ? 'active' : ''} onClick={() => setData(current => ({ ...current, default_address_id: address.id }))}><i>{data.default_address_id === address.id ? <Check size={12}/> : <MapPin size={12}/>}</i><div><strong>{addressTitle(address, ar)}</strong><small>{addressLine(address, ar)}</small></div></button>)}</div> : <div className="individual-no-address-inline"><MapPin size={18}/><span>{ar ? 'لا يوجد عنوان محفوظ بعد.' : 'No saved address yet.'}</span></div>}<button type="button" className="individual-add-address-inline" onClick={() => onNeedAddress(data)}><Plus size={13}/>{ar ? 'إضافة عنوان جديد' : 'Add new address'}</button></div>
        {duplicate && <div className="individual-duplicate-warning small"><CircleAlert size={16}/><div><strong>{ar ? 'يبدو أن هذا المستلم محفوظ لديك بالفعل' : 'This recipient appears to be saved already'}</strong><p>{recipientTitle(duplicate, ar)} · {shortPhone(duplicate.phone)}</p><button type="button" onClick={() => onSaved(duplicate)}>{ar ? 'استخدم الموجود' : 'Use existing recipient'}</button></div></div>}
        {error && <div className="individual-inline-error"><CircleAlert size={14}/><span>{error}</span></div>}
        <button type="button" className="individual-recipient-save" onClick={save} disabled={saving || Boolean(duplicate && !editing)}>{saving ? <LoaderCircle className="spin" size={15}/> : <Check size={15}/>} {ar ? 'حفظ المستلم' : 'Save recipient'}</button>
      </div>
    </div>
  </div>;
}

function RecipientAddressesManager({ lang, recipient, addresses, links, onClose, onChanged }) {
  const ar = lang === 'ar';
  const linkedMap = useMemo(() => Object.fromEntries(links.filter(link => link.recipient_id === recipient.id).map(link => [link.address_id, link])), [links, recipient.id]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  async function toggle(address) {
    const link = linkedMap[address.id]; setMessage(''); setBusy(address.id);
    if (link) {
      if (link.is_default) { setBusy(''); return setMessage(ar ? 'اختر عنوانًا معتادًا آخر قبل إزالة هذا العنوان.' : 'Choose another usual address before unlinking this one.'); }
      await supabase.from('customer_recipient_addresses').delete().eq('recipient_id', recipient.id).eq('address_id', address.id);
    } else {
      await supabase.from('customer_recipient_addresses').insert({ user_id: recipient.user_id, recipient_id: recipient.id, address_id: address.id, is_default: false });
    }
    setBusy(''); onChanged();
  }
  async function makeDefault(address) {
    setBusy(`d-${address.id}`); setMessage('');
    const { error } = await supabase.rpc('customer_set_recipient_default_address', { p_recipient_id: recipient.id, p_address_id: address.id });
    setBusy(''); if (error) setMessage(ar ? 'تعذر تغيير العنوان المعتاد.' : 'Could not change the usual address.'); else onChanged();
  }
  return <div className="individual-modal-overlay individual-address-modal-overlay"><div className="individual-recipient-address-manager">
    <button type="button" className="individual-modal-close" onClick={onClose}><X size={16}/></button>
    <div className="individual-address-wizard-head"><span><Link2 size={18}/></span><div><small>{ar ? 'عناوين المستلم' : 'RECIPIENT ADDRESSES'}</small><h2>{recipientTitle(recipient, ar)}</h2></div></div>
    <p className="individual-recipient-manager-intro">{ar ? 'اربط أكثر من عنوان بنفس المستلم، وحدد واحدًا فقط كعنوان معتاد. وقت الطلب يظل بإمكانك اختيار أي عنوان آخر.' : 'Link multiple addresses to this recipient and keep one as the usual address. You can still choose another during checkout.'}</p>
    <div className="individual-recipient-manager-list">{addresses.map(address => {
      const linked = linkedMap[address.id];
      return <article key={address.id} className={linked ? 'linked' : ''}><button type="button" className="toggle" onClick={() => toggle(address)} disabled={busy === address.id}><i>{linked ? <Check size={13}/> : <Plus size={13}/>}</i><div><strong>{addressTitle(address, ar)}</strong><span>{addressLine(address, ar)}</span></div></button>{linked && <button type="button" className={linked.is_default ? 'default active' : 'default'} onClick={() => !linked.is_default && makeDefault(address)} disabled={busy === `d-${address.id}`}><Star size={13}/>{linked.is_default ? (ar ? 'المعتاد' : 'Usual') : (ar ? 'اجعله المعتاد' : 'Set usual')}</button>}</article>;
    })}</div>
    {message && <div className="individual-inline-error"><CircleAlert size={14}/><span>{message}</span></div>}
  </div></div>;
}

export default function IndividualAddresses({ lang, session }) {
  const ar = lang === 'ar';
  const navigate = useNavigate();
  const Arrow = ar ? ChevronLeft : ChevronRight;
  const cart = useBalqeesCart(session?.user?.id || null);
  const [tab, setTab] = useState('addresses');
  const [addresses, setAddresses] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [links, setLinks] = useState([]);
  const [orders, setOrders] = useState([]);
  const [profile, setProfile] = useState(null);
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [query, setQuery] = useState('');
  const [addressWizard, setAddressWizard] = useState(null);
  const [recipientWizard, setRecipientWizard] = useState(null);
  const [pendingRecipientDraft, setPendingRecipientDraft] = useState(null);
  const [manageRecipient, setManageRecipient] = useState(null);
  const [menu, setMenu] = useState(null);
  const [confirmArchive, setConfirmArchive] = useState(null);

  async function load(silent = false) {
    const uid = session?.user?.id;
    if (!uid || !supabase) return;
    if (silent) setRefreshing(true); else setLoading(true);
    setError('');
    const [addressResult, recipientResult, linkResult, ordersResult, profileResult, preferencesResult] = await Promise.all([
      supabase.from('customer_addresses').select('*').eq('user_id', uid).eq('is_active', true).order('is_default', { ascending: false }).order('updated_at', { ascending: false }),
      supabase.from('customer_recipients').select('*').eq('user_id', uid).eq('is_active', true).order('is_favorite', { ascending: false }).order('updated_at', { ascending: false }),
      supabase.from('customer_recipient_addresses').select('*').eq('user_id', uid).order('is_default', { ascending: false }).order('updated_at', { ascending: false }),
      supabase.from('orders').select('id,customer_recipient_id,customer_address_id,recipient_snapshot,address_snapshot,created_at,requested_delivery_date,status').eq('user_id', uid).order('created_at', { ascending: false }).limit(120),
      supabase.from('customer_profiles').select('full_name,phone,email,national_address').eq('id', uid).maybeSingle(),
      supabase.from('customer_preferences').select('default_address_id,default_recipient_id').eq('user_id', uid).maybeSingle(),
    ]);
    const anyError = [addressResult, recipientResult, linkResult, ordersResult, profileResult, preferencesResult].some(result => result.error);
    if (anyError) setError(ar ? 'تعذر تحميل جزء من بيانات العناوين الآن. يمكنك التحديث والمحاولة مرة أخرى.' : 'Some address-book data could not be loaded. Refresh and try again.');
    setAddresses(addressResult.data || []); setRecipients(recipientResult.data || []); setLinks(linkResult.data || []); setOrders(ordersResult.data || []); setProfile(profileResult.data || null); setPreferences(preferencesResult.data || null);
    setLoading(false); setRefreshing(false);
  }
  useEffect(() => { load(); }, [session?.user?.id]);
  useEffect(() => { if (!toast) return undefined; const id = window.setTimeout(() => setToast(''), 3600); return () => clearTimeout(id); }, [toast]);

  const addressMap = useMemo(() => Object.fromEntries(addresses.map(address => [address.id, address])), [addresses]);
  const lastOrderByRecipient = useMemo(() => {
    const out = {};
    orders.forEach(order => { if (order.customer_recipient_id && !out[order.customer_recipient_id]) out[order.customer_recipient_id] = order; });
    return out;
  }, [orders]);
  const recipientLastUsed = useMemo(() => {
    const out = {};
    orders.forEach(order => { if (order.customer_recipient_id && !out[order.customer_recipient_id]) out[order.customer_recipient_id] = new Date(order.created_at).getTime(); });
    return out;
  }, [orders]);
  const defaultAddressId = preferences?.default_address_id || addresses.find(item => item.is_default)?.id || null;
  const defaultRecipientId = preferences?.default_recipient_id || recipients.find(item => item.is_favorite)?.id || null;
  const sortedAddresses = useMemo(() => [...addresses].sort((a,b) => Number(b.id === defaultAddressId) - Number(a.id === defaultAddressId) || new Date(b.updated_at) - new Date(a.updated_at)), [addresses, defaultAddressId]);
  const sortedRecipients = useMemo(() => [...recipients].sort((a,b) => Number(b.id === defaultRecipientId) - Number(a.id === defaultRecipientId) || (recipientLastUsed[b.id] || 0) - (recipientLastUsed[a.id] || 0) || new Date(b.updated_at) - new Date(a.updated_at)), [recipients, defaultRecipientId, recipientLastUsed]);
  const recipientSearchNeeded = recipients.length > 4;
  const shownRecipients = useMemo(() => {
    const q = normalize(query);
    if (!q) return sortedRecipients;
    return sortedRecipients.filter(item => normalize(`${item.full_name} ${item.label || ''} ${item.phone}`).includes(q));
  }, [query, sortedRecipients]);

  function recipientLinks(recipientId) { return links.filter(link => link.recipient_id === recipientId); }
  function openNewAddress(afterSave = null) { setAddressWizard({ user_id: session.user.id, afterSave }); }
  function openEditAddress(address) { setAddressWizard({ ...address }); setMenu(null); }
  function openNewRecipient() { setRecipientWizard({ user_id: session.user.id }); }
  function openEditRecipient(recipient) { setRecipientWizard({ ...recipient }); setMenu(null); }

  async function addressSaved(address) {
    const callback = addressWizard?.afterSave;
    setAddressWizard(null); await load(true); setToast(ar ? 'تم حفظ العنوان.' : 'Address saved.');
    if (callback === 'recipient' && pendingRecipientDraft) {
      setRecipientWizard({ user_id: session.user.id, ...pendingRecipientDraft, default_address_id: address.id }); setPendingRecipientDraft(null);
    }
  }
  async function recipientSaved() { setRecipientWizard(null); setPendingRecipientDraft(null); await load(true); setToast(ar ? 'تم حفظ المستلم.' : 'Recipient saved.'); }

  function needAddressForRecipient(draft) {
    setPendingRecipientDraft(draft); setRecipientWizard(null); openNewAddress('recipient');
  }

  async function setDefaultAddress(address) {
    const { error: rpcError } = await supabase.rpc('customer_set_default_address', { p_address_id: address.id });
    if (rpcError) return setToast(ar ? 'تعذر تعيين العنوان الافتراضي.' : 'Could not set the default address.');
    setMenu(null); await load(true); setToast(ar ? 'تم تعيين العنوان كافتراضي.' : 'Default address updated.');
  }
  async function setDefaultRecipient(recipient) {
    const { error: rpcError } = await supabase.rpc('customer_set_default_recipient', { p_recipient_id: recipient.id });
    if (rpcError) return setToast(ar ? 'تعذر تثبيت المستلم.' : 'Could not pin this recipient.');
    setMenu(null); await load(true); setToast(ar ? 'تم تثبيت المستلم في الأعلى.' : 'Recipient pinned.');
  }

  async function archiveConfirmed() {
    if (!confirmArchive) return;
    const target = confirmArchive; setConfirmArchive(null);
    const rpc = target.type === 'address' ? 'customer_archive_address' : 'customer_archive_recipient';
    const args = target.type === 'address' ? { p_address_id: target.item.id } : { p_recipient_id: target.item.id };
    const { error: rpcError } = await supabase.rpc(rpc, args);
    if (rpcError) return setToast(ar ? 'تعذر الحذف من الحساب الآن.' : 'Could not remove this item right now.');
    setMenu(null); await load(true); setToast(target.type === 'address' ? (ar ? 'تم حذف العنوان من المحفوظات الحالية. طلباتك القديمة لم تتأثر.' : 'Address removed from saved places. Past orders are unchanged.') : (ar ? 'تم حذف المستلم من القائمة الحالية. طلباتك القديمة لم تتأثر.' : 'Recipient removed from your current list. Past orders are unchanged.'));
  }

  function useAddress(address) {
    writeCheckoutDraft(session.user.id, { recipient_mode: 'self', customer_address_id: address.id, customer_recipient_id: null });
    setToast(ar ? 'تم اختيار العنوان للطلب. ستجده جاهزًا عند إتمام الطلب.' : 'Address selected for your order. It will be ready at checkout.');
    window.setTimeout(() => navigate('/account/cart'), 350);
  }
  function useRecipient(recipient, addressId = null) {
    const lastOrder = lastOrderByRecipient[recipient.id];
    const chosenAddressId = addressId || recipient.default_address_id || lastOrder?.customer_address_id || null;
    writeCheckoutDraft(session.user.id, { recipient_mode: 'saved', customer_recipient_id: recipient.id, customer_address_id: chosenAddressId });
    setToast(ar ? 'تم تجهيز بيانات المستلم للطلب.' : 'Recipient details are ready for your order.');
    window.setTimeout(() => navigate('/account/cart'), 350);
  }
  function useSelf() {
    writeCheckoutDraft(session.user.id, { recipient_mode: 'self', customer_recipient_id: null, customer_address_id: defaultAddressId });
    setToast(ar ? 'سنستخدم بيانات حسابك والعنوان الافتراضي في إتمام الطلب.' : 'Your account details and default address will be used at checkout.');
    window.setTimeout(() => navigate('/account/cart'), 350);
  }

  if (loading) return <AddressChrome lang={lang} session={session} cartCount={cart.count}><main className="individual-shell individual-addresses-main"><div className="individual-loading-state"><LoaderCircle className="spin"/><strong>{ar ? 'نرتب دفتر عناوينك…' : 'Preparing your address book…'}</strong><span>{ar ? 'نحمّل العناوين والمستلمين المحفوظين بأمان.' : 'Loading your saved addresses and recipients securely.'}</span></div></main></AddressChrome>;

  return <AddressChrome lang={lang} session={session} cartCount={cart.count}>
    <main className="individual-shell individual-addresses-main">
      <section className="individual-addresses-head"><div><div className="individual-overline"><ShieldCheck size={14}/><span>{ar ? 'بيانات التوصيل الخاصة بك' : 'PRIVATE DELIVERY BOOK'}</span></div><h1>{ar ? 'العناوين والمستلمون' : 'Addresses & recipients'}</h1><p>{ar ? 'احفظ المكان والشخص مرة واحدة، وخلي طلباتك القادمة أقصر وأسهل — بدون إعادة كتابة نفس البيانات.' : 'Save each place and person once, then make every next order faster without retyping the same details.'}</p></div><button type="button" className="individual-refresh" onClick={() => load(true)} disabled={refreshing}>{refreshing ? <LoaderCircle className="spin" size={14}/> : <RefreshCw size={14}/>} {ar ? 'تحديث' : 'Refresh'}</button></section>
      {error && <div className="individual-system-note"><CircleAlert size={15}/><span>{error}</span></div>}

      <section className="individual-address-tabs" aria-label={ar ? 'العناوين والمستلمون' : 'Addresses and recipients'}>
        <button type="button" className={tab === 'addresses' ? 'active' : ''} onClick={() => { setTab('addresses'); setQuery(''); }}><MapPin size={16}/><span>{ar ? 'عناويني' : 'My addresses'}</span><b>{addresses.length}</b></button>
        <button type="button" className={tab === 'recipients' ? 'active' : ''} onClick={() => { setTab('recipients'); setQuery(''); }}><Users size={16}/><span>{ar ? 'المستلمون' : 'Recipients'}</span><b>{recipients.length}</b></button>
      </section>

      {tab === 'addresses' ? <>
        <div className="individual-address-section-head"><div><small>{ar ? 'أماكن محفوظة' : 'SAVED PLACES'}</small><h2>{ar ? 'اختر المكان بدل كتابة العنوان من جديد' : 'Choose the place instead of retyping it'}</h2></div><button type="button" onClick={() => openNewAddress()}><Plus size={15}/>{ar ? 'إضافة عنوان' : 'Add address'}</button></div>
        {!sortedAddresses.length ? <section className="individual-address-empty"><span><MapPin size={28}/></span><h2>{ar ? 'أضف عنوانك مرة واحدة' : 'Save your address once'}</h2><p>{ar ? 'واستخدمه في طلباتك القادمة بسهولة. تقدر تحدده على Google Maps أو تدخله يدويًا.' : 'Reuse it easily on future orders. Pick it on Google Maps or enter it manually.'}</p><button type="button" onClick={() => openNewAddress()}><Plus size={15}/>{ar ? 'إضافة عنوان' : 'Add address'}</button></section> : <section className="individual-address-grid">{sortedAddresses.map((address, index) => {
          const isDefault = address.id === defaultAddressId;
          const linkedCount = links.filter(link => link.address_id === address.id).length;
          return <article key={address.id} className={isDefault ? 'individual-saved-address default' : 'individual-saved-address'}>
            <div className="individual-saved-address-icon">{address.label && normalize(address.label).includes(normalize(ar ? 'العمل' : 'work')) ? <Building2 size={19}/> : <Home size={19}/>}</div>
            <div className="individual-saved-address-copy"><div className="individual-saved-address-title"><div><small>{ar ? `العنوان ${index + 1}` : `ADDRESS ${index + 1}`}</small><h3>{addressTitle(address, ar)}</h3></div>{isDefault && <em><Star size={11}/>{ar ? 'الافتراضي' : 'Default'}</em>}</div><p>{addressLine(address, ar)}</p><div className="individual-address-meta">{address.short_address && <span>{address.short_address}</span>}{address.building_number && <span>{ar ? `مبنى ${address.building_number}` : `Building ${address.building_number}`}</span>}{linkedCount > 0 && <span><Users size={10}/>{ar ? `مرتبط بـ ${linkedCount} مستلم` : `Linked to ${linkedCount} recipient(s)`}</span>}</div>{address.access_notes && <div className="individual-access-note"><Navigation size={12}/><span>{address.access_notes}</span></div>}</div>
            <div className="individual-address-card-actions"><button type="button" className="primary" onClick={() => useAddress(address)}>{ar ? 'استخدم للطلب' : 'Use for order'}<Arrow size={14}/></button><button type="button" onClick={() => openEditAddress(address)}><Pencil size={14}/><span>{ar ? 'تعديل' : 'Edit'}</span></button><div className="individual-more-wrap"><button type="button" onClick={() => setMenu(menu === `a-${address.id}` ? null : `a-${address.id}`)}><MoreHorizontal size={16}/></button>{menu === `a-${address.id}` && <div className="individual-more-menu">{!isDefault && <button type="button" onClick={() => setDefaultAddress(address)}><Star size={13}/>{ar ? 'تعيين كافتراضي' : 'Set as default'}</button>}{address.maps_url && <a href={address.maps_url} target="_blank" rel="noreferrer"><Navigation size={13}/>{ar ? 'فتح في Google Maps' : 'Open in Google Maps'}</a>}<button type="button" className="danger" onClick={() => setConfirmArchive({ type:'address', item: address })}><Trash2 size={13}/>{ar ? 'حذف من الحساب' : 'Remove'}</button></div>}</div></div>
          </article>;
        })}</section>}
      </> : <>
        <div className="individual-address-section-head"><div><small>{ar ? 'أشخاص محفوظون' : 'SAVED RECIPIENTS'}</small><h2>{ar ? 'لمن ترسل عادة؟' : 'Who do you usually send to?'}</h2></div><button type="button" onClick={openNewRecipient}><Plus size={15}/>{ar ? 'إضافة مستلم' : 'Add recipient'}</button></div>
        <article className="individual-self-recipient"><span><UserRound size={19}/></span><div><small>{ar ? 'اختصار دائم' : 'ALWAYS AVAILABLE'}</small><strong>{ar ? 'أنا المستلم' : 'I am the recipient'}</strong><p>{profile?.full_name || session?.user?.email} {profile?.phone ? `· ${shortPhone(profile.phone)}` : ''}</p>{defaultAddressId && <em><MapPin size={11}/>{addressTitle(addressMap[defaultAddressId], ar)}</em>}</div><button type="button" onClick={useSelf}>{ar ? 'استخدم للطلب' : 'Use for order'}<Arrow size={14}/></button></article>
        {recipientSearchNeeded && <label className="individual-recipient-search"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder={ar ? 'ابحث بالاسم أو جزء من رقم الجوال' : 'Search by name or part of phone number'}/>{query && <button type="button" onClick={() => setQuery('')}><X size={13}/></button>}</label>}
        {!sortedRecipients.length ? <section className="individual-address-empty"><span><Users size={28}/></span><h2>{ar ? 'احفظ الأشخاص الذين ترسل لهم عادةً' : 'Save people you send to often'}</h2><p>{ar ? 'الاسم والجوال وعنوان معتاد فقط، وبعدها تصبح الطلبات القادمة أسرع بكثير.' : 'Just a name, phone number, and usual address — future orders become much faster.'}</p><button type="button" onClick={openNewRecipient}><Plus size={15}/>{ar ? 'إضافة مستلم' : 'Add recipient'}</button></section> : <section className="individual-recipient-grid">{shownRecipients.map(recipient => {
          const isDefault = recipient.id === defaultRecipientId;
          const lastOrder = lastOrderByRecipient[recipient.id];
          const lastAddressId = lastOrder?.customer_address_id || lastOrder?.address_snapshot?.id || null;
          const usual = addressMap[recipient.default_address_id] || addressMap[recipientLinks(recipient.id).find(link => link.is_default)?.address_id] || null;
          const lastAddress = addressMap[lastAddressId] || null;
          const linkedCount = recipientLinks(recipient.id).length;
          return <article key={recipient.id} className={isDefault ? 'individual-recipient-card default' : 'individual-recipient-card'}>
            <div className="individual-recipient-avatar">{(recipient.label || recipient.full_name || '?').trim().slice(0,1).toUpperCase()}</div>
            <div className="individual-recipient-card-copy"><div className="individual-recipient-title"><div><small>{recipient.label || (ar ? 'مستلم محفوظ' : 'Saved recipient')}</small><h3>{recipient.full_name}</h3></div>{isDefault && <em><Star size={11}/>{ar ? 'مثبت' : 'Pinned'}</em>}</div><p><Phone size={12}/><span dir="ltr">{recipient.phone}</span></p>{usual && <div className="individual-recipient-usual"><MapPin size={12}/><div><small>{ar ? 'العنوان المعتاد' : 'USUAL ADDRESS'}</small><strong>{addressTitle(usual, ar)}</strong><span>{addressLine(usual, ar)}</span></div></div>}{lastAddress && lastAddress.id !== usual?.id && <div className="individual-recipient-last"><Navigation size={12}/><span>{ar ? `آخر توصيل كان إلى ${addressTitle(lastAddress, ar)}` : `Last delivery went to ${addressTitle(lastAddress, ar)}`}</span><button type="button" onClick={() => useRecipient(recipient, lastAddress.id)}>{ar ? 'استخدم كما في آخر مرة' : 'Use last time'}</button></div>}</div>
            <div className="individual-recipient-card-foot"><button type="button" className="primary" onClick={() => useRecipient(recipient)}>{ar ? 'استخدم للطلب' : 'Use for order'}<Arrow size={14}/></button><button type="button" onClick={() => setManageRecipient(recipient)}><Link2 size={14}/><span>{linkedCount ? (ar ? `${linkedCount} عنوان` : `${linkedCount} addresses`) : (ar ? 'ربط عنوان' : 'Link address')}</span></button><div className="individual-more-wrap"><button type="button" onClick={() => setMenu(menu === `r-${recipient.id}` ? null : `r-${recipient.id}`)}><MoreHorizontal size={16}/></button>{menu === `r-${recipient.id}` && <div className="individual-more-menu">{!isDefault && <button type="button" onClick={() => setDefaultRecipient(recipient)}><Star size={13}/>{ar ? 'تثبيت في الأعلى' : 'Pin to top'}</button>}<button type="button" onClick={() => openEditRecipient(recipient)}><Pencil size={13}/>{ar ? 'تعديل البيانات' : 'Edit details'}</button><button type="button" className="danger" onClick={() => setConfirmArchive({ type:'recipient', item: recipient })}><Trash2 size={13}/>{ar ? 'حذف من الحساب' : 'Remove'}</button></div>}</div></div>
          </article>;
        })}</section>}
        {recipientSearchNeeded && query && !shownRecipients.length && <div className="individual-address-no-results"><Search size={21}/><strong>{ar ? 'ما لقينا مستلمًا بهذا البحث' : 'No recipient matched that search'}</strong><span>{ar ? 'جرّب الاسم أو آخر أرقام الجوال.' : 'Try the name or the last digits of the phone number.'}</span></div>}
      </>}

      <section className="individual-address-privacy"><ShieldCheck size={17}/><div><strong>{ar ? 'بيانات خاصة للتوصيل فقط' : 'Private delivery data only'}</strong><p>{ar ? 'أسماء المستلمين وأرقامهم وعناوينهم تُستخدم لتسهيل الطلب والتوصيل، ولا تُستخدم لبناء حملات تسويقية لهم.' : 'Recipient names, phone numbers and addresses are used to complete delivery, not to market to those recipients.'}</p></div></section>
    </main>

    {toast && <div className="individual-cart-toast"><Check size={14}/><span>{toast}</span></div>}
    {addressWizard && <AddressWizard lang={lang} initial={addressWizard} addresses={addresses} onClose={() => { setAddressWizard(null); setPendingRecipientDraft(null); }} onSaved={addressSaved}/>} 
    {recipientWizard && <RecipientWizard lang={lang} initial={recipientWizard} addresses={addresses} recipients={recipients} onClose={() => setRecipientWizard(null)} onSaved={recipientSaved} onNeedAddress={needAddressForRecipient}/>} 
    {manageRecipient && <RecipientAddressesManager lang={lang} recipient={manageRecipient} addresses={addresses} links={links} onClose={() => setManageRecipient(null)} onChanged={async () => { await load(true); }}/>} 
    {confirmArchive && <div className="individual-modal-overlay"><div className="individual-cart-confirm"><button type="button" className="individual-modal-close" onClick={() => setConfirmArchive(null)}><X size={16}/></button><span><Trash2 size={20}/></span><h3>{confirmArchive.type === 'address' ? (ar ? 'حذف العنوان من الحساب؟' : 'Remove this address?') : (ar ? 'حذف المستلم من الحساب؟' : 'Remove this recipient?')}</h3><p>{ar ? 'لن تتأثر الطلبات القديمة؛ فهي تحتفظ بنسخة مستقلة من بيانات التسليم وقت الطلب.' : 'Past orders will not change; each order keeps its own delivery snapshot.'}</p><div><button type="button" className="ghost" onClick={() => setConfirmArchive(null)}>{ar ? 'إبقاء' : 'Keep'}</button><button type="button" className="danger" onClick={archiveConfirmed}>{ar ? 'حذف' : 'Remove'}</button></div></div></div>}
  </AddressChrome>;
}
