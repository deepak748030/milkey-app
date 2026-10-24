# 🥛 Milkey - MongoDB Backup & Restore Guide

> **100% Safe — Ek bhi document loss nahi hoga!**

Ye scripts aapke saare MongoDB data ko local pe backup karte hain, taaki aap `server/models` change kar sako bina data khoye — aur change ke baad AI se safely upsert kara sako.

---

## 📦 Quick Start (Sabse Easy)

### Step 1: `.env` set karo

`server/.env` file banao (agar nahi hai to):

```bash
cp server/.env.example server/.env
# Phir server/.env me apna MONGODB_URI daalo
```

`.env` me ye line honi chahiye:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/mydb?retryWrites=true&w=majority
```

> **Note:** Agar aapke `MONGODB_URI` me database name nahi hai (jaise `...mongodb.net/`), to script auto-detect kar lega. Par best hai ki URI me DB name add karo: `...mongodb.net/milkey?retryWrites=true`

### Step 2: Dependencies install karo

```bash
cd server
npm install
```

### Step 3: Backup lo — Bas ek command!

```bash
# Server folder se:
node server/scripts/backup.js

# Ya server folder ke andar se:
cd server
node scripts/backup.js
```

**Output:**
```
✅ Backup successful! Location: ./backups/backup-2026-01-01T...
📊 Total: 28 collections, 15420 documents
```

Aapka saara data `backups/backup-...` folder me JSON files ke roop me save ho jayega!

---

## 🔄 Restore kaise kare?

### Safe Restore (Recommended — kuch delete nahi hoga)

```bash
node server/scripts/restore.js --in ./backups/backup-2026-01-01T10-00-00-000Z
```

Ye mode **upsert** karta hai — matlab:
- Agar document already hai → update karega
- Agar naya hai → insert karega
- **Kuch bhi delete nahi hoga** ✅

### Fresh Restore (Pura wapas, pehle drop)

```bash
node server/scripts/restore.js --in ./backups/backup-... --drop
```

Ye pehle collection drop karke fresh insert karta hai. **Sirf tab use karo jab pura data wapas lana ho.**

### Pehle Check karo (Dry Run)

```bash
node server/scripts/restore.js --in ./backups/backup-... --dry-run
```

Ye sirf batayega ki kya hoga, bina kuch change kiye.

---

## 📋 Saare Commands

| Kaam | Command |
|------|---------|
| **Simple backup** | `node server/scripts/backup.js` |
| **Gzip ke sath (chhota size)** | `node server/scripts/backup.js --gzip` |
| **Custom folder me** | `node server/scripts/backup.js --out ./my-backups` |
| **Specific DB ka backup** | `node server/scripts/backup.js --db milkey` |
| **Saare DBs ka backup** | `node server/scripts/backup.js --all` |
| **Sirf check (dry run)** | `node server/scripts/backup.js --dry-run` |
| **Direct URI se** | `node server/scripts/backup.js --uri "mongodb+srv://..."` |
| **Restore (safe)** | `node server/scripts/restore.js --in ./backups/backup-...` |
| **Restore (fresh)** | `node server/scripts/restore.js --in ./backups/backup-... --drop` |
| **Restore check** | `node server/scripts/restore.js --in ./backups/backup-... --dry-run` |
| **AI Migration (model change ke baad)** | `node server/scripts/migrate.js --in ./backups/backup-...` |

---

## 🛡️ Model Change karne ka Safe Tareeka

Ye workflow follow karo — **zero risk**:

```bash
# 1️⃣ Pehle backup lo (MOST IMPORTANT)
node server/scripts/backup.js

# 2️⃣ Backup verify karo
ls backups/                          # folder dikhega
cat backups/backup-.../_SUMMARY.txt  # kitne docs save hue
cat backups/backup-.../_metadata.json

# 3️⃣ Backup ko safe jagah copy karo (Google Drive / HDD)
cp -r backups/backup-... ~/Desktop/milkey-backup/

# 4️⃣ Ab models change karo
#    server/models/User.js, Farmer.js, etc. edit karo

