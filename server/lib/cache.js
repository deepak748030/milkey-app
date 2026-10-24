/**
 * Upstash Redis REST cache wrapper.
 * - Uses UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN from env.
 * - All operations are safe no-ops if env vars are missing or Redis is down,
 *   so the server keeps working exactly as before — Redis is purely a speed
 *   accelerator, never a hard dependency.
 */
const axios = require('axios');
const https = require('https');
const http = require('http');

const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const ENABLED = !!(URL && TOKEN);

if (ENABLED) {
    console.log('[cache] Upstash Redis enabled');
} else {
    console.log('[cache] Upstash Redis disabled (no credentials) — running without cache');
}

// In-process micro-cache to absorb burst traffic and avoid extra Upstash round-trips
// for the exact same key within a few seconds. Keyed by full redis key.
const micro = new Map(); // key -> { value, expiresAt }
const MICRO_TTL_MS = 2000;

const microGet = (key) => {
    const hit = micro.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt < Date.now()) {
        micro.delete(key);
        return undefined;
    }
    return hit.value;
};
const microSet = (key, value) => {
    if (micro.size > 5000) micro.clear();
    micro.set(key, { value, expiresAt: Date.now() + MICRO_TTL_MS });
};
const microDel = (key) => micro.delete(key);

// Keep-alive agents so we reuse a single TLS connection to Upstash
// instead of paying the TCP+TLS handshake on every cache op.
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 64 });
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 64 });

const client = ENABLED
    ? axios.create({
        baseURL: URL,
        headers: { Authorization: `Bearer ${TOKEN}` },
        timeout: 1500,
        httpsAgent,
        httpAgent,
    })
    : null;

const safe = async (fn, fallback) => {
    if (!ENABLED) return fallback;
    try {
        return await fn();
    } catch (err) {
        // Never let cache errors break a request
        if (process.env.NODE_ENV === 'development') {
            console.warn('[cache] op failed:', err?.message || err);
        }
        return fallback;
    }
};

/**
 * GET a JSON value from cache. Returns parsed value or null if missing.
 */
const get = async (key) => {
    const mic = microGet(key);
    if (mic !== undefined) return mic;
    const val = await safe(async () => {
        const { data } = await client.get(`/get/${encodeURIComponent(key)}`);
        if (!data || data.result == null) return null;
        try { return JSON.parse(data.result); } catch { return data.result; }
    }, null);
    if (val !== null) microSet(key, val);
    return val;
};

/**
 * SET a JSON value with TTL in seconds.
 */
const set = async (key, value, ttlSeconds = 60) => {
    const payload = JSON.stringify(value);
    microSet(key, value);
    return safe(async () => {
        await client.post(`/set/${encodeURIComponent(key)}?EX=${ttlSeconds}`, payload, {
            headers: { 'Content-Type': 'text/plain' },
        });
        return true;
    }, false);
};

/**
 * DEL one or more keys.
 */
const del = async (...keys) => {
    if (!keys.length) return 0;
    keys.forEach(microDel);
    return safe(async () => {
        const path = '/del/' + keys.map(encodeURIComponent).join('/');
        const { data } = await client.get(path);
        return data?.result || 0;
    }, 0);
};

/**
 * Wrap an async loader with cache. If hit, returns cached value;
 * otherwise runs the loader, caches the result, and returns it.
 * Loader returning null/undefined is NOT cached.
 */
const wrap = async (key, ttlSeconds, loader) => {
    const cached = await get(key);
    if (cached !== null && cached !== undefined) return cached;
    const fresh = await loader();
    if (fresh !== null && fresh !== undefined) {
        // fire-and-forget
        set(key, fresh, ttlSeconds);
    }
    return fresh;
};

/**
 * Route-prefix versioning. Mutating requests bump the version for their
 * base path so all cached GET responses under that prefix are invalidated
 * in O(1) without needing SCAN/DEL of many keys.
 */
