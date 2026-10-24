// Ponytail reusable CRUD factory - DRY for Category/Device/Faq/Video etc without touching real server
const cache = require('./cache');
function crudFactory({ Model, baseQuery = () => ({}), sortDefault = { createdAt: -1 }, populate = null, searchField = null, cacheKey = null }) {
  const { parsePaging, pagingResult } = require('./pagination');
  return {
    async list(req, res) {
      try {
        const { page, limit, skip } = parsePaging(req.query, { page: 1, limit: 20 });
        const q = { ...baseQuery(req), ...(req.query.search && searchField ? { [searchField]: { $regex: req.query.search, $options: 'i' } } : {}) };
        const [items, total] = await Promise.all([
          (async () => { let cur = Model.find(q).sort(sortDefault).skip(skip).limit(limit).lean(); if (populate) cur = cur.populate(populate); return cur; })(),
          Model.countDocuments(q),
        ]);
        const r = pagingResult({ items, total, page, limit });
        res.json({ success: true, response: r });
      } catch (e) { res.status(500).json({ success: false, message: 'Failed' }); }
    },
    async create(req, res) {
      try { const doc = await Model.create({ ...req.body, owner: req.userId || req.adminId }); if (cacheKey) cache.del(cacheKey); res.status(201).json({ success: true, response: doc }); } catch (e) { res.status(500).json({ success: false, message: e.message }); }
    },
    async update(req, res) {
      try { const doc = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true }); if (!doc) return res.status(404).json({ success: false }); if (cacheKey) cache.del(cacheKey); res.json({ success: true, response: doc }); } catch (e) { res.status(500).json({ success: false }); }
    },
    async remove(req, res) {
      try { await Model.findByIdAndDelete(req.params.id); if (cacheKey) cache.del(cacheKey); res.json({ success: true }); } catch (e) { res.status(500).json({ success: false }); }
    },
  };
}
module.exports = crudFactory;