# 5️⃣ Agar kuch gadbad lage to wapas restore
node server/scripts/restore.js --in ./backups/backup-... --drop

# 6️⃣ App test karo — sab data wapas!
```

---

## 🤖 AI KE LIYE — Model Change Ke Baad Upsert Kaise Kare

> **Ye section sabse important hai!** Jab aap `server/models` change kar dete ho (naya field add, field rename, type change, enum change), to purana backup direct restore karne pe error aa sakta hai. AI ko ye instructions do — wo bina error ke migrate kar dega.

### ❓ Normal restore kyun fail ho sakta hai model change ke baad?

| Model Change | Problem |
|---|---|
| Naya `required` field add kiya | Purane docs me wo field nahi hai → validation error |
| Field ka type change kiya (`String` → `Number`) | Purana data type mismatch |
| `enum` values badle | Purane docs me purana enum value → validation fail |
| Field rename kiya (`mobile` → `phoneNumber`) | Purana field ab ignore ho jayega, naya field empty |
| `unique` index add kiya | Duplicate data pe error |
| Field hata diya | Purana data silently drop ho sakta hai |

**Solution:** AI ko bolo ki `migrate.js` use kare — ye Mongoose validation bypass karke native MongoDB se upsert karta hai + transformations handle karta hai.

---

### ✅ AI ko ye prompt copy-paste karo:

```
Mere Milkey project ke models change ho gaye hain.

BACKUP FOLDER: ./backups/backup-YYYY-MM-DDTHH-MM-SS-...

Kya change kiya hai:
1. [Yaha likho — jaise: User model me 'phone' ko 'phoneNumber' rename kiya, naya required field 'kycStatus' add kiya default 'pending' ke sath]
2. [Dusra change — jaise: Farmer model me 'type' enum me 'premium' add kiya]
3. [Teesra change...]

Tumhe server/scripts/migrate.js ko update karna hai:
- MIGRATIONS object me har collection ke liye transform function likho
- server/models ke naye schemas dekho
- backup ke purane docs ko naye schema ke hisaab se convert karo
- Phir node server/scripts/migrate.js --in ./backups/backup-... --dry-run se check karo
- Verify ke baad actual migrate karo

RULES:
- Native db.collection() use karo, Mongoose Model.create() nahi (validation bypass ke liye)
- Naye required fields ko default value do
- Rename hue fields ko map karo (oldName -> newName)
- Type change ho to Number(), String() se convert karo
- Enum ke purane values ko naye valid value pe map karo
- Kabhi bhi backup folder delete mat karo
```

**Example — AI ko aise bolo:**

> "Maine `User.js` me `phone` field ko `phoneNumber` rename kiya hai, aur naya field `kycStatus` add kiya hai jo required hai. Purane backup se saara data naye schema pe migrate karo bina error ke."

AI fir `migrate.js` me ye likhega:
```js
User: (oldDoc) => {
    // Rename
    if (oldDoc.phone && !oldDoc.phoneNumber) {
        oldDoc.phoneNumber = oldDoc.phone;
        delete oldDoc.phone;
    }
    // New required field default
    if (!oldDoc.kycStatus) oldDoc.kycStatus = 'pending';
    return oldDoc;
}
```

---

### 🔧 AI ke liye 5 Common Scenarios + Fix

#### 1) Naya required field add hua
```js
// Pehle: User { name, phone }
// Ab: User { name, phone, kycStatus: required }
// Fix:
User: (doc) => {
    if (!doc.kycStatus) doc.kycStatus = 'pending'; // default do
    return doc;
}
```

#### 2) Field rename hua
```js
// Pehle: Farmer { mobile }
// Ab: Farmer { phoneNumber }
// Fix:
Farmer: (doc) => {
    if (doc.mobile && !doc.phoneNumber) {
        doc.phoneNumber = doc.mobile;
        delete doc.mobile;
    }
    return doc;
}
```

#### 3) Type change (String → Number)
```js
// Pehle: Advance { amount: "500" } (string)
// Ab: Advance { amount: Number }
// Fix:
Advance: (doc) => {
    if (typeof doc.amount === 'string') doc.amount = Number(doc.amount) || 0;
    return doc;
}
```

#### 4) Enum change
```js
// Pehle: MilkCollection { shift: 'morning' | 'evening' }
// Ab: MilkCollection { shift: 'morning' | 'evening' | 'night' }
// Purane docs me 'day' value thi jo ab invalid hai
MilkCollection: (doc) => {
    if (doc.shift === 'day') doc.shift = 'morning'; // map kar do
    if (!['morning','evening','night'].includes(doc.shift)) doc.shift = 'morning';
    return doc;
}
```

#### 5) Field ka structure change (nested → flat ya vice versa)
```js
// Pehle: User { address: "Jaipur" }
// Ab: User { address: { city, state } }
// Fix:
User: (doc) => {
    if (typeof doc.address === 'string') {
        doc.address = { city: doc.address, state: '' };
    }
    return doc;
}
```

---

### 📝 `migrate.js` kaise kaam karta hai?

```
Backup JSON (purana schema) 
    ↓ 
