// src/enchant/optimizer.ts
// 정옵션/마이너스옵션이 정해졌을 때 부여 순서를 계산하고,
// "성공률 우선" 또는 "재료 절약" 기준으로 마이너스옵션을 자동 선택하는 로직.

import {
    type CharacterSettings,
    EQUIP_BASE_POTENTIAL_MIN,
    EnchantStat,
    type EquipmentFieldType,
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
    insufficientPotential: boolean;
}

function realPotentialCost(v: number): number {
    return v >= 0 ? Math.floor(v) : Math.ceil(v);
}

/** 한 스텝 안에 같은 카테고리 능력이 여러 개 몰리면 소모 잠재력이 늘어나는 페널티. */
function calcExtraRateForStats(stats: EnchantStat[]): number {
    const counts = new Map<StatCategoryData, number>();
    stats.forEach(s => {
        const cat = s.item.category;
        counts.set(cat, (counts.get(cat) ?? 0) + 1);
    });
    const base = [...counts.values()].reduce((sum, n) => sum + (n > 1 ? n * n : 0), 20);
    return base * 5;
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

/**
 * cy's Grimoire의 부여 순서 전략을 최대한 따라간다.
 * 1) 정옵션들을 소모량이 큰 것부터 1씩 "씨앗" 부여한다 (카테고리 중복 페널티를 피하기 위해 개별로).
 * 2) 잠재력이 허락하는 한, 소모량이 적은 능력부터 최대한 채워 넣는다 (top-off). 이 두 단계는
 *    잔여 잠재력이 절대 1 밑으로 떨어지지 않도록만 진행하므로 완전히 안전한 구간이다.
 * 3) 마이너스옵션을 한 번에 일괄 부여한다.
 * 4) 소모 잠재력이 1인 능력 중 아직 다 못 채운 게 있으면 1단위씩 분할 부여로 전환해 위험을 최소화한다.
 * 5) 그래도 남은 값은 전부 마지막 스텝에 몰아서 부여한다 (위험도가 결정되는 마지막 구간).
 */
export function computeEnchantResult(params: {
    fieldType: EquipmentFieldType;
    isOriginalElement: boolean;
    originalPotential: number;
    positiveStats: EnchantStat[];
    negativeStats: EnchantStat[]; // value는 이미 음수(목표값)
    settings: CharacterSettings;
}): EnchantResult {
    const { fieldType, isOriginalElement, originalPotential, positiveStats, negativeStats, settings } = params;
    const allStats = [...negativeStats, ...positiveStats];
    const materialCostByType = calcMaterialCostByType(allStats, settings);

    if (allStats.length === 0) {
        return { steps: [], originalPotential, successRate: -1, expectedSuccessRate: 100, materialCostByType, insufficientPotential: false };
    }

    const costPerUnit = (stat: EnchantStat) => stat.item.getPotentialCostPerUnit(stat.type, fieldType, isOriginalElement);
    const signOf = (stat: EnchantStat) => (stat.value > 0 ? 1 : -1);
    const costFromZero = (stat: EnchantStat, value: number) => stat.item.calcPotentialCost(stat.type, value, 0, fieldType, isOriginalElement);

    // ---- 1) + 2) 씨앗 부여 + top-off (잔여 잠재력이 1 밑으로 내려가지 않는 한도 내에서만) ----
    let safeRemaining = originalPotential;
    const assigned = new Map<string, number>();
    positiveStats.forEach(stat => assigned.set(stat.statKey, 0));

    const seedOrder = [...positiveStats].sort((a, b) => costPerUnit(b) - costPerUnit(a));
    seedOrder.forEach(stat => {
        if (Math.abs(stat.value) < 1) return;
        const sign = signOf(stat);
        const cost = stat.item.calcPotentialCost(stat.type, sign, 0, fieldType, isOriginalElement);
        if (safeRemaining - cost >= 1) {
            safeRemaining -= cost;
            assigned.set(stat.statKey, sign);
        }
    });

    const topoffOrder = [...positiveStats].sort((a, b) => costPerUnit(a) - costPerUnit(b));
    let progressed = true;
    while (progressed) {
        progressed = false;
        for (const stat of topoffOrder) {
            const cur = assigned.get(stat.statKey)!;
            if (Math.abs(cur) >= Math.abs(stat.value)) continue;
            const sign = signOf(stat);
            const cost = stat.item.calcPotentialCost(stat.type, sign, cur, fieldType, isOriginalElement);
            if (safeRemaining - cost >= 1) {
                safeRemaining -= cost;
                assigned.set(stat.statKey, cur + sign);
                progressed = true;
            }
        }
    }

    // ---- 표시용 스텝 구성 ----
    const steps: EnchantStepResult[] = [];
    let cum = originalPotential;

    const seedTopoffStats = seedOrder.filter(stat => assigned.get(stat.statKey) !== 0);
    groupByCategory(seedTopoffStats).forEach(group => {
        let cost = 0;
        group.forEach(stat => (cost += costFromZero(stat, assigned.get(stat.statKey)!)));
        cum -= cost;
        // 표시는 이 단계까지 실제로 누적된 값으로 (최종 목표값이 아닐 수 있음)
        const displayStats = group.map(stat => {
            const partial = stat.clone();
            partial.value = assigned.get(stat.statKey)!;
            return partial;
        });
        steps.push({ stats: displayStats, type: 'bulk', potentialCost: cost, remainingPotential: cum });
    });

    // ---- 3) 마이너스옵션 일괄 부여 ----
    let negativeBefore = -1;
    let negativeAfter = -1;
    if (negativeStats.length > 0) {
        const extraRate = calcExtraRateForStats(negativeStats);
        const rawSum = negativeStats.reduce((sum, stat) => sum + costFromZero(stat, stat.value), 0);
        const cost = realPotentialCost((rawSum * extraRate) / 100);
        negativeBefore = cum;
        cum -= cost;
        negativeAfter = cum;
        steps.push({ stats: negativeStats, type: 'bulk', potentialCost: cost, remainingPotential: cum });
    }

    // ---- 4) 소모 잠재력 1인 능력의 잔여분은 1단위씩 분할 부여 ----
    const eachStepRanges: { before: number; remainders: number[] }[] = [];
    positiveStats.forEach(stat => {
        const cur = assigned.get(stat.statKey)!;
        if (cur === stat.value) return;
        if (costPerUnit(stat) !== 1) return;
        const sign = signOf(stat);
        const before = cum;
        const remainders: number[] = [];
        let running = 0;
        let v = cur;
        while (v !== stat.value) {
            const c = stat.item.calcPotentialCost(stat.type, sign, v, fieldType, isOriginalElement);
            running += c;
            v += sign;
            remainders.push(before - running);
        }
        cum = before - running;
        steps.push({
            stats: [stat],
            type: remainders.length > 1 ? 'each' : 'bulk',
            repeatCount: remainders.length,
            potentialCost: running,
            remainingPotential: cum,
        });
        eachStepRanges.push({ before, remainders });
        assigned.set(stat.statKey, stat.value);
    });

    // ---- 5) 남은 값은 전부 마지막 스텝으로 ----
    const leftoverStats = [
        ...positiveStats.filter(stat => assigned.get(stat.statKey) !== stat.value),
    ];
    let finalBefore = -1;
    let finalAfter = -1;
    if (leftoverStats.length > 0) {
        const extraRate = calcExtraRateForStats(leftoverStats);
        const rawSum = leftoverStats.reduce((sum, stat) => {
            const cur = assigned.get(stat.statKey)!;
            return sum + stat.item.calcPotentialCost(stat.type, stat.value - cur, cur, fieldType, isOriginalElement);
        }, 0);
        const cost = realPotentialCost((rawSum * extraRate) / 100);
        finalBefore = cum;
        cum -= cost;
        finalAfter = cum;
        steps.push({ stats: leftoverStats, type: 'bulk', potentialCost: cost, remainingPotential: cum });
    }

    // ---- 성공률 계산: 첫 "잔여 잠재력 < 1" 시점을 찾는다 (1~2단계는 항상 안전하도록 구성했으므로 대상에서 제외) ----
    let rateNumerator = cum;
    let rateDenominator = originalPotential;
    let insufficientPotential = false;
    let found = false;

    if (negativeStats.length > 0 && negativeAfter < 1) {
        rateNumerator = negativeAfter;
        rateDenominator = negativeBefore;
        insufficientPotential = true;
        found = true;
    }
    if (!found) {
        for (const range of eachStepRanges) {
            const crossIdx = range.remainders.findIndex(r => r < 1);
            if (crossIdx !== -1) {
                rateNumerator = range.remainders[crossIdx];
                rateDenominator = crossIdx === 0 ? range.before : range.remainders[crossIdx - 1];
                insufficientPotential = true;
                found = true;
                break;
            }
        }
    }
    if (!found && leftoverStats.length > 0) {
        // 마지막 스텝이므로 잔여 잠재력이 음수여도 위험 플래그는 세우지 않는다 (정상적인 마지막 조작).
        rateNumerator = finalAfter;
        rateDenominator = finalBefore;
    }
    if (!found && leftoverStats.length === 0 && eachStepRanges.length === 0 && negativeStats.length === 0) {
        // 정옵션만 있고 전부 씨앗+top-off로 끝난 경우: 마지막 안전 스텝이 곧 마지막 스텝
        rateNumerator = cum;
        rateDenominator = steps.length > 1 ? (steps[steps.length - 2]?.remainingPotential ?? originalPotential) : originalPotential;
    }

    const denom = Math.max(rateDenominator, EQUIP_BASE_POTENTIAL_MIN);
    const rawRate = 160 + (rateNumerator * 230) / denom;
    const successRate = rawRate >= 160 ? -1 : Math.max(rawRate, 0);
    const expectedSuccessRate = calcExpectedRate(successRate, positiveStats.length, settings);

    return { steps, originalPotential, successRate, expectedSuccessRate, materialCostByType, insufficientPotential };
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

    const cumulative = new Map<string, number>();
    const steps: EnchantStepResult[] = [];
    let remaining = originalPotential;
    const remainders: number[] = [];

    orderedSteps.forEach(placed => {
        if (placed.members && placed.members.length > 1) {
            // 묶음 단계: 자동 계산과 같은 식(같은 분류가 몰리면 소모가 늘어남)으로 한 번에 계산한다.
            const extraRate = calcExtraRateForStats(placed.members.map(m => m.stat));
            let raw = 0;
            const displays: EnchantStat[] = [];
            placed.members.forEach(m => {
                const before = cumulative.get(m.stat.statKey) ?? 0;
                raw += m.stat.item.calcPotentialCost(m.stat.type, m.amount, before, fieldType, isOriginalElement);
                cumulative.set(m.stat.statKey, before + m.amount);
                const shown = m.stat.clone();
                shown.value = before + m.amount;
                displays.push(shown);
            });
            const cost = realPotentialCost((raw * extraRate) / 100);
            remaining -= cost;
            remainders.push(remaining);
            steps.push({ stats: displays, type: 'bulk', potentialCost: cost, remainingPotential: remaining });
            return;
        }
        const repeat = Math.max(1, placed.repeat ?? 1);
        let totalCost = 0;
        for (let r = 0; r < repeat; r++) {
            const before = cumulative.get(placed.stat.statKey) ?? 0;
            const cost = placed.stat.item.calcPotentialCost(placed.stat.type, placed.amount, before, fieldType, isOriginalElement);
            cumulative.set(placed.stat.statKey, before + placed.amount);
            remaining -= cost;
            totalCost += cost;
            remainders.push(remaining);
        }

        const displayStat = placed.stat.clone();
        displayStat.value = cumulative.get(placed.stat.statKey)!;
        steps.push({
            stats: [displayStat],
            type: repeat > 1 ? 'each' : 'bulk',
            repeatCount: repeat > 1 ? repeat : undefined,
            potentialCost: totalCost,
            remainingPotential: remaining,
        });
    });

    let crossIdx = remainders.length - 1;
    for (let k = 0; k < remainders.length; k++) {
        if (remainders[k] < 1) {
            crossIdx = k;
            break;
        }
    }
    const insufficientPotential = crossIdx !== remainders.length - 1;
    const lastRemaining = remainders[crossIdx];
    const beforeLastRemaining = crossIdx > 0 ? remainders[crossIdx - 1] : originalPotential;
    const denom = Math.max(beforeLastRemaining, EQUIP_BASE_POTENTIAL_MIN);

    const rawRate = 160 + (lastRemaining * 230) / denom;
    const successRate = rawRate >= 160 ? -1 : Math.max(rawRate, 0);
    const expectedSuccessRate = calcExpectedRate(successRate, positiveStatsCount, settings);

    return { steps, originalPotential, successRate, expectedSuccessRate, materialCostByType, insufficientPotential };
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
            rate: r.successRate === -1 ? Infinity : r.successRate,
            expected: r.expectedSuccessRate,
            freed: set.reduce((sum, c) => sum + c.potentialFreed, 0),
        };
    };
    const better = (x: ReturnType<typeof evaluate>, y: ReturnType<typeof evaluate>): boolean => {
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
    const evalAt = (pot: number) => computeEnchantResult({ ...params, originalPotential: pot }).successRate;

    let lo = 1;
    let hi = AUTO_FIND_POTENTIAL_UPPER_LIMIT;
    const rateAtHi = evalAt(hi);
    if (!(rateAtHi === -1 || rateAtHi >= 100)) {
        return hi;
    }
    while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        const rate = evalAt(mid);
        if (rate === -1 || rate >= 100) {
            hi = mid;
        } else {
            lo = mid;
        }
    }
    return hi;
}
