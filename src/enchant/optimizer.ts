// src/enchant/optimizer.ts
// 정옵션/마이너스옵션이 정해졌을 때 부여 순서를 계산하고,
// "성공률 우선" 또는 "재료 절약" 기준으로 마이너스옵션을 자동 선택하는 로직.
//
// 계산 규칙은 실제 게임을 따라 하는 Coryn Club 스탯팅 시뮬레이터를 기준으로 한다.
// - 같은 분류의 능력이 장비에 이미 있으면(이번 단계에 같이 넣는 것 포함) 그 분류 개수의 제곱 × 5% 만큼 소모/회수 잠재력이 늘어난다.
// - 잠재력은 한 번 확정할 때마다 정수로 내림(0 방향)한다.
// - 옵션 칸(최대 8)이 모두 차거나 잠재력이 0 이하가 되면 그 확정을 끝으로 부여가 끝난다.
// - 성공률 = trunc(160 + 230 × 남은 잠재력 / 기준 잠재력)

import {
    type CharacterSettings,
    EQUIP_BASE_POTENTIAL_MIN,
    EnchantStat,
    type EquipmentFieldType,
    MAX_ABILITY_LINES,
    type StatCategoryData,
    type StatItem,
    type StatValueType,
} from './model';

export interface EnchantStepResult {
    stats: EnchantStat[]; // 1개(개별 부여) 또는 여러 개(안전 구간 일괄 부여)
    type: 'bulk' | 'each'; // each: 1단위씩 반복 분할 부여
    repeatCount?: number; // type === 'each' 일 때 반복 횟수
    potentialCost: number;
    remainingPotential: number;
}

export interface EnchantResult {
    steps: EnchantStepResult[];
    originalPotential: number;
    successRate: number; // -1 이면 "성공률 무제한(항상 성공)"
    expectedSuccessRate: number; // 0~100, 여러 정옵션의 복합 확률까지 반영한 수치
    materialCostByType: number[]; // 길이 6
    insufficientPotential: boolean; // 마지막 단계 전에 부여가 끝나 버리는 순서 (잠재력 소진 또는 옵션 8칸 가득)
    lineLimitHit?: boolean; // 위 경우 중 "옵션 8칸이 가득 차서" 끝나는 경우
}

// ---------------------------------------------------------------------------
// 게임 규칙 시뮬레이터
// ---------------------------------------------------------------------------

interface Change {
    stat: EnchantStat;
    amount: number; // 부호 포함 변화량
}

interface ActionOutcome {
    cost: number; // 소모한 잠재력 (회수면 음수)
    remaining: number;
    rawRate: number; // trunc(160 + 230 × 남은 / 기준)
    lineCount: number;
    ended: boolean; // 이 확정으로 부여가 끝남
    lineLimit: boolean;
}

class LineSim {
    potential: number;
    private readonly values = new Map<string, number>();
    private readonly lines = new Map<string, StatCategoryData>();

    constructor(
        private readonly original: number,
        private readonly fieldType: EquipmentFieldType,
        private readonly isOriginalElement: boolean
    ) {
        this.potential = original;
    }

    valueOf(stat: EnchantStat): number {
        return this.values.get(stat.statKey) ?? 0;
    }

    /** 이번 확정 뒤 장비에 있는 모든 옵션 줄의 분류로 계산하는 소모 배율(%). */
    private penaltyPercent(changes: Change[]): number {
        const cats = new Map<StatCategoryData, number>();
        const seen = new Set<string>();
        this.lines.forEach((cat, key) => {
            seen.add(key);
            cats.set(cat, (cats.get(cat) ?? 0) + 1);
        });
        changes.forEach(c => {
            if (seen.has(c.stat.statKey)) return;
            seen.add(c.stat.statKey);
            cats.set(c.stat.item.category, (cats.get(c.stat.item.category) ?? 0) + 1);
        });
        let percent = 100;
        cats.forEach(n => {
            if (n > 1) percent += 5 * n * n;
        });
        return percent;
    }

