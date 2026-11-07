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

type NegativeMode = 'manual' | 'auto';
type AutoGoal = 'successRate' | 'material';
type OrderMode = 'auto' | 'manual';

interface EnchantState {
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
    negativeAutoCountOn: boolean; // 꺼져 있으면(기본) 남은 슬롯을 항상 최대로 채운다
    negativeAutoCount: number | null;
    negativeStatsManual: EnchantStat[];
    result: EnchantResult | null;
    resolvedPotential: number | null;
    orderMode: OrderMode;
    manualPlaced: ManualPlacedStep[];
    manualCustomAmount: Record<string, string>; // statKey -> 커스텀 수치 입력값
}

let skillsOpen = false;
// 자동화 상자는 평소에 접어 두고, 눌렀을 때만 펼친다
let autoOpen = false;

let catalog: EnchantCatalog | null = null;
let state: EnchantState = createInitialState();

function createInitialState(): EnchantState {
    return {
        fieldType: 'mainWeapon',
        isOriginalElement: false,
        originalPotential: 90,
        autoFindPotential: false,
        settings: defaultCharacterSettings(),
        showAdvanced: false,
        positiveStats: [],
        positiveAutoFill: true, // 정옵션을 고르면 상한값이 항상 자동으로 채워진다
        negativeMode: 'auto',
        negativeAutoGoal: 'successRate',
        negativeAutoCountOn: false,
        negativeAutoCount: null,
        negativeStatsManual: [],
        result: null,
        resolvedPotential: null,
        orderMode: 'auto',
        manualPlaced: [],
        manualCustomAmount: {},
    };
}

function negativeStats(): EnchantStat[] {
    if (state.negativeMode === 'auto') {
        return computeAutoNegativeStats();
    }
    return state.negativeStatsManual;
}

// 같은 입력이면 다시 계산하지 않는다 (한 번 그릴 때 여러 번 불리고, 후보 교체 계산이 무겁다)
let autoNegativeCache: { key: string; value: EnchantStat[] } | null = null;

function computeAutoNegativeStats(): EnchantStat[] {
    if (!catalog) return [];
    const potential = state.autoFindPotential ? null : state.originalPotential;
    const key = JSON.stringify([
        state.fieldType, state.isOriginalElement, state.settings, potential, state.negativeAutoGoal, state.negativeAutoCountOn, state.negativeAutoCount,
        state.positiveStats.map(st => `${st.statKey}=${st.value}`),
    ]);
    if (autoNegativeCache?.key === key) return autoNegativeCache.value;

    const usedKeys = new Set(state.positiveStats.map(st => st.statKey));
    const candidates: { item: StatItem; type: StatValueType }[] = [];
    catalog.availableCategories(state.fieldType).forEach(cat => {
        cat.items.forEach(item => {
            (['constant', 'multiplier'] as StatValueType[]).forEach(type => {
                if (type === 'multiplier' && !item.hasMultiplier) return;
                if (usedKeys.has(`${item.id}:${type}`)) return;
                if (item.isToggle(type)) return; // 속성 부여처럼 켜고 끄는 항목은 마이너스로 쓸 수 없다
                const { min } = item.getLimit(type, state.fieldType, state.isOriginalElement, state.settings.level);
                if (min >= 0) return;
                candidates.push({ item, type });
            });
        });
    });
    // 개수 지정이 꺼져 있으면 남은 슬롯을 최대로 채운다
    const slots = MAX_ABILITY_LINES - state.positiveStats.length;
    const value = autoSelectNegativeStats({
        candidates,
        count: Math.max(0, state.negativeAutoCountOn ? Math.min(state.negativeAutoCount ?? slots, slots) : slots),
        mode: state.negativeAutoGoal,
        fieldType: state.fieldType,
        isOriginalElement: state.isOriginalElement,
        level: state.settings.level,
        settings: state.settings,
        positiveStats: state.positiveStats,
        originalPotential: potential,
    });
    autoNegativeCache = { key, value };
    return value;
}

