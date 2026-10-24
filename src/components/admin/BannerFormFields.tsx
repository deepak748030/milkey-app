import { BannerFormData } from '../../pages/BannersPage'
import { Upload, Loader2, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useRef } from 'react'

const gradients = [
  ['#22C55E','#16A34A'], ['#3B82F6','#2563EB'], ['#F59E0B','#D97706'], ['#EF4444','#DC2626'],
  ['#8B5CF6','#7C3AED'], ['#EC4899','#DB2777'], ['#06B6D4','#0891B2'], ['#10B981','#059669'],
]
export function BannerFormFields({ formData, setFormData, imagePreview, setImagePreview, uploadLoading, setUploadLoading, fileInputRef }: any) {
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please select image'); return; }
    if (file.size > 5*1024*1024) { alert('Image <5MB'); return; }
    setUploadLoading(true)
    try {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64 = reader.result as string
        setImagePreview(base64)
        const { uploadImage } = await import('../../lib/api')
        const r = await uploadImage(base64, 'banners')
        if (r.success && r.response?.url) { setFormData((p: any) => ({ ...p, image: r.response!.url })); setImagePreview(r.response.url); } else { alert(r.message||'upload failed'); setImagePreview('') }
        setUploadLoading(false)
      }
      reader.onerror = () => { alert('read failed'); setUploadLoading(false) }
      reader.readAsDataURL(file)
    } catch { setUploadLoading(false) }
  }
  return (
    <>
      <div>
        <label className="block text-sm font-medium mb-2">Banner Image *</label>
        <div onClick={() => !uploadLoading && fileInputRef.current?.click()} className={cn('relative border-2 border-dashed rounded-lg overflow-hidden cursor-pointer h-40', imagePreview ? 'border-primary' : 'border-border hover:border-primary/50')} style={{ background: formData.gradient ? `linear-gradient(135deg, ${formData.gradient[0]}, ${formData.gradient[1]})` : '#22C55E' }}>
          {uploadLoading ? <div className="absolute inset-0 flex items-center justify-center bg-background/80"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          : imagePreview ? <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
          : <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80"><Upload className="w-8 h-8 mb-2" /><p className="text-sm font-medium">Click to upload image</p><p className="text-xs">PNG, JPG up to 5MB</p></div>}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        {formData.image && !formData.image.startsWith('data:') && <p className="text-xs text-success mt-1">✓ Image uploaded to Cloudinary</p>}
      </div>
      <div className="p-3 bg-muted/50 border border-border rounded-lg"><p className="text-xs text-muted-foreground">✓ Image-only banner — no text overlay in app Home. Title auto-generated.</p></div>
      <div>
        <label className="block text-sm font-medium mb-1">Banner Link (optional)</label>
        <select value={formData.linkType} onChange={e=>setFormData((p:any)=>({...p, linkType:e.target.value as any, linkValue:e.target.value==='none'?'':p.linkValue}))} className="w-full px-4 py-2 bg-input border border-border rounded-lg text-sm">
          <option value="none">None (not clickable)</option><option value="url">URL (YouTube, website)</option><option value="product">Product</option><option value="category">Category</option>
        </select>
        {formData.linkType!=='none' && <input type="text" value={formData.linkValue} onChange={e=>setFormData((p:any)=>({...p, linkValue:e.target.value}))} placeholder={formData.linkType==='url' ? 'https://youtube.com/watch?v=...' : 'Product/Category name'} className="w-full mt-2 px-4 py-2 bg-input border rounded-lg text-sm" />}
        <p className="text-xs text-muted-foreground mt-1">Users tap banner in app and go directly to this link.</p>
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Background Gradient</label>
        <div className="flex flex-wrap gap-2">{gradients.map((g,i)=>(<button key={i} type="button" onClick={()=>setFormData((p:any)=>({...p, gradient:g}))} className={cn('w-10 h-10 rounded-lg border-2', formData.gradient[0]===g[0] && formData.gradient[1]===g[1] ? 'border-foreground scale-110' : 'border-transparent')} style={{ background:`linear-gradient(135deg, ${g[0]}, ${g[1]})` }} />))}</div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Display Position</label>
        <div className="flex items-center gap-3">
          <input type="number" value={formData.order} onChange={e=>setFormData((p:any)=>({...p, order:parseInt(e.target.value)||0}))} min={0} className="flex-1 px-4 py-2 bg-input border rounded-lg text-sm" />
          <div className="flex gap-1"><button type="button" onClick={()=>setFormData((p:any)=>({...p, order:Math.max(0,p.order-1)}))} className="p-2 bg-muted rounded-lg"><ArrowUp className="w-4 h-4" /></button><button type="button" onClick={()=>setFormData((p:any)=>({...p, order:p.order+1}))} className="p-2 bg-muted rounded-lg"><ArrowDown className="w-4 h-4" /></button></div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Lower numbers appear first. #{formData.order+1} in carousel.</p>
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Quick Position Select</label>
        <div className="flex flex-wrap gap-2">{[0,1,2,3,4,5,6,7,8,9].map(pos=>(<button key={pos} type="button" onClick={()=>setFormData((p:any)=>({...p, order:pos}))} className={cn('w-10 h-10 rounded-lg border-2 text-sm font-bold', formData.order===pos ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted border-border')}>{pos+1}</button>))}</div>
      </div>
    </>
  )
}
