import { useRef, useState } from 'react';
import { ImagePlus, LoaderCircle, Trash2, UploadCloud } from 'lucide-react';
import { supabase } from '../lib/supabase';

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

export default function AdminMediaUpload({ lang, value, onChange, folder = 'products', label }) {
  const ar = lang === 'ar';
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function upload(file) {
    setError('');
    if (!file) return;
    if (!ALLOWED.has(file.type)) {
      setError(ar ? 'استخدم JPG أو PNG أو WEBP أو AVIF فقط.' : 'Use JPG, PNG, WEBP or AVIF only.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(ar ? 'حجم الصورة يجب ألا يتجاوز 8MB.' : 'Image size must not exceed 8MB.');
      return;
    }

    setUploading(true);
    const ext = (file.name.split('.').pop() || 'webp').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${folder}/${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('catalog-media').upload(path, file, {
      cacheControl: '31536000', upsert: false, contentType: file.type,
    });
    if (uploadError) {
      setError(uploadError.message || (ar ? 'تعذر رفع الصورة.' : 'Could not upload image.'));
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from('catalog-media').getPublicUrl(path);
    onChange(data.publicUrl);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  return <div className="admin-media-field">
    <div className="admin-media-label"><span>{label || (ar ? 'الصورة' : 'Image')}</span><small>{ar ? 'رفع مباشر · JPG / PNG / WEBP / AVIF · حتى 8MB' : 'Direct upload · JPG / PNG / WEBP / AVIF · up to 8MB'}</small></div>
    <div className={`admin-media-box ${value ? 'has-image' : ''}`}>
      {value ? <img src={value} alt=""/> : <span className="admin-media-placeholder"><ImagePlus size={25}/></span>}
      <div className="admin-media-actions">
        <button type="button" className="admin-secondary-button" onClick={() => inputRef.current?.click()} disabled={uploading}>{uploading ? <LoaderCircle className="spin" size={16}/> : <UploadCloud size={16}/>} {uploading ? (ar ? 'جاري الرفع…' : 'Uploading…') : value ? (ar ? 'استبدال الصورة' : 'Replace image') : (ar ? 'رفع صورة' : 'Upload image')}</button>
        {value && <button type="button" className="admin-icon-danger" onClick={() => onChange('')} title={ar ? 'إزالة الصورة' : 'Remove image'}><Trash2 size={16}/></button>}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden onChange={e => upload(e.target.files?.[0])}/>
    </div>
    {error && <div className="admin-media-error">{error}</div>}
  </div>;
}
