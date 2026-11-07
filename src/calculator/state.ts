// 계산기 탭들이 함께 쓰는 빌드 상태. 브라우저 localStorage 에 저장한다.
export type StatKey = 'STR' | 'INT' | 'VIT' | 'AGI' | 'DEX' | 'CRT';

export const STAT_KEYS: StatKey[] = ['STR', 'INT', 'VIT', 'AGI', 'DEX', 'CRT'];

// 포인트 한도에 들어가는 능력치. CRT 는 별도로 입력하며 한도 계산에서 뺀다.
export const POINT_KEYS: StatKey[] = ['STR', 'INT', 'VIT', 'AGI', 'DEX'];

// 스테이터스 규칙: STR~DEX 는 1부터, CRT 는 0부터 시작해 최대 510까지.
// 사용 포인트는 STR~DEX 값의 합계(시작값 1 포함)이고, 한도는 레벨×2 + 훈장 + 고정 25 이다.
export const STAT_MIN = 1;
export const STAT_CAP = 510;
export const LEVEL_CAP = 325;
export const FIXED_POINTS = 25;

// 직접 입력한(또는 도감 장비를 고쳐 쓴) 장비. 있으면 도감 옵션 대신 이것을 합산한다.
export interface CustomOption {
    name: string;
    value: number;
    pct: boolean;
}

export interface CustomEquip {
    name: string;
    // 공격 종류: 물리(ATK) / 마법(MATK)
    kind: 'phys' | 'magic';
    atk: number;
    def: number;
    options: CustomOption[];
    // 숫자로 합칠 수 없는 효과 문구(한 줄에 하나)
    other: string[];
    // 도감 장비에서 가져와 고친 경우 그 장비 키
    origin?: string;
}

export interface Build {
    level: number;
    // 훈장 포인트에 쓰는 계정 최고 레벨
    highestLevel: number;
    stats: Record<StatKey, number>;
    // 부위(main/sub/body/add1/add2) → 장비 키(카테고리|이름|영문 이름)
    equip: Record<string, string>;
    // 부위 → 직접 입력 장비
    custom: Record<string, CustomEquip>;
    // 트리 id → 스킬 id → 투자 레벨
    skills: Record<string, Record<string, number>>;
}

const STORAGE_KEY = 'toram-calc-build-v1';

export function createBuild(): Build {
    return {
        level: LEVEL_CAP,
        highestLevel: LEVEL_CAP,
        stats: { STR: 1, INT: 1, VIT: 1, AGI: 1, DEX: 1, CRT: 0 },
        equip: {},
        custom: {},
        skills: {},
    };
}

function integer(value: unknown, fallback: number): number {
    const n = Math.trunc(Number(value));
    return Number.isFinite(n) ? n : fallback;
}

export function minOf(key: StatKey): number {
    return key === 'CRT' ? 0 : STAT_MIN;
}

export function clampStat(key: StatKey, value: number): number {
    return Math.max(minOf(key), Math.min(STAT_CAP, integer(value, minOf(key))));
}

export function clampLevel(value: number): number {
    return Math.max(1, Math.min(LEVEL_CAP, integer(value, 1)));
}

export interface PointBreakdown {
    levelPoints: number;
    emblemPoints: number;
    fixedPoints: number;
    total: number;
}

export function pointBreakdown(level: number, highestLevel: number): PointBreakdown {
    const levelPoints = clampLevel(level) * 2;
    const emblemPoints = Math.round(Math.max(1, integer(highestLevel, 1)) / 10) * 5;
    return { levelPoints, emblemPoints, fixedPoints: FIXED_POINTS, total: levelPoints + emblemPoints + FIXED_POINTS };
}

export function spentPoints(build: Build): number {
    return POINT_KEYS.reduce((sum, k) => sum + build.stats[k], 0);
}

export function loadBuild(): Build {
    const build = createBuild();
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return build;
        const saved = JSON.parse(raw) as Partial<Build>;
        build.level = clampLevel(saved.level ?? build.level);
        build.highestLevel = Math.max(build.level, clampLevel(saved.highestLevel ?? build.highestLevel));
        for (const k of STAT_KEYS) build.stats[k] = clampStat(k, saved.stats?.[k] ?? build.stats[k]);
        for (const [slot, key] of Object.entries(saved.equip ?? {})) {
            if (typeof key === 'string' && key) build.equip[slot] = key;
        }
        for (const [tree, levels] of Object.entries(saved.skills ?? {})) {
            if (!levels || typeof levels !== 'object') continue;
            for (const [id, lv] of Object.entries(levels)) {
                const n = Math.trunc(Number(lv));
                if (Number.isFinite(n) && n > 0) (build.skills[tree] ??= {})[id] = Math.min(10, n);
            }
        }
        for (const [slot, c] of Object.entries(saved.custom ?? {})) {
            if (!c || typeof c !== 'object') continue;
            build.custom[slot] = {
                name: String(c.name ?? ''),
                kind: c.kind === 'magic' ? 'magic' : 'phys',
                atk: Number(c.atk) || 0,
                def: Number(c.def) || 0,
                options: (Array.isArray(c.options) ? c.options : [])
                    .map(o => ({ name: String(o?.name ?? ''), value: Number(o?.value) || 0, pct: !!o?.pct })),
                other: (Array.isArray(c.other) ? c.other : []).map(x => String(x)),
                origin: typeof c.origin === 'string' && c.origin ? c.origin : undefined,
            };
        }
    } catch {
        // 저장값을 읽지 못하면 기본값으로 시작한다
    }
    return build;
}

export function saveBuild(build: Build): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(build));
    } catch {
        // 저장이 막혀 있어도 화면은 정상 동작한다
    }
}