MIGRATIONS[collection] transform function (AI likhega)
    ↓ 
Native bulkWrite upsert (validation bypass)
    ↓ 
Naya DB (naye schema ke sath) ✅
```

- **Native driver:** `db.collection('User').bulkWrite()` — Mongoose validation skip, isliye error nahi
- **Batch processing:** 500 docs ek saath, bade DB pe bhi fast
- **Dry-run:** Pehle check, fir actual migrate
- **Verification:** Har collection ke counts compare

---

### ⚙️ AI Migration Steps (AI ye follow karega):

```bash
# Step 1: Naye models dekho
ls server/models/
cat server/models/User.js          # naya schema samjho
cat server/models/Farmer.js

# Step 2: Backup ka structure dekho
ls backups/backup-.../
cat backups/backup-.../_metadata.json

# Step 3: migrate.js me MIGRATIONS likho
# File: server/scripts/migrate.js
# Har changed collection ke liye transform function

# Step 4: Dry-run (check only)
node server/scripts/migrate.js --in ./backups/backup-... --dry-run

# Step 5: Agar dry-run OK, to actual migrate
node server/scripts/migrate.js --in ./backups/backup-...
# Ya safe mode: --drop ke bina (upsert)

# Step 6: Verify
node server/scripts/migrate.js --in ./backups/backup-... --verify
```

---

### 🛡️ Golden Rules (AI ke liye):

1. **Kabhi backup folder delete mat karo** — hamesha copy pe kaam karo
2. **Mongoose Model use mat karo** — `db.collection()` native use karo
3. **Har naye required field ko default do** — nahi to insert fail hoga
4. **Rename/Type change ko transform karo** — seedha upsert se data loss hoga
5. **Dry-run pehle** — ` --dry-run` se 100 docs test karo
6. **Batch me karo** — ek saath saare docs RAM me mat lao
7. **`_id` ko touch mat karo** — wahi ID se upsert hota hai, change kiya to duplicate banega
8. **Timestamps (`createdAt`, `updatedAt`) preserve karo** — delete mat karo
9. **Backup ke indexes ko turant restore mat karo** — pehle data migrate, fir `db.collection().createIndex()` alag se

---

### 📋 AI Checklist — Har migration se pehle:

- [ ] `server/models/*.js` ke naye schemas padhe?
- [ ] Konsi collections change hui hain, list banayi?
- [ ] Har collection ke liye transform function likha?
- [ ] Naye required fields ko defaults diye?
- [ ] Rename/type/enum mappings kiye?
- [ ] `migrate.js` me `MIGRATIONS` update kiya?
- [ ] `--dry-run` se test kiya?
- [ ] Counts match hue? (`backup count == live count`)
- [ ] App me manually 2-3 records check kiye?

---

### 💡 Quick AI Prompts — Copy-Paste:

**Prompt 1 — General migration:**
> "Backup `./backups/backup-...` se naye models pe migrate karo. Saare `server/models/*.js` dekho, kya change hua samjho, `migrate.js` me transforms likho, dry-run karo, fir migrate karo."

**Prompt 2 — Specific change:**
> "Maine `PurchaseFarmer` model me `priceBasis` ka naya enum value `weight` add kiya hai aur `cowRate` ko required kar diya hai. Backup se migrate karo — `cowRate` missing ho to `0` set karo."

**Prompt 3 — Full reset:**
> "Mujhe pura database backup se fresh restore chahiye naye schema pe. `migrate.js --drop` use karo, saare transforms apply karo, indexes bhi restore karo."

---

## 🛠️ Alternative: mongodump (BSON Binary)

Agar aapke system pe `mongodump` installed hai to ye bhi use kar sakte ho:

```bash
# Install (macOS)
brew install mongodb-database-tools

# Install (Ubuntu)
sudo apt install mongodb-database-tools

# Backup
chmod +x server/scripts/backup.sh
./server/scripts/backup.sh --gzip

# Restore
./server/scripts/restore.sh --in ./backups/mongodump-.../milkey --gzip
```

> **Recommendation:** Node wali script (`backup.js` / `migrate.js`) sabse reliable hai — koi external tool nahi, aur model change ke baad bhi kaam karti hai!

---

## 📁 Backup Folder Structure

```
backups/
├── backup-2026-01-15T10-30-00-000Z/
│   ├── _metadata.json       # Backup ki info (counts, time, etc.)
│   ├── _SUMMARY.txt         # Human-readable summary
│   ├── User.json            # Saare users
│   ├── User.indexes.json    # Indexes
│   ├── Farmer.json
│   ├── Order.json
│   ├── MilkCollection.json
│   └── ... (28 collections)
└── backup-2026-01-16T...
```

Har `*.json` file EJSON format me hai — matlab `ObjectId`, `Date` sab original jaisa hi restore hoga.

---

## 🔍 Verify kaise kare?

```bash
# Backup ke baad counts dekho
cat backups/backup-.../_SUMMARY.txt
cat backups/backup-.../_metadata.json

# Restore/migrate ke baad DB counts vs backup counts
node server/scripts/migrate.js --in ./backups/backup-... --verify
# Ya
node server/scripts/restore.js --in ./backups/backup-... --dry-run
```

---

## ❓ Troubleshooting

### "MONGODB_URI nahi mila"
→ `server/.env` file banao aur usme `MONGODB_URI=mongodb+srv://...` add karo

### "Authentication failed"
→ Password me special chars (`@`, `#`, `$`) ho to URL-encode karo. Ya Atlas dashboard se naya password banao jo simple ho.

### "IP not whitelisted"
→ MongoDB Atlas → Network Access → Add IP Address → `0.0.0.0/0` (allow all) ya apna current IP add karo

### Backup folder bahut bada ho gaya
→ `--gzip` flag use karo: `node server/scripts/backup.js --gzip`

### "E11000 duplicate key error" restore pe
→ Koi unique index violate ho raha hai. `--drop` mode try karo, ya backup me duplicates check karo.

### "Validation failed: ... is required" error
→ Naya required field hai jo purane docs me nahi. `migrate.js` use karo aur us field ko default do. Seedha `restore.js` Mongoose validation bypass karta hai, par app level pe validation ho sakta hai — isliye migrate.js better.

### "Validation failed: ... is not a valid enum value"
→ Purane docs me enum ka purana value hai. `migrate.js` me enum mapping likho (Scenario 4 dekho).

### Atlas free tier slow hai
→ Ye normal hai. Bade backup me 5-10 min lag sakta hai. Script streaming se kaam karta hai, RAM full nahi hoga.

---

## 🔐 Security

- Backup files me aapka saara data hota hai — **kisi ko share mat karo**
- `backups/` folder already `.gitignore` me hai
- MONGODB_URI ko kabhi Git pe push mat karo
- Production me IP whitelist zaroor set rakho

---

**Made with ❤️ for Milkey — Aapka data 100% safe hai! Models change ke baad bhi!**
