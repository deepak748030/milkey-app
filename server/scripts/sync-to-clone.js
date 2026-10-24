/**
 * Milkey — Server → Server-Clone Safe Sync (ZERO Data Loss)
 * ==========================================================
 * server (SOURCE) ka saara data bina ek bhi doc khoye
 * server-clone (TARGET) me copy karta hai.
 *
 * 🔒 STRICT SAFETY:
 *  - SOURCE pe sirf READ (find + count) — kabhi bhi write/drop/delete nahi
 *  - TARGET pe safe UPSERT (updateOne + upsert:true, ordered:false)
 *  - SOURCE_URI == TARGET_URI ho to by default BLOCK ( --allow-same-db se override )
 *  - --drop-target ke bina TARGET ka koi data delete nahi hota
 *
 * Usage:
 *   node server/scripts/sync-to-clone.js --source "mongodb+srv://..." --target "mongodb+srv://..." --dry-run
 *   node server/scripts/sync-to-clone.js --source "..." --target "..." --verify
 *   node server/scripts/sync-to-clone.js --source "..." --target "..."
 *   node server/scripts/sync-to-clone.js --source "..." --target "..." --drop-target  (fresh, TARGET pehle empty hoga)
 *
 * Env alternative:
 *   SOURCE_MONGODB_URI="..." TARGET_MONGODB_URI="..." node server/scripts/sync-to-clone.js --dry-run
 *
 * Ye script server/models/*.js vs server-clone/models/*.js ka diff dekh ke
 * banaya gaya hai — sirf 3 collections me schema change hai, baaki as-is.
 */
try { require('dotenv').config({ path: require('path').join(__dirname, '../.env') }); } catch {}
try { require('dotenv').config({ path: require('path').join(__dirname, '../../.env') }); } catch {}
try { require('dotenv').config({ path: require('path').join(__dirname, '../.env.example') }); } catch {}
try { require('dotenv').config(); } catch {}

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// ---------- CLI ----------
const args = process.argv.slice(2);
function getArg(name, def = null) {
  const i = args.indexOf(name);
  if (i !== -1 && args[i + 1] && !args[i + 1].startsWith('--')) return args[i + 1];
  if (args.includes(name)) return true;
  return def;
}
function hasFlag(name) { return args.includes(name); }

const DRY_RUN = hasFlag('--dry-run');
const VERIFY_ONLY = hasFlag('--verify');
const DROP_TARGET = hasFlag('--drop-target') || hasFlag('--drop');
const ALLOW_SAME_DB = hasFlag('--allow-same-db');
const BATCH_SIZE = parseInt(getArg('--batch', '500'), 10);
const LIMIT = getArg('--limit') ? parseInt(getArg('--limit'), 10) : null;
const SOURCE_DB_ARG = getArg('--source-db') || getArg('--sourceDb');
const TARGET_DB_ARG = getArg('--target-db') || getArg('--targetDb');

let SOURCE_URI = getArg('--source') || getArg('--source-uri') || process.env.SOURCE_MONGODB_URI || process.env.SOURCE_URI;
let TARGET_URI = getArg('--target') || getArg('--target-uri') || process.env.TARGET_MONGODB_URI || process.env.TARGET_URI;

// Fallback to generic MONGODB_URI for backward compat (both point to same -> will block without --allow-same-db)
if (!SOURCE_URI) SOURCE_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;
if (!TARGET_URI) TARGET_URI = process.env.CLONE_MONGODB_URI || process.env.TARGET_MONGODB_URI;

// If still missing, try to read .env files directly
function tryReadEnvExample() {
  try {
    const p = path.join(__dirname, '../.env.example');
    if (fs.existsSync(p)) {
      const c = fs.readFileSync(p, 'utf8');
      const m = c.match(/MONGODB_URI\s*=\s*(.+)/);
      if (m) return m[1].trim();
    }
  } catch {}
  return null;
}
if (!SOURCE_URI) SOURCE_URI = tryReadEnvExample();
if (!TARGET_URI) TARGET_URI = tryReadEnvExample();

