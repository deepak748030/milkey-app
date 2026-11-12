import AsyncStorage from '@react-native-async-storage/async-storage';

// Local mirror of the Rate Setting > Bonus config.
// The server document is the source of truth, but the deployed API may not have the
// `bonus.enabled` field yet. Keeping a local copy means the ON/OFF toggle survives
// leaving/reopening the screen instead of snapping back to OFF.
// userKey = owner user id, so two dairies on one device never share a bonus.

const KEY = 'milkey.rateSettings.bonus.v1';

export type BonusConfig = {
    enabled: boolean;
    type: 'perLitre' | 'percent';
    perLitre: number;
    percent: number;
};

const isNum = (v: any) => typeof v === 'number' && Number.isFinite(v);

export async function readBonusLocal(userKey?: string): Promise<BonusConfig | null> {
    if (!userKey) return null;
    try {
        const raw = await AsyncStorage.getItem(`${KEY}.${userKey}`);
        if (!raw) return null;
        const d = JSON.parse(raw);
        if (!d || typeof d.enabled !== 'boolean') return null;
        return {
            enabled: d.enabled,
            type: d.type === 'percent' ? 'percent' : 'perLitre',
            perLitre: isNum(d.perLitre) ? d.perLitre : 0,
            percent: isNum(d.percent) ? d.percent : 0,
        };
    } catch {
        return null;
    }
}

export async function writeBonusLocal(userKey: string | undefined, cfg: BonusConfig): Promise<void> {
    if (!userKey) return;
    try {
        await AsyncStorage.setItem(`${KEY}.${userKey}`, JSON.stringify(cfg));
    } catch { /* offline-safe */ }
}

/** Merge a server rate-settings document with the local bonus copy (local wins). */
export function mergeBonus<T extends Record<string, any>>(doc: T, local: BonusConfig | null): T {
    if (!local) return doc;
    const serverBonus: any = (doc as any)?.bonus || {};
    return {
        ...doc,
        bonus: {
            ...serverBonus,
            enabled: local.enabled,
            type: local.type,
            perLitre: local.perLitre,
            percent: local.percent,
        },
    } as T;
}
