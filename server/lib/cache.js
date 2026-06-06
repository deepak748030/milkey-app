/**
 * Upstash Redis REST cache wrapper.
 * - Uses UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN from env.
 * - All operations are safe no-ops if env vars are missing or Redis is down,
 *   so the server keeps working exactly as before — Redis is purely a speed
 *   accelerator, never a hard dependency.
 */
const axios = require('axios');

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

const client = ENABLED
    ? axios.create({
        baseURL: URL,
        headers: { Authorization: `Bearer ${TOKEN}` },
        timeout: 1500,
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

module.exports = {
    enabled: ENABLED,
    get,
    set,
    del,
    wrap,
};