/**
 * Milkey - AI-Powered MongoDB Migration Script
 * ==============================================
 * Model change ke baad backup ko naye schema pe migrate karta hai
 * Bina ek bhi document khoye, bina validation error ke.
 *
 * YE FILE AI KE LIYE HAI:
 *  - AI is file ke MIGRATIONS object me transform functions likhega
 *  - Har collection jiska model change hua hai, uske liye ek function
 *  - Native MongoDB driver use hota hai → Mongoose validation bypass → error nahi
 *
 * Usage:
 *   node server/scripts/migrate.js --in ./backups/backup-2026-01-01T10-00-00-000Z --dry-run  (pehle check)
 *   node server/scripts/migrate.js --in ./backups/backup-...                                (safe upsert)
 *   node server/scripts/migrate.js --in ./backups/backup-... --drop                         (fresh migrate)
 *   node server/scripts/migrate.js --in ./backups/backup-... --verify                       (sirf verify)
 *
 * AI Workflow:
 *   1) server/models/*.js dekho — kya change hua
 *   2) Niche MIGRATIONS me har changed collection ka transform likho
 *   3) --dry-run se test karo
 *   4) --verify se counts check karo
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
require('dotenv').config();

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { EJSON } = require('bson');

// ============================================================
//  🤖 AI — YAHAN MIGRATIONS LIKHO
// ============================================================
// Har key = collection name (jaise file name bina .json ke)
// Value = function(oldDoc) => newDoc
// oldDoc = backup ka purana document
// newDoc = naye schema ke hisaab se transformed document
//
// RULES:
//  - _id ko kabhi change mat karo
//  - createdAt/updatedAt ko preserve karo
//  - Naye required fields ko default value do
//  - Rename: purane field ko naye me copy, purana delete
//  - Type change: Number(), String() se convert
//  - Enum: purane invalid values ko valid pe map karo
//
// Agar koi collection change nahi hui to yaha entry mat karo — wo as-is upsert hogi.
//
// EXAMPLE (AI isko edit karega):
const MIGRATIONS = {

    // --------------------------------------------------------
    // Example 1: User me phone -> phoneNumber rename + naya required field
    // --------------------------------------------------------
    // User: (doc) => {
    //     // Rename: phone -> phoneNumber
    //     if (doc.phone && !doc.phoneNumber) {
    //         doc.phoneNumber = doc.phone;
    //         delete doc.phone;
    //     }
    //     // Naya required field
    //     if (!doc.kycStatus) doc.kycStatus = 'pending';
    //     // Type fix
    //     if (doc.referralEarnings && typeof doc.referralEarnings === 'string') {
    //         doc.referralEarnings = Number(doc.referralEarnings) || 0;
    //     }
    //     return doc;
    // },

    // --------------------------------------------------------
    // Example 2: Farmer me type enum me naya value
    // --------------------------------------------------------
    // Farmer: (doc) => {
    //     // Agar purane docs me type 'premium' nahi tha aur ab allowed hai, koi change nahi
    //     // Par agar purana invalid value hai to map karo:
    //     const validTypes = ['farmer', 'member', 'premium'];
    //     if (!validTypes.includes(doc.type)) doc.type = 'farmer';
    //     return doc;
    // },

    // --------------------------------------------------------
    // Example 3: MilkCollection me naya field
    // --------------------------------------------------------
    // MilkCollection: (doc) => {
    //     if (!doc.quality) doc.quality = 'good'; // naya field default
    //     return doc;
    // },

    // --------------------------------------------------------
    // Example 4: PurchaseFarmer me field rename + type change
    // --------------------------------------------------------
    // PurchaseFarmer: (doc) => {
    //     if (doc.farmerName && !doc.name) {
    //         doc.name = doc.farmerName;
    //         delete doc.farmerName;
    //     }
    //     return doc;
    // },

    // --------------------------------------------------------
    // ✏️ AI: Yaha apne actual migrations likho
    //        Jab tak koi model change nahi hua, ye empty rahega
    //        aur saara data as-is migrate hoga (bina transform ke)
    // --------------------------------------------------------

};

// ============================================================
//  Internal — AI ko niche ka code change karne ki zarurat nahi
// ============================================================

const args = process.argv.slice(2);
function getArg(name, defaultValue = null) {
    const idx = args.indexOf(name);
    if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('--')) return args[idx + 1];
    if (args.includes(name)) return true;
    return defaultValue;
}
function hasFlag(name) { return args.includes(name); }

const INPUT_DIR = getArg('--in') || getArg('--input') || getArg('--dir');
const MONGODB_URI = getArg('--uri') || process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;
const DROP_MODE = hasFlag('--drop');
const DRY_RUN = hasFlag('--dry-run');
const VERIFY_ONLY = hasFlag('--verify');
const BATCH_SIZE = parseInt(getArg('--batch', '500'), 10);
const TARGET_DB = getArg('--db') || process.env.MONGODB_DB_NAME || null;
const LIMIT = getArg('--limit') ? parseInt(getArg('--limit'), 10) : null; // test ke liye: --limit 10

if (!INPUT_DIR) {
    console.error('\n❌ Backup folder nahi diya!');
    console.error('   Usage: node server/scripts/migrate.js --in ./backups/backup-2026-...\n');
    try {
        const base = path.join(__dirname, '../../backups');
        if (fs.existsSync(base)) {
            const list = fs.readdirSync(base).filter(f => f.startsWith('backup-'));
            if (list.length) {
                console.error('   Available backups:');
                list.forEach(f => console.error(`     - ${f}`));
                console.error('');
            }
        }
    } catch {}
    process.exit(1);
}
if (!MONGODB_URI && !VERIFY_ONLY) {
    console.error('\n❌ MONGODB_URI nahi mila! .env me set karo ya --uri se pass karo\n');
    process.exit(1);
}

function maskUri(uri) {
    try { return uri.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@'); } catch { return '***'; }
}
function isGzipped(filePath) { return filePath.endsWith('.gz'); }

async function readCollectionFile(filePath) {
    let raw;
    if (isGzipped(filePath)) {
        const gzBuffer = await fs.promises.readFile(filePath);
        raw = zlib.gunzipSync(gzBuffer).toString('utf-8');
    } else {
        raw = await fs.promises.readFile(filePath, 'utf-8');
    }
    const parsed = EJSON.parse(raw, { relaxed: false });
    return Array.isArray(parsed) ? parsed : [];
}

async function discoverBackupStructure(inputDir) {
    const entries = await fs.promises.readdir(inputDir, { withFileTypes: true });
    const subDirs = entries.filter(e => e.isDirectory());
    const files = entries.filter(e => e.isFile() && e.name.endsWith('.json') && !e.name.startsWith('_'));
    let metadata = null;
    const metaPath = path.join(inputDir, '_metadata.json');
    if (fs.existsSync(metaPath)) {
        try { metadata = JSON.parse(await fs.promises.readFile(metaPath, 'utf-8')); } catch {}
    }
    const metaGzPath = path.join(inputDir, '_metadata.json.gz');
    if (!metadata && fs.existsSync(metaGzPath)) {
        try {
            const gz = await fs.promises.readFile(metaGzPath);
            metadata = JSON.parse(zlib.gunzipSync(gz).toString('utf-8'));
        } catch {}
    }
    if (subDirs.length > 0 && files.length === 0) {
        const dbBackups = [];
        for (const d of subDirs) {
            const dbDir = path.join(inputDir, d.name);
            const dbFiles = (await fs.promises.readdir(dbDir)).filter(f =>
                (f.endsWith('.json') || f.endsWith('.json.gz')) && !f.includes('.indexes.') && !f.startsWith('_')
            );
            dbBackups.push({ dbName: d.name, dir: dbDir, files: dbFiles });
        }
        return { type: 'multi-db', dbBackups, metadata };
    } else {
        const allFiles = files.map(f => f.name);
        const gzFiles = entries.filter(e => e.isFile() && e.name.endsWith('.json.gz') && !e.name.includes('.indexes.') && !e.name.startsWith('_'));
        gzFiles.forEach(f => allFiles.push(f.name));
        return { type: 'single-db', files: allFiles, dir: inputDir, metadata };
    }
}

function applyMigration(collectionName, docs) {
    const transform = MIGRATIONS[collectionName];
    if (!transform) return { docs, transformed: false, count: docs.length };

    console.log(`   🔄 Transform: ${collectionName} pe migration apply ho raha hai...`);
    let transformed = 0;
    let errors = 0;
    const newDocs = docs.map((doc, idx) => {
        try {
            const result = transform({ ...doc }); // shallow copy taaki original safe rahe
            if (result) { transformed++; return result; }
            return doc;
        } catch (e) {
            console.log(`   ⚠️  Transform error [${collectionName} #${idx} _id=${doc._id}]: ${e.message}`);
            errors++;
            return doc; // fail hua to original hi rakho
        }
    });
    console.log(`   🔄 ${collectionName}: ${transformed} docs transformed, ${errors} errors`);
    return { docs: newDocs, transformed: true, count: transformed, errors };
}

async function migrateCollection(db, filePath, collectionName, options = {}) {
    const { dropMode, dryRun, batchSize, limit } = options;
    let docs = await readCollectionFile(filePath);
    const originalCount = docs.length;

    if (limit && docs.length > limit) {
        console.log(`   ⚠️  --limit ${limit}: sirf pehle ${limit} docs test kar rahe hain (${originalCount} total)`);
        docs = docs.slice(0, limit);
    }

    console.log(`\n   📄 ${collectionName}: ${originalCount} docs in backup${limit ? ` (testing ${docs.length})` : ''}`);

    if (docs.length === 0) {
        console.log(`   ⏭️  Empty — skipping`);
        return { migrated: 0, skipped: true };
    }

    // Apply AI migrations
    const migrationResult = applyMigration(collectionName, docs);
    docs = migrationResult.docs;

    if (dryRun) {
        let existingCount = 0;
        try { existingCount = await db.collection(collectionName).countDocuments(); } catch {}
        console.log(`   🧪 DRY RUN — DB me ${existingCount} docs, backup me ${originalCount} docs`);
        if (migrationResult.transformed) console.log(`   🧪 ${migrationResult.count} docs transform hue`);
        if (dropMode) console.log(`   🧪 --drop: collection drop + ${docs.length} insert`);
        else console.log(`   🧪 Safe upsert: ${docs.length} docs`);

        // Sample: pehle 2 docs ka preview
        if (docs.length > 0) {
            console.log(`   🔍 Sample transformed doc (first):`);
            const sample = JSON.stringify(docs[0], null, 2);
            console.log('   ' + sample.split('\n').slice(0, 15).join('\n   ') + (sample.split('\n').length > 15 ? '\n   ...' : ''));
        }
        return { migrated: docs.length, dryRun: true };
    }

    const collection = db.collection(collectionName);

    if (dropMode) {
        try {
            await collection.drop();
            console.log(`   🗑️  Dropped: ${collectionName}`);
        } catch (e) {
            if (!e.message.includes('ns not found')) console.log(`   ⚠️  Drop warning: ${e.message}`);
        }
        let inserted = 0;
        let failed = 0;
        for (let i = 0; i < docs.length; i += batchSize) {
            const batch = docs.slice(i, i + batchSize);
            try {
                const res = await collection.insertMany(batch, { ordered: false });
                inserted += res.insertedCount || batch.length;
            } catch (e) {
                // insertMany with ordered:false may partially succeed
                if (e.result && e.result.nInserted) inserted += e.result.nInserted;
                else if (e.writeErrors) {
                    inserted += batch.length - e.writeErrors.length;
                    failed += e.writeErrors.length;
                    // Log first error for debugging
                    if (e.writeErrors[0]) console.log(`   ⚠️  Write error sample: ${e.writeErrors[0].errmsg || e.writeErrors[0].message}`);
                } else {
                    console.log(`   ⚠️  Batch insert warning at ${i}: ${e.message}`);
                }
            }
            if (docs.length > batchSize) process.stdout.write(`\r   ⏳ Inserting: ${Math.min(i + batchSize, docs.length)}/${docs.length}`);
        }
        if (docs.length > batchSize) process.stdout.write('\n');
        if (failed) console.log(`   ⚠️  Failed: ${failed} docs (duplicate key ya validation)`);
        console.log(`   ✅ Inserted: ${inserted}/${docs.length}`);
        return { migrated: inserted, failed };
    } else {
        // Safe upsert — native, validation bypass
        let totalOk = 0;
        let failed = 0;
        for (let i = 0; i < docs.length; i += batchSize) {
            const batch = docs.slice(i, i + batchSize);
            const ops = batch.map(doc => ({
                replaceOne: {
                    filter: { _id: doc._id },
                    replacement: doc,
                    upsert: true
                }
            }));
            try {
                const res = await collection.bulkWrite(ops, { ordered: false });
                totalOk += (res.upsertedCount || 0) + (res.modifiedCount || 0) + (res.matchedCount || 0);
                // bulkWrite counts can overlap; total processed = batch size if no errors
                if (res.hasWriteErrors && res.hasWriteErrors()) {
                    const errors = res.getWriteErrors();
                    failed += errors.length;
                    if (errors[0]) console.log(`   ⚠️  Write error: ${errors[0].errmsg}`);
                }
            } catch (e) {
                console.log(`   ⚠️  Bulk write warning at ${i}: ${e.message}`);
                // Fallback: one by one
                let batchOk = 0;
                for (const doc of batch) {
                    try {
                        await collection.replaceOne({ _id: doc._id }, doc, { upsert: true });
                        batchOk++;
                    } catch (ee) {
                        failed++;
                        if (failed <= 3) console.log(`   ❌ Doc ${String(doc._id).slice(0,8)}... fail: ${ee.message}`);
                    }
                }
                totalOk += batchOk;
            }
            if (docs.length > batchSize) process.stdout.write(`\r   ⏳ Upserting: ${Math.min(i + batchSize, docs.length)}/${docs.length}`);
        }
        if (docs.length > batchSize) process.stdout.write('\n');
        console.log(`   ✅ Migrated: ${docs.length} docs (failed: ${failed})`);
        if (failed) console.log(`   💡 Failed docs dekho — shayad transform me kuch missing hai`);
        return { migrated: docs.length - failed, failed };
    }
}

async function main() {
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║   🥛 Milkey - AI Migration (Model Change Safe)      ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    const absInput = path.resolve(INPUT_DIR);
    console.log(`📂 Backup folder: ${absInput}`);
    if (!VERIFY_ONLY) console.log(`🔗 MongoDB URI  : ${maskUri(MONGODB_URI)}`);
    console.log(`⚙️  Mode         : ${DROP_MODE ? '🗑️ DROP + INSERT (fresh)' : '🛡️ SAFE UPSERT (no delete)'}`);
    if (DRY_RUN) console.log(`🧪 DRY RUN     : Sirf check, kuch change nahi`);
    if (VERIFY_ONLY) console.log(`🔍 VERIFY ONLY : Sirf counts compare`);
    console.log(`📦 Batch size  : ${BATCH_SIZE}`);
    if (LIMIT) console.log(`🔢 Limit       : ${LIMIT} docs per collection (test)`);
    if (TARGET_DB) console.log(`🎯 Target DB   : ${TARGET_DB}`);

    const migrationKeys = Object.keys(MIGRATIONS);
    if (migrationKeys.length > 0) {
        console.log(`\n🔄 Migrations active for: ${migrationKeys.join(', ')}`);
    } else {
        console.log(`\n📋 No custom migrations — saara data as-is migrate hoga`);
        console.log(`   (AI ko bolo: server/scripts/migrate.js me MIGRATIONS likhne ke liye)`);
    }

    if (!fs.existsSync(absInput)) {
        console.error(`\n❌ Folder exist nahi karta: ${absInput}`);
        process.exit(1);
    }

    const structure = await discoverBackupStructure(absInput);
    console.log(`\n📋 Backup type: ${structure.type}`);
    if (structure.metadata) {
        console.log(`   Created: ${structure.metadata.createdAt}`);
        console.log(`   Total docs: ${structure.metadata.totalDocs}`);
        console.log(`   Collections: ${structure.metadata.totalCollections}`);
    }

    if (DROP_MODE && !DRY_RUN && !VERIFY_ONLY) {
        console.log('\n⚠️  WARNING: --drop mode me collections DROP hongi!');
        console.log('   5 second me shuru... Ctrl+C se rok sakte ho\n');
        await new Promise(r => setTimeout(r, 5000));
    }

    let conn = null;
    if (!VERIFY_ONLY) {
        console.log('\n⏳ MongoDB connect ho raha hai...');
        conn = await mongoose.createConnection(MONGODB_URI, {
            serverSelectionTimeoutMS: 15000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
        }).asPromise();
        console.log(`✅ Connected! Host: ${conn.host} | DB: ${conn.name}`);
    } else {
        console.log('\n⏳ MongoDB connect (verify)...');
        conn = await mongoose.createConnection(MONGODB_URI, {
            serverSelectionTimeoutMS: 15000,
        }).asPromise();
        console.log(`✅ Connected! DB: ${conn.name}`);
    }

    const startTime = Date.now();
    let totalMigrated = 0;
    let totalCollections = 0;
    let totalFailed = 0;

    try {
        const handleDB = async (db, files, dir) => {
            console.log(`\n${'═'.repeat(60)}`);
            console.log(`📦 Database: ${db.databaseName} (${files.length} collections)`);
            console.log('═'.repeat(60));

            for (const fileName of files) {
                const collName = fileName.replace(/\.json(\.gz)?$/, '');
                const filePath = path.join(dir, fileName);

                if (VERIFY_ONLY) {
                    try {
                        const backupDocs = await readCollectionFile(filePath);
                        const liveCount = await db.collection(collName).countDocuments();
                        const ok = backupDocs.length === liveCount ? '✅' : backupDocs.length < liveCount ? '⚠️ (DB me zyada)' : '⚠️ (backup me zyada)';
                        console.log(`   ${ok} ${collName}: backup ${backupDocs.length} → live ${liveCount}`);
                    } catch (e) { console.log(`   ❓ ${fileName}: ${e.message}`); }
                    totalCollections++;
                    continue;
                }

                const res = await migrateCollection(db, filePath, collName, { dropMode: DROP_MODE, dryRun: DRY_RUN, batchSize: BATCH_SIZE, limit: LIMIT });
                totalMigrated += res.migrated || 0;
                totalFailed += res.failed || 0;
                totalCollections++;
            }
        };

        if (structure.type === 'multi-db') {
            for (const dbBackup of structure.dbBackups) {
                const dbName = TARGET_DB || dbBackup.dbName;
                const db = conn.client.db(dbName);
                await handleDB(db, dbBackup.files, dbBackup.dir);
            }
        } else {
            const db = TARGET_DB ? conn.client.db(TARGET_DB) : conn.db;
            await handleDB(db, structure.files, structure.dir);
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

        if (VERIFY_ONLY) {
            console.log('\n╔══════════════════════════════════════════════════════╗');
            console.log('║              🔍 VERIFY COMPLETE                    ║');
            console.log('╚══════════════════════════════════════════════════════╝');
            console.log(`   Collections checked: ${totalCollections}\n`);
        } else if (DRY_RUN) {
            console.log('\n╔══════════════════════════════════════════════════════╗');
            console.log('║            🧪 DRY RUN COMPLETE                     ║');
            console.log('╚══════════════════════════════════════════════════════╝');
            console.log(`   Collections: ${totalCollections}`);
            console.log(`   Docs in backup: ${totalMigrated}`);
            console.log(`   Koi data change nahi hua`);
            console.log(`\n   ✅ Agar sab sahi lage to bina --dry-run ke chalao:`);
            console.log(`   node server/scripts/migrate.js --in "${absInput}"\n`);
        } else {
            console.log('\n╔══════════════════════════════════════════════════════╗');
            console.log('║           ✅ MIGRATION SUCCESSFUL! ✅              ║');
            console.log('╚══════════════════════════════════════════════════════╝');
            console.log(`   Collections: ${totalCollections}`);
            console.log(`   Migrated   : ${totalMigrated} docs`);
            if (totalFailed) console.log(`   Failed     : ${totalFailed} docs`);
            console.log(`   Time       : ${elapsed}s`);
            if (migrationKeys.length) console.log(`   Transforms : ${migrationKeys.join(', ')}`);

            console.log(`\n🔍 Post-migration verify:`);
            // Quick verify
            if (structure.type === 'multi-db') {
                for (const dbBackup of structure.dbBackups) {
                    const dbName = TARGET_DB || dbBackup.dbName;
                    const db = conn.client.db(dbName);
                    for (const fileName of dbBackup.files) {
                        const collName = fileName.replace(/\.json(\.gz)?$/, '');
                        const filePath = path.join(dbBackup.dir, fileName);
                        try {
                            const backupDocs = await readCollectionFile(filePath);
                            const expected = LIMIT ? Math.min(backupDocs.length, LIMIT) : backupDocs.length;
                            const liveCount = await db.collection(collName).countDocuments();
                            // For upsert mode, live may be >= backup
                            const status = liveCount >= expected ? '✅' : '⚠️';
                            console.log(`   ${status} ${dbName}.${collName}: backup ${expected} → live ${liveCount}`);
                        } catch (e) { console.log(`   ❓ ${collName}: ${e.message}`); }
                    }
                }
            } else {
                const db = TARGET_DB ? conn.client.db(TARGET_DB) : conn.db;
                for (const fileName of structure.files) {
                    const collName = fileName.replace(/\.json(\.gz)?$/, '');
                    const filePath = path.join(structure.dir, fileName);
                    try {
                        const backupDocs = await readCollectionFile(filePath);
                        const expected = LIMIT ? Math.min(backupDocs.length, LIMIT) : backupDocs.length;
                        const liveCount = await db.collection(collName).countDocuments();
                        const status = liveCount >= expected ? '✅' : '⚠️';
                        console.log(`   ${status} ${collName}: backup ${expected} → live ${liveCount}`);
                    } catch (e) { console.log(`   ❓ ${collName}: ${e.message}`); }
                }
            }
            console.log('');
            if (totalFailed) {
                console.log(`⚠️  ${totalFailed} docs fail hue — shayad transform me kuch missing hai`);
                console.log(`   Backup abhi bhi safe hai: ${absInput}`);
            }
        }

    } finally {
        if (conn) await conn.close();
        console.log('🔌 MongoDB closed\n');
    }
}

main().catch(err => {
    console.error('\n❌ MIGRATION FAILED:', err.message);
    console.error(err.stack);
    process.exit(1);
});
