export function getSaudiSeason(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
    timeZone: 'Asia/Riyadh', year: 'numeric', month: 'numeric', day: 'numeric'
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
  const hijriMonth = get('month');
  const hijriDay = get('day');

  const greg = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const g = Object.fromEntries(greg.filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));

  if (hijriMonth === 9) return { key: 'ramadan', ar: 'رمضان كريم', en: 'Ramadan Kareem' };
  if (hijriMonth === 10 && hijriDay <= 3) return { key: 'eid', ar: 'عيدكم مبارك', en: 'Eid Mubarak' };
  if (hijriMonth === 12 && hijriDay >= 10 && hijriDay <= 13) return { key: 'adha', ar: 'عيد أضحى مبارك', en: 'Eid Al-Adha Mubarak' };
  if (hijriMonth === 12 && hijriDay >= 1 && hijriDay <= 9) return { key: 'hajj', ar: 'موسم حج مبارك', en: 'Blessed Hajj Season' };
  if (g.month === 9 && g.day >= 20 && g.day <= 26) return { key: 'national', ar: 'دام عزك يا وطن', en: 'Saudi National Day' };
  return { key: 'default', ar: '', en: '' };
}
