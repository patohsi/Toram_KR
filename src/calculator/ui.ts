// 계산기: 스테이터스 / 장비 / 스킬 / 옵션부여 탭을 한 페이지 안에서 전환한다.
import { renderEnchantPage } from '../enchant/ui';
import { computeTotals, fmtFlat, fmtPct, renderEquipTab } from './equip';
import { renderSkillTab } from './skills';
import {
    Build, STAT_KEYS, POINT_KEYS, STAT_CAP, LEVEL_CAP, StatKey,
    clampLevel, clampStat, loadBuild, minOf, pointBreakdown, saveBuild, spentPoints,
} from './state';

export type CalcTab = 'status' | 'equip' | 'skill' | 'enchant';

const TABS: { key: CalcTab; label: string }[] = [
    { key: 'status', label: '스테이터스' },
    { key: 'equip', label: '장비' },
    { key: 'skill', label: '스킬' },
    { key: 'enchant', label: '옵션부여' },
];

let build: Build = loadBuild();
let activeTab: CalcTab = 'status';

const STAT_NOTE: Record<StatKey, string> = {
    STR: '힘', INT: '지능', VIT: '체력', AGI: '민첩', DEX: '기술', CRT: '크리티컬',
};

export function renderCalculatorPage(tab: CalcTab = 'status'): void {
    const app = document.querySelector<HTMLDivElement>('#app')!;
    activeTab = tab;
    build = loadBuild();

    app.innerHTML = `
    <div class="nav-bar">
      <button class="btn-home" id="back-home">🏠 Home</button>
      <h2 style="margin:0 0 0 15px; border:none;">🧮 계산기</h2>
    </div>
    <div class="container calc-wrap">
      <div class="skill-tabs" id="calc-tabs">
        ${TABS.map(t => `<button class="skill-tab-btn ${t.key === activeTab ? 'active' : ''}" data-tab="${t.key}">${t.label}</button>`).join('')}
      </div>
      <div id="calc-body"></div>
    </div>`;

    document.getElementById('back-home')?.addEventListener('click', () => history.back());
    document.querySelectorAll<HTMLButtonElement>('#calc-tabs .skill-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            activeTab = btn.dataset.tab as CalcTab;
            document.querySelectorAll('#calc-tabs .skill-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
            renderBody();
        });
    });
    renderBody();
}

function renderBody(): void {
    const body = document.getElementById('calc-body')!;
    if (activeTab === 'status') return renderStatusTab(body);
    if (activeTab === 'enchant') {
        body.innerHTML = '<div id="calc-enchant-host"></div>';
        void renderEnchantPage(document.getElementById('calc-enchant-host')!);
        return;
    }
    if (activeTab === 'equip') return renderEquipTab(body, build, () => saveBuild(build));
    void renderSkillTab(body, build, () => saveBuild(build));
}

// ---------------------------------------------------------------- 스테이터스 탭
function pointsText(): { total: number; spent: number; left: number } {
    const total = pointBreakdown(build.level, build.highestLevel).total;
    const spent = spentPoints(build);
    return { total, spent, left: total - spent };
}

