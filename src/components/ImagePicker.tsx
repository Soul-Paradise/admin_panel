import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ImageOff, Images, Link2, Search, Upload, X } from 'lucide-react';
import { api, type MediaAsset } from '../lib/api';
import { checkImageFile, prepareImage, titleFromFileName } from '../lib/image-upload';
import { BTN_GHOST, BTN_PRIMARY, BTN_SM, INPUT } from '../lib/ui-styles';
import { Alert, Badge, EmptyState, Modal, Spinner } from './ui';

/**
 * Image field for section forms: thumbnail of the current URL, a library
 * browser (with upload straight to the bucket) and a paste-a-URL fallback.
 */
export default function ImagePicker({
  value,
  onChange,
  disabled,
  label,
  invalid,
  deleted = false,
  clearable = false,
}: {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  label: string;
  invalid?: boolean;
  /** The file was deleted from the bucket (from the missing-media report). */
  deleted?: boolean;
  /** Offer a Clear button (optional image slots). */
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [draftUrl, setDraftUrl] = useState(value);
  // The URL that failed to load; a new value clears it implicitly.
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const broken = !!value && (deleted || brokenUrl === value);

  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-xl border bg-background p-2.5 ${invalid ? 'border-danger/60' : 'border-tertiary-button'}`}>
      <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 ring-1 ring-tertiary-button">
        {value && !broken ? (
          <img src={value} alt={label} loading="lazy" className="h-full w-full object-cover" onError={() => setBrokenUrl(value)} />
        ) : (
          <ImageOff className="h-5 w-5 text-inactive" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-xs text-inactive" title={value}>
          {value || 'No image selected'}
        </p>
        {broken && <p className="text-xs font-semibold text-danger">Image deleted - choose another</p>}
        {!disabled && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setOpen(true)} className={`${BTN_PRIMARY} ${BTN_SM}`}>
              <Images className="h-3.5 w-3.5" /> Choose from library
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftUrl(value);
                setPasting((p) => !p);
              }}
              className={`${BTN_GHOST} ${BTN_SM}`}
            >
              <Link2 className="h-3.5 w-3.5" /> Paste URL
            </button>
            {clearable && value && (
              <button type="button" onClick={() => onChange('')} className={`${BTN_GHOST} ${BTN_SM}`}>
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>
        )}
        {pasting && !disabled && (
          <div className="mt-2 flex gap-1.5">
            <input
              type="url"
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
              placeholder="https://storage.googleapis.com/..."
              aria-label={`${label} URL`}
              className={`${INPUT} !py-1.5 text-xs`}
            />
            <button
              type="button"
              onClick={() => {
                onChange(draftUrl.trim());
                setPasting(false);
              }}
              disabled={!/^https?:\/\//.test(draftUrl.trim())}
              className={`${BTN_PRIMARY} ${BTN_SM}`}
            >
              Use
            </button>
          </div>
        )}
      </div>
      {open && (
        <LibraryModal
          current={value}
          onClose={() => setOpen(false)}
          onPick={(url) => {
            onChange(url);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function LibraryModal({ current, onClose, onPick }: { current: string; onClose: () => void; onPick: (url: string) => void }) {
  const [items, setItems] = useState<MediaAsset[] | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (q: string) => {
    try {
      setItems(await api.getMedia({ search: q || undefined }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the media library.');
      setItems([]);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => load(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search, load]);

  async function upload(file: File) {
    const problem = checkImageFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const img = await prepareImage(file);
      const asset = await api.uploadMedia(img.blob, img.fileName, {
        title: titleFromFileName(file.name),
        collection: 'LIBRARY',
        isVisible: true,
        width: img.width,
        height: img.height,
      });
      onPick(asset.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal
      title="Choose an image"
      onClose={onClose}
      wide
      footer={
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = '';
            }}
          />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className={BTN_GHOST}>
            <Upload className="h-4 w-4" /> {uploading ? 'Uploading…' : 'Upload new image'}
          </button>
          <button type="button" onClick={onClose} className={BTN_PRIMARY}>
            Close
          </button>
        </>
      }
    >
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-inactive" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, caption or category"
          aria-label="Search images"
          className={`${INPUT} pl-9`}
        />
      </div>
      {error && (
        <div className="mb-3">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      {items === null ? (
        <Spinner label="Loading images…" />
      ) : items.length === 0 ? (
        <EmptyState icon={Images} title="No images found" message="Upload one with the button below." />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((m) => {
            const selected = m.url === current;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onPick(m.url)}
                  className={`group relative block w-full overflow-hidden rounded-xl text-left ring-2 transition ${selected ? 'ring-links' : 'ring-transparent hover:ring-links/40'}`}
                >
                  <img src={m.url} alt={m.title} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                  <span className="block truncate bg-peace px-2 py-1.5 text-xs font-semibold text-foreground">{m.title}</span>
                  <span className="absolute top-1.5 left-1.5 flex gap-1">
                    <Badge tone={m.collection === 'HALL_OF_FAME' ? 'purple' : 'slate'}>{m.collection === 'HALL_OF_FAME' ? 'Gallery' : 'Library'}</Badge>
                    {!m.isVisible && <Badge tone="amber">Hidden</Badge>}
                  </span>
                  {selected && (
                    <span className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-links text-white">
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
