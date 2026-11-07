// src/enchant/ui.ts
// 옵션부여(스탯팅) 계산기 - 팝업 없는 버튼형 UI

import {
    type CharacterSettings,
    EnchantStat,
    type EquipmentFieldType,
    MAX_ABILITY_LINES,
    type StatItem,
    type StatValueType,
    defaultCharacterSettings,
} from './model';
import { loadEnchantCatalog } from './data';
import {
    type EnchantResult,
    type EnchantStepResult,
    type ManualPlacedStep,
    autoSelectNegativeStats,
    computeEnchantResult,
    computeManualOrderResult,
    findMinimumPotential,
} from './optimizer';
import type { EnchantCatalog } from './model';

type StepId = 'equipment' | 'positive' | 'negative' | 'result';
type NegativeMode = 'manual' | 'auto';
type AutoGoal = 'successRate' | 'material';
type OrderMode = 'auto' | 'manual';

interface EnchantState {
    step: StepId;
    fieldType: EquipmentFieldType;
    isOriginalElement: boolean;
    originalPotential: number;
    autoFindPotential: boolean;
    settings: CharacterSettings;
    showAdvanced: boolean;
    positiveStats: EnchantStat[];
    positiveAutoFill: boolean;
    negativeMode: NegativeMode;
    negativeAutoGoal: AutoGoal;
    negativeAutoCount: number | null; // null = 남은 슬롯 전부
    negativeStatsManual: EnchantStat[];
    result: EnchantResult | null;
    resolvedPotential: number | null;
    orderMode: OrderMode;
    manualPlaced: ManualPlacedStep[];
    manualCustomAmount: Record<string, string>; // statKey -> 커스텀 수치 입력값
}

let catalog: EnchantCatalog | null = null;
let state: EnchantState = createInitialState();

function createInitialState(): EnchantState {
    return {
        step: 'equipment',
        fieldType: 'mainWeapon',
        isOriginalElement: false,
        originalPotential: 90,
        autoFindPotential: false,
        settings: defaultCharacterSettings(),
        showAdvanced: false,
        positiveStats: [],
        positiveAutoFill: true,
        negativeMode: 'auto',
        negativeAutoGoal: 'successRate',
        negativeAutoCount: null,
        negativeStatsManual: [],
        result: null,
        resolvedPotential: null,
        orderMode: 'auto',
        manualPlaced: [],
        manualCustomAmount: {},
    };
}

const STEP_ORDER: StepId[] = ['equipment', 'positive', 'negative', 'result'];
const STEP_LABEL: Record<StepId, string> = {
    equipment: '장비 선택',
    positive: '정옵션(플러스)',
    negative: '마이너스옵션',
    result: '결과',
};

function negativeStats(): EnchantStat[] {
    if (state.negativeMode === 'auto') {
        return computeAutoNegativeStats();
    }
    return state.negativeStatsManual;
}

function computeAutoNegativeStats(): EnchantStat[] {
    if (!catalog) return [];
    const usedKeys = new Set(state.positiveStats.map(s => s.statKey));
    const count = state.negativeAutoCount ?? MAX_ABILITY_LINES - state.positiveStats.length;
    const candidates: { item: StatItem; type: StatValueType }[] = [];
    catalog.availableCategories(state.fieldType).forEach(cat => {
        cat.items.forEach(item => {
            (['constant', 'multiplier'] as StatValueType[]).forEach(type => {
                if (type === 'multiplier' && !item.hasMultiplier) return;
                const key = `${item.id}:${type}`;
                if (usedKeys.has(key)) return;
                const { min } = item.getLimit(type, state.fieldType, state.isOriginalElement, state.settings.level);
                if (min >= 0) return;
                candidates.push({ item, type });
            });
        });
    });
    return autoSelectNegativeStats({
        candidates,
        count: Math.max(0, Math.min(count, MAX_ABILITY_LINES - state.positiveStats.length)),
        mode: state.negativeAutoGoal,
        fieldType: state.fieldType,
        isOriginalElement: state.isOriginalElement,
        level: state.settings.level,
        settings: state.settings,
    });
}

function canGoNext(): boolean {
    if (state.step === 'positive') return state.positiveStats.length > 0;
    return true;
}

// host 를 주면 계산기 탭 안에 넣어 그리고(홈 버튼 없음), 없으면 예전처럼 페이지 전체를 그린다.
export async function renderEnchantPage(host?: HTMLElement): Promise<void> {
    const target = host ?? document.querySelector<HTMLDivElement>('#app')!;
    state = createInitialState();

    target.innerHTML = `
    ${host ? '' : `<div class="nav-bar">
      <button class="btn-home" id="back-home">🏠 Home</button>
      <h2 style="margin:0 0 0 15px; border:none;">🧪 옵션부여 계산기</h2>
    </div>`}
    <div class="${host ? 'enc-embedded' : 'container'}">
      <div class="enc-step-indicator" id="enc-step-indicator"></div>
      <div id="enc-body"></div>
      <div class="enc-nav-row">
        <button class="enc-btn-circle" id="enc-prev" aria-label="이전 단계" title="이전 단계">‹</button>
        <button class="enc-btn enc-btn-ghost" id="enc-reset">초기화</button>
        <button class="enc-btn-circle enc-btn-circle-primary" id="enc-next" aria-label="다음 단계" title="다음 단계">›</button>
      </div>
    </div>
  `;

    document.getElementById('back-home')?.addEventListener('click', () => history.back());

    try {
        catalog = await loadEnchantCatalog();
    } catch {
        document.getElementById('enc-body')!.innerHTML =
            '<div class="enc-card enc-error">옵션부여 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>';
        return;
    }

    rerender();
}