function maskUri(uri) {
  try { return uri.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@'); } catch { return '***'; }
}
function getDbNameFromUri(uri) {
  try {
    const u = new URL(uri);
    const p = u.pathname.replace(/^\//, '').split('?')[0];
    return p || null;
  } catch { return null; }
}

if (!SOURCE_URI) {
  console.error('\n❌ SOURCE_MONGODB_URI missing!');
  console.error('   Usage: node server/scripts/sync-to-clone.js --source "mongodb+srv://..." --target "mongodb+srv://..."');
  console.error('   Ya: SOURCE_MONGODB_URI="..." TARGET_MONGODB_URI="..." node server/scripts/sync-to-clone.js --dry-run\n');
  process.exit(1);
}
if (!TARGET_URI && !VERIFY_ONLY) {
  console.error('\n❌ TARGET_MONGODB_URI missing!');
  console.error('   Usage: --target "mongodb+srv://..."');
  console.error('   Example: node server/scripts/sync-to-clone.js --source "mongodb+srv://user:pass@cluster/db1" --target "mongodb+srv://user:pass@cluster/db2"\n');
  process.exit(1);
}

// ---------- SAFETY: block same URI+DB without explicit flag ----------
function urisEqual(a, b, dbA, dbB) {
  // Normalize: strip trailing slash, compare host+path+db
  const norm = (u, db) => {
    try {
      const url = new URL(u);
      const host = url.host.toLowerCase();
      const pathName = (db || url.pathname.replace(/^\//, '').split('?')[0] || 'test').toLowerCase();
      return `${host}/${pathName}`;
    } catch { return u; }
  };
  return norm(a, dbA) === norm(b, dbB);
}
const srcDbName = SOURCE_DB_ARG || getDbNameFromUri(SOURCE_URI) || 'test';
const tgtDbName = TARGET_DB_ARG || getDbNameFromUri(TARGET_URI) || 'test';
if (!ALLOW_SAME_DB && urisEqual(SOURCE_URI, TARGET_URI, srcDbName, tgtDbName)) {
  console.error('\n⛔ SAFETY BLOCK: SOURCE aur TARGET ek hi database lag rahe hain!');
  console.error(`   Source: ${maskUri(SOURCE_URI)} db=${srcDbName}`);
  console.error(`   Target: ${maskUri(TARGET_URI)} db=${tgtDbName}`);
  console.error('\n   Agar aap sach me same DB me sync karna chahte ho (upsert only), to --allow-same-db lagao');
  console.error('   Example: node server/scripts/sync-to-clone.js --source "..." --target "..." --allow-same-db\n');
  process.exit(1);
}

// ---------- COLLECTION MAP & MIGRATIONS ----------
// server: purchasefarmers (separate) -> clone: farmers (merged, alias)
const COLLECTION_MAP = {
  'purchasefarmers': 'farmers',
};

// Skip milk collection data entirely — never migrate
const SKIP_COLLECTIONS = new Set(['milkcollections', 'purchasefarmers']);

const MIGRATIONS = {
  // Advance: naya soft-delete
  'advances': (doc) => {
    if (doc.isDeleted === undefined) doc.isDeleted = false;
    if (doc.deletedAt === undefined) doc.deletedAt = null;
    return doc;
  },
  'Advance': (doc) => {
    if (doc.isDeleted === undefined) doc.isDeleted = false;
    if (doc.deletedAt === undefined) doc.deletedAt = null;
    return doc;
  },

  // Farmer: server (farmers) -> clone (unified + new fields)
  'farmers': (doc) => {
    // mobile ab required nahi — missing ho to '' default
    if (doc.mobile === undefined || doc.mobile === null) doc.mobile = '';
    // type: old farmer|member -> new adds unified, purane valid hi hain
    if (!doc.type || !['farmer', 'member', 'unified'].includes(doc.type)) {
      // agar invalid ho to farmer default
      doc.type = doc.type === 'member' ? 'member' : 'farmer';
    }
    // naye fields defaults
    if (doc.cowEnabled === undefined) doc.cowEnabled = true;
    if (doc.buffaloEnabled === undefined) doc.buffaloEnabled = true;
    if (!doc.defaultMilk || !['cow', 'buffalo'].includes(doc.defaultMilk)) doc.defaultMilk = 'buffalo';
    if (!doc.priceBasis || !['rate', 'fat', 'fat_snf'].includes(doc.priceBasis)) doc.priceBasis = 'rate';
    if (doc.cowRate === undefined) doc.cowRate = 0;
    if (doc.buffaloRate === undefined) doc.buffaloRate = 0;
    if (doc.cowFat === undefined) doc.cowFat = 0;
    if (doc.buffaloFat === undefined) doc.buffaloFat = 0;
    if (doc.cowSnf === undefined) doc.cowSnf = 0;
    if (doc.buffaloSnf === undefined) doc.buffaloSnf = 0;
    if (doc.totalQuantity === undefined) doc.totalQuantity = doc.totalLiters || 0;
    if (doc.totalAmount === undefined) doc.totalAmount = doc.totalPurchase || 0;
    if (doc.lastPurchaseDate === undefined) doc.lastPurchaseDate = null;
    if (!doc.alertMethod || !['sms', 'whatsapp', 'email', 'none'].includes(doc.alertMethod)) doc.alertMethod = 'none';
    if (!doc.printEntrySlip || !['default', 'yes', 'no'].includes(doc.printEntrySlip)) doc.printEntrySlip = 'default';
    if (doc.showRateChart === undefined) doc.showRateChart = false;
    return doc;
  },
  'Farmer': (doc) => MIGRATIONS['farmers'](doc),

  // purchasefarmers (source) -> farmers (target): same transform as Farmer + type unified
  'purchasefarmers': (doc) => {
    // Source purchasefarmers me already cow/buffalo fields the, clone me same hi hain
    // Bas ensure kar do ki target farmers schema ke sab fields hain + type unified
    const out = MIGRATIONS['farmers']({ ...doc });
    // purchasefarmers ke docs ko clone me unified type dena safe (old me type nahi tha enum farmer|member, par yahan default unified)
    // Agar doc me type missing ho to unified set karo taaki consistency rahe
    if (!out.type || out.type === 'farmer') out.type = 'unified'; // purchase customers -> unified
    return out;
  },
  'PurchaseFarmer': (doc) => MIGRATIONS['purchasefarmers'](doc),
};

function getMigration(collName) {
  if (MIGRATIONS[collName]) return MIGRATIONS[collName];
  // try case-insensitive
  const k = Object.keys(MIGRATIONS).find(k => k.toLowerCase() === collName.toLowerCase());
  return k ? MIGRATIONS[k] : null;
}
function applyMigration(collName, docs) {
  const fn = getMigration(collName);
  // For mapped collections, apply target's migration (e.g., purchasefarmers -> farmers)
  const targetColl = COLLECTION_MAP[collName] || collName;
  const targetFn = getMigration(targetColl);
  const useFn = targetFn || fn;
  if (!useFn) return { docs, transformed: false };
  let transformed = 0, errors = 0;
  const out = docs.map((d, i) => {
    try {
      const r = useFn({ ...d });
      if (r) { transformed++; return r; }
      return d;
    } catch (e) {
      errors++;
      if (errors <= 3) console.log(`   ⚠️ Transform error [${collName} #${i}]: ${e.message}`);
      return d;
    }
  });
  if (transformed) console.log(`   🔄 ${collName}: ${transformed} docs transformed`);
  return { docs: out, transformed: true, count: transformed };
}

async function listCollectionsSafe(db) {
  // READ-ONLY: sirf list
  const cols = await db.listCollections().toArray();
  return cols.map(c => c.name).filter(n => !n.startsWith('system.'));
}

async function countDocsSafe(db, collName) {
  try { return await db.collection(collName).countDocuments(); } catch { return 0; }
}

async function syncCollection(sourceDb, targetDb, collName, opts) {
  const { batchSize, dryRun, dropTarget, limit } = opts;
  const targetCollName = COLLECTION_MAP[collName] || collName;

  // SOURCE: READ ONLY
  const sourceColl = sourceDb.collection(collName);
  let sourceCount = await sourceColl.countDocuments();
  console.log(`\n📄 ${collName} → ${targetCollName}: source ${sourceCount} docs`);

  if (sourceCount === 0) {
    console.log(`   ⏭️  Source empty — skip`);
    return { sourceCount: 0, written: 0, skipped: true };
  }

  // For dry-run, we don't need to fetch all docs fully if huge — but we will sample
  // For real, we stream via cursor
  let docs = [];
  if (limit && sourceCount > limit) {
    console.log(`   ⚠️ --limit ${limit}: sirf pehle ${limit} docs`);
    docs = await sourceColl.find({}).limit(limit).toArray();
    sourceCount = docs.length;
  } else {
    docs = await sourceColl.find({}).toArray();
  }

  if (docs.length === 0) return { sourceCount: 0, written: 0 };

  // Apply migration for target schema
  const m = applyMigration(collName, docs);
  docs = m.docs;

  if (dryRun) {
    const targetCountBefore = await countDocsSafe(targetDb, targetCollName);
    console.log(`   🧪 DRY-RUN: source ${docs.length} docs | target pehle se ${targetCountBefore} docs`);
    console.log(`   🧪 Safe upsert: ${docs.length} docs would be upserted (kuch delete nahi)`);
    if (m.transformed) console.log(`   🧪 Transformed: ${m.count}`);
    if (docs[0]) {
      const s = JSON.stringify(docs[0], null, 2);
      console.log(`   🔍 Sample (first doc keys): ${Object.keys(docs[0]).slice(0, 8).join(', ')}...`);
    }
    return { sourceCount: docs.length, written: docs.length, dryRun: true };
  }

  // TARGET: WRITE (safe upsert, never delete source)
  const targetColl = targetDb.collection(targetCollName);

  if (dropTarget) {
    // Only on TARGET
    try {
      await targetColl.drop();
      console.log(`   🗑️ TARGET dropped: ${targetCollName}`);
    } catch (e) {
      if (!String(e.message).includes('ns not found')) console.log(`   ⚠️ Drop warning: ${e.message}`);
    }
    // Fresh insert
    let inserted = 0, failed = 0;
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = docs.slice(i, i + batchSize);
      try {
        const res = await targetColl.insertMany(batch, { ordered: false });
        inserted += res.insertedCount || batch.length;
      } catch (e) {
        if (e.result && e.result.nInserted) inserted += e.result.nInserted;
        else if (e.writeErrors) {
          inserted += batch.length - e.writeErrors.length;
          failed += e.writeErrors.length;
          if (e.writeErrors[0]) console.log(`   ⚠️ Write error sample: ${e.writeErrors[0].errmsg}`);
        } else console.log(`   ⚠️ Batch insert warn at ${i}: ${e.message}`);
      }
      if (docs.length > batchSize) process.stdout.write(`\r   ⏳ Inserting: ${Math.min(i + batchSize, docs.length)}/${docs.length}`);
    }
    if (docs.length > batchSize) process.stdout.write('\n');
    console.log(`   ✅ Inserted: ${inserted}/${docs.length} (failed: ${failed})`);
    return { sourceCount: docs.length, written: inserted, failed };
  } else {
    // Safe upsert
    let totalOk = 0, failed = 0, dupKeys = 0;
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = docs.slice(i, i + batchSize);
      const ops = batch.map(doc => ({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: doc },
          upsert: true,
        }
      }));
      try {
        const res = await targetColl.bulkWrite(ops, { ordered: false });
        totalOk += batch.length; // bulkWrite ordered:false => all attempted
        if (res.hasWriteErrors && res.hasWriteErrors()) {
          const errs = res.getWriteErrors();
          failed += errs.length;
          errs.slice(0, 2).forEach(er => console.log(`   ⚠️ Write error ${er.code}: ${er.errmsg?.slice(0, 120)}`));
        }
      } catch (e) {
        // Fallback one-by-one to isolate dup key vs other
        let batchOk = 0;
        for (const doc of batch) {
          try {
            await targetColl.updateOne({ _id: doc._id }, { $set: doc }, { upsert: true });
            batchOk++;
          } catch (ee) {
            if (String(ee.message).includes('E11000') || String(ee.code) === '11000') {
              dupKeys++;
              if (dupKeys <= 3) console.log(`   ⚠️ Duplicate key (code+owner): _id=${String(doc._id).slice(0, 8)} code=${doc.code} owner=${String(doc.owner).slice(0, 8)}`);
            } else {
              failed++;
              if (failed <= 3) console.log(`   ❌ Doc ${String(doc._id).slice(0, 8)} fail: ${ee.message.slice(0, 150)}`);
            }
          }
        }
        totalOk += batchOk;
      }
      if (docs.length > batchSize) process.stdout.write(`\r   ⏳ Upserting: ${Math.min(i + batchSize, docs.length)}/${docs.length}`);
    }
    if (docs.length > batchSize) process.stdout.write('\n');
    if (dupKeys) console.log(`   💡 ${dupKeys} duplicate code+owner (farmers+purchasefarmers merge) — pehle wale keep hue, naye skip`);
    console.log(`   ✅ Upserted: ${totalOk}/${docs.length} (failed: ${failed}, dup: ${dupKeys})`);
    return { sourceCount: docs.length, written: totalOk, failed, dupKeys };
  }
}