    private evaluate(changes: Change[]): ActionOutcome {
        const penalty = this.penaltyPercent(changes);
        let total = 0; // 소모면 양수 (×100 단위)
        changes.forEach(c => {
            const before = this.valueOf(c.stat);
            const raw = c.stat.item.calcPotentialCost(c.stat.type, c.amount, before, this.fieldType, this.isOriginalElement);
            const base = raw >= 0 ? Math.floor(raw) : Math.ceil(raw);
            total += base * penalty;
        });
        const used = Math.trunc(total / 100);
        const cost = used === 0 ? 0 : used;
        const remaining = this.potential - cost;
        const denomBase = this.potential >= this.original ? this.potential : this.original;
        const denom = Math.max(denomBase, EQUIP_BASE_POTENTIAL_MIN);
        const rawRate = Math.trunc(160 + (230 * remaining) / denom);
        const lineKeys = new Set<string>(this.lines.keys());
        changes.forEach(c => lineKeys.add(c.stat.statKey));
        const lineCount = lineKeys.size;
        const lineLimit = lineCount >= MAX_ABILITY_LINES;
        return { cost, remaining, rawRate, lineCount, ended: remaining < 1 || lineLimit, lineLimit };
    }

    preview(changes: Change[]): ActionOutcome {
        return this.evaluate(changes);
    }

    apply(changes: Change[]): ActionOutcome {
        const outcome = this.evaluate(changes);
        changes.forEach(c => {
            this.values.set(c.stat.statKey, this.valueOf(c.stat) + c.amount);
            this.lines.set(c.stat.statKey, c.stat.item.category);
        });
        this.potential = outcome.remaining;
        return outcome;
    }
}

function calcExpectedRate(successRate: number, positiveStatsLength: number, settings: CharacterSettings): number {
    let positiveCount = positiveStatsLength;
    if (positiveCount > 1 && settings.hasExpertsCustomization2Skill) positiveCount -= 1;
    if (successRate === -1 || successRate >= 100) return 100;
    if (positiveCount <= 0) return successRate;
    return Math.min(100, Math.pow(Math.floor(successRate) / 100, positiveCount) * 100);
}

function calcMaterialCostByType(allStats: EnchantStat[], settings: CharacterSettings): number[] {
    const materialCostByType = [0, 0, 0, 0, 0, 0];
    allStats.forEach(stat => {
        materialCostByType[stat.materialType] += stat.item.calcMaterialCost(stat.type, 0, stat.value, settings);
    });
    return materialCostByType;
}

/** 카테고리가 겹치지 않는 스탯들을 최대한 하나의 그룹으로 묶는다 (그리디 first-fit). */
function groupByCategory(stats: EnchantStat[]): EnchantStat[][] {
    const groups: { cats: Set<StatCategoryData>; stats: EnchantStat[] }[] = [];
    stats.forEach(stat => {
        const group = groups.find(g => !g.cats.has(stat.item.category));
        if (group) {
            group.cats.add(stat.item.category);
            group.stats.push(stat);
        } else {
            groups.push({ cats: new Set([stat.item.category]), stats: [stat] });
        }
    });
    return groups.map(g => g.stats);
}

/** 확정 기록 전체에서 성공률을 구한다. 부여가 끝나는 첫 확정(없으면 마지막 확정)의 성공률을 쓴다. */
function finalizeResult(params: {
    steps: EnchantStepResult[];
    outcomes: ActionOutcome[];
    originalPotential: number;
    positiveCount: number;
    materialCostByType: number[];
    settings: CharacterSettings;
}): EnchantResult {
    const { steps, outcomes, originalPotential, positiveCount, materialCostByType, settings } = params;
    let endIdx = outcomes.findIndex(o => o.ended);
    if (endIdx === -1) endIdx = outcomes.length - 1;
    const end = outcomes[endIdx];
    const endedEarly = endIdx < outcomes.length - 1;
    const rawRate = end.rawRate;
    const successRate = rawRate >= 160 ? -1 : Math.min(100, Math.max(rawRate, 0));
    const expectedSuccessRate = calcExpectedRate(successRate, positiveCount, settings);
    return {
        steps,
        originalPotential,
        successRate,
        expectedSuccessRate,
        materialCostByType,
        insufficientPotential: endedEarly,
        lineLimitHit: endedEarly && end.lineLimit && end.remaining >= 1,
    };
}