function rerender(): void {
    renderStepIndicator();
    renderBody();
    renderNavButtons();
}

function renderStepIndicator(): void {
    const el = document.getElementById('enc-step-indicator');
    if (!el) return;
    el.innerHTML = STEP_ORDER.map((id, idx) => {
        const active = id === state.step;
        const done = STEP_ORDER.indexOf(state.step) > idx;
        return `<span class="enc-step-dot ${active ? 'active' : ''} ${done ? 'done' : ''}">${idx + 1}. ${STEP_LABEL[id]}</span>`;
    }).join('<span class="enc-step-sep">›</span>');
}

function renderNavButtons(): void {
    const prevBtn = document.getElementById('enc-prev') as HTMLButtonElement;
    const nextBtn = document.getElementById('enc-next') as HTMLButtonElement;
    const idx = STEP_ORDER.indexOf(state.step);

    prevBtn.style.visibility = idx === 0 ? 'hidden' : 'visible';
    nextBtn.style.display = state.step === 'result' ? 'none' : '';
    nextBtn.disabled = !canGoNext();

    prevBtn.onclick = () => {
        state.step = STEP_ORDER[Math.max(0, idx - 1)];
        state.result = null;
        rerender();
    };
    nextBtn.onclick = async () => {
        if (!canGoNext()) return;
        const nextIdx = idx + 1;
        if (STEP_ORDER[nextIdx] === 'result') {
            await runCalculation();
        }
        state.step = STEP_ORDER[Math.min(STEP_ORDER.length - 1, nextIdx)];
        rerender();
    };
    document.getElementById('enc-reset')!.onclick = () => {
        state = createInitialState();
        rerender();
    };
}

async function runCalculation(): Promise<void> {
    const negatives = negativeStats();
    let potential = state.originalPotential;
    if (state.autoFindPotential) {
        potential = findMinimumPotential({
            fieldType: state.fieldType,
            isOriginalElement: state.isOriginalElement,
            positiveStats: state.positiveStats,
            negativeStats: negatives,
            settings: state.settings,
        });
    }
    state.resolvedPotential = potential;
    state.orderMode = 'auto';
    state.manualPlaced = [];
    state.manualCustomAmount = {};
    recomputeResult();
}

/** 직접 순서 조정에서 다룰 전체 스탯 목록 (마이너스+플러스). */
function manualAllStats(): EnchantStat[] {
    return [...negativeStats(), ...state.positiveStats];
}

/** 아직 배치되지 않고 남아있는 값 (부호 포함). 0이면 이 스탯은 전부 배치 완료. */
function manualRemaining(stat: EnchantStat): number {
    const placedSum = state.manualPlaced
        .filter(p => p.stat.statKey === stat.statKey)
        .reduce((sum, p) => sum + p.amount, 0);
    return stat.value - placedSum;
}

function recomputeResult(): void {
    const potential = state.resolvedPotential ?? state.originalPotential;
    if (state.orderMode === 'auto') {
        state.result = computeEnchantResult({
            fieldType: state.fieldType,
            isOriginalElement: state.isOriginalElement,
            originalPotential: potential,
            positiveStats: state.positiveStats,
            negativeStats: negativeStats(),
            settings: state.settings,
        });
    } else {
        state.result = computeManualOrderResult({
            fieldType: state.fieldType,
            isOriginalElement: state.isOriginalElement,
            originalPotential: potential,
            orderedSteps: state.manualPlaced,
            positiveStatsCount: state.positiveStats.length,
            settings: state.settings,
        });
    }
}

function renderBody(): void {
    const body = document.getElementById('enc-body')!;
    if (state.step === 'equipment') {
        body.innerHTML = renderEquipmentStepHtml();
        bindEquipmentStep();
    } else if (state.step === 'positive') {
        body.innerHTML = renderStatPickerHtml('positive');
        bindStatPickerStep('positive');
    } else if (state.step === 'negative') {
        body.innerHTML = renderNegativeStepHtml();
        bindNegativeStep();
    } else {
        body.innerHTML = renderResultStepHtml();
        bindResultStep();
    }
}

// ==================== 1. 장비 선택 ====================