const crypto = require('crypto');

const routeBase = (url) => {
    const path = (url || '').split('?')[0];
    const m = path.match(/^(\/api\/[^/]+)/);
    return m ? m[1] : path;
};

const versionCache = new Map(); // base -> { v, expiresAt }
const VERSION_LOCAL_TTL = 2000;

const getVersion = async (base) => {
    const local = versionCache.get(base);
    if (local && local.expiresAt > Date.now()) return local.v;
    const v = (await get(`httpv:${base}`)) || 1;
    versionCache.set(base, { v, expiresAt: Date.now() + VERSION_LOCAL_TTL });
    return v;
};

const bumpVersion = async (base) => {
    const cur = (await get(`httpv:${base}`)) || 1;
    const next = cur + 1;
    await set(`httpv:${base}`, next, 86400);
    versionCache.set(base, { v: next, expiresAt: Date.now() + VERSION_LOCAL_TTL });
};

// Routes we must NEVER cache (auth flows, payment callbacks, seeds, realtime, etc.)
// FIX: added /api/purchase-farmers and /api/milk-collections and /api/members to prevent stale blank list
// The mobile app's C-Farmer tab was showing blank white space because cached empty/limited responses were served
const SKIP_BASES = new Set([
    '/api/auth',
    '/api/razorpay',
    '/api/zapupi',
    '/api/seed',
    '/api/notifications', // realtime-ish; let it always be fresh
    '/api/purchase-farmers',
    '/api/milk-collections',
    '/api/members',
    '/api/selling-entries',
    '/api/member-payments',
    '/api/user-subscriptions',
    '/api/subscriptions',
]);

/**
 * Global HTTP cache middleware.
 *  - Only caches successful GET responses.
 *  - Keys are partitioned per Authorization token (hashed) so users never
 *    see each other's data.
 *  - Mutating requests (POST/PUT/PATCH/DELETE) bump a version counter for
 *    their route prefix, invalidating all cached GETs under that prefix.
 *  - Completely transparent when Redis is disabled or unreachable.
 */
const httpCache = ({ ttl = 30 } = {}) => async (req, res, next) => {
    if (!ENABLED) return next();
    try {
        const base = routeBase(req.originalUrl || req.url);
        if (SKIP_BASES.has(base)) return next();

        const authHeader = req.headers.authorization || '';
        const userPart = authHeader
            ? 'a:' + crypto.createHash('sha1').update(authHeader).digest('hex').slice(0, 16)
            : 'anon';

        if (req.method === 'GET') {
            const v = await getVersion(base);
            const key = `http:${base}:v${v}:${userPart}:${req.originalUrl || req.url}`;
            const hit = await get(key);
            if (hit && hit.s !== undefined) {
                // Serve pre-serialized JSON string directly — skip re-stringify.
                res.set('X-Cache', 'HIT');
                res.set('Vary', 'Authorization, Accept-Encoding');
                res.status(hit.status || 200).type('application/json').send(hit.s);
                return;
            }
            const origJson = res.json.bind(res);
            res.json = (body) => {
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        const s = JSON.stringify(body);
                        // Skip caching very large payloads (>512KB) to keep Redis fast.
                        if (s.length <= 512 * 1024) {
                            set(key, { status: res.statusCode, s }, ttl);
                        }
                    }
                } catch (_) { /* ignore */ }
                res.set('X-Cache', 'MISS');
                res.set('Vary', 'Authorization, Accept-Encoding');
                return origJson(body);
            };
            return next();
        }

        // Mutating method: bump prefix version once the response is sent OK
        res.on('finish', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                bumpVersion(base).catch(() => { });
            }
        });
        return next();
    } catch (_) {
        // Never let cache logic break a request
        return next();
    }
};

module.exports = {
    enabled: ENABLED,
    get,
    set,
    del,
    wrap,
    httpCache,
    bumpVersion,
    routeBase,
};