// src/enchant/model.ts
// 옵션부여(스탯팅) 계산에 쓰이는 능력치/공식 모델.

export type MaterialType = 0 | 1 | 2 | 3 | 4 | 5; // 금속, 수품, 목재, 포목, 약품, 마소
export type StatValueType = 'constant' | 'multiplier';
export type EquipmentFieldType = 'mainWeapon' | 'bodyArmor';
export type ConditionKey = 'mainWeapon' | 'bodyArmor' | 'originalElement';

export interface TypeParamsData {
    potentialCost: number;
    limit: number | null;
    extraLimit: { max: string | null; min: string | null } | null;
    unitValue: [number, number];
    materialCost: number | null;
    convertThreshold: number | null;
}

export interface ConditionOverride {
    when: ConditionKey;
    constant: { potentialCost: number } | null;
    multiplier: { potentialCost: number } | null;
}

export interface StatItemData {
    id: string;
    name: string;
    materialType: MaterialType;
    conditions: ConditionOverride[];
    constant: TypeParamsData;
    multiplier: TypeParamsData | null;
}

export interface StatCategoryData {
    title: string;
    weaponOnly: boolean;
    items: StatItemData[];
}

export interface EnchantCatalogData {
    materialTypes: string[];
    categories: StatCategoryData[];
}

export interface CharacterSettings {
    level: number;
    smithLevel: number;
    materialSkillLevels: number[]; // 길이 6 (금속/수품/목재/포목/약품/마소)
    materialAnvilSkillLevelSum: number;
    hasExpertsCustomization2Skill: boolean;
}

export function defaultCharacterSettings(): CharacterSettings {
    return {
        level: 320,
        smithLevel: 100,
        materialSkillLevels: [10, 10, 10, 10, 10, 10],
        materialAnvilSkillLevelSum: 40,
        hasExpertsCustomization2Skill: true,
    };
}

export const POTENTIAL_CAPACITY = 100;
export const EQUIP_BASE_POTENTIAL_MIN = 15;
export const MAX_ABILITY_LINES = 8;
const DEFAULT_CONVERT_THRESHOLD = 20;
const MATERIAL_COST_TABLE: Record<number, number> = { 1: 5, 3: 16.5, 5: 25, 6: 33.5, 10: 50, 20: 100 };
// 이 계산기는 항상 TEC 최대치를 기준으로 계산한다 (마이너스 부여 시 소모 잠재력 할인율에 영향).
const ASSUMED_TEC = 255;

function evalLevelFormula(formula: string, level: number): number {
    const m = /^CLv\/(\d+(?:\.\d+)?)$/.exec(formula);
    if (!m) return 0;
    if (level <= 200) return 0;
    const clv = Math.floor((level - 200) / 10) * 10;
    return Math.floor(clv / parseFloat(m[1]));
}

export class StatItem {
    constructor(
        public readonly data: StatItemData,
        public readonly category: StatCategoryData
    ) {}

    get id(): string {
        return this.data.id;
    }
    get name(): string {
        return this.data.name;
    }
    get materialType(): MaterialType {
        return this.data.materialType;
    }
    get hasMultiplier(): boolean {
        return this.data.multiplier !== null;
    }

    private typeParams(type: StatValueType): TypeParamsData {
        const p = type === 'constant' ? this.data.constant : this.data.multiplier;
        if (!p) {
            throw new Error(`stat "${this.id}" has no ${type} variant`);
        }
        return p;
    }

    getPotentialCostPerUnit(
        type: StatValueType,
        fieldType: EquipmentFieldType,
        isOriginalElement: boolean
    ): number {
        const override = this.data.conditions.find(c => {
            if (c.when === 'mainWeapon') return fieldType === 'mainWeapon';
            if (c.when === 'bodyArmor') return fieldType === 'bodyArmor';
            return isOriginalElement;
        });
        if (override) {
            const o = type === 'constant' ? override.constant : override.multiplier;
            if (o) return o.potentialCost;
        }
        return this.typeParams(type).potentialCost;
    }

    private dynamicCapacityLimit(potentialCostPerUnit: number): number {
        const capacity = POTENTIAL_CAPACITY - (potentialCostPerUnit === 6 ? 10 : 0);
        return Math.floor(capacity / potentialCostPerUnit);
    }

    getLimit(
        type: StatValueType,
        _fieldType: EquipmentFieldType,
        _isOriginalElement: boolean,
        level: number
    ): { max: number; min: number } {
        // 상한(용량 기반)은 무기/방어구 조건부 소모량 배율과 무관하게
        // 능력치 고유의 기본 잠재력 소모량(potentialCost)만으로 계산한다.
        const p = this.typeParams(type);
        const cost = p.potentialCost;
        const dynamicCap = this.dynamicCapacityLimit(cost);
        const levelCapSoft = Math.min(20, Math.floor(level / 10));
        const cap = Math.min(dynamicCap, levelCapSoft);

        const baseMax = p.limit ?? cap;
        const baseMin = p.limit != null ? -p.limit : -cap;

        let extraMax = 0;
        let extraMin = 0;
        if (p.extraLimit && level > 200) {
            extraMax = p.extraLimit.max ? evalLevelFormula(p.extraLimit.max, level) : 0;
            extraMin =
                p.extraLimit.min != null
                    ? p.extraLimit.min === '0'
                        ? 0
                        : evalLevelFormula(p.extraLimit.min, level)
                    : -extraMax;
        }

        const hardCap = Math.floor(level / 10);
        return {
            max: Math.min(baseMax + extraMax, hardCap),
            min: Math.max(baseMin + extraMin, -hardCap),
        };
    }

    /** 최대값이 1인 능력(속성 부여 등)은 수치를 올리는 게 아니라 켜고 끄는 항목이라 숫자를 표시하지 않는다. */
    isToggle(type: StatValueType): boolean {
        return this.typeParams(type).limit === 1;
    }

    getConvertThreshold(type: StatValueType): number {
        const p = this.typeParams(type);
        if (p.convertThreshold != null) return p.convertThreshold;
        return Math.min(DEFAULT_CONVERT_THRESHOLD, this.dynamicCapacityLimit(p.potentialCost));
    }

    getMaterialCostPerUnit(type: StatValueType): number {
        const p = this.typeParams(type);
        return p.materialCost ?? MATERIAL_COST_TABLE[p.potentialCost] ?? 0;
    }

    getUnitValue(type: StatValueType): [number, number] {
        return this.typeParams(type).unitValue;
    }

    /**
     * value를 previousValue에 이어서 부여할 때 드는 잠재력 소모량.
     * 변환 임계값을 넘는 초과분은 2배 소모되며, 누적값이 음수로 넘어가면(마이너스 부여)
     * TEC 기반 할인율이 적용된다 — 실제 게임의 스탯팅 공식을 그대로 따른다.
     */
    calcPotentialCost(
        type: StatValueType,
        value: number,
        previousValue: number,
        fieldType: EquipmentFieldType,
        isOriginalElement: boolean
    ): number {
        const potential = this.getPotentialCostPerUnit(type, fieldType, isOriginalElement);
        const threshold = this.getConvertThreshold(type);
        const sign = value < 0 ? -1 : 1;

        let v = value;
        let v2 = 0;
        if (previousValue * sign <= threshold) {
            v += previousValue;
            v *= sign;
            if (v > threshold) {
                v2 = v - threshold;
                v = threshold;
            }
            v *= sign;
            v2 *= sign;
            v -= previousValue;
        } else {
            v2 = v;
            v = 0;
        }

        const rate = 5 + ASSUMED_TEC / 10;
        if (v + v2 >= 0) {
            return v * potential + v2 * potential * 2;
        }
        return Math.ceil(((v * potential + (v2 * potential) / 2) * rate) / 100);
    }

    /**
     * from -> to 로 값을 바꾸는 데 필요한 재료비 (대장 Lv / 소재스킬 / 모루스킬 반영).
     * 재료비는 부여 순서와 무관하게 시작/끝 값에 의해서만 정해진다.
     */
    calcMaterialCost(type: StatValueType, from: number, to: number, settings: CharacterSettings): number {
        const baseValue = this.getMaterialCostPerUnit(type);
        const baseRate = 100 - Math.floor(settings.smithLevel / 10) - Math.floor(settings.smithLevel / 50);
        const materialSkillRate = settings.materialSkillLevels[this.materialType] ?? 0;
        const anvilSkillRate = settings.materialAnvilSkillLevelSum;

        const calc = (a: number, b: number): number => {
            let lo = Math.abs(a);
            let hi = Math.abs(b);
            if (lo > hi) [lo, hi] = [hi, lo];
            let sum = 0;
            for (let step = lo + 1; step <= hi; step++) {
                let v = Math.floor((step * step * baseValue * baseRate) / 100);
                v -= Math.floor((v * materialSkillRate) / 100);
                v -= Math.floor((v * anvilSkillRate) / 100);
                sum += v;
            }
            return sum;
        };

        if (from * to >= 0) return calc(from, to);
        return calc(from, 0) + calc(0, to);
    }
}

export class StatCategory {
    readonly items: StatItem[];
    constructor(public readonly data: StatCategoryData) {
        this.items = data.items.map(item => new StatItem(item, data));
    }
    get title(): string {
        return this.data.title;
    }
    get weaponOnly(): boolean {
        return this.data.weaponOnly;
    }
}

export class EnchantCatalog {
    readonly materialTypes: string[];
    readonly categories: StatCategory[];

    constructor(data: EnchantCatalogData) {
        this.materialTypes = data.materialTypes;
        this.categories = data.categories.map(c => new StatCategory(c));
    }

    availableCategories(fieldType: EquipmentFieldType): StatCategory[] {
        return this.categories.filter(c => !c.weaponOnly || fieldType === 'mainWeapon');
    }
}

export class EnchantStat {
    value: number;
    constructor(
        public readonly item: StatItem,
        public readonly type: StatValueType,
        value: number
    ) {
        this.value = value;
    }

    get statKey(): string {
        return `${this.item.id}:${this.type}`;
    }
    get materialType(): MaterialType {
        return this.item.materialType;
    }

    clone(): EnchantStat {
        return new EnchantStat(this.item, this.type, this.value);
    }

    showLabel(): string {
        return this.showValueLabel(this.value);
    }

    /** 이 능력의 라벨을, 실제 stat.value가 아니라 주어진 value로 표시한다 (스텝별 분할 표시용). */
    showValueLabel(value: number): string {
        if (this.item.isToggle(this.type)) return this.item.name;
        const percent = this.type === 'multiplier' ? '%' : '';
        const sign = value > 0 ? '+' : '';
        return `${this.item.name}${percent} ${sign}${value}${percent}`;
    }
}
