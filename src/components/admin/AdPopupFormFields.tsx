import { Upload, Loader2, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '../../lib/utils'

export function AdPopupFormFields({ formData, setFormData, imagePreview, setImagePreview, uploadLoading, setUploadLoading, fileInputRef }: any) {
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please select image'); return; }
    if (file.size > 8 * 1024 * 1024) { alert('Image <8MB'); return; }
    setUploadLoading(true)
    try {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64 = reader.result as string
        setImagePreview(base64)
        const { uploadImage } = await import('../../lib/api')
        const r = await uploadImage(base64, 'ad-popups')
        if (r.success && r.response?.url) { setFormData((p: any) => ({ ...p, image: r.response!.url })); setImagePreview(r.response.url); } else { alert(r.message || 'upload failed'); setImagePreview('') }
        setUploadLoading(false)
      }
      reader.onerror = () => { alert('read failed'); setUploadLoading(false) }
      reader.readAsDataURL(file)
    } catch { setUploadLoading(false) }
  }
  return (
    <>
      <div>
        <label className="block text-sm font-medium mb-2">Ad Image * — will show full-width in app popup (tall images become scrollable fullscreen)</label>
        <div onClick={() => !uploadLoading && fileInputRef.current?.click()} className={cn('relative border-2 border-dashed rounded-lg overflow-hidden cursor-pointer', imagePreview ? 'border-primary h-72' : 'border-border hover:border-primary/50 h-48')}>
          {uploadLoading ? <div className="absolute inset-0 flex items-center justify-center bg-background/80"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            : imagePreview ? <img src={imagePreview} alt="preview" className="w-full h-full object-contain bg-black/5" />
              : <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground"><Upload className="w-8 h-8 mb-2" /><p className="text-sm font-medium">Click to upload image</p><p className="text-xs">PNG, JPG up to 8MB — any height supported</p></div>}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        {formData.image && !formData.image.startsWith('data:') && <p className="text-xs text-success mt-1">✓ Image uploaded to Cloudinary</p>}
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Title (internal)</label>
        <input type="text" value={formData.title} onChange={e => setFormData((p: any) => ({ ...p, title: e.target.value }))} placeholder="e.g. Diwali Offer — auto if empty" className="w-full px-4 py-2 bg-input border border-border rounded-lg text-sm" />
        <p className="text-xs text-muted-foreground mt-1">Only for admin list, not shown in app modal.</p>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Ad Link (optional — tap image in app)</label>
        <select value={formData.linkType} onChange={e => setFormData((p: any) => ({ ...p, linkType: e.target.value as any, linkValue: e.target.value === 'none' ? '' : p.linkValue }))} className="w-full px-4 py-2 bg-input border border-border rounded-lg text-sm">
          <option value="none">None (just image, no tap action)</option><option value="url">URL (website / YouTube)</option><option value="product">Product</option><option value="category">Category</option>
        </select>
        {formData.linkType !== 'none' && <input type="text" value={formData.linkValue} onChange={e => setFormData((p: any) => ({ ...p, linkValue: e.target.value }))} placeholder={formData.linkType === 'url' ? 'https://...' : 'Product / Category name'} className="w-full mt-2 px-4 py-2 bg-input border rounded-lg text-sm" />}
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Display Position (order)</label>
        <div className="flex items-center gap-3">
          <input type="number" value={formData.order} onChange={e => setFormData((p: any) => ({ ...p, order: parseInt(e.target.value) || 0 }))} min={0} className="flex-1 px-4 py-2 bg-input border rounded-lg text-sm" />
          <div className="flex gap-1"><button type="button" onClick={() => setFormData((p: any) => ({ ...p, order: Math.max(0, p.order - 1) }))} className="p-2 bg-muted rounded-lg"><ArrowUp className="w-4 h-4" /></button><button type="button" onClick={() => setFormData((p: any) => ({ ...p, order: p.order + 1 }))} className="p-2 bg-muted rounded-lg"><ArrowDown className="w-4 h-4" /></button></div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Lower order shows first when fetching active ad.</p>
      </div>
    </>
  )
}