function renderEquipmentStepHtml(): string {
    const s = state.settings;
    const materialLabels = catalog!.materialTypes;
    return `
    <div class="enc-card">
      <div class="enc-card-title">⚔️ 장비 종류</div>
      <div class="enc-choice-row">
        <button class="enc-choice-btn ${state.fieldType === 'mainWeapon' && !state.isOriginalElement ? 'active' : ''}" data-field="mainWeapon" data-orig="0">무기</button>
        <button class="enc-choice-btn ${state.fieldType === 'bodyArmor' ? 'active' : ''}" data-field="bodyArmor" data-orig="0">방어구</button>
        <button class="enc-choice-btn ${state.fieldType === 'mainWeapon' && state.isOriginalElement ? 'active' : ''}" data-field="mainWeapon" data-orig="1">무기(속성 유지)</button>
      </div>
    </div>
    <div class="enc-card">
      <div class="enc-card-title">💎 장비 초기 잠재력</div>
      <div class="enc-choice-row">
        <button class="enc-choice-btn ${state.autoFindPotential ? 'active' : ''}" id="enc-auto-potential">자동으로 최소 잠재력 찾기</button>
      </div>
      ${
          state.autoFindPotential
              ? '<div class="enc-hint">성공률 100%를 만족하는 최소 잠재력을 자동으로 계산합니다.</div>'
              : `<div class="enc-inline-input">
             <label>초기 잠재력</label>
             <button class="enc-btn-mini" id="enc-potential-minus" aria-label="감소">−</button>
             <input type="number" id="enc-potential-input" min="1" value="${state.originalPotential}">
             <button class="enc-btn-mini" id="enc-potential-plus" aria-label="증가">+</button>
           </div>`
      }
    </div>
    <div class="enc-card">
      <button class="enc-collapse-toggle" id="enc-advanced-toggle">${state.showAdvanced ? '▲' : '▼'} 고급 설정 (레벨 / 대장 Lv / 소재스킬)</button>
      ${
          state.showAdvanced
              ? `
        <div class="enc-advanced-grid">
          <label>캐릭터 레벨<input type="number" id="enc-level" min="300" max="400" step="10" value="${s.level}"></label>
          <label>대장 레벨<input type="number" id="enc-smith" min="0" max="300" step="10" value="${s.smithLevel}"></label>
          <label>모루 스킬<input type="number" id="enc-anvil" min="20" max="50" step="5" value="${s.materialAnvilSkillLevelSum}"></label>
          <label class="enc-check-inline">
            <input type="checkbox" id="enc-experts2" ${s.hasExpertsCustomization2Skill ? 'checked' : ''}>
            전문 커스터마이징2 보유 (예상 성공률 계산에만 반영)
          </label>
        </div>
        <div class="enc-advanced-grid">
          ${materialLabels
              .map(
                  (name, idx) =>
                      `<label>${name} 소재스킬<input type="number" class="enc-material-skill" data-idx="${idx}" min="5" max="10" value="${s.materialSkillLevels[idx]}"></label>`
              )
              .join('')}
        </div>`
              : ''
      }
    </div>
  `;
}

function bindEquipmentStep(): void {
    document.querySelectorAll<HTMLButtonElement>('.enc-choice-btn[data-field]').forEach(btn => {
        btn.addEventListener('click', () => {
            state.fieldType = btn.dataset.field as EquipmentFieldType;
            state.isOriginalElement = btn.dataset.orig === '1';
            rerender();
        });
    });
    document.getElementById('enc-auto-potential')?.addEventListener('click', () => {
        state.autoFindPotential = !state.autoFindPotential;
        rerender();
    });
    document.getElementById('enc-potential-input')?.addEventListener('input', e => {
        state.originalPotential = Number((e.target as HTMLInputElement).value) || 1;
    });
    document.getElementById('enc-potential-minus')?.addEventListener('click', () => {
        state.originalPotential = Math.max(1, state.originalPotential - 1);
        rerender();
    });
    document.getElementById('enc-potential-plus')?.addEventListener('click', () => {
        state.originalPotential += 1;
        rerender();
    });
    document.getElementById('enc-advanced-toggle')?.addEventListener('click', () => {
        state.showAdvanced = !state.showAdvanced;
        rerender();
    });
    document.getElementById('enc-level')?.addEventListener('input', e => {
        state.settings.level = Number((e.target as HTMLInputElement).value) || 1;
    });
    document.getElementById('enc-smith')?.addEventListener('input', e => {
        state.settings.smithLevel = Number((e.target as HTMLInputElement).value) || 0;
    });
    document.getElementById('enc-anvil')?.addEventListener('input', e => {
        state.settings.materialAnvilSkillLevelSum = Number((e.target as HTMLInputElement).value) || 0;
    });
    document.getElementById('enc-experts2')?.addEventListener('change', e => {
        state.settings.hasExpertsCustomization2Skill = (e.target as HTMLInputElement).checked;
    });
    document.querySelectorAll<HTMLInputElement>('.enc-material-skill').forEach(input => {
        input.addEventListener('input', () => {
            const idx = Number(input.dataset.idx);
            state.settings.materialSkillLevels[idx] = Number(input.value) || 0;
        });
    });
}

// ==================== 2. 정옵션 선택 (버튼형, 팝업 없음) ====================