// host 를 주면 계산기 탭 안에 넣어 그리고(홈 버튼 없음), 없으면 예전처럼 페이지 전체를 그린다.
// 한 화면 시뮬레이터: 장비·설정 / 정옵션 / 마이너스(자동화) / 결과를 동시에 보여 주고, 입력이 바뀌면 결과를 바로 다시 계산한다.
export async function renderEnchantPage(host?: HTMLElement): Promise<void> {
    const target = host ?? document.querySelector<HTMLDivElement>('#app')!;
    state = createInitialState();
    lastSignature = '';

    target.innerHTML = `
    ${host ? '' : `<div class="nav-bar">
      <button class="btn-home" id="back-home">🏠 Home</button>
      <h2 style="margin:0 0 0 15px; border:none;">🧪 옵션부여 시뮬레이터</h2>
    </div>`}
    <div class="${host ? 'enc-embedded' : 'container'} enc-plaza">
      <div class="pz-head">
        <h3>옵션부여 시뮬레이터</h3>
        <div class="pz-head-actions">
          <button type="button" class="pz-btn" id="enc-reset">새로 시작</button>
        </div>
      </div>
      <div class="pz-layout">
        <section class="pz-center">
          <div id="enc-sec-equip"></div>
          <div id="enc-sec-result"></div>
        </section>
        <aside class="pz-right">
          <div id="enc-sec-positive"></div>
          <div class="pz-auto">
            <div class="pz-auto-tag">자동화 · 추가 기능</div>
            <div id="enc-sec-negative"></div>
          </div>
        </aside>
      </div>
    </div>
  `;

    document.getElementById('back-home')?.addEventListener('click', () => history.back());
    document.getElementById('enc-reset')!.addEventListener('click', () => {
        state = createInitialState();
        lastSignature = '';
        rerender();
    });

    try {
        catalog = await loadEnchantCatalog();
    } catch {
        document.getElementById('enc-sec-equip')!.innerHTML =
            '<div class="enc-card enc-error">옵션부여 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>';
        return;
    }

    rerender();
}

// 입력이 바뀌었는지 판단하는 값. 같으면 직접 순서 조정 같은 결과 쪽 상태를 그대로 둔다.
let lastSignature = '';

function inputSignature(): string {
    const stat = (s: EnchantStat): string => `${s.statKey}=${s.value}`;
    return JSON.stringify([
        state.fieldType, state.isOriginalElement, state.originalPotential, state.autoFindPotential, state.settings,
        state.positiveStats.map(stat), state.positiveAutoFill,
        state.negativeMode, state.negativeAutoGoal, state.negativeAutoCountOn, state.negativeAutoCount, state.negativeStatsManual.map(stat),
    ]);
}

function rerender(): void {
    if (!catalog) return;
    // 정옵션이 있으면 입력이 바뀔 때마다 결과를 다시 계산한다.
    if (state.positiveStats.length === 0) {
        state.result = null;
        lastSignature = '';
    } else if (inputSignature() !== lastSignature) {
        runCalculation();
        lastSignature = inputSignature();
    }
    renderSections();
}

function renderSections(): void {
    const equip = document.getElementById('enc-sec-equip');
    const positive = document.getElementById('enc-sec-positive');
    const negative = document.getElementById('enc-sec-negative');
    const result = document.getElementById('enc-sec-result');
    if (!equip || !positive || !negative || !result) return;

    // 다시 그려도 스크롤 위치가 맨 위로 튀지 않도록 기억해 두었다가 되돌린다.
    const pageY = window.scrollY;
    const inner = ['.pz-pick-scroll', '.pz-steps-scroll'].map(sel => document.querySelector<HTMLElement>(sel)?.scrollTop ?? 0);

    const waiting = state.positiveStats.length === 0 || !state.result;
    equip.innerHTML = renderEquipmentStepHtml();
    positive.innerHTML = renderStatPickerHtml('positive');
    negative.innerHTML = renderAutoBoxHtml();
    result.innerHTML = renderResultStepHtml(waiting);

    bindEquipmentStep();
    bindStatPickerStep('positive');
    document.getElementById('enc-auto-toggle')?.addEventListener('click', () => { autoOpen = !autoOpen; rerender(); });
    if (autoOpen) bindNegativeStep();
    if (!waiting) bindResultStep();

    ['.pz-pick-scroll', '.pz-steps-scroll'].forEach((sel, i) => {
        const el = document.querySelector<HTMLElement>(sel);
        if (el) el.scrollTop = inner[i];
    });
    window.scrollTo(window.scrollX, pageY);
}

