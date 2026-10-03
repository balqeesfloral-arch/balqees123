let mapsPromise = null;

export function hasGoogleMapsKey() {
  return Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
}

export function loadGoogleMaps(language = 'ar') {
  if (typeof window === 'undefined') return Promise.reject(new Error('BROWSER_REQUIRED'));
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!key) return Promise.reject(new Error('GOOGLE_MAPS_KEY_MISSING'));
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-balqees-google-maps]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google.maps), { once: true });
      existing.addEventListener('error', () => reject(new Error('GOOGLE_MAPS_LOAD_FAILED')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.dataset.balqeesGoogleMaps = '1';
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&language=${encodeURIComponent(language)}&region=SA&v=weekly`;
    script.onload = () => window.google?.maps?.Map ? resolve(window.google.maps) : reject(new Error('GOOGLE_MAPS_LOAD_FAILED'));
    script.onerror = () => reject(new Error('GOOGLE_MAPS_LOAD_FAILED'));
    document.head.appendChild(script);
  }).catch(error => {
    mapsPromise = null;
    throw error;
  });

  return mapsPromise;
}

export function parseGoogleMapsUrl(value = '') {
  const text = String(value || '').trim();
  if (!text) return null;
  const at = text.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/);
  if (at) return { lat: Number(at[1]), lng: Number(at[2]) };
  const query = text.match(/[?&](?:q|query)=(-?\d{1,2}\.\d+)%?2C(-?\d{1,3}\.\d+)/i);
  if (query) return { lat: Number(query[1]), lng: Number(query[2]) };
  const plain = text.match(/(-?\d{1,2}\.\d+)\s*[,،]\s*(-?\d{1,3}\.\d+)/);
  if (plain) return { lat: Number(plain[1]), lng: Number(plain[2]) };
  return null;
}

export function mapsSearchUrl({ lat, lng, query } = {}) {
  if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || '')}`;
}

export function mapsEmbedUrl(lat, lng) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return '';
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}&z=17&output=embed`;
}