function renderStatPickerHtml(kind: 'positive'): string {
    const selected = state.positiveStats;
    const remaining = MAX_ABILITY_LINES - selected.length;
    void kind;

    const categoriesHtml = catalog!
        .availableCategories(state.fieldType)
        .map(cat => {
            const chips = cat.items
                .flatMap(item => {
                    const types: StatValueType[] = item.hasMultiplier ? ['constant', 'multiplier'] : ['constant'];
                    return types.map(type => {
                        const key = `${item.id}:${type}`;
                        const isSelected = selected.some(s => s.statKey === key);
                        const label = type === 'multiplier' ? `${item.name}%` : item.name;
                        return `<button class="enc-stat-chip ${isSelected ? 'active' : ''}" data-item="${item.id}" data-type="${type}">${label}</button>`;
                    });
                })
                .join('');
            return `<div class="enc-category-block"><div class="enc-category-title">${cat.title}</div><div class="enc-chip-row">${chips}</div></div>`;
        })
        .join('');

    const selectedHtml =
        selected.length === 0
            ? '<div class="enc-empty-hint">선택된 정옵션이 없습니다. 아래에서 능력을 선택해주세요.</div>'
            : selected
                  .map(stat => {
                      return `
              <div class="enc-selected-row" data-key="${stat.statKey}">
                <span class="enc-selected-label">${stat.showLabel()}</span>
                <button class="enc-btn-mini enc-stepper-btn" data-step="-1" data-key="${stat.statKey}" aria-label="감소">−</button>
                <input type="number" class="enc-selected-value" data-key="${stat.statKey}" min="1" value="${stat.value}">
                <button class="enc-btn-mini enc-stepper-btn" data-step="1" data-key="${stat.statKey}" aria-label="증가">+</button>
                <button class="enc-remove-btn" data-key="${stat.statKey}">✕</button>
              </div>`;
                  })
                  .join('');

    return `
    <div class="enc-card">
      <div class="enc-card-title">➕ 정옵션(플러스) 선택 <span class="enc-count-badge">${selected.length} / ${MAX_ABILITY_LINES}</span></div>
      <div class="enc-hint">최소 1개, 최대 ${MAX_ABILITY_LINES}개까지 선택할 수 있습니다. (남은 슬롯 ${remaining}개)</div>
      <div class="enc-choice-row">
        <button class="enc-choice-btn ${state.positiveAutoFill ? 'active' : ''}" id="enc-autofill-toggle">선택 시 자동으로 상한값 채우기</button>
      </div>
      <div class="enc-selected-list">${selectedHtml}</div>
    </div>
    <div class="enc-card">${categoriesHtml}</div>
  `;
}

function bindStatPickerStep(_kind: 'positive'): void {
    document.getElementById('enc-autofill-toggle')?.addEventListener('click', () => {
        state.positiveAutoFill = !state.positiveAutoFill;
        rerender();
    });
    document.querySelectorAll<HTMLButtonElement>('.enc-stat-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            const itemId = btn.dataset.item!;
            const type = btn.dataset.type as StatValueType;
            togglePositiveStat(itemId, type);
            rerender();
        });
    });
    document.querySelectorAll<HTMLInputElement>('.enc-selected-value').forEach(input => {
        input.addEventListener('change', () => {
            const key = input.dataset.key!;
            const stat = state.positiveStats.find(s => s.statKey === key);
            if (!stat) return;
            stat.value = Math.max(1, Number(input.value) || 1);
            rerender();
        });
    });
    document.querySelectorAll<HTMLButtonElement>('.enc-stepper-btn[data-key]').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.key!;
            const stat = state.positiveStats.find(s => s.statKey === key);
            if (!stat) return;
            const delta = Number(btn.dataset.step);
            stat.value = Math.max(1, stat.value + delta);
            rerender();
        });
    });
    document.querySelectorAll<HTMLButtonElement>('.enc-remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.key!;
            state.positiveStats = state.positiveStats.filter(s => s.statKey !== key);
            rerender();
        });
    });
}

function findCatalogItem(itemId: string): StatItem | null {
    for (const cat of catalog!.categories) {
        const found = cat.items.find(i => i.id === itemId);
        if (found) return found;
    }
    return null;
}

function togglePositiveStat(itemId: string, type: StatValueType): void {
    const key = `${itemId}:${type}`;
    const existingIdx = state.positiveStats.findIndex(s => s.statKey === key);
    if (existingIdx !== -1) {
        state.positiveStats.splice(existingIdx, 1);
        return;
    }
    if (state.positiveStats.length >= MAX_ABILITY_LINES) return;
    const item = findCatalogItem(itemId);
    if (!item) return;
    const { max } = item.getLimit(type, state.fieldType, state.isOriginalElement, state.settings.level);
    const value = state.positiveAutoFill ? max : 1;
    state.positiveStats.push(new EnchantStat(item, type, Math.max(1, value)));
}

// ==================== 3. 마이너스옵션 선택 ====================

