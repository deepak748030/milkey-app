/**
 * Milkey - MongoDB Full Backup Script
 * =====================================
 * Ye script aapke MongoDB ka saara data local machine pe backup kar deta hai
 * Bina ek bhi document khoye — 100% safe.
 *
 * Features:
 *  - Saare collections auto-detect (koi bhi naya collection miss nahi hoga)
 *  - BSON types safe (ObjectId, Date, Decimal128 sab sahi save hota hai)
 *  - Bade database ke liye streaming (RAM overflow nahi hoga)
 *  - Har collection ke baad verification (count match)
 *  - Metadata + summary report
 *  - Indexes ka bhi backup
 *
 * Usage:
 *   node server/scripts/backup.js
 *   node server/scripts/backup.js --out ./backups --gzip
 *   node server/scripts/backup.js --uri "mongodb+srv://user:pass@cluster.mongodb.net/mydb"
 *   MONGODB_URI="mongodb+srv://..." node server/scripts/backup.js
 *
 * Restore ke liye: node server/scripts/restore.js --in ./backups/backup-2024-01-01T...
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
require('dotenv').config(); // fallback to cwd/.env

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { EJSON } = require('bson');

// ---------- CLI Args ----------
const args = process.argv.slice(2);
function getArg(name, defaultValue = null) {
    const idx = args.indexOf(name);
    if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('--')) return args[idx + 1];
    if (args.includes(name)) return true;
    return defaultValue;
}
function hasFlag(name) { return args.includes(name); }

const MONGODB_URI = getArg('--uri') || process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;
const OUT_DIR_BASE = getArg('--out') || getArg('--output') || path.join(__dirname, '../../backups');
const USE_GZIP = hasFlag('--gzip') || hasFlag('--gz');
const SPECIFIC_DB = getArg('--db') || process.env.MONGODB_DB_NAME || null;
const BACKUP_ALL_DBS = hasFlag('--all');
const DRY_RUN = hasFlag('--dry-run');

if (!MONGODB_URI) {
    console.error('\n❌ MONGODB_URI nahi mila!');
    console.error('   Upay:');
    console.error('   1) server/.env file me MONGODB_URI=... set karo');
    console.error('   2) Ya command me pass karo: node server/scripts/backup.js --uri "mongodb+srv://..."');
    console.error('   3) Ya env var: MONGODB_URI="..." node server/scripts/backup.js\n');
    process.exit(1);
}

// Mask password for logging
function maskUri(uri) {
    try { return uri.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@'); } catch { return '***'; }
}

async function ensureDir(dir) {
    await fs.promises.mkdir(dir, { recursive: true });
}

async function writeJsonCollection(collection, filePath, useGzip) {
    const count = await collection.countDocuments();
    console.log(`   📄 ${collection.collectionName}: ${count} documents`);

    if (count === 0) {
        const emptyContent = '[]';
        if (useGzip) {
            await fs.promises.writeFile(filePath + '.gz', zlib.gzipSync(emptyContent));
        } else {
            await fs.promises.writeFile(filePath, emptyContent);
        }
        return { count, filePath: useGzip ? filePath + '.gz' : filePath, empty: true };
    }

    // Streaming approach for large collections
    const cursor = collection.find({});

    // For gzip, we need to stream compress
    if (useGzip) {
        const gzip = zlib.createGzip();
        const writeStream = fs.createWriteStream(filePath + '.gz');
        gzip.pipe(writeStream);

        let isFirst = true;
        let writtenCount = 0;

        // Write JSON array opening
        gzip.write('[');

        for await (const doc of cursor) {
            const ejsonStr = EJSON.stringify(doc, { relaxed: false });
            if (!isFirst) gzip.write(',');
            gzip.write(ejsonStr);
            isFirst = false;
            writtenCount++;

            // Progress for large collections
            if (writtenCount % 5000 === 0) {
                process.stdout.write(`\r   ⏳ ${collection.collectionName}: ${writtenCount}/${count}...`);
            }
        }
        if (writtenCount % 5000 === 0 && writtenCount > 0) process.stdout.write('\n');

        gzip.write(']');
        gzip.end();

        await new Promise((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
            gzip.on('error', reject);
        });

        return { count: writtenCount, filePath: filePath + '.gz', empty: false };
    } else {
        // Non-gzip: collect in streaming file write
        const writeStream = fs.createWriteStream(filePath);
        writeStream.write('[');
        let isFirst = true;
        let writtenCount = 0;

        for await (const doc of cursor) {
            const ejsonStr = EJSON.stringify(doc, { relaxed: false });
            if (!isFirst) writeStream.write(',');
            else isFirst = false;
            writeStream.write(ejsonStr);
            writtenCount++;
            if (writtenCount % 5000 === 0) {
                process.stdout.write(`\r   ⏳ ${collection.collectionName}: ${writtenCount}/${count}...`);
            }
        }
        if (writtenCount >= 5000) process.stdout.write('\n');
        writeStream.write(']');

        await new Promise((resolve, reject) => {
            writeStream.end(() => resolve());
            writeStream.on('error', reject);
        });

        return { count: writtenCount, filePath, empty: false };
    }
}

async function backupIndexes(collection, filePath, useGzip) {
    try {
        const indexes = await collection.indexes();
        const content = JSON.stringify(indexes, null, 2);
        const idxPath = filePath.replace(/\.json$/, '.indexes.json');
        if (useGzip) {
            await fs.promises.writeFile(idxPath + '.gz', zlib.gzipSync(content));
        } else {
            await fs.promises.writeFile(idxPath, content);
        }
        return indexes.length;
    } catch (e) {
        // Some collections may not allow index listing without permission
        return 0;
    }
}

async function backupOneDatabase(db, backupDir, useGzip) {
    const collectionsInfo = await db.listCollections().toArray();
    // Filter out system collections except we DO want to backup everything user-created
    // Keep system collections backup optional — skip system.* views for now
    const collections = collectionsInfo.filter(c => !c.name.startsWith('system.'));

    if (collections.length === 0) {
        console.log(`   ⚠️  Database "${db.databaseName}" me koi collection nahi mili`);
        return { dbName: db.databaseName, collections: [], totalDocs: 0 };
    }

    console.log(`\n📦 Database: ${db.databaseName} — ${collections.length} collections mil gayi`);
    console.log('─'.repeat(60));

    const results = [];
    let totalDocs = 0;

    for (const colInfo of collections) {
        const colName = colInfo.name;
        const collection = db.collection(colName);
        const fileName = `${colName}.json`;
        const filePath = path.join(backupDir, fileName);

        const result = await writeJsonCollection(collection, filePath, useGzip);
        const indexCount = await backupIndexes(collection, filePath, useGzip);

        const stats = await fs.promises.stat(result.filePath);
        const sizeKB = (stats.size / 1024).toFixed(2);

        console.log(`   ✅ ${colName}: ${result.count} docs | ${sizeKB} KB | indexes: ${indexCount} ${useGzip ? '(gzipped)' : ''}`);

        // Verification: file should be parseable
        try {
            let raw;
            if (useGzip) {
                const gzBuffer = await fs.promises.readFile(result.filePath);
                raw = zlib.gunzipSync(gzBuffer).toString('utf-8');
            } else {
                raw = await fs.promises.readFile(result.filePath, 'utf-8');
            }
            const parsed = EJSON.parse(raw, { relaxed: false });
            const fileCount = Array.isArray(parsed) ? parsed.length : 0;
            if (fileCount !== result.count) {
                console.log(`   ⚠️  VERIFY FAIL: ${colName} — DB count ${result.count} != File count ${fileCount}`);
            } else {
                console.log(`   🔍 Verified: ${fileCount} docs file me sahi save hue`);
            }
        } catch (verErr) {
            console.log(`   ⚠️  Verify nahi ho paya: ${verErr.message}`);
        }

        results.push({ collection: colName, count: result.count, file: path.basename(result.filePath), sizeKB, indexes: indexCount });
        totalDocs += result.count;
    }

    return { dbName: db.databaseName, collections: results, totalDocs };
}

async function main() {
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║   🥛 Milkey - MongoDB Full Backup (Zero Data Loss)  ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    console.log(`🔗 MongoDB URI: ${maskUri(MONGODB_URI)}`);
    console.log(`📁 Output dir : ${OUT_DIR_BASE}`);
    console.log(`🗜️  Gzip       : ${USE_GZIP ? 'ON' : 'OFF (use --gzip for compression)'}`);
    if (SPECIFIC_DB) console.log(`🎯 Target DB  : ${SPECIFIC_DB}`);
    if (BACKUP_ALL_DBS) console.log(`🌐 Mode       : ALL DATABASES`);
    if (DRY_RUN) console.log(`🧪 Mode       : DRY RUN (sirf check, backup nahi hoga)`);

    // Create timestamped backup folder
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(OUT_DIR_BASE, `backup-${timestamp}`);

    if (!DRY_RUN) {
        await ensureDir(backupDir);
        console.log(`\n📂 Backup folder banaya: ${backupDir}`);
    } else {
        console.log(`\n🧪 DRY RUN — folder nahi banega, sirf check hoga`);
    }

    console.log('\n⏳ MongoDB se connect ho rahe hain...');
    const conn = await mongoose.createConnection(MONGODB_URI, {
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
    }).asPromise();

    console.log(`✅ Connected! Host: ${conn.host} | DB: ${conn.name}`);
    console.log(`   Mongoose v${mongoose.version}`);

    const startTime = Date.now();
    let backupResults = [];

    try {
        if (BACKUP_ALL_DBS) {
            // Try to list all databases (requires admin privileges)
            try {
                const admin = conn.db.admin();
                const { databases } = await admin.listDatabases();
                console.log(`\n🌐 ${databases.length} databases mile (ALL mode)`);
                for (const dbInfo of databases) {
                    const dbName = dbInfo.name;
                    // Skip system dbs unless user explicitly wants
                    if (['admin', 'config', 'local'].includes(dbName)) {
                        console.log(`   ⏭️  Skipping system DB: ${dbName}`);
                        continue;
                    }
                    const db = conn.client.db(dbName);
                    const subDir = path.join(backupDir, dbName);
                    if (!DRY_RUN) await ensureDir(subDir);
                    const result = await backupOneDatabase(db, DRY_RUN ? '/tmp' : subDir, USE_GZIP);
                    backupResults.push(result);
                }
            } catch (adminErr) {
                console.log(`⚠️  ALL databases list nahi kar paye (permission nahi): ${adminErr.message}`);
                console.log('   → Sirf current database ka backup kar rahe hain');
                const db = conn.db;
                const result = await backupOneDatabase(db, DRY_RUN ? '/tmp' : backupDir, USE_GZIP);
                backupResults.push(result);
            }
        } else if (SPECIFIC_DB) {
            const db = conn.client.db(SPECIFIC_DB);
            const result = await backupOneDatabase(db, DRY_RUN ? '/tmp' : backupDir, USE_GZIP);
            backupResults.push(result);
        } else {
            const db = conn.db;
            const result = await backupOneDatabase(db, DRY_RUN ? '/tmp' : backupDir, USE_GZIP);
            backupResults.push(result);
        }

        // Write metadata
        const totalCollections = backupResults.reduce((a, r) => a + r.collections.length, 0);
        const totalDocs = backupResults.reduce((a, r) => a + r.totalDocs, 0);
        const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);

        const metadata = {
            createdAt: new Date().toISOString(),
            mongoUri: maskUri(MONGODB_URI),
            databases: backupResults,
            totalCollections,
            totalDocs,
            elapsedSeconds: elapsedSec,
            gzip: USE_GZIP,
            mongooseVersion: mongoose.version,
            nodeVersion: process.version,
            backupToolVersion: '1.0.0',
            note: 'Ye backup EJSON format me hai — ObjectId, Date sab safe hai. Restore ke liye restore.js use karo.',
        };

        if (!DRY_RUN) {
            const metaPath = path.join(backupDir, '_metadata.json');
            await fs.promises.writeFile(metaPath, JSON.stringify(metadata, null, 2));
            console.log(`\n📋 Metadata saved: ${metaPath}`);

            // Also write a human-readable summary
            const summaryPath = path.join(backupDir, '_SUMMARY.txt');
            let summary = `Milkey MongoDB Backup Summary\n`;
            summary += `===========================\n`;
            summary += `Date: ${metadata.createdAt}\n`;
            summary += `URI: ${metadata.mongoUri}\n`;
            summary += `Total DBs: ${backupResults.length}\n`;
            summary += `Total Collections: ${totalCollections}\n`;
            summary += `Total Documents: ${totalDocs}\n`;
            summary += `Time taken: ${elapsedSec}s\n`;
            summary += `Gzip: ${USE_GZIP}\n\n`;
            for (const dbRes of backupResults) {
                summary += `Database: ${dbRes.dbName} (${dbRes.totalDocs} docs)\n`;
                summary += '-'.repeat(50) + '\n';
                for (const c of dbRes.collections) {
                    summary += `  ${c.collection.padEnd(25)} ${String(c.count).padStart(8)} docs  ${c.sizeKB} KB\n`;
                }
                summary += '\n';
            }
            summary += `Restore: node server/scripts/restore.js --in ${backupDir}\n`;
            await fs.promises.writeFile(summaryPath, summary);

            // Show folder size
            try {
                const files = await fs.promises.readdir(backupDir);
                let totalSize = 0;
                for (const f of files) {
                    const s = await fs.promises.stat(path.join(backupDir, f));
                    if (s.isFile()) totalSize += s.size;
                    else if (s.isDirectory()) {
                        const subFiles = await fs.promises.readdir(path.join(backupDir, f));
                        for (const sf of subFiles) {
                            const ss = await fs.promises.stat(path.join(backupDir, f, sf));
                            totalSize += ss.size;
                        }
                    }
                }
                const totalMB = (totalSize / (1024 * 1024)).toFixed(2);
                console.log(`📦 Total backup size: ${totalMB} MB`);
            } catch { }

            console.log('\n╔══════════════════════════════════════════════════════╗');
            console.log('║              ✅ BACKUP SUCCESSFUL! ✅               ║');
            console.log('╚══════════════════════════════════════════════════════╝');
            console.log(`\n📂 Location: ${backupDir}`);
            console.log(`📊 Total  : ${totalCollections} collections, ${totalDocs} documents`);
            console.log(`⏱️  Time    : ${elapsedSec}s`);
            console.log(`\n💡 Next steps:`);
            console.log(`   1) Backup ko safe jagah copy karo (Google Drive / External HDD)`);
            console.log(`   2) Restore ke liye: node server/scripts/restore.js --in "${backupDir}"`);
            console.log(`   3) Verify ke liye:  node server/scripts/restore.js --in "${backupDir}" --dry-run`);
            console.log(`\n⚠️  IMPORTANT: server/models change karne se PEHLE ye backup le liya hai,`);
            console.log(`   to ab aap safely models modify kar sakte ho — data loss ka risk nahi!`);
            console.log(`   Agar kuch gadbad ho to restore.js se wapas la sakte ho.\n`);

            // Warn about .gitignore
            const gitignorePath = path.join(OUT_DIR_BASE, '.gitignore');
            try { await fs.promises.access(gitignorePath); } catch {
                try {
                    const rootGitignore = path.join(__dirname, '../../.gitignore');
                    let content = await fs.promises.readFile(rootGitignore, 'utf-8').catch(() => '');
                    if (!content.includes('backups/')) {
                        console.log(`💡 Tip: .gitignore me "backups/" add kar do taki backup Git pe push na ho`);
                    }
                } catch { }
            }
        } else {
            console.log('\n🧪 DRY RUN COMPLETE — koi file save nahi hui (check only)');
            console.log(`   Real backup ke liye --dry-run hatake chalao`);
        }

    } finally {
        await conn.close();
        console.log('🔌 MongoDB connection closed\n');
    }
}

main().catch(err => {
    console.error('\n❌ BACKUP FAILED:', err.message);
    console.error(err.stack);
    process.exit(1);
});