function runCalculation(): void {
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
    const placedSum = state.manualPlaced.reduce((sum, p) => {
        if (p.members) return sum + p.members.filter(m => m.stat.statKey === stat.statKey).reduce((a, m) => a + m.amount, 0);
        return p.stat.statKey === stat.statKey ? sum + p.amount * (p.repeat ?? 1) : sum;
    }, 0);
    return stat.value - placedSum;
}

/** "직접 순서 조정"을 누르면 자동으로 짠 부여 단계를 그대로 넘겨받아 거기서부터 순서를 고친다. */
function seedManualFromAuto(): void {
    state.manualPlaced = [];
    state.manualCustomAmount = {};
    const result = state.result;
    if (!result) return;
    const all = manualAllStats();
    const cumulative = new Map<string, number>();
    result.steps.forEach(step => {
        const repeat = step.repeatCount ?? 1;
        if (step.type === 'each' && step.stats.length === 1 && repeat > 1) {
            const shown = step.stats[0];
            const sign = shown.value > 0 ? 1 : -1;
            state.manualPlaced.push({ stat: all.find(x => x.statKey === shown.statKey) ?? shown, amount: sign, repeat });
            cumulative.set(shown.statKey, (cumulative.get(shown.statKey) ?? 0) + sign * repeat);
            return;
        }
        const members = step.stats
            .map(shown => {
                const amount = shown.value - (cumulative.get(shown.statKey) ?? 0);
                cumulative.set(shown.statKey, shown.value);
                return { stat: all.find(x => x.statKey === shown.statKey) ?? shown, amount };
            })
            .filter(m => m.amount !== 0);
        if (members.length === 0) return;
        if (members.length === 1) {
            state.manualPlaced.push({ stat: members[0].stat, amount: members[0].amount, repeat: 1 });
        } else {
            state.manualPlaced.push({ stat: members[0].stat, amount: members[0].amount, repeat: 1, members });
        }
    });
}

/** 한 번 배치한다. 직전 줄과 같은 스탯의 ±1이면 새 줄을 만들지 않고 반복 횟수만 올린다. */
function placeManual(stat: EnchantStat, amount: number): void {
    if (amount === 0) return;
    const last = state.manualPlaced[state.manualPlaced.length - 1];
    if (Math.abs(amount) === 1 && last && !last.members && last.stat.statKey === stat.statKey && last.amount === amount) {
        last.repeat = (last.repeat ?? 1) + 1;
    } else {
        state.manualPlaced.push({ stat, amount, repeat: 1 });
    }
    recomputeResult();
    rerender();
}