function renderNegativeStepHtml(): string {
    const remainingSlots = MAX_ABILITY_LINES - state.positiveStats.length;
    const negatives = negativeStats();

    const modeButtons = `
    <div class="enc-choice-row">
      <button class="enc-choice-btn ${state.negativeMode === 'auto' ? 'active' : ''}" data-mode="auto">자동 선택</button>
      <button class="enc-choice-btn ${state.negativeMode === 'manual' ? 'active' : ''}" data-mode="manual">직접 선택</button>
    </div>`;

    if (state.negativeMode === 'auto') {
        const goalButtons = `
      <div class="enc-choice-row">
        <button class="enc-choice-btn ${state.negativeAutoGoal === 'successRate' ? 'active' : ''}" data-goal="successRate">🎯 성공률 우선</button>
        <button class="enc-choice-btn ${state.negativeAutoGoal === 'material' ? 'active' : ''}" data-goal="material">💰 재료 절약</button>
      </div>`;
        const listHtml =
            negatives.length === 0
                ? '<div class="enc-empty-hint">제거할 수 있는 능력이 없습니다 (정옵션 슬롯이 가득 찼을 수 있습니다).</div>'
                : negatives.map(stat => `<div class="enc-selected-row"><span class="enc-selected-label">${stat.showLabel()}</span></div>`).join('');
        return `
      <div class="enc-card">
        <div class="enc-card-title">➖ 마이너스옵션(자동) <span class="enc-count-badge">${negatives.length} / ${remainingSlots}</span></div>
        <div class="enc-hint">남은 ${remainingSlots}개의 슬롯을 자동으로 채웁니다. 목표를 선택하세요.</div>
        ${modeButtons}
        ${goalButtons}
        <div class="enc-inline-input">
          <label>자동 선택 개수 (비우면 최대)</label>
          <input type="number" id="enc-auto-count" min="0" max="${remainingSlots}" value="${state.negativeAutoCount ?? ''}" placeholder="${remainingSlots}">
        </div>
        <div class="enc-selected-list">${listHtml}</div>
      </div>
    `;
    }

    const selectedHtml =
        state.negativeStatsManual.length === 0
            ? '<div class="enc-empty-hint">선택된 마이너스옵션이 없습니다.</div>'
            : state.negativeStatsManual
                  .map(stat => {
                      return `
            <div class="enc-selected-row" data-key="${stat.statKey}">
              <span class="enc-selected-label">${stat.showLabel()}</span>
              <button class="enc-btn-mini enc-neg-stepper-btn" data-step="-1" data-key="${stat.statKey}" aria-label="더 감소">−</button>
              <input type="number" class="enc-neg-value" data-key="${stat.statKey}" max="-1" value="${stat.value}">
              <button class="enc-btn-mini enc-neg-stepper-btn" data-step="1" data-key="${stat.statKey}" aria-label="덜 감소">+</button>
              <button class="enc-remove-btn" data-neg-key="${stat.statKey}">✕</button>
            </div>`;
                  })
                  .join('');

    const usedKeys = new Set([...state.positiveStats, ...state.negativeStatsManual].map(s => s.statKey));
    const categoriesHtml = catalog!
        .availableCategories(state.fieldType)
        .map(cat => {
            const chips = cat.items
                .flatMap(item => {
                    const types: StatValueType[] = item.hasMultiplier ? ['constant', 'multiplier'] : ['constant'];
                    return types
                        .filter(type => {
                            const { min } = item.getLimit(type, state.fieldType, state.isOriginalElement, state.settings.level);
                            return min < 0;
                        })
                        .map(type => {
                            const key = `${item.id}:${type}`;
                            const isSelected = usedKeys.has(key) && state.negativeStatsManual.some(s => s.statKey === key);
                            const label = type === 'multiplier' ? `${item.name}%` : item.name;
                            const disabled = usedKeys.has(key) && !isSelected;
                            return `<button class="enc-stat-chip ${isSelected ? 'active' : ''}" ${disabled ? 'disabled' : ''} data-neg-item="${item.id}" data-neg-type="${type}">${label}</button>`;
                        });
                })
                .join('');
            return chips ? `<div class="enc-category-block"><div class="enc-category-title">${cat.title}</div><div class="enc-chip-row">${chips}</div></div>` : '';
        })
        .join('');

    return `
    <div class="enc-card">
      <div class="enc-card-title">➖ 마이너스옵션(직접) <span class="enc-count-badge">${state.negativeStatsManual.length} / ${remainingSlots}</span></div>
      ${modeButtons}
      <div class="enc-selected-list">${selectedHtml}</div>
    </div>
    <div class="enc-card">${categoriesHtml}</div>
  `;
}

function bindNegativeStep(): void {
    document.querySelectorAll<HTMLButtonElement>('.enc-choice-btn[data-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
            state.negativeMode = btn.dataset.mode as NegativeMode;
            rerender();
        });
    });
    document.querySelectorAll<HTMLButtonElement>('.enc-choice-btn[data-goal]').forEach(btn => {
        btn.addEventListener('click', () => {
            state.negativeAutoGoal = btn.dataset.goal as AutoGoal;
            rerender();
        });
    });
    document.getElementById('enc-auto-count')?.addEventListener('input', e => {
        const v = (e.target as HTMLInputElement).value;
        state.negativeAutoCount = v === '' ? null : Math.max(0, Number(v));
        rerender();
    });
    document.querySelectorAll<HTMLButtonElement>('[data-neg-item]').forEach(btn => {
        if (btn.disabled) return;
        btn.addEventListener('click', () => {
            const itemId = btn.dataset.negItem!;
            const type = btn.dataset.negType as StatValueType;
            toggleNegativeStat(itemId, type);
            rerender();
        });
    });
    document.querySelectorAll<HTMLInputElement>('.enc-neg-value').forEach(input => {
        input.addEventListener('change', () => {
            const key = input.dataset.key!;
            const stat = state.negativeStatsManual.find(s => s.statKey === key);
            if (!stat) return;
            stat.value = Math.min(-1, Number(input.value) || -1);
            rerender();
        });
    });
    document.querySelectorAll<HTMLButtonElement>('.enc-neg-stepper-btn[data-key]').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.key!;
            const stat = state.negativeStatsManual.find(s => s.statKey === key);
            if (!stat) return;
            const delta = Number(btn.dataset.step);
            stat.value = Math.min(-1, stat.value + delta);
            rerender();
        });
    });
    document.querySelectorAll<HTMLButtonElement>('[data-neg-key]').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.negKey!;
            state.negativeStatsManual = state.negativeStatsManual.filter(s => s.statKey !== key);
            rerender();
        });
    });
}

