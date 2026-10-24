const express = require('express');
const router = express.Router();
const MilkRateSettings = require('../models/MilkRateSettings');
const auth = require('../middleware/auth');

function clampNum(v, def = 0) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (!Number.isFinite(n)) return def;
  if (n < 0) return 0;
  if (n > 1000) return 1000;
  return Math.round(n * 100) / 100;
}

router.get('/', auth, async (req, res) => {
  try {
    let doc = await MilkRateSettings.findOne({ owner: req.user._id });
    if (!doc) doc = await MilkRateSettings.create({ owner: req.user._id });
    res.json({ success: true, response: doc });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.put('/', auth, async (req, res) => {
  try {
    const b = req.body || {};
    const update = {};

    if (b.fatSnfRate) {
      update['fatSnfRate.buffalo'] = clampNum(b.fatSnfRate.buffalo, 0);
      update['fatSnfRate.cow'] = clampNum(b.fatSnfRate.cow, 0);
      if (typeof b.fatSnfRate.baseLabel === 'string') update['fatSnfRate.baseLabel'] = b.fatSnfRate.baseLabel.slice(0, 20);
    }
    if (b.fixedRate) {
      update['fixedRate.buffalo'] = clampNum(b.fixedRate.buffalo, 0);
      update['fixedRate.cow'] = clampNum(b.fixedRate.cow, 0);
    }
    if (b.fatRate) {
      update['fatRate.buffalo'] = clampNum(b.fatRate.buffalo, 0);
      update['fatRate.cow'] = clampNum(b.fatRate.cow, 0);
    }
    if (b.clrProRata) {
      if (b.clrProRata.clrToSnf !== undefined) update['clrProRata.clrToSnf'] = clampNum(b.clrProRata.clrToSnf, 0);
      if (typeof b.clrProRata.proRataEnabled === 'boolean') update['clrProRata.proRataEnabled'] = b.clrProRata.proRataEnabled;
      if (b.clrProRata.proRata) {
        if (b.clrProRata.proRata.col1 !== undefined) update['clrProRata.proRata.col1'] = clampNum(b.clrProRata.proRata.col1, 0);
        if (b.clrProRata.proRata.col2 !== undefined) update['clrProRata.proRata.col2'] = clampNum(b.clrProRata.proRata.col2, 0);
        if (b.clrProRata.proRata.col3 !== undefined) update['clrProRata.proRata.col3'] = clampNum(b.clrProRata.proRata.col3, 0);
      }
    }
    if (b.bonus) {
      if (b.bonus.type) update['bonus.type'] = b.bonus.type === 'percent' ? 'percent' : 'perLitre';
      if (b.bonus.perLitre !== undefined) update['bonus.perLitre'] = clampNum(b.bonus.perLitre, 0);
      if (b.bonus.percent !== undefined) update['bonus.percent'] = clampNum(b.bonus.percent, 0);
    }

    let doc = await MilkRateSettings.findOne({ owner: req.user._id });
    if (!doc) doc = await MilkRateSettings.create({ owner: req.user._id });
    // apply dotted updates
    for (const k in update) {
      const parts = k.split('.');
      let cur = doc;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!cur[parts[i]]) cur[parts[i]] = {};
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = update[k];
    }
    await doc.save();
    res.json({ success: true, response: doc });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
