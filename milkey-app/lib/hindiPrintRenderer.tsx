/**
 * Devanagari (Hindi/Marathi) thermal-print renderer.
 *
 * Why this exists:
 *   58mm thermal printers like the Shreyans SR588 do NOT have Devanagari
 *   glyphs in their firmware. Sending UTF-8 Hindi text directly via
 *   ESC/POS makes the printer silently DROP those bytes (e.g. "प्रेमवीर सिंह
 *   Dairy" prints as just "Dairy"). The only reliable fix is to render any
 *   non-Latin line as a bitmap and embed it in the DantSu payload using
 *   the supported `<img>BASE64</img>` tag.
 *
 * What this file provides:
 *   - <HindiPrintRendererHost />: invisible off-screen capture surface that
 *     must be mounted ONCE inside BluetoothPrinterProvider.
 *   - preprocessPayloadForDevanagari(payload, widthMM): scans the
 *     tag-formatted print payload, finds lines containing Devanagari, and
 *     replaces them with bitmap `<img>` tags. ASCII-only lines are kept as
 *     fast native text so English receipts stay quick and lightweight.
 *
 * Cache: rendered lines are memoized by their (text + style + width) key
 * so re-prints don't re-capture the same bitmap.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Platform, View, Text } from 'react-native';
import ViewShot from 'react-native-view-shot';

// 58mm @ 203dpi ≈ 384 dots, 80mm @ 203dpi ≈ 576 dots.
const WIDTH_DOTS_58 = 384;
const WIDTH_DOTS_80 = 576;

// Devanagari Unicode block. Marathi reuses the same block.
const DEVANAGARI_RE = /[\u0900-\u097F]/;

type Align = 'L' | 'C' | 'R';

interface RenderJob {
    key: string;
    text: string;
    align: Align;
    bold: boolean;
    big: boolean;
    widthDots: number;
    /** Optional right-side text for two-column rows (`[L]a[R]b`). */
    rightText?: string;
    rightBold?: boolean;
    resolve: (base64: string) => void;
    reject: (err: Error) => void;
}

const cache = new Map<string, string>();
let pushJob: ((job: RenderJob) => void) | null = null;

/**
 * Strip DantSu inline tags (`<b>`, `<u>`, `<font...>`) for visible text.
 * We only need plain visible characters when deciding whether a line
 * contains Devanagari and when drawing the bitmap.
 */
