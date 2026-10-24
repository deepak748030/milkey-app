/**
 * Milkey - MongoDB Restore Script (Zero Data Loss)
 * =================================================
 * Backup folder se saara data wapas MongoDB me restore karta hai
 * Bina data corrupt hue, safely.
 *
 * 2 Modes:
 *  1) SAFE MODE (default): Upsert — existing docs update, naye insert, kuch delete nahi hota
 *  2) DROP MODE (--drop): Pehle collection drop, phir fresh insert (pura wapas)
 *
 * Usage:
 *   node server/scripts/restore.js --in ./backups/backup-2024-01-01T10-00-00-000Z
 *   node server/scripts/restore.js --in ./backups/backup-... --dry-run   (sirf check)
 *   node server/scripts/restore.js --in ./backups/backup-... --drop      (fresh restore)
 *   node server/scripts/restore.js --in ./backups/backup-... --uri "mongodb+srv://..."
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
require('dotenv').config();

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { EJSON } = require('bson');

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
const BATCH_SIZE = parseInt(getArg('--batch', '500'), 10);
const TARGET_DB = getArg('--db') || process.env.MONGODB_DB_NAME || null;

if (!INPUT_DIR) {
    console.error('\n❌ Backup folder nahi diya!');
    console.error('   Usage: node server/scripts/restore.js --in ./backups/backup-2024-...'); 
    console.error('   List backups: ls ./backups/\n');
    // Try to list available backups
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
    } catch { }
    process.exit(1);
}
if (!MONGODB_URI) {
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

    // Check if this is a multi-DB backup (subdirectories per DB)
    const subDirs = entries.filter(e => e.isDirectory());
    const files = entries.filter(e => e.isFile() && e.name.endsWith('.json') && !e.name.startsWith('_'));

    // Metadata file
    let metadata = null;
    const metaPath = path.join(inputDir, '_metadata.json');
    if (fs.existsSync(metaPath)) {
        try { metadata = JSON.parse(await fs.promises.readFile(metaPath, 'utf-8')); } catch { }
    }
    // Handle gzipped metadata
    const metaGzPath = path.join(inputDir, '_metadata.json.gz');
    if (!metadata && fs.existsSync(metaGzPath)) {
        try {
            const gz = await fs.promises.readFile(metaGzPath);
            metadata = JSON.parse(zlib.gunzipSync(gz).toString('utf-8'));
        } catch { }
    }

    if (subDirs.length > 0 && files.length === 0) {
        // Multi-DB: each subdir is a DB
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
        // Single DB
        const allFiles = files.map(f => f.name);
        // Also check for .json.gz
        const gzFiles = entries.filter(e => e.isFile() && e.name.endsWith('.json.gz') && !e.name.includes('.indexes.') && !e.name.startsWith('_'));
        gzFiles.forEach(f => allFiles.push(f.name));
        return { type: 'single-db', files: allFiles, dir: inputDir, metadata };
    }
}

async function restoreCollection(db, filePath, collectionName, options = {}) {
    const { dropMode, dryRun, batchSize } = options;
    const docs = await readCollectionFile(filePath);

    console.log(`\n   📄 ${collectionName}: ${docs.length} documents in backup`);

    if (docs.length === 0) {
        console.log(`   ⏭️  Empty collection — skipping`);
        return { restored: 0, skipped: true };
    }

    if (dryRun) {
        const existingCount = await db.collection(collectionName).countDocuments().catch(() => 0);
        console.log(`   🧪 DRY RUN — DB me abhi ${existingCount} docs hain, backup me ${docs.length} docs`);
        if (dropMode) console.log(`   🧪 --drop mode: collection drop + ${docs.length} insert hoga`);
        else console.log(`   🧪 Safe mode: ${docs.length} docs upsert honge (existing update, naye insert)`);
        return { restored: docs.length, dryRun: true };
    }

    const collection = db.collection(collectionName);

    if (dropMode) {
        try {
            await collection.drop();
            console.log(`   🗑️  Collection dropped: ${collectionName}`);
        } catch (e) {
            if (!e.message.includes('ns not found')) {
                console.log(`   ⚠️  Drop warning: ${e.message}`);
            }
        }
        // Batch insert
        let inserted = 0;
        for (let i = 0; i < docs.length; i += batchSize) {
            const batch = docs.slice(i, i + batchSize);
            try {
                const res = await collection.insertMany(batch, { ordered: false });
                inserted += res.insertedCount || batch.length;
            } catch (e) {
                // Handle duplicate key etc — try individual
                if (e.writeErrors) inserted += batch.length - e.writeErrors.length;
                else console.log(`   ⚠️  Batch insert warning at ${i}: ${e.message}`);
            }
            if (docs.length > batchSize) process.stdout.write(`\r   ⏳ Inserting: ${Math.min(i + batchSize, docs.length)}/${docs.length}`);
        }
        if (docs.length > batchSize) process.stdout.write('\n');
        console.log(`   ✅ Inserted: ${inserted}/${docs.length}`);
        return { restored: inserted };
    } else {
        // Safe mode: bulk upsert by _id
        let upserted = 0, modified = 0, inserted = 0;
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
                upserted += res.upsertedCount || 0;
                modified += res.modifiedCount || 0;
                // matched + upserted = total processed
            } catch (e) {
                console.log(`   ⚠️  Bulk write warning at batch ${i}: ${e.message}`);
                // Fallback: try one by one for failed batch
                for (const doc of batch) {
                    try {
                        await collection.replaceOne({ _id: doc._id }, doc, { upsert: true });
                        upserted++;
                    } catch (ee) {
                        console.log(`   ❌ Doc ${_idStr(doc._id)} fail: ${ee.message}`);
                    }
                }
            }
            if (docs.length > batchSize) process.stdout.write(`\r   ⏳ Upserting: ${Math.min(i + batchSize, docs.length)}/${docs.length}`);
        }
        if (docs.length > batchSize) process.stdout.write('\n');
        console.log(`   ✅ Done — Upserted: ${upserted}, Modified: ${modified}, Total: ${docs.length}`);
        return { restored: docs.length };
    }
}

function _idStr(id) { try { return String(id); } catch { return '?'; } }

async function restoreIndexes(db, backupDir, collectionName) {
    // Try to restore indexes from .indexes.json
    const idxPaths = [
        path.join(backupDir, `${collectionName}.indexes.json`),
        path.join(backupDir, `${collectionName}.indexes.json.gz`),
        path.join(backupDir, `${collectionName}.json.indexes.json`),
    ];
    for (const p of idxPaths) {
        if (fs.existsSync(p)) {
            try {
                let raw = isGzipped(p) ? zlib.gunzipSync(await fs.promises.readFile(p)).toString('utf-8') : await fs.promises.readFile(p, 'utf-8');
                const indexes = JSON.parse(raw);
                if (!indexes.length) return 0;
                const coll = db.collection(collectionName);
                for (const idx of indexes) {
                    // Skip _id index (auto-created)
                    if (idx.name === '_id_') continue;
                    try {
                        await coll.createIndex(idx.key, {
                            name: idx.name,
                            unique: idx.unique || false,
                            sparse: idx.sparse || false,
                            expireAfterSeconds: idx.expireAfterSeconds,
                            partialFilterExpression: idx.partialFilterExpression,
                            collation: idx.collation,
                        });
                    } catch (e) {
                        // Index may already exist
                    }
                }
                console.log(`   🔑 Indexes restored: ${indexes.length - 1} (excluding _id_)`);
                return indexes.length;
            } catch (e) {
                console.log(`   ⚠️  Index restore fail: ${e.message}`);
            }
        }
    }
    return 0;
}

async function main() {
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║   🥛 Milkey - MongoDB Restore (Zero Data Loss)     ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    const absInput = path.resolve(INPUT_DIR);
    console.log(`📂 Backup folder: ${absInput}`);
    console.log(`🔗 MongoDB URI  : ${maskUri(MONGODB_URI)}`);
    console.log(`⚙️  Mode         : ${DROP_MODE ? '🗑️ DROP + INSERT (fresh)' : '🛡️ SAFE UPSERT (no data delete)'}`);
    if (DRY_RUN) console.log(`🧪 DRY RUN     : Sirf check, kuch change nahi hoga`);
    console.log(`📦 Batch size  : ${BATCH_SIZE}`);
    if (TARGET_DB) console.log(`🎯 Target DB   : ${TARGET_DB}`);

    if (!fs.existsSync(absInput)) {
        console.error(`\n❌ Folder exist nahi karta: ${absInput}`);
        process.exit(1);
    }

    const structure = await discoverBackupStructure(absInput);
    console.log(`\n📋 Backup type: ${structure.type}`);
    if (structure.metadata) {
        console.log(`   Created: ${structure.metadata.createdAt}`);
        console.log(`   Total docs in backup: ${structure.metadata.totalDocs}`);
        console.log(`   Collections: ${structure.metadata.totalCollections}`);
    }

    // Safety confirmation for --drop without --dry-run
    if (DROP_MODE && !DRY_RUN) {
        console.log('\n⚠️  WARNING: --drop mode me collections DROP hongi!');
        console.log('   Agar galti se chal gaya to data delete ho sakta hai.');
        console.log('   5 second me shuru hoga... Ctrl+C se rok sakte ho\n');
        await new Promise(r => setTimeout(r, 5000));
    }

    console.log('\n⏳ MongoDB se connect ho rahe hain...');
    const conn = await mongoose.createConnection(MONGODB_URI, {
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
    }).asPromise();
    console.log(`✅ Connected! Host: ${conn.host} | DB: ${conn.name}`);

    const startTime = Date.now();
    let totalRestored = 0;
    let totalCollections = 0;

    try {
        if (structure.type === 'multi-db') {
            for (const dbBackup of structure.dbBackups) {
                const dbName = TARGET_DB || dbBackup.dbName;
                const db = conn.client.db(dbName);
                console.log(`\n${'═'.repeat(60)}`);
                console.log(`📦 Restoring Database: ${dbName}`);
                console.log('═'.repeat(60));

                for (const fileName of dbBackup.files) {
                    const collName = fileName.replace(/\.json(\.gz)?$/, '');
                    const filePath = path.join(dbBackup.dir, fileName);
                    const res = await restoreCollection(db, filePath, collName, { dropMode: DROP_MODE, dryRun: DRY_RUN, batchSize: BATCH_SIZE });
                    await restoreIndexes(db, dbBackup.dir, collName);
                    totalRestored += res.restored || 0;
                    totalCollections++;
                }
            }
        } else {
            const db = TARGET_DB ? conn.client.db(TARGET_DB) : conn.db;
            console.log(`\n${'═'.repeat(60)}`);
            console.log(`📦 Restoring Database: ${db.databaseName} (${structure.files.length} collections)`);
            console.log('═'.repeat(60));

            for (const fileName of structure.files) {
                const collName = fileName.replace(/\.json(\.gz)?$/, '');
                const filePath = path.join(structure.dir, fileName);
                const res = await restoreCollection(db, filePath, collName, { dropMode: DROP_MODE, dryRun: DRY_RUN, batchSize: BATCH_SIZE });
                await restoreIndexes(db, structure.dir, collName);
                totalRestored += res.restored || 0;
                totalCollections++;
            }
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

        if (DRY_RUN) {
            console.log('\n╔══════════════════════════════════════════════════════╗');
            console.log('║            🧪 DRY RUN COMPLETE                     ║');
            console.log('╚══════════════════════════════════════════════════════╝');
            console.log(`   Collections checked: ${totalCollections}`);
            console.log(`   Documents in backup: ${totalRestored}`);
            console.log(`   Koi data change nahi hua — real restore ke liye --dry-run hatao\n`);
        } else {
            console.log('\n╔══════════════════════════════════════════════════════╗');
            console.log('║           ✅ RESTORE SUCCESSFUL! ✅                ║');
            console.log('╚══════════════════════════════════════════════════════╝');
            console.log(`   Collections: ${totalCollections}`);
            console.log(`   Documents : ${totalRestored}`);
            console.log(`   Time      : ${elapsed}s`);
            console.log(`\n💡 Verify karo: Data sahi aaya hai ya nahi, app me check karo`);
            console.log(`   Agar kuch missing lage to backup folder abhi bhi safe hai: ${absInput}\n`);
        }

        // Post-restore verification: count check
        if (!DRY_RUN) {
            console.log('🔍 Post-restore verification (counts):');
            if (structure.type === 'multi-db') {
                for (const dbBackup of structure.dbBackups) {
                    const dbName = TARGET_DB || dbBackup.dbName;
                    const db = conn.client.db(dbName);
                    for (const fileName of dbBackup.files) {
                        const collName = fileName.replace(/\.json(\.gz)?$/, '');
                        const filePath = path.join(dbBackup.dir, fileName);
                        try {
                            const backupDocs = await readCollectionFile(filePath);
                            const liveCount = await db.collection(collName).countDocuments();
                            const ok = backupDocs.length === liveCount ? '✅' : '⚠️';
                            console.log(`   ${ok} ${dbName}.${collName}: backup ${backupDocs.length} → live ${liveCount}`);
                        } catch (e) { console.log(`   ❓ ${collName}: verify fail ${e.message}`); }
                    }
                }
            } else {
                const db = TARGET_DB ? conn.client.db(TARGET_DB) : conn.db;
                for (const fileName of structure.files) {
                    const collName = fileName.replace(/\.json(\.gz)?$/, '');
                    const filePath = path.join(structure.dir, fileName);
                    try {
                        const backupDocs = await readCollectionFile(filePath);
                        const liveCount = await db.collection(collName).countDocuments();
                        const ok = backupDocs.length === liveCount ? '✅' : '⚠️';
                        console.log(`   ${ok} ${collName}: backup ${backupDocs.length} → live ${liveCount}`);
                    } catch (e) { console.log(`   ❓ ${collName}: verify fail ${e.message}`); }
                }
            }
            console.log('');
        }

    } finally {
        await conn.close();
        console.log('🔌 MongoDB connection closed\n');
    }
}

main().catch(err => {
    console.error('\n❌ RESTORE FAILED:', err.message);
    console.error(err.stack);
    process.exit(1);
});