/**
 * 부여 순서 계획.
 * 1) 정옵션을 소모량이 큰 것부터 1씩 "씨앗" 부여하고, 잠재력이 허락하는 한 소모량이 적은 것부터 채운다 (top-off).
 *    이 구간은 남은 잠재력이 1 밑으로 내려가지 않게만 진행하므로 안전하다.
 * 2) 마이너스옵션을 한 번에 부여해 잠재력을 돌려받는다.
 * 3) 소모 잠재력이 1인 능력은 남은 값을 1단위씩 나눠 부여한다.
 * 4) 남은 값을 마지막 단계에 몰아서 부여한다.
 * 옵션이 8줄이면 8번째 줄을 만드는 순간 부여가 끝나므로, 정옵션 하나를 골라 "마지막 단계에서 처음 만드는 줄"로 남겨 둔다.
 */
function planOnce(params: {
    fieldType: EquipmentFieldType;
    isOriginalElement: boolean;
    originalPotential: number;
    positiveStats: EnchantStat[];
    negativeStats: EnchantStat[];
    heldBack: EnchantStat | null;
    settings: CharacterSettings;
}): EnchantResult {
    const { fieldType, isOriginalElement, originalPotential, positiveStats, negativeStats, heldBack, settings } = params;
    const materialCostByType = calcMaterialCostByType([...negativeStats, ...positiveStats], settings);
    const newSim = () => new LineSim(originalPotential, fieldType, isOriginalElement);

    const costPerUnit = (stat: EnchantStat) => stat.item.getPotentialCostPerUnit(stat.type, fieldType, isOriginalElement);
    const signOf = (stat: EnchantStat) => (stat.value > 0 ? 1 : -1);

    const body = positiveStats.filter(s => s !== heldBack);
    const assigned = new Map<string, number>();
    body.forEach(s => assigned.set(s.statKey, 0));

    const seedOrder = [...body].sort((a, b) => costPerUnit(b) - costPerUnit(a));
    const groups = groupByCategory(seedOrder);
    const groupChanges = (g: EnchantStat[]): Change[] =>
        g.filter(s => assigned.get(s.statKey) !== 0).map(s => ({ stat: s, amount: assigned.get(s.statKey)! }));

    // 지금 배정으로 그룹을 차례로 확정해도 남은 잠재력이 항상 1 이상인지
    const safe = (): boolean => {
        const sim = newSim();
        for (const g of groups) {
            const ch = groupChanges(g);
            if (ch.length === 0) continue;
            if (sim.apply(ch).remaining < 1) return false;
        }
        return true;
    };

    seedOrder.forEach(stat => {
        if (Math.abs(stat.value) < 1) return;
        assigned.set(stat.statKey, signOf(stat));
        if (!safe()) assigned.set(stat.statKey, 0);
    });

    const topoffOrder = [...body].sort((a, b) => costPerUnit(a) - costPerUnit(b));
    let progressed = true;
    while (progressed) {
        progressed = false;
        for (const stat of topoffOrder) {
            const cur = assigned.get(stat.statKey)!;
            if (cur === 0 || Math.abs(cur) >= Math.abs(stat.value)) continue;
            assigned.set(stat.statKey, cur + signOf(stat));
            if (safe()) progressed = true;
            else assigned.set(stat.statKey, cur);
        }
    }

    // ---- 실제 확정 기록 ----
    const sim = newSim();
    const steps: EnchantStepResult[] = [];
    const outcomes: ActionOutcome[] = [];
    const shownWith = (stat: EnchantStat, value: number): EnchantStat => {
        const c = stat.clone();
        c.value = value;
        return c;
    };

    groups.forEach(g => {
        const ch = groupChanges(g);
        if (ch.length === 0) return;
        const o = sim.apply(ch);
        outcomes.push(o);
        steps.push({
            stats: ch.map(c => shownWith(c.stat, c.amount)),
            type: 'bulk',
            potentialCost: o.cost,
            remainingPotential: o.remaining,
        });
    });

    if (negativeStats.length > 0) {
        const o = sim.apply(negativeStats.map(s => ({ stat: s, amount: s.value })));
        outcomes.push(o);
        steps.push({ stats: negativeStats, type: 'bulk', potentialCost: o.cost, remainingPotential: o.remaining });
    }

    // 소모 잠재력 1인 능력의 남은 값은 1단위씩
    body.forEach(stat => {
        const cur = assigned.get(stat.statKey)!;
        if (cur === 0 || cur === stat.value || costPerUnit(stat) !== 1) return;
        const sign = signOf(stat);
        let total = 0;
        let count = 0;
        let last = sim.potential;
        for (let v = cur; v !== stat.value; v += sign) {
            const o = sim.apply([{ stat, amount: sign }]);
            outcomes.push(o);
            total += o.cost;
            last = o.remaining;
            count++;
        }
        assigned.set(stat.statKey, stat.value);
        steps.push({
            stats: [stat],
            type: count > 1 ? 'each' : 'bulk',
            repeatCount: count,
            potentialCost: total,
            remainingPotential: last,
        });
    });

    // 남은 값은 전부 마지막 확정으로 (8번째 줄은 여기서 처음 만든다)
    const leftover: Change[] = [];
    positiveStats.forEach(stat => {
        const cur = stat === heldBack ? 0 : (assigned.get(stat.statKey) ?? 0);
        if (cur !== stat.value) leftover.push({ stat, amount: stat.value - cur });
    });
    if (leftover.length > 0) {
        const o = sim.apply(leftover);
        outcomes.push(o);
        steps.push({ stats: leftover.map(c => c.stat), type: 'bulk', potentialCost: o.cost, remainingPotential: o.remaining });
    }

    return finalizeResult({ steps, outcomes, originalPotential, positiveCount: positiveStats.length, materialCostByType, settings });
}