function toggleNegativeStat(itemId: string, type: StatValueType): void {
    const key = `${itemId}:${type}`;
    const existingIdx = state.negativeStatsManual.findIndex(s => s.statKey === key);
    if (existingIdx !== -1) {
        state.negativeStatsManual.splice(existingIdx, 1);
        return;
    }
    if (state.negativeStatsManual.length >= MAX_ABILITY_LINES - state.positiveStats.length) return;
    const item = findCatalogItem(itemId);
    if (!item) return;
    const { min } = item.getLimit(type, state.fieldType, state.isOriginalElement, state.settings.level);
    if (min >= 0) return;
    state.negativeStatsManual.push(new EnchantStat(item, type, min));
}

// ==================== 4. 결과 ====================

function stepLabelHtml(step: EnchantStepResult): string {
    if (step.type === 'each' && step.stats.length === 1) {
        const stat = step.stats[0];
        const negative = stat.value < 0;
        const unit = stat.type === 'multiplier' ? '%' : '';
        const sign = stat.value > 0 ? '+' : '-';
        return `<span class="enc-result-step-label ${negative ? 'negative' : ''}">${stat.item.name}${unit} 1단위씩 반복 → ${sign}${Math.abs(stat.value)}${unit} (${step.repeatCount}회)</span>`;
    }
    return step.stats
        .map(stat => `<span class="enc-result-step-label ${stat.value < 0 ? 'negative' : ''}">${stat.showLabel()}</span>`)
        .join(' ');
}

function renderManualBuilderHtml(): string {
    const stats = manualAllStats();
    const paletteHtml = stats
        .map(stat => {
            const remaining = manualRemaining(stat);
            if (remaining === 0) return '';
            const sign = remaining > 0 ? 1 : -1;
            const customValue = state.manualCustomAmount[stat.statKey] ?? '';
            return `
        <div class="enc-palette-row">
          <span class="enc-selected-label ${remaining < 0 ? 'negative' : ''}">${stat.showValueLabel(remaining)} 남음</span>
          <div class="enc-palette-actions">
            <button class="enc-btn-mini enc-place-btn" data-key="${stat.statKey}" data-amount="${sign}">+1</button>
            <button class="enc-btn-mini enc-place-btn" data-key="${stat.statKey}" data-amount="${remaining}">전부</button>
            <input type="number" class="enc-palette-custom" data-key="${stat.statKey}" placeholder="수치" value="${customValue}">
            <button class="enc-btn-mini enc-place-custom-btn" data-key="${stat.statKey}" aria-label="입력한 만큼 추가">+</button>
          </div>
        </div>`;
        })
        .join('');

    const orderListHtml =
        state.manualPlaced.length === 0
            ? '<div class="enc-empty-hint">아직 배치된 옵션이 없습니다. 위에서 버튼을 눌러 순서를 만들어보세요.</div>'
            : state.manualPlaced
                  .map((placed, idx) => {
                      const negative = placed.amount < 0;
                      return `
          <div class="enc-order-row" data-idx="${idx}">
            <span class="enc-order-drag-handle" data-idx="${idx}" aria-label="드래그해서 순서 변경">⠿</span>
            <span class="enc-order-num">${idx + 1}</span>
            <span class="enc-selected-label ${negative ? 'negative' : ''}">${placed.stat.showValueLabel(placed.amount)}</span>
            <button class="enc-btn-mini" data-move="up" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''} aria-label="위로">▲</button>
            <button class="enc-btn-mini" data-move="down" data-idx="${idx}" ${idx === state.manualPlaced.length - 1 ? 'disabled' : ''} aria-label="아래로">▼</button>
            <button class="enc-remove-btn" data-remove-idx="${idx}" aria-label="제거">✕</button>
          </div>`;
                  })
                  .join('');

    const allPlaced = stats.every(stat => manualRemaining(stat) === 0);

    return `
    <div class="enc-card">
      <div class="enc-card-title">🧩 배치 가능한 옵션</div>
      <div class="enc-hint">버튼을 눌러 원하는 만큼 순서 목록 맨 뒤에 배치하세요.</div>
      <div class="enc-selected-list">${paletteHtml || '<div class="enc-empty-hint">모든 옵션을 배치했습니다.</div>'}</div>
    </div>
    <div class="enc-card">
      <div class="enc-card-title">📐 만든 순서 ${allPlaced ? '' : '<span class="enc-count-badge">배치 중</span>'}</div>
      <div class="enc-hint">⠿를 드래그하거나 ▲▼로 순서를 바꿀 수 있습니다.</div>
      <div class="enc-order-list">${orderListHtml}</div>
    </div>
  `;
}