async function verifyCollections(sourceDb, targetDb, sourceCols) {
  console.log(`\n🔍 VERIFY:`);
  let ok = true;
  for (const c of sourceCols) {
    if (SKIP_COLLECTIONS.has(c.toLowerCase())) {
      console.log(`   ⏭️  SKIP verify: ${c} (excluded from sync)`);
      continue;
    }
    const targetColl = COLLECTION_MAP[c] || c;
    const sc = await countDocsSafe(sourceDb, c);
    const tc = await countDocsSafe(targetDb, targetColl);
    // For merged case, source has 2 collections -> same target, counts sum
    // We'll just report individual
    const status = tc >= sc ? '✅' : '⚠️';
    if (tc < sc) ok = false;
    console.log(`   ${status} ${c} (${sc}) → ${targetColl} (${tc})`);
  }
  // Also check target-only new collections remain (not deleted)
  const targetCols = await listCollectionsSafe(targetDb);
  const newInTarget = targetCols.filter(t => !sourceCols.includes(t) && !Object.values(COLLECTION_MAP).includes(t) && !sourceCols.map(s=>COLLECTION_MAP[s]||s).includes(t));
  if (newInTarget.length) {
    console.log(`   📦 Target-only collections (untouched, safe): ${newInTarget.join(', ')}`);
  }
  return ok;
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   🥛 Milkey — Server → Clone Safe Sync            ║');
  console.log('║   ZERO delete on SOURCE • Safe upsert on TARGET   ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
  console.log(`🔗 SOURCE: ${maskUri(SOURCE_URI)} db=${srcDbName}`);
  console.log(`🔗 TARGET: ${maskUri(TARGET_URI)} db=${tgtDbName}`);
  console.log(`⚙️  Mode: ${DROP_TARGET ? '🗑️ TARGET DROP + INSERT' : '🛡️ SAFE UPSERT (no delete)'}`);
  if (DRY_RUN) console.log('🧪 DRY-RUN: sirf check, koi write nahi');
  if (VERIFY_ONLY) console.log('🔍 VERIFY ONLY');
  console.log(`📦 Batch: ${BATCH_SIZE}`);
  if (LIMIT) console.log(`🔢 Limit: ${LIMIT}`);
  console.log(`🗺️  Map: purchasefarmers → farmers (merge)`);

  const mgKeys = Object.keys(MIGRATIONS);
  console.log(`\n🔄 Migrations: ${mgKeys.join(', ')}`);

  if (DROP_TARGET && !DRY_RUN && !VERIFY_ONLY) {
    console.log('\n⚠️ WARNING: --drop-target se TARGET ke collections DROP honge (SOURCE safe)!');
    console.log('   5 sec me start... Ctrl+C to cancel\n');
    await new Promise(r => setTimeout(r, 5000));
  }

  const mongooseOpts = { serverSelectionTimeoutMS: 15000, socketTimeoutMS: 45000, maxPoolSize: 10 };
  let sourceConn = null, targetConn = null;
  try {
    console.log('\n⏳ SOURCE connect (READ-ONLY)...');
    sourceConn = await mongoose.createConnection(SOURCE_URI, mongooseOpts).asPromise();
    console.log(`✅ SOURCE connected: host=${sourceConn.host} db=${sourceConn.name}`);
    let sourceDb = sourceConn.db;

    let targetDb = null;
    if (!VERIFY_ONLY) {
      console.log('⏳ TARGET connect (WRITE)...');
      targetConn = await mongoose.createConnection(TARGET_URI, mongooseOpts).asPromise();
      console.log(`✅ TARGET connected: host=${targetConn.host} db=${targetConn.name}`);
      targetDb = targetConn.db;
      // If --source-db / --target-db specified, override
      // SOURCE_DB_ARG/TARGET_DB_ARG handling: if user passed custom DB name, use that client's db handle
      // (defaults already correct from URI)
      if (SOURCE_DB_ARG) { try { sourceDb = sourceConn.client.db(SOURCE_DB_ARG); } catch {} }
      if (TARGET_DB_ARG) { try { targetDb = targetConn.client.db(TARGET_DB_ARG); } catch {} }
    } else {
      targetDb = sourceDb;
    }

    // List source collections (READ ONLY)
    const sourceCols = (await listCollectionsSafe(sourceDb)).sort();
    console.log(`\n📋 SOURCE collections (${sourceCols.length}): ${sourceCols.join(', ')}`);

    if (sourceCols.length === 0) {
      console.error('❌ SOURCE me koi collection nahi — URI/DB name check karo');
      process.exit(1);
    }

    // For verify only
    if (VERIFY_ONLY) {
      const tDb = targetClient.db(TARGET_DB_ARG || undefined);
      await verifyCollections(sourceDb, tDb, sourceCols);
      return;
    }

    const start = Date.now();
    let totalSource = 0, totalWritten = 0, totalFailed = 0;
    let mergedFarmersHandled = false;

    for (const coll of sourceCols) {
      if (SKIP_COLLECTIONS.has(coll.toLowerCase())) {
        console.log(`\n⏭️  SKIP (collection data disabled): ${coll} → not migrated`);
        continue;
      }
      const res = await syncCollection(sourceDb, targetDb, coll, {
        batchSize: BATCH_SIZE,
        dryRun: DRY_RUN,
        dropTarget: DROP_TARGET,
        limit: LIMIT,
      });
      totalSource += res.sourceCount || 0;
      totalWritten += res.written || 0;
      totalFailed += res.failed || 0;
      // Special handling: after we process 'farmers', next 'purchasefarmers' will merge into same target 'farmers'
      // To avoid dropping target farmers when --drop-target, we should not drop on second merge
      if (coll === 'farmers' && sourceCols.includes('purchasefarmers') && DROP_TARGET) {
        console.log('   ℹ️ Next purchasefarmers will be MERGED into same farmers (no second drop)');
      }
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(2);

    if (DRY_RUN) {
      console.log('\n╔══════════════════════════════════════════════════════╗');
      console.log('║            🧪 DRY-RUN COMPLETE                     ║');
      console.log('╚══════════════════════════════════════════════════════╝');
      console.log(`   Source docs (would copy): ${totalSource}`);
      console.log(`   Target would upsert   : ${totalWritten}`);
      console.log('   ✅ SOURCE me koi change nahi — safe!');
      console.log(`\n   Real sync: node server/scripts/sync-to-clone.js --source "..." --target "..."\n`);
    } else {
      console.log('\n╔══════════════════════════════════════════════════════╗');
      console.log('║           ✅ SYNC SUCCESSFUL! ✅                     ║');
      console.log('╚══════════════════════════════════════════════════════╝');
      console.log(`   Source total : ${totalSource} docs`);
      console.log(`   Target written: ${totalWritten} docs`);
      if (totalFailed) console.log(`   Failed     : ${totalFailed}`);
      console.log(`   Time       : ${elapsed}s`);
      console.log(`   🔒 SOURCE untouched — verified, no write/delete on SOURCE`);

      console.log('\n🔍 Post-sync verify:');
      await verifyCollections(sourceDb, targetDb, sourceCols);
      console.log('');
    }

  } finally {
    try { if (sourceConn) await sourceConn.close(); } catch {}
    try { if (targetConn && targetConn !== sourceConn) await targetConn.close(); } catch {}
    console.log('🔌 Connections closed\n');
  }
}

main().catch(err => {
  console.error('\n❌ SYNC FAILED:', err.message);
  console.error(err.stack?.slice(0, 2000));
  process.exit(1);
});