function renderStatusTab(body: HTMLElement): void {
    const bd = pointBreakdown(build.level, build.highestLevel);
    body.innerHTML = `
    <div class="calc-grid">
      <section class="calc-card">
        <h3>스테이터스</h3>
        <label class="calc-field">캐릭터 레벨
          <input type="number" id="calc-level" min="1" max="${LEVEL_CAP}" value="${build.level}">
        </label>
        <label class="calc-field"><span class="calc-lab">계정 최고 레벨<small>(훈장 포인트 계산용)</small></span>
          <input type="number" id="calc-highest" min="1" max="${LEVEL_CAP}" value="${build.highestLevel}">
        </label>

        <div class="calc-points" id="calc-points"></div>
        <div class="calc-points-note" id="calc-points-note">레벨 ${bd.levelPoints} + 훈장 ${bd.emblemPoints} + 고정 ${bd.fixedPoints}</div>

        <div class="calc-stat-list">
          ${STAT_KEYS.map(k => `
          <div class="calc-stat-row">
            <span class="calc-stat-chip" title="${STAT_NOTE[k]}">${k}</span>
            <input type="number" class="calc-stat-input" data-stat="${k}" min="${minOf(k)}" max="${STAT_CAP}" value="${build.stats[k]}">
            <button type="button" class="calc-max" data-max="${k}" title="${k === 'CRT' ? 'CRT 를 최대치로' : `남은 포인트를 최대치까지 ${k}에 투자`}">최대</button>
          </div>`).join('')}
        </div>
        <div class="calc-actions"><button type="button" class="trade-btn" id="calc-reset">스탯 초기화</button></div>
      </section>

      <section class="calc-card">
        <h3>최종 스테이터스</h3>
        <table class="calc-table">
          <thead><tr><th>능력치</th><th>투자</th><th>장비 보너스</th><th>최종</th></tr></thead>
          <tbody id="calc-final"></tbody>
        </table>
        <p class="calc-hint">장비 보너스는 장비 탭에서 고른 장비의 옵션(%와 고정값)을 합산해 반영됩니다.</p>
      </section>
    </div>`;

    // 포인트 한도가 줄어들면 DEX부터 거꾸로 줄여 한도에 맞춘다
    const fitToLimit = (): void => {
        let over = -pointsText().left;
        for (const k of [...POINT_KEYS].reverse()) {
            if (over <= 0) break;
            const take = Math.min(build.stats[k] - minOf(k), over);
            build.stats[k] -= take;
            over -= take;
            (body.querySelector(`.calc-stat-input[data-stat="${k}"]`) as HTMLInputElement).value = String(build.stats[k]);
        }
    };

    const levelInput = document.getElementById('calc-level') as HTMLInputElement;
    const highestInput = document.getElementById('calc-highest') as HTMLInputElement;

    // 최종 = 투자 × (1 + 장비 %) + 장비 고정값 (소수점 이하 버림)
    let finalToken = 0;
    const renderFinal = async (): Promise<void> => {
        const token = ++finalToken;
        const totals = await computeTotals(build);
        if (token !== finalToken) return;
        const el = document.getElementById('calc-final');
        if (!el) return;
        el.innerHTML = STAT_KEYS.map(k => {
            const flat = totals.flat.get(k) ?? 0;
            const pct = totals.pct.get(k) ?? 0;
            const final = Math.floor(build.stats[k] * (1 + pct / 100)) + flat;
            const bonus = [pct ? fmtPct(pct) : '', flat ? fmtFlat(flat) : ''].filter(Boolean).join(' ');
            return `<tr><td>${k}</td><td>${build.stats[k]}</td><td class="${bonus ? '' : 'calc-dim'}">${bonus || '+0'}</td><td><b>${final}</b></td></tr>`;
        }).join('');
    };

    const refresh = (): void => {
        const { total, spent, left } = pointsText();
        const bd2 = pointBreakdown(build.level, build.highestLevel);
        const el = document.getElementById('calc-points')!;
        el.innerHTML = `사용 <b>${spent}</b> / ${total} <span class="${left < 0 ? 'calc-over' : ''}">(남은 ${left})</span> <small>CRT 는 포인트 한도에 포함하지 않음</small>`;
        el.classList.toggle('over', left < 0);
        document.getElementById('calc-points-note')!.textContent = `레벨 ${bd2.levelPoints} + 훈장 ${bd2.emblemPoints} + 고정 ${bd2.fixedPoints}`;
        saveBuild(build);
        void renderFinal();
    };

    levelInput.addEventListener('change', () => {
        build.level = clampLevel(Number(levelInput.value));
        levelInput.value = String(build.level);
        if (build.highestLevel < build.level) {
            build.highestLevel = build.level;
            highestInput.value = String(build.highestLevel);
        }
        fitToLimit();
        refresh();
    });
    highestInput.addEventListener('change', () => {
        build.highestLevel = Math.max(build.level, clampLevel(Number(highestInput.value)));
        highestInput.value = String(build.highestLevel);
        fitToLimit();
        refresh();
    });

    body.querySelectorAll<HTMLInputElement>('.calc-stat-input').forEach(input => {
        input.addEventListener('change', () => {
            const k = input.dataset.stat as StatKey;
            build.stats[k] = clampStat(k, Number(input.value));
            const over = -pointsText().left;
            if (k !== 'CRT' && over > 0) build.stats[k] = Math.max(minOf(k), build.stats[k] - over);
            input.value = String(build.stats[k]);
            refresh();
        });
    });

    body.querySelectorAll<HTMLButtonElement>('[data-max]').forEach(btn => {
        btn.addEventListener('click', () => {
            const k = btn.dataset.max as StatKey;
            const { left } = pointsText();
            // 남은 포인트를 이 능력치에 몰아 넣되 최대치를 넘지 않는다 (CRT 는 포인트 한도 밖)
            build.stats[k] = k === 'CRT' ? STAT_CAP : clampStat(k, build.stats[k] + Math.max(0, left));
            (body.querySelector(`.calc-stat-input[data-stat="${k}"]`) as HTMLInputElement).value = String(build.stats[k]);
            refresh();
        });
    });

    document.getElementById('calc-reset')!.addEventListener('click', () => {
        for (const k of STAT_KEYS) {
            build.stats[k] = minOf(k);
            (body.querySelector(`.calc-stat-input[data-stat="${k}"]`) as HTMLInputElement).value = String(build.stats[k]);
        }
        refresh();
    });

    refresh();
}