export function computeEnchantResult(params: {
    fieldType: EquipmentFieldType;
    isOriginalElement: boolean;
    originalPotential: number;
    positiveStats: EnchantStat[];
    negativeStats: EnchantStat[]; // value는 이미 음수(목표값)
    settings: CharacterSettings;
}): EnchantResult {
    const { originalPotential, positiveStats, negativeStats, settings } = params;
    const allStats = [...negativeStats, ...positiveStats];
    const materialCostByType = calcMaterialCostByType(allStats, settings);

    if (allStats.length === 0) {
        return { steps: [], originalPotential, successRate: -1, expectedSuccessRate: 100, materialCostByType, insufficientPotential: false };
    }

    // 옵션이 8줄이면 마지막에 만드는 줄을 어떤 정옵션으로 할지에 따라 성공률이 달라진다. 가장 좋은 것을 고른다.
    if (allStats.length >= MAX_ABILITY_LINES && positiveStats.length > 0) {
        let best: EnchantResult | null = null;
        const rateKey = (r: EnchantResult) => (r.successRate === -1 ? 101 : r.successRate);
        positiveStats.forEach(held => {
            const r = planOnce({ ...params, heldBack: held });
            if (!best) {
                best = r;
                return;
            }
            if (r.insufficientPotential !== best.insufficientPotential) {
                if (!r.insufficientPotential) best = r;
                return;
            }
            if (rateKey(r) !== rateKey(best)) {
                if (rateKey(r) > rateKey(best)) best = r;
                return;
            }
            if (r.expectedSuccessRate > best.expectedSuccessRate) best = r;
        });
        return best!;
    }
    return planOnce({ ...params, heldBack: null });
}