function renderResultStepHtml(): string {
    const result = state.result;
    if (!result) return '<div class="enc-card">계산 중 오류가 발생했습니다.</div>';

    const successLabel = result.successRate === -1 ? '무제한(항상 성공)' : `${result.successRate.toFixed(1)}%`;
    const expectedLabel = `${result.expectedSuccessRate.toFixed(1)}%`;

    const stepsHtml = result.steps
        .map((step, idx) => {
            return `
        <div class="enc-result-step">
          <span class="enc-result-step-num">${idx + 1}.</span>
          ${stepLabelHtml(step)}
          <span class="enc-result-step-cost">잠재력 ${step.potentialCost >= 0 ? '-' : '+'}${Math.abs(step.potentialCost)}</span>
          <span class="enc-result-step-remain">잔여 ${step.remainingPotential}</span>
        </div>`;
        })
        .join('');

    const materialsHtml = catalog!.materialTypes
        .map((name, idx) => `<span class="enc-material-pill">${name} <b>${result.materialCostByType[idx].toLocaleString()}</b></span>`)
        .join('');

    const manualBuilderHtml = state.orderMode === 'manual' ? renderManualBuilderHtml() : '';

    return `
    <div class="enc-card">
      <div class="enc-card-title">🔀 부여 순서 방식</div>
      <div class="enc-choice-row">
        <button class="enc-choice-btn ${state.orderMode === 'auto' ? 'active' : ''}" data-order="auto">자동 순서(추천)</button>
        <button class="enc-choice-btn ${state.orderMode === 'manual' ? 'active' : ''}" data-order="manual">직접 순서 조정</button>
      </div>
    </div>
    ${manualBuilderHtml}
    <div id="enc-result-capture">
      <div class="enc-card">
        <div class="enc-card-title">📋 부여 순서</div>
        ${state.autoFindPotential ? `<div class="enc-hint">자동으로 찾은 최소 잠재력: <b>${state.resolvedPotential}</b></div>` : ''}
        <div class="enc-result-steps">${stepsHtml}</div>
      </div>
      <div class="enc-card">
        <div class="enc-card-title">🧪 재료비 (소재타입별 합계)</div>
        <div class="enc-material-row">${materialsHtml}</div>
      </div>
      <div class="enc-card">
        <div class="enc-card-title">⭐ 성공률</div>
        <div class="enc-success-row">
          <div class="enc-success-box"><div class="enc-success-label">성공률</div><div class="enc-success-value">${successLabel}</div></div>
          <div class="enc-success-box"><div class="enc-success-label">예상 성공률</div><div class="enc-success-value">${expectedLabel}</div></div>
        </div>
        ${result.insufficientPotential ? '<div class="enc-warning">⚠️ 잠재력이 부족한 순서가 포함되어 있습니다. 잠재력을 늘리거나 옵션 수를 줄여보세요.</div>' : ''}
      </div>
    </div>
    <div class="enc-export-row">
      <button class="enc-choice-btn" id="enc-save-image">📸 이미지로 저장</button>
      <button class="enc-choice-btn" id="enc-save-text">📋 텍스트로 복사</button>
    </div>
    <textarea class="enc-text-export" id="enc-text-export" readonly style="display:none;"></textarea>
  `;
}

function buildResultText(): string {
    const result = state.result;
    if (!result) return '';
    const equipLabel = state.fieldType === 'bodyArmor' ? '방어구' : state.isOriginalElement ? '무기(속성 유지)' : '무기';
    const successLabel = result.successRate === -1 ? '무제한(항상 성공)' : `${result.successRate.toFixed(1)}%`;
    const expectedLabel = `${result.expectedSuccessRate.toFixed(1)}%`;
    const stepsText = result.steps
        .map((step, idx) => {
            const label =
                step.type === 'each' && step.stats.length === 1
                    ? `${step.stats[0].item.name}${step.stats[0].type === 'multiplier' ? '%' : ''} 1단위씩 반복 → ${step.stats[0].value > 0 ? '+' : ''}${step.stats[0].value}${step.stats[0].type === 'multiplier' ? '%' : ''} (${step.repeatCount}회)`
                    : step.stats.map(s => s.showLabel()).join(', ');
            return `${idx + 1}. ${label} | 잠재력 ${step.potentialCost >= 0 ? '-' : '+'}${Math.abs(step.potentialCost)} | 잔여 ${step.remainingPotential}`;
        })
        .join('\n');
    const materialsText = catalog!.materialTypes
        .map((name, idx) => `${name} ${result.materialCostByType[idx].toLocaleString()}`)
        .join(' | ');

    return [
        `✩ 장비: ${equipLabel}`,
        `✩ 초기 잠재력: ${state.resolvedPotential ?? state.originalPotential}`,
        '',
        '✩ 부여 순서',
        stepsText,
        '',
        `✩ 재료비: ${materialsText}`,
        '',
        `✩ 성공률: ${successLabel}`,
        `✩ 예상 성공률: ${expectedLabel}`,
        '',
        '(토람 종합 정보툴 우로보로스 - 옵션부여 계산기)',
    ].join('\n');
}

