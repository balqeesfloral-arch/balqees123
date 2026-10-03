import { useRef, useState } from 'react';
import { GripVertical, ImagePlus, LoaderCircle, Trash2, UploadCloud } from 'lucide-react';
import { supabase } from '../lib/supabase';

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_IMAGES = 8;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

export default function AdminGalleryUpload({ lang, value = [], onChange, folder = 'products/gallery', label }) {
  const ar = lang === 'ar';
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const images = Array.isArray(value) ? value.filter(Boolean) : [];

  async function upload(files) {
    setError('');
    const list = Array.from(files || []).slice(0, Math.max(0, MAX_IMAGES - images.length));
    if (!list.length) return;
    for (const file of list) {
      if (!ALLOWED.has(file.type)) {
        setError(ar ? 'استخدم JPG أو PNG أو WEBP أو AVIF فقط.' : 'Use JPG, PNG, WEBP or AVIF only.');
        return;
      }
      if (file.size > MAX_BYTES) {
        setError(ar ? 'كل صورة يجب ألا تتجاوز 8MB.' : 'Each image must be under 8MB.');
        return;
      }
    }

    setUploading(true);
    const next = [...images];
    for (const file of list) {
      const ext = (file.name.split('.').pop() || 'webp').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${folder}/${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('catalog-media').upload(path, file, {
        cacheControl: '31536000', upsert: false, contentType: file.type,
      });
      if (uploadError) {
        setError(uploadError.message || (ar ? 'تعذر رفع بعض الصور.' : 'Could not upload one or more images.'));
        setUploading(false);
        return;
      }
      const { data } = supabase.storage.from('catalog-media').getPublicUrl(path);
      next.push(data.publicUrl);
    }
    onChange(next);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  function remove(index) { onChange(images.filter((_, i) => i !== index)); }
  function move(index, dir) {
    const target = index + dir;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return <div className="admin-gallery-field">
    <div className="admin-media-label"><span>{label || (ar ? 'معرض الصور' : 'Image gallery')}</span><small>{ar ? `حتى ${MAX_IMAGES} صور · رفع مباشر` : `Up to ${MAX_IMAGES} images · direct upload`}</small></div>
    <div className="admin-gallery-grid">
      {images.map((src, index) => <article className="admin-gallery-tile" key={`${src}-${index}`}>
        <img src={src} alt=""/>
        <div className="admin-gallery-order">
          <button type="button" onClick={() => move(index, -1)} disabled={index === 0} title={ar ? 'تحريك للأمام' : 'Move earlier'}>‹</button>
          <span><GripVertical size={14}/>{index + 1}</span>
          <button type="button" onClick={() => move(index, 1)} disabled={index === images.length - 1} title={ar ? 'تحريك للخلف' : 'Move later'}>›</button>
        </div>
        <button type="button" className="admin-gallery-remove" onClick={() => remove(index)} title={ar ? 'حذف الصورة' : 'Remove image'}><Trash2 size={15}/></button>
      </article>)}
      {images.length < MAX_IMAGES && <button type="button" className="admin-gallery-add" onClick={() => inputRef.current?.click()} disabled={uploading}>
        {uploading ? <LoaderCircle className="spin" size={22}/> : <ImagePlus size={24}/>}<span>{uploading ? (ar ? 'جاري الرفع…' : 'Uploading…') : (ar ? 'إضافة صور' : 'Add images')}</span>
      </button>}
    </div>
    <input ref={inputRef} hidden multiple type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={e => upload(e.target.files)}/>
    {images.length === 0 && <button type="button" className="admin-secondary-button admin-gallery-upload-button" onClick={() => inputRef.current?.click()} disabled={uploading}><UploadCloud size={16}/>{ar ? 'رفع مجموعة صور' : 'Upload images'}</button>}
    {error && <div className="admin-media-error">{error}</div>}
  </div>;
}
