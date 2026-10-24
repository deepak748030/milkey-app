# Milkey — Server → Server-Clone Safe Sync Guide
### ZERO Data Loss • SOURCE pe kabhi write/delete nahi • TARGET pe safe upsert

---

## 🔒 Safety Guarantee
- **SOURCE (server)** pe sirf `find()` + `countDocuments()` + `listCollections()` — **kabhi `insert/update/delete/drop` nahi**
- **TARGET (server-clone)** pe `bulkWrite({ updateOne: { $set, upsert:true }})` — existing update, naya insert, kuch delete nahi
- Agar `SOURCE_URI == TARGET_URI` (same host + same DB) → **by default BLOCK** → `--allow-same-db` se hi chalega (tab bhi SOURCE write nahi)
- `--drop-target` ke bina TARGET ka koi data delete nahi hota

---

## 📦 Kya Change Hua (Deep Analysis)

| Collection | Server (Old) | Server-Clone (New) | Migration |
|---|---|---|---|
| **Advance** | `settledAmount` tak hi | + `isDeleted:Boolean` + `deletedAt:Date` | Missing → `isDeleted=false, deletedAt=null` |
| **Farmer** (`farmers`) | `code+owner+type` unique, `mobile` required, type `farmer\|member`, 8 fields | `code+owner` unique, `mobile` optional, type `farmer\|member\|unified`, **+16 naye fields** (cowEnabled, buffaloEnabled, defaultMilk, priceBasis, cowRate, buffaloRate, cowFat, buffaloFat, cowSnf, buffaloSnf, totalQuantity, totalAmount, lastPurchaseDate, alertMethod, printEntrySlip, showRateChart) | Naye fields ko default value, mobile missing → `''`, type invalid → `farmer` |
| **PurchaseFarmer** (`purchasefarmers`) | Alag collection, full cow/buffalo schema | Alias → `Farmer` (same `farmers` collection) | **MERGE**: `farmers` + `purchasefarmers` dono → target `farmers` me (upsert by `_id`, duplicate `code+owner` pe warning + skip) |
| **Other 25+ collections** | Same | Same | As-is copy, `_id` preserve |
| **New in clone only** | N/A | `categories, devices, faqs, videotutorials` | Empty rahenge, touch nahi honge (safe) |

---

## 🚀 Commands (Proper + Strict)

### Option A — Direct Sync (Recommended, 1 command)

**1) Dry-run (pehle check, koi write nahi):**
```bash
cd server
npm run sync:clone:dry -- --source "mongodb+srv://user:pass@cluster.mongodb.net/serverDB?retryWrites=true&w=majority" --target "mongodb+srv://user:pass@cluster.mongodb.net/cloneDB?retryWrites=true&w=majority"
```
Ya env se:
```bash
SOURCE_MONGODB_URI="mongodb+srv://.../serverDB" TARGET_MONGODB_URI="mongodb+srv://.../cloneDB" npm run sync:clone:dry
```

**2) Real Sync (safe upsert, SOURCE untouched):**
```bash
node server/scripts/sync-to-clone.js --source "mongodb+srv://.../serverDB" --target "mongodb+srv://.../cloneDB"
# ya npm script:
npm run sync:clone -- --source "..." --target "..."
```

**3) Verify (counts compare, no write):**
```bash
npm run sync:clone:verify -- --source "..." --target "..."
```

**4) Test with 10 docs only:**
```bash
npm run sync:clone:limit -- --source "..." --target "..." --limit 10
```

**5) Fresh TARGET (only if you want TARGET empty first — SOURCE still safe):**
```bash
node server/scripts/sync-to-clone.js --source "..." --target "..." --drop-target
```

### Option B — 2-Step Backup + Migrate (if direct network not allowed)

```bash
# Step 1: SOURCE ka backup lo (READ only)
cd server
npm run backup -- --uri "mongodb+srv://.../serverDB" --out ../backups

# Step 2: Backup ko TARGET pe migrate karo (with transforms)
npm run migrate -- --in ../backups/backup-2026-... --uri "mongodb+srv://.../cloneDB"
# Dry: npm run migrate:dry -- --in ../backups/... --uri "..."
# Verify: npm run migrate:verify -- --in ../backups/... --uri "..."
```

Dono methods me **SOURCE ka data kabhi change/delete nahi hota** — backup sirf read karta hai, migrate sirf TARGET pe write.

---

## 🔍 Verify After Sync

```bash
# Direct verify
node server/scripts/sync-to-clone.js --source "..." --target "..." --verify

# Ya manual counts
mongosh "mongodb+srv://.../serverDB" --eval "db.farmers.countDocuments()"
mongosh "mongodb+srv://.../cloneDB" --eval "db.farmers.countDocuments()"
```

Target me `farmers` count = `server.farmers` + `server.purchasefarmers` (merged) hona chahiye.

---

## ⚠️ Important Notes (Strict)

1. **Kabhi bhi SOURCE URI pe `--drop` mat lagao** — script me SOURCE pe drop ka code hi nahi hai, lekin galti se bhi TARGET URI ko SOURCE samajh ke pass mat karo. Script same-DB ko block karta hai.
2. **CLONE ke naye collections** (`categories` etc.) pehle se data ho to wo **delete nahi honge** (upsert only).
3. **Duplicate `code+owner`** agar `farmers` aur `purchasefarmers` me same code ho to second wala skip hoga with warning — pehla keep hota hai. Isko manually check karo: `db.farmers.find({code:"DUPLICATE_CODE"})`
4. **BSON types safe** — ObjectId, Date, Decimal128 sab preserve hote hain (native driver, no Mongoose validation).

---

## 📂 Files Created

- `server/scripts/sync-to-clone.js` — Main safe sync (SOURCE read-only, TARGET upsert, 3 migrations + merge)
- `server-clone/scripts/sync-from-server.js` — Same (clone se chalane ke liye)
- `server/package.json` → `sync:clone*` scripts
- `server-clone/package.json` → `sync:from-server*` scripts

---

## ✅ Checklist Before Running

- [ ] SOURCE URI sahi hai? `--dry-run` se pehle test karo
- [ ] TARGET URI alag DB hai? Same host+DB ho to `--allow-same-db` chahiye (not recommended)
- [ ] `npm install` done in `server` (mongoose, dotenv)
- [ ] `--verify` se counts match hue?
- [ ] Backup taken? `npm run backup` (extra safety)

Phir hi real sync chalao.

