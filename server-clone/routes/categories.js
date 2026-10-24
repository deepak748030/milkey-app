const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/admin');

// Public list (owner scoped or all)
router.get('/', auth, async (req,res)=>{
  try{
    const q = { $or: [{ owner: req.userId }, { owner: null }] , isActive: true };
    const cats = await Category.find({ isActive: true }).sort({ order:1, name:1 }).lean();
    res.json({ success:true, response: cats });
  }catch(e){ res.status(500).json({ success:false, message:'Failed' }); }
});
router.get('/admin/all', adminAuth, async (req,res)=>{
  try{ const cats = await Category.find().sort({ order:1 }).lean(); res.json({ success:true, response:cats }); }catch(e){ res.status(500).json({ success:false }); }
});
router.post('/', adminAuth, async (req,res)=>{
  try{
    const { name, icon, color, order } = req.body;
    if(!name) return res.status(400).json({ success:false, message:'Name required' });
    const slug = name.toLowerCase().trim().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
    const cat = await Category.create({ name: name.trim(), slug, icon: icon||'', color: color||'#22C55E', order: order||0, createdBy: req.adminId });
    res.status(201).json({ success:true, response:cat });
  }catch(e){ if(e.code===11000) return res.status(409).json({ success:false, message:'Category exists'}); res.status(500).json({ success:false }); }
});
router.put('/:id', adminAuth, async (req,res)=>{
  try{ const c = await Category.findByIdAndUpdate(req.params.id, req.body, { new:true }); if(!c) return res.status(404).json({ success:false }); res.json({ success:true, response:c }); }catch(e){ res.status(500).json({ success:false }); }
});
router.delete('/:id', adminAuth, async (req,res)=>{
  try{ await Category.findByIdAndDelete(req.params.id); res.json({ success:true, message:'Deleted' }); }catch(e){ res.status(500).json({ success:false }); }
});
module.exports = router;