function manualAmountFor(stat: EnchantStat): number {
    const remaining = manualRemaining(stat);
    const limit = Math.abs(remaining);
    const raw = Math.trunc(Number(state.manualCustomAmount[stat.statKey] ?? 1)) || 1;
    return Math.max(1, Math.min(raw, limit));
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

function renderEquipmentStepHtml(): string {
    const s = state.settings;
    const materialLabels = catalog!.materialTypes;
    const typeBtn = (field: EquipmentFieldType, orig: boolean, label: string): string => {
        const on = state.fieldType === field && state.isOriginalElement === orig;
        return `<button type="button" class="pz-btn ${on ? 'pz-btn-primary' : ''}" data-field="${field}" data-orig="${orig ? 1 : 0}">${label}</button>`;
    };
    return `
    <div class="pz-panel">
      <div class="pz-label" style="margin-bottom:6px;">장비 종류</div>
      <div class="pz-row pz-types-row">
        ${typeBtn('mainWeapon', false, '무기')}
        ${typeBtn('bodyArmor', false, '방어구')}
        ${typeBtn('mainWeapon', true, '무기(속성 유지)')}
      </div>
      <div class="pz-row" style="margin-top:10px;">
        <button type="button" class="pz-btn pz-btn-primary pz-grow" id="enc-auto-potential">${state.autoFindPotential ? '✔ 최소 잠재력 자동 찾기 (켜짐)' : '최소 잠재력 자동 찾기'}</button>
      </div>
      <div class="pz-fields">
        <label class="pz-field">레벨<input type="number" id="enc-level" min="300" max="400" step="10" value="${s.level}"></label>
        <label class="pz-field">숙련도<input type="number" id="enc-smith" min="0" max="300" step="10" value="${s.smithLevel}"></label>
        <label class="pz-field">모루 스킬<input type="number" id="enc-anvil" min="20" max="50" step="5" value="${s.materialAnvilSkillLevelSum}"></label>
        <div class="pz-field">소재 스킬<button type="button" class="pz-btn ${skillsOpen ? 'on' : ''}" id="enc-skill-toggle">${skillsOpen ? '접기' : '설정'}</button></div>
      </div>
      <label class="pz-check"><input type="checkbox" id="enc-experts2" ${s.hasExpertsCustomization2Skill ? 'checked' : ''}> 전문 커스터마이징2 보유 <small>(예상 성공률에만 반영)</small></label>
      ${skillsOpen ? `<div class="pz-skills">${materialLabels.map((name, idx) => `<label class="pz-field">${name}<input type="number" class="enc-material-skill" data-idx="${idx}" min="5" max="10" value="${s.materialSkillLevels[idx]}"></label>`).join('')}</div>` : ''}
      ${state.autoFindPotential
          ? `<div class="pz-hint">성공률 100%를 만족하는 최소 잠재력을 자동으로 계산합니다.${state.resolvedPotential != null && state.positiveStats.length ? ` (현재 <b>${state.resolvedPotential}</b>)` : ''}</div>`
          : `<div class="pz-potential">
               <span class="pz-label">잠재력</span>
               <button type="button" class="pz-mini" id="enc-potential-minus" aria-label="감소">−</button>
               <input type="range" id="enc-potential-range" min="1" max="200" value="${Math.min(200, state.originalPotential)}">
               <button type="button" class="pz-mini" id="enc-potential-plus" aria-label="증가">+</button>
               <input type="number" id="enc-potential-input" min="1" value="${state.originalPotential}">
             </div>`}
    </div>
  `;
}

function bindEquipmentStep(): void {
    document.getElementById('enc-auto-potential')?.addEventListener('click', () => {
        state.autoFindPotential = !state.autoFindPotential;
        rerender();
    });
    document.querySelectorAll<HTMLButtonElement>('.pz-btn[data-field]').forEach(btn => {
        btn.addEventListener('click', () => {
            state.fieldType = btn.dataset.field as EquipmentFieldType;
            state.isOriginalElement = btn.dataset.orig === '1';
            rerender();
        });
    });
    document.getElementById('enc-skill-toggle')?.addEventListener('click', () => {
        skillsOpen = !skillsOpen;
        rerender();
    });
    const potentialInput = document.getElementById('enc-potential-input') as HTMLInputElement | null;
    potentialInput?.addEventListener('change', () => {
        state.originalPotential = Math.max(1, Number(potentialInput.value) || 1);
        rerender();
    });
    document.getElementById('enc-potential-range')?.addEventListener('change', e => {
        state.originalPotential = Math.max(1, Number((e.target as HTMLInputElement).value) || 1);
        rerender();
    });
    document.getElementById('enc-potential-minus')?.addEventListener('click', () => {
        state.originalPotential = Math.max(1, state.originalPotential - 1);
        rerender();
    });
    document.getElementById('enc-potential-plus')?.addEventListener('click', () => {
        state.originalPotential += 1;
        rerender();
    });
    const numberSetting = (id: string, apply: (v: number) => void): void => {
        const el = document.getElementById(id) as HTMLInputElement | null;
        el?.addEventListener('change', () => { apply(Number(el.value) || 0); rerender(); });
    };
    numberSetting('enc-level', v => { state.settings.level = v || 1; });
    numberSetting('enc-smith', v => { state.settings.smithLevel = v; });
    numberSetting('enc-anvil', v => { state.settings.materialAnvilSkillLevelSum = v; });
    document.getElementById('enc-experts2')?.addEventListener('change', e => {
        state.settings.hasExpertsCustomization2Skill = (e.target as HTMLInputElement).checked;
        rerender();
    });
    document.querySelectorAll<HTMLInputElement>('.enc-material-skill').forEach(input => {
        input.addEventListener('change', () => {
            state.settings.materialSkillLevels[Number(input.dataset.idx)] = Number(input.value) || 0;
            rerender();
        });
    });
}

// ==================== 2. 정옵션 선택 (버튼형, 팝업 없음) ====================

// 옵션 선택 목록을 펼쳐 둘지 (다시 그려도 유지)
let pickerOpen = true;

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
            ? '<div class="pz-empty">선택된 옵션이 없습니다. "옵션 선택"에서 고르세요.</div>'
            : selected
                  .map(stat => {
                      if (stat.item.isToggle(stat.type)) {
                          // 최대 1인 옵션(속성 부여): 숫자와 +/- 없이 이름과 삭제 버튼만
                          return `
              <div class="enc-selected-row" data-key="${stat.statKey}">
                <span class="enc-selected-label">${stat.showLabel()}</span>
                <button class="enc-remove-btn" data-key="${stat.statKey}">✕</button>
              </div>`;
                      }
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
    <div class="pz-panel pz-options">
      <div class="pz-options-head">
        <b>옵션 <span class="pz-count">${selected.length} / ${MAX_ABILITY_LINES}</span></b>
        <button type="button" class="pz-btn pz-btn-primary" id="enc-pick-toggle">${pickerOpen ? '옵션 선택 닫기' : '옵션 선택'}</button>
      </div>
      ${pickerOpen
          ? `<div class="pz-pick-scroll">
               ${categoriesHtml}
             </div>`
          : ''}
      <div class="pz-selected">${selectedHtml}</div>
      <div class="pz-hint">최소 1개, 최대 ${MAX_ABILITY_LINES}개 (남은 슬롯 ${remaining}개)</div>
    </div>
  `;
}

function bindStatPickerStep(_kind: 'positive'): void {
    document.getElementById('enc-pick-toggle')?.addEventListener('click', () => { pickerOpen = !pickerOpen; rerender(); });
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

function renderAutoBoxHtml(): string {
    const negatives = negativeStats();
    const slots = MAX_ABILITY_LINES - state.positiveStats.length;
    const summary = state.negativeMode === 'auto'
        ? `마이너스 옵션 자동 선택 · ${state.negativeAutoGoal === 'successRate' ? '성공률 우선' : '재료 절약'} (${negatives.length}/${slots})`
        : `마이너스 옵션 직접 선택 (${state.negativeStatsManual.length}/${slots})`;
    return `
    <button type="button" class="pz-auto-head" id="enc-auto-toggle" aria-expanded="${autoOpen}">
      <span>${summary}</span><span>${autoOpen ? '접기 ▴' : '설정 ▾'}</span>
    </button>
    ${autoOpen ? renderNegativeStepHtml() : ''}`;
}

function renderNegativeStepHtml(): string {
    const remainingSlots = MAX_ABILITY_LINES - state.positiveStats.length;
    const negatives = negativeStats();

    // 자동 선택일 때만 "-개수" 버튼을 같은 줄에 둔다. 켜진 버튼을 다시 누르면 꺼지고(최대), 아무것도 안 켜져 있으면 남은 슬롯을 모두 채운다.
    const maxCount = Math.max(0, remainingSlots);
    const currentCount = state.negativeAutoCountOn ? Math.min(state.negativeAutoCount ?? maxCount, maxCount) : maxCount;
    const countOn = state.negativeAutoCountOn;
    // "옵션 개수" 텍스트 버튼은 자동/직접 선택 줄에, 켰을 때의 − 숫자 + 는 그 아랫줄에 둔다.
    const showCount = state.negativeMode === 'auto' && maxCount > 0;
    const countButtons = showCount
        ? `<button class="enc-choice-btn ${countOn ? 'active' : ''}" id="enc-auto-count-toggle" aria-pressed="${countOn}" title="마이너스 옵션 개수를 직접 정합니다 (끄면 남은 슬롯을 모두 채움)">옵션 개수</button>`
        : '';
    const countRow = showCount && countOn
        ? `<div class="enc-choice-row enc-count-row">
             <button class="enc-btn-mini" id="enc-auto-count-minus" aria-label="개수 줄이기" ${currentCount <= 1 ? 'disabled' : ''}>−</button>
             <span class="enc-count-value">${currentCount}</span>
             <button class="enc-btn-mini" id="enc-auto-count-plus" aria-label="개수 늘리기" ${currentCount >= maxCount ? 'disabled' : ''}>+</button>
           </div>`
        : '';
    const modeButtons = `
    <div class="enc-choice-row">
      <button class="enc-choice-btn ${state.negativeMode === 'auto' ? 'active' : ''}" data-mode="auto">자동 선택</button>
      <button class="enc-choice-btn ${state.negativeMode === 'manual' ? 'active' : ''}" data-mode="manual">직접 선택</button>
      ${countButtons}
    </div>`;

    if (state.negativeMode === 'auto') {
        const listHtml =
            negatives.length === 0
                ? '<div class="enc-empty-hint">제거할 수 있는 능력이 없습니다 (정옵션 슬롯이 가득 찼을 수 있습니다).</div>'
                : negatives.map(stat => `<div class="enc-selected-row"><span class="enc-selected-label">${stat.showLabel()}</span></div>`).join('');
        return `
      <div class="enc-card">
        <div class="enc-card-title">➖ 마이너스옵션(자동) <span class="enc-count-badge">${negatives.length} / ${remainingSlots}</span></div>
        <div class="enc-hint">남은 ${remainingSlots}개의 슬롯을 모두 채웁니다. 개수를 직접 정하려면 '옵션 개수'를 켜세요.</div>
        ${modeButtons}
        ${countRow}
        <div class="enc-choice-row">
          <button class="enc-choice-btn ${state.negativeAutoGoal === 'successRate' ? 'active' : ''}" data-goal="successRate">🎯 성공률 우선</button>
          <button class="enc-choice-btn ${state.negativeAutoGoal === 'material' ? 'active' : ''}" data-goal="material">💰 재료 절약</button>
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
                            if (item.isToggle(type)) return false;
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
    const countMax = (): number => MAX_ABILITY_LINES - state.positiveStats.length;
    const countNow = (): number => Math.min(state.negativeAutoCount ?? countMax(), countMax());
    document.getElementById('enc-auto-count-toggle')?.addEventListener('click', () => {
        state.negativeAutoCountOn = !state.negativeAutoCountOn;
        state.negativeAutoCount = state.negativeAutoCountOn ? countMax() : null; // 끄면 최대
        rerender();
    });
    document.getElementById('enc-auto-count-minus')?.addEventListener('click', () => {
        state.negativeAutoCount = Math.max(1, countNow() - 1);
        rerender();
    });
    document.getElementById('enc-auto-count-plus')?.addEventListener('click', () => {
        state.negativeAutoCount = Math.min(countMax(), countNow() + 1);
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
            const toggle = stat.item.isToggle(stat.type);
            const amount = manualAmountFor(stat);
            const unit = stat.type === 'multiplier' ? '%' : '';
            return `
        <div class="enc-palette-row">
          <span class="enc-selected-label ${remaining < 0 ? 'negative' : ''}">${stat.showValueLabel(remaining)} <small>남음</small></span>
          <div class="enc-palette-actions">
            ${toggle ? '' : `
            <button class="enc-btn-mini enc-amt-btn" data-key="${stat.statKey}" data-delta="-1" aria-label="수치 감소">−</button>
            <input type="number" class="enc-palette-custom" data-key="${stat.statKey}" min="1" max="${Math.abs(remaining)}" value="${amount}" aria-label="한 번에 배치할 수치">
            <button class="enc-btn-mini enc-amt-btn" data-key="${stat.statKey}" data-delta="1" aria-label="수치 증가">+</button>`}
            <button class="pz-btn enc-add-btn" data-key="${stat.statKey}" data-amount="${sign * (toggle ? 1 : amount)}">추가${toggle ? '' : ` ${sign < 0 ? '-' : '+'}${amount}${unit}`}</button>
            ${toggle || Math.abs(remaining) === 1 ? '' : `<button class="pz-btn enc-all-btn" data-key="${stat.statKey}" data-amount="${remaining}">전부</button>`}
          </div>
        </div>`;
        })
        .join('');

    const orderListHtml =
        state.manualPlaced.length === 0
            ? '<div class="enc-empty-hint">배치된 단계가 없습니다. 위에서 수치를 정하고 "추가"를 눌러 만들어보세요.</div>'
            : state.manualPlaced
                  .map((placed, idx) => {
                      const negative = placed.amount < 0;
                      const repeat = placed.repeat ?? 1;
                      return `
          <div class="enc-order-row" data-idx="${idx}">
            <span class="enc-order-drag-handle" data-idx="${idx}" aria-label="드래그해서 순서 변경">⠿</span>
            <span class="enc-order-num">${idx + 1}</span>
            <span class="enc-selected-label ${negative && !placed.members ? 'negative' : ''}">${placed.members
                ? placed.members.map(m => `<span class="${m.amount < 0 ? 'enc-neg-part' : ''}">${m.stat.showValueLabel(m.amount)}</span>`).join(' ')
                : placed.stat.showValueLabel(placed.amount)}${repeat > 1 ? ` <b class="enc-repeat">× ${repeat}회</b>` : ''}</span>
            ${!placed.members && Math.abs(placed.amount) === 1 ? `
            <button class="enc-btn-mini" data-rep="down" data-idx="${idx}" ${repeat <= 1 ? 'disabled' : ''} aria-label="반복 줄이기">−</button>
            <button class="enc-btn-mini" data-rep="up" data-idx="${idx}" ${Math.abs(manualRemaining(placed.stat)) < 1 ? 'disabled' : ''} aria-label="반복 늘리기">+</button>` : ''}
            <button class="enc-btn-mini" data-move="up" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''} aria-label="위로">▲</button>
            <button class="enc-btn-mini" data-move="down" data-idx="${idx}" ${idx === state.manualPlaced.length - 1 ? 'disabled' : ''} aria-label="아래로">▼</button>
            <button class="enc-remove-btn" data-remove-idx="${idx}" aria-label="제거">✕</button>
          </div>`;
                  })
                  .join('');

    const allPlaced = stats.every(stat => manualRemaining(stat) === 0);

    return `
    <div class="enc-card">
      <div class="enc-card-title">📐 부여 순서 조정 ${allPlaced ? '' : '<span class="enc-count-badge">배치 중</span>'}</div>
      <div class="enc-hint">자동으로 짠 부여 단계를 가져왔습니다. ⠿를 드래그하거나 ▲▼로 순서를 바꾸세요. +1을 반복한 단계는 한 줄에 × 횟수로 묶이고, − + 로 횟수를 조절합니다.</div>
      <div class="enc-order-list">${orderListHtml}</div>
    </div>
    <div class="enc-card">
      <div class="enc-card-title">🧩 단계 추가</div>
      <div class="enc-hint">− + 로 수치를 정하고 "추가"를 누르면 순서 맨 뒤에 배치됩니다.</div>
      <div class="enc-selected-list">${paletteHtml || '<div class="enc-empty-hint">모든 옵션을 배치했습니다.</div>'}</div>
    </div>
  `;
}

function renderResultStepHtml(waiting = false): string {
    const result = state.result;
    const materialNames = catalog!.materialTypes;

    const successLabel = !result || waiting ? '—' : result.successRate === -1 ? '무제한' : `${result.successRate.toFixed(1)}%`;
    const expectedLabel = !result || waiting ? '—' : `${result.expectedSuccessRate.toFixed(1)}%`;
    const initial = result && !waiting ? result.originalPotential : state.autoFindPotential ? '—' : state.originalPotential;
    const last = result && !waiting ? result.steps[result.steps.length - 1] : null;
    const remain = last ? last.remainingPotential : result && !waiting ? result.originalPotential : '—';
    const used = result && !waiting && last ? result.originalPotential - last.remainingPotential : '—';

    const rowsHtml = result && !waiting
        ? result.steps
              .map((step, idx) => `
        <tr class="${step.potentialCost < 0 ? 'pz-gain' : ''}">
          <td class="pz-td-num">${idx + 1}</td>
          <td class="pz-td-opt">${stepLabelHtml(step)}</td>
          <td class="pz-td-cost">${step.potentialCost >= 0 ? '-' : '+'}${Math.abs(step.potentialCost)}</td>
          <td class="pz-td-remain ${step.remainingPotential < 0 ? 'bad' : ''}">${step.remainingPotential}</td>
        </tr>`)
              .join('')
        : '<tr><td colspan="4" class="pz-empty">확정된 작업이 없습니다.</td></tr>';

    const materialsHtml = materialNames
        .map((name, idx) => `<div class="pz-mat"><span>${name}</span><b>${result && !waiting ? result.materialCostByType[idx].toLocaleString() : '—'}</b></div>`)
        .join('');

    const manualBuilderHtml = !waiting && state.orderMode === 'manual' ? renderManualBuilderHtml() : '';

    return `
    <div class="pz-panel" ${waiting ? '' : 'id="enc-result-capture"'}>
      <div class="pz-tiles">
        <div class="pz-tile"><span>잠재력</span><b>${initial}</b></div>
        <div class="pz-tile ${typeof remain === 'number' && remain < 0 ? 'bad' : ''}"><span>남은 잠재력</span><b>${remain}</b></div>
        <div class="pz-tile"><span>소모 잠재력</span><b>${used}</b></div>
        <div class="pz-tile"><span>표기 성공률</span><b>${successLabel}</b></div>
        <div class="pz-tile"><span>성공 기대</span><b>${expectedLabel}</b></div>
      </div>
      ${result && !waiting && result.insufficientPotential ? '<div class="pz-warning">⚠️ 잠재력이 부족한 순서가 포함되어 있습니다. 잠재력을 늘리거나 옵션 수를 줄여보세요.</div>' : ''}
      <div class="pz-split">
        <div class="pz-mats"><h4>소모 소재</h4>${materialsHtml}</div>
        <div class="pz-steps">
          <h4>부여 단계</h4>
          <div class="pz-steps-scroll">
            <table class="pz-table">
              <thead><tr><th>단계</th><th>옵션</th><th>잠재력</th><th>잔여</th></tr></thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
    ${waiting ? '' : `
    <div class="pz-panel pz-order">
      <div class="pz-row">
        <b>부여 순서</b>
        <div class="pz-seg">
          <button type="button" class="enc-choice-btn ${state.orderMode === 'auto' ? 'on' : ''}" data-order="auto">자동 순서(추천)</button>
          <button type="button" class="enc-choice-btn ${state.orderMode === 'manual' ? 'on' : ''}" data-order="manual">직접 순서 조정</button>
        </div>
        <div class="pz-grow"></div>
        <button type="button" class="pz-btn" id="enc-save-image">이미지</button>
        <button type="button" class="pz-btn" id="enc-save-text">텍스트</button>
      </div>
    </div>
    ${manualBuilderHtml}
    <textarea class="enc-text-export" id="enc-text-export" readonly style="display:none;"></textarea>`}
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
            const next = btn.dataset.order as OrderMode;
            if (next === state.orderMode) return;
            // 직접 순서 조정으로 넘어갈 때는 자동 부여 단계를 그대로 가져온다
            if (next === 'manual') seedManualFromAuto();
            state.orderMode = next;
            recomputeResult();
            rerender();
        });
    });
    document.querySelectorAll<HTMLButtonElement>('.enc-btn-mini[data-rep]').forEach(btn => {
        btn.addEventListener('click', () => {
            const placed = state.manualPlaced[Number(btn.dataset.idx)];
            if (!placed) return;
            const delta = btn.dataset.rep === 'up' ? 1 : -1;
            placed.repeat = Math.max(1, (placed.repeat ?? 1) + delta);
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
    document.querySelectorAll<HTMLButtonElement>('.enc-amt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const stat = manualAllStats().find(x => x.statKey === btn.dataset.key);
            if (!stat) return;
            const next = manualAmountFor(stat) + Number(btn.dataset.delta);
            state.manualCustomAmount[stat.statKey] = String(Math.max(1, Math.min(next, Math.abs(manualRemaining(stat)))));
            rerender();
        });
    });
    document.querySelectorAll<HTMLInputElement>('.enc-palette-custom').forEach(input => {
        input.addEventListener('change', () => {
            const stat = manualAllStats().find(x => x.statKey === input.dataset.key);
            if (!stat) return;
            state.manualCustomAmount[stat.statKey] = input.value;
            state.manualCustomAmount[stat.statKey] = String(manualAmountFor(stat));
            rerender();
        });
    });
    document.querySelectorAll<HTMLButtonElement>('.enc-add-btn, .enc-all-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const stat = manualAllStats().find(x => x.statKey === btn.dataset.key);
            if (stat) placeManual(stat, Number(btn.dataset.amount));
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