function stripTags(s: string): { text: string; bold: boolean; big: boolean } {
    const bold = /<b>/i.test(s);
    const big = /<font[^>]*size=['"]?(big|tall|wide)/i.test(s);
    const text = s.replace(/<[^>]+>/g, '');
    return { text, bold, big };
}

function enqueue(job: Omit<RenderJob, 'resolve' | 'reject'>): Promise<string> {
    if (cache.has(job.key)) return Promise.resolve(cache.get(job.key)!);
    return new Promise<string>((resolve, reject) => {
        const full: RenderJob = { ...job, resolve, reject };
        if (!pushJob) {
            // Renderer host not mounted — fallback so we don't crash the print.
            // The printer will simply skip the missing chars (legacy behavior).
            console.warn('[HindiPrintRenderer] host not mounted — Devanagari line will be skipped by printer.');
            reject(new Error('renderer host not mounted'));
            return;
        }
        pushJob(full);
    });
}

/**
 * Walk a DantSu print payload and replace Devanagari lines with bitmaps.
 * Lines with only Latin/ASCII characters pass through untouched.
 */
export async function preprocessPayloadForDevanagari(
    payload: string,
    widthMM: 58 | 80,
): Promise<string> {
    if (!DEVANAGARI_RE.test(payload)) return payload;
    if (Platform.OS === 'web') return payload;

    const widthDots = widthMM === 80 ? WIDTH_DOTS_80 : WIDTH_DOTS_58;
    const lines = payload.split('\n');
    const out: string[] = [];

    for (const raw of lines) {
        if (!raw) {
            out.push(raw);
            continue;
        }
        if (!DEVANAGARI_RE.test(raw)) {
            out.push(raw);
            continue;
        }

        // Try to detect two-column shape `[X]left[R]right`.
        const twoCol = raw.match(/^\[(L|C|R)\](.*?)\[R\](.*)$/);
        let align: Align = 'L';
        let leftPart = '';
        let rightPart: string | undefined;

        if (twoCol) {
            align = twoCol[1] as Align;
            leftPart = twoCol[2];
            rightPart = twoCol[3];
        } else {
            const single = raw.match(/^\[(L|C|R)\](.*)$/);
            if (single) {
                align = single[1] as Align;
                leftPart = single[2];
            } else {
                leftPart = raw;
            }
        }

        const left = stripTags(leftPart);
        const right = rightPart !== undefined ? stripTags(rightPart) : null;

        const key = JSON.stringify({
            l: left.text, lb: left.bold, lz: left.big,
            r: right?.text ?? null, rb: right?.bold ?? false,
            a: align, w: widthDots,
        });

        try {
            const base64 = await enqueue({
                key,
                text: left.text,
                align,
                bold: left.bold,
                big: left.big,
                widthDots,
                rightText: right?.text,
                rightBold: right?.bold,
            });
            // DantSu places <img> at the alignment of the row tag. Always use
            // [L] because the bitmap itself already has the correct internal
            // layout (centered / right-aligned / two-column padded).
            out.push(`[L]<img>${base64}</img>`);
        } catch (e: any) {
            console.warn('[HindiPrintRenderer] capture failed, falling back to raw text:', e?.message || e);
            out.push(raw);
        }
    }

    return out.join('\n');
}

/**
 * Off-screen capture host. Mount once at the provider root.
 * Renders one queued job at a time into a hidden ViewShot, captures the
 * PNG as base64, then advances to the next job.
 */
export function HindiPrintRendererHost() {
    const [job, setJob] = useState<RenderJob | null>(null);
    const queueRef = useRef<RenderJob[]>([]);
    const shotRef = useRef<ViewShot | null>(null);
    const busyRef = useRef(false);

    useEffect(() => {
        pushJob = (next: RenderJob) => {
            queueRef.current.push(next);
            if (!busyRef.current) {
                const head = queueRef.current.shift()!;
                busyRef.current = true;
                setJob(head);
            }
        };
        return () => { pushJob = null; };
    }, []);

    useEffect(() => {
        if (!job) return;
        let cancelled = false;
        // Defer one frame so the View has actually laid out before capture.
        const timer = setTimeout(async () => {
            try {
                if (!shotRef.current?.capture) throw new Error('ViewShot ref not ready');
                const result = await shotRef.current.capture();
                // KEEP the full data URI (`data:image/png;base64,xxx`).
                // react-native-thermal-printer v2.3.6 native bridge passes
                // the content between <img>...</img> to Glide as a URL — and
                // Glide's default model loader supports data URIs but NOT
                // bare base64 strings. Stripping the prefix made every
                // slip with Hindi silently fail to print.
                const dataUri = result || '';
                if (!cancelled) {
                    cache.set(job.key, dataUri);
                    job.resolve(dataUri);
                }
            } catch (e: any) {
                if (!cancelled) job.reject(e instanceof Error ? e : new Error(String(e)));
            } finally {
                if (!cancelled) {
                    const next = queueRef.current.shift() || null;
                    busyRef.current = !!next;
                    setJob(next);
                }
            }
        }, 60);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [job]);

    if (Platform.OS === 'web') return null;

    // Hidden but real — must be laid out so ViewShot can capture pixels.
    // Position absolute off-screen with full target width.
    return (
        <View
            pointerEvents="none"
            style={{
                position: 'absolute',
                left: -10000,
                top: -10000,
                opacity: 0,
            }}
        >
            {job ? (
                <ViewShot
                    ref={shotRef}
                    options={{ format: 'png', quality: 1, result: 'data-uri' }}
                >
                    <HindiLineCanvas job={job} />
                </ViewShot>
            ) : null}
        </View>
    );
}

function HindiLineCanvas({ job }: { job: RenderJob }) {
    const fontSize = job.big ? 28 : 22;
    const fontWeight = job.bold ? '700' : '400';
    const justifyContent =
        job.rightText !== undefined
            ? 'space-between'
            : job.align === 'C'
                ? 'center'
                : job.align === 'R'
                    ? 'flex-end'
                    : 'flex-start';

    return (
        <View
            style={{
                width: job.widthDots,
                backgroundColor: '#FFFFFF',
                paddingVertical: 4,
                paddingHorizontal: 4,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent,
            }}
        >
            <Text
                style={{
                    color: '#000000',
                    fontSize,
                    fontWeight,
                    includeFontPadding: false,
                }}
            >
                {job.text}
            </Text>
            {job.rightText !== undefined ? (
                <Text
                    style={{
                        color: '#000000',
                        fontSize,
                        fontWeight: job.rightBold ? '700' : fontWeight,
                        includeFontPadding: false,
                        marginLeft: 8,
                    }}
                >
                    {job.rightText}
                </Text>
            ) : null}
        </View>
    );
}