export interface ManualPlacedStep {
    stat: EnchantStat;
    amount: number; // 이 스텝에서 실제로 부여할 값 (부호 포함, 목표값을 넘지 않는 한 임의의 크기)
    repeat?: number; // 같은 amount 를 연속으로 몇 번 부여하는지 (기본 1). +1 반복을 한 줄로 묶어 보여 준다.
    // 여러 능력을 한 번에 부여하는 묶음 단계 (자동 단계의 마이너스 일괄 부여 등). stat/amount 는 첫 항목과 같다.
    members?: { stat: EnchantStat; amount: number }[];
}

/**
 * 사용자가 직접 배치한 스텝 순서대로 계산한 결과.
 * 각 스텝은 "이 스탯을 얼마나 부여할지"를 사용자가 직접 정한 크기의 조작이며,
 * 같은 스탯이 여러 스텝에 걸쳐 나눠 배치될 수도 있다 (누적값을 이어서 계산).
 */
export function computeManualOrderResult(params: {
    fieldType: EquipmentFieldType;
    isOriginalElement: boolean;
    originalPotential: number;
    orderedSteps: ManualPlacedStep[];
    positiveStatsCount: number;
    settings: CharacterSettings;
}): EnchantResult {
    const { fieldType, isOriginalElement, originalPotential, orderedSteps, positiveStatsCount, settings } = params;
    const involvedStats = [...new Map(orderedSteps.map(s => [s.stat.statKey, s.stat])).values()];
    const materialCostByType = calcMaterialCostByType(involvedStats, settings);

    if (orderedSteps.length === 0) {
        return { steps: [], originalPotential, successRate: -1, expectedSuccessRate: 100, materialCostByType, insufficientPotential: false };
    }

    const sim = new LineSim(originalPotential, fieldType, isOriginalElement);
    const steps: EnchantStepResult[] = [];
    const outcomes: ActionOutcome[] = [];

    orderedSteps.forEach(placed => {
        if (placed.members && placed.members.length > 1) {
            const displays = placed.members.map(m => {
                const shown = m.stat.clone();
                shown.value = sim.valueOf(m.stat) + m.amount;
                return shown;
            });
            const o = sim.apply(placed.members.map(m => ({ stat: m.stat, amount: m.amount })));
            outcomes.push(o);
            steps.push({ stats: displays, type: 'bulk', potentialCost: o.cost, remainingPotential: o.remaining });
            return;
        }
        const repeat = Math.max(1, placed.repeat ?? 1);
        let totalCost = 0;
        let remaining = sim.potential;
        for (let r = 0; r < repeat; r++) {
            const o = sim.apply([{ stat: placed.stat, amount: placed.amount }]);
            outcomes.push(o);
            totalCost += o.cost;
            remaining = o.remaining;
        }
        const displayStat = placed.stat.clone();
        displayStat.value = sim.valueOf(placed.stat);
        steps.push({
            stats: [displayStat],
            type: repeat > 1 ? 'each' : 'bulk',
            repeatCount: repeat > 1 ? repeat : undefined,
            potentialCost: totalCost,
            remainingPotential: remaining,
        });
    });

    return finalizeResult({ steps, outcomes, originalPotential, positiveCount: positiveStatsCount, materialCostByType, settings });
}

export interface NegativeCandidate {
    item: StatItem;
    type: StatValueType;
}

/**
 * 마이너스옵션 자동 선택.
 * - material 모드(재료 절약): 제거 재료비가 적은 능력 위주로 고른다.
 * - successRate 모드(성공률 우선):
 * 1) 실제 잠재력 공식(변환 임계값, TEC 할인 포함)으로 "제거 시 돌려받는 잠재력"이 큰 능력부터 고른다.
 * 2) 잠재력이 정해져 있고 정옵션이 있으면, 고른 조합과 나머지 후보를 하나씩 바꿔 가며
 *    실제 성공률을 계산해 더 높아지는 교체를 반복한다. (성공률이 같으면 예상 성공률, 회수 잠재력 순)
 */