function bindResultStep(): void {
    document.querySelectorAll<HTMLButtonElement>('.enc-choice-btn[data-order]').forEach(btn => {
        btn.addEventListener('click', () => {
            state.orderMode = btn.dataset.order as OrderMode;
            recomputeResult();
            rerender();
        });
    });
    document.querySelectorAll<HTMLButtonElement>('.enc-btn-mini[data-move]').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = Number(btn.dataset.idx);
            const dir = btn.dataset.move === 'up' ? -1 : 1;
            const target = idx + dir;
            if (target < 0 || target >= state.manualPlaced.length) return;
            const arr = state.manualPlaced;
            [arr[idx], arr[target]] = [arr[target], arr[idx]];
            recomputeResult();
            rerender();
        });
    });
    document.querySelectorAll<HTMLButtonElement>('[data-remove-idx]').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = Number(btn.dataset.removeIdx);
            state.manualPlaced.splice(idx, 1);
            recomputeResult();
            rerender();
        });
    });
    document.querySelectorAll<HTMLButtonElement>('.enc-place-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.key!;
            const amount = Number(btn.dataset.amount);
            const stat = manualAllStats().find(s => s.statKey === key);
            if (!stat || amount === 0) return;
            state.manualPlaced.push({ stat, amount });
            recomputeResult();
            rerender();
        });
    });
    document.querySelectorAll<HTMLInputElement>('.enc-palette-custom').forEach(input => {
        input.addEventListener('input', () => {
            state.manualCustomAmount[input.dataset.key!] = input.value;
        });
    });
    document.querySelectorAll<HTMLButtonElement>('.enc-place-custom-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.key!;
            const stat = manualAllStats().find(s => s.statKey === key);
            if (!stat) return;
            const remaining = manualRemaining(stat);
            const raw = Number(state.manualCustomAmount[key]);
            if (!raw) return;
            const sign = remaining > 0 ? 1 : -1;
            const amount = sign * Math.min(Math.abs(raw), Math.abs(remaining));
            if (amount === 0) return;
            state.manualPlaced.push({ stat, amount });
            delete state.manualCustomAmount[key];
            recomputeResult();
            rerender();
        });
    });
    document.getElementById('enc-save-image')?.addEventListener('click', () => {
        void saveResultAsImage();
    });
    document.getElementById('enc-save-text')?.addEventListener('click', () => {
        void saveResultAsText();
    });
    bindManualOrderDrag();
}

/** 순서 목록의 각 행을 손가락/마우스로 잡아 드래그로 재배치할 수 있게 한다. */
function bindManualOrderDrag(): void {
    const list = document.querySelector<HTMLElement>('.enc-order-list');
    if (!list) return;

    const getRows = () => [...list.querySelectorAll<HTMLElement>('.enc-order-row')];

    let dragEl: HTMLElement | null = null;

    const renumber = () => {
        getRows().forEach((row, visualIdx) => {
            const numEl = row.querySelector('.enc-order-num');
            if (numEl) numEl.textContent = String(visualIdx + 1);
        });
    };

    const onPointerMove = (e: PointerEvent) => {
        if (!dragEl) return;
        e.preventDefault();
        const rows = getRows().filter(r => r !== dragEl);
        const y = e.clientY;
        let target: HTMLElement | null = null;
        for (const row of rows) {
            const rect = row.getBoundingClientRect();
            if (y < rect.top + rect.height / 2) {
                target = row;
                break;
            }
        }
        if (target) {
            if (target !== dragEl.nextSibling) list.insertBefore(dragEl, target);
        } else {
            const last = rows[rows.length - 1];
            if (last && last.nextSibling !== dragEl) list.insertBefore(dragEl, last.nextSibling);
        }
        renumber();
    };

    const onPointerUp = () => {
        if (!dragEl) return;
        dragEl.classList.remove('dragging');
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);

        const newOrder = getRows().map(row => Number(row.dataset.idx));
        state.manualPlaced = newOrder.map(i => state.manualPlaced[i]);

        dragEl = null;
        recomputeResult();
        rerender();
    };

    document.querySelectorAll<HTMLElement>('.enc-order-drag-handle').forEach(handle => {
        handle.addEventListener('pointerdown', e => {
            e.preventDefault();
            const row = handle.closest('.enc-order-row') as HTMLElement | null;
            if (!row) return;
            dragEl = row;
            row.classList.add('dragging');
            document.addEventListener('pointermove', onPointerMove);
            document.addEventListener('pointerup', onPointerUp);
        });
    });
}

async function saveResultAsText(): Promise<void> {
    const text = buildResultText();
    const textarea = document.getElementById('enc-text-export') as HTMLTextAreaElement | null;
    const btn = document.getElementById('enc-save-text') as HTMLButtonElement | null;
    if (textarea) {
        textarea.value = text;
        textarea.style.display = 'block';
    }
    try {
        await navigator.clipboard.writeText(text);
        if (btn) {
            const original = btn.textContent;
            btn.textContent = '✅ 복사됨!';
            setTimeout(() => {
                btn.textContent = original;
            }, 1500);
        }
    } catch {
        // 클립보드 권한이 없는 환경이면 textarea에 표시된 텍스트를 직접 선택해 복사하도록 안내
        textarea?.select();
    }
}

async function saveResultAsImage(): Promise<void> {
    const target = document.getElementById('enc-result-capture');
    if (!target) return;
    const btn = document.getElementById('enc-save-image') as HTMLButtonElement | null;
    if (btn) {
        btn.disabled = true;
        btn.textContent = '이미지 생성 중...';
    }
    try {
        const html2canvas = (await import('html2canvas')).default;
        const canvas = await html2canvas(target, {
            backgroundColor: getComputedStyle(document.body).backgroundColor || '#ffffff',
            scale: 2,
        });
        const link = document.createElement('a');
        link.download = `옵션부여_결과_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch {
        alert('이미지 저장에 실패했습니다.');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '📸 결과 이미지로 저장';
        }
    }
}