export function autoSelectNegativeStats(params: {
    candidates: NegativeCandidate[];
    count: number;
    mode: 'successRate' | 'material';
    fieldType: EquipmentFieldType;
    isOriginalElement: boolean;
    level: number;
    settings: CharacterSettings;
    positiveStats: EnchantStat[];
    // null 이면 잠재력을 자동으로 찾는 중이라 성공률을 비교할 수 없으므로 회수 잠재력만 본다.
    originalPotential: number | null;
}): EnchantStat[] {
    const { candidates, count, mode, fieldType, isOriginalElement, level, settings, positiveStats, originalPotential } = params;
    if (count <= 0) return [];

    const scored = candidates.map(c => {
        const { min } = c.item.getLimit(c.type, fieldType, isOriginalElement, level);
        const potentialFreed = -c.item.calcPotentialCost(c.type, min, 0, fieldType, isOriginalElement);
        const materialCost = c.item.calcMaterialCost(c.type, 0, min, settings);
        return { ...c, min, potentialFreed, materialCost };
    });
    if (mode === 'material') {
        scored.sort((a, b) => a.materialCost - b.materialCost);
        return scored.slice(0, count).map(c => new EnchantStat(c.item, c.type, c.min));
    }
    scored.sort((a, b) => b.potentialFreed - a.potentialFreed);

    const toStats = (set: typeof scored): EnchantStat[] => set.map(c => new EnchantStat(c.item, c.type, c.min));
    let chosen = scored.slice(0, count);
    if (originalPotential === null || positiveStats.length === 0 || scored.length <= count) return toStats(chosen);

    const evaluate = (set: typeof scored) => {
        const r = computeEnchantResult({ fieldType, isOriginalElement, originalPotential, positiveStats, negativeStats: toStats(set), settings });
        return {
            ok: !r.insufficientPotential,
            rate: r.successRate === -1 ? Infinity : r.successRate,
            expected: r.expectedSuccessRate,
            freed: set.reduce((sum, c) => sum + c.potentialFreed, 0),
        };
    };
    const better = (x: ReturnType<typeof evaluate>, y: ReturnType<typeof evaluate>): boolean => {
        if (x.ok !== y.ok) return x.ok;
        if (x.rate !== y.rate) return x.rate > y.rate;
        if (x.expected !== y.expected) return x.expected > y.expected;
        return x.freed > y.freed;
    };

    let best = evaluate(chosen);
    for (let round = 0; round < 4; round++) {
        let improved = false;
        for (let i = 0; i < chosen.length; i++) {
            for (const cand of scored) {
                if (chosen.includes(cand)) continue;
                const trial = chosen.slice();
                trial[i] = cand;
                const ev = evaluate(trial);
                if (better(ev, best)) {
                    chosen = trial;
                    best = ev;
                    improved = true;
                }
            }
        }
        if (!improved) break;
    }
    return toStats(chosen);
}

export const AUTO_FIND_POTENTIAL_UPPER_LIMIT = 200;

/** 성공률 100% 이상을 만족하는 최소 잠재력을 이분탐색으로 찾는다. */
export function findMinimumPotential(params: {
    fieldType: EquipmentFieldType;
    isOriginalElement: boolean;
    positiveStats: EnchantStat[];
    negativeStats: EnchantStat[];
    settings: CharacterSettings;
}): number {
    const evalAt = (pot: number) => {
        const r = computeEnchantResult({ ...params, originalPotential: pot });
        return !r.insufficientPotential && (r.successRate === -1 || r.successRate >= 100);
    };

    let lo = 1;
    let hi = AUTO_FIND_POTENTIAL_UPPER_LIMIT;
    if (!evalAt(hi)) {
        return hi;
    }
    while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (evalAt(mid)) {
            hi = mid;
        } else {
            lo = mid;
        }
    }
    return hi;
}
