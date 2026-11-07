// 계산기 장비 탭: 부위별로 장비를 고르거나 직접 적어 넣고, 옵션을 합산한다.
// 장비 데이터는 장비 탭과 같은 public/Equipment/<카테고리>/<카테고리>.js 를 그대로 읽는다.
// 각 부위는 (1) 도감 장비의 옵션 그대로, (2) 도감 장비를 고쳐 쓰기, (3) 완전히 직접 입력 중 하나로 쓴다.
import { Build, CustomEquip, CustomOption } from './state';

export interface EquipItem {
    name: string;
    name_en?: string;
    stats?: string[] | string;
    image?: string | string[];
    atk?: number | string;
    stability?: number | string;
    base_atk?: number | string;
    base_def?: number | string;
    drop?: string;
}

interface SlotDef {
    key: string;
    label: string;
    // 공격력(ATK) 입력이 의미 있는 부위
    weapon: boolean;
    cats: { cat: string; label: string }[];
}

export const SLOTS: SlotDef[] = [
    {
        key: 'main', label: '메인 무기', weapon: true, cats: [
            { cat: 'Handed_Sword', label: '한손검' }, { cat: 'Two_Handed_Sword', label: '양손검' }, { cat: 'bow', label: '활' },
            { cat: 'bowgun', label: '보우건' }, { cat: 'staff', label: '지팡이' }, { cat: 'magicdevice', label: '마도구' },
            { cat: 'knuckle', label: '너클' }, { cat: 'halberd', label: '선풍창' }, { cat: 'katana', label: '발도검' },
        ],
    },
    { key: 'sub', label: '서브 무기', weapon: true, cats: [{ cat: 'shield', label: '방패' }, { cat: 'Arrow', label: '화살' }, { cat: 'Dagger', label: '단검' }] },
    { key: 'body', label: '몸장비', weapon: false, cats: [{ cat: 'armor', label: '몸장비' }] },
    { key: 'add1', label: '추가장비', weapon: false, cats: [{ cat: 'additional', label: '추가장비' }] },
    { key: 'add2', label: '특수장비', weapon: false, cats: [{ cat: 'additional', label: '추가장비' }] },
];

// 마법 공격을 쓰는 무기 종류 (직접 고르기 전 기본값)
const MAGIC_CATS = new Set(['staff', 'magicdevice']);

// 옵션 이름 자동완성 후보 (자유롭게 직접 입력해도 된다)
const OPTION_NAMES = [
    'STR', 'INT', 'VIT', 'AGI', 'DEX', '최대HP', '최대MP', 'ATK', 'MATK', '무기ATK', 'DEF', 'MDEF',
    '물리관통', '마법관통', '크리티컬률', '크리티컬데미지', '안정률', '명중', '회피', '공격속도', '시전속도', '행동속도',
    '물리내성', '마법내성', '어그로', '근거리위력', '원거리위력', '물리추격', '마법추격', '발도공격',
    '방어무너뜨리기', 'Guard력', 'Guard회복', 'Avoid회복', '비율배리어', '마법배리어', '물리배리어',
    '공격MP회복', 'MP자연회복', 'HP자연회복', '불내성', '물내성', '바람내성', '땅내성', '빛내성', '어둠내성',
    '불속성데미지', '물속성데미지', '바람속성데미지', '땅속성데미지', '빛속성데미지', '어둠속성데미지', '무속성데미지',
];

const cache: Record<string, EquipItem[]> = {};

export async function loadCategory(cat: string): Promise<EquipItem[]> {
    if (cache[cat]) return cache[cat];
    try {
        const res = await fetch(`Equipment/${cat}/${cat}.js`);
        if (!res.ok) throw new Error(String(res.status));
        const text = (await res.text()).replace(/^﻿/, '');
        const body = text.slice(text.indexOf('=') + 1).trim().replace(/;$/, '');
        const data = new Function(`return ${body}`)() as { items?: EquipItem[] } | EquipItem[];
        cache[cat] = Array.isArray(data) ? data : (data.items ?? []);
    } catch (err) {
        console.error(`장비 데이터 로딩 실패: ${cat}`, err);
        cache[cat] = [];
    }
    return cache[cat];
}

// 저장용 키: 카테고리|이름|영문 이름
export function itemKey(cat: string, item: EquipItem): string {
    return `${cat}|${item.name}|${item.name_en ?? ''}`;
}

export async function findByKey(key: string): Promise<{ cat: string; item: EquipItem } | null> {
    const cat = key.split('|')[0];
    const list = await loadCategory(cat);
    const item = list.find(i => itemKey(cat, i) === key);
    return item ? { cat, item } : null;
}

function imageOf(cat: string, item: EquipItem): string {
    const img = Array.isArray(item.image) ? (item.image.find(x => x.includes('Normal')) ?? item.image[0]) : item.image;
    if (!img) return '';
    return `Equipment/${cat}/${img}`.split('/').map(encodeURIComponent).join('/');
}

function statLines(item: EquipItem): string[] {
    if (Array.isArray(item.stats)) return item.stats;
    if (typeof item.stats === 'string') return item.stats.split('\n');
    return [];
}

// ------------------------------------------------------------------ 옵션 줄 해석
const NUMERIC = /^([^\d+\-]+?)\s*(%?)\s*([+\-]?)\s*(\d+(?:\.\d+)?)\s*(%?)$/;
const ELEMENT = /^(불|물|바람|땅|빛|어둠)속성$/;

interface ParsedItem {
    atk: number;
    def: number;
    options: CustomOption[];
    other: string[];
}

// 도감 장비 한 개를 숫자 옵션 / 기본 수치 / 기타 문구로 나눈다.
function parseItem(item: EquipItem): ParsedItem {
    const out: ParsedItem = { atk: 0, def: 0, options: [], other: [] };
    if (item.atk) out.atk += Number(item.atk) || 0;
    if (item.base_atk) out.atk += Number(item.base_atk) || 0;
    if (item.base_def) out.def += Number(item.base_def) || 0;
    for (const raw of statLines(item)) {
        const line = raw.trim();
        if (!line) continue;
        let m: RegExpMatchArray | null;
        if ((m = line.match(/^ATK:(\d+)/))) { out.atk += Number(m[1]); continue; }
        if ((m = line.match(/^DEF:?(\d+)$/))) { out.def += Number(m[1]); continue; }
        if (line.startsWith('(') || ELEMENT.test(line) || !(m = line.match(NUMERIC))) { out.other.push(line); continue; }
        out.options.push({
            name: m[1].trim().replace(/\s+/g, ''),
            value: (m[3] === '-' ? -1 : 1) * Number(m[4]),
            pct: m[2] === '%' || m[5] === '%',
        });
    }
    return out;
}

// ------------------------------------------------------------------ 옵션 합산
export interface Totals {
    flat: Map<string, number>;
    pct: Map<string, number>;
    baseAtk: number;
    baseMatk: number;
    baseDef: number;
    element: string;
    other: string[];
}

function add(map: Map<string, number>, key: string, value: number): void {
    map.set(key, Math.round(((map.get(key) ?? 0) + value) * 100) / 100);
}

export function emptyTotals(): Totals {
    return { flat: new Map(), pct: new Map(), baseAtk: 0, baseMatk: 0, baseDef: 0, element: '', other: [] };
}

function addParsed(totals: Totals, p: ParsedItem, kind: 'phys' | 'magic', isMain: boolean): void {
    if (kind === 'magic') totals.baseMatk += p.atk; else totals.baseAtk += p.atk;
    totals.baseDef += p.def;
    for (const o of p.options) {
        const name = o.name.trim().replace(/\s+/g, '');
        if (!name || !o.value) continue;
        add(o.pct ? totals.pct : totals.flat, name, o.value);
    }
    for (const line of p.other) {
        const m = line.match(ELEMENT);
        if (m) { if (isMain) totals.element = m[1]; continue; }
        if (!totals.other.includes(line)) totals.other.push(line);
    }
}

export async function computeTotals(build: Build): Promise<Totals> {
    const totals = emptyTotals();
    for (const slot of SLOTS) {
        const isMain = slot.key === 'main';
        const custom = build.custom[slot.key];
        if (custom) {
            addParsed(totals, { atk: custom.atk, def: custom.def, options: custom.options, other: custom.other }, custom.kind, isMain);
            continue;
        }
        const key = build.equip[slot.key];
        const found = key ? await findByKey(key) : null;
        if (found) addParsed(totals, parseItem(found.item), MAGIC_CATS.has(found.cat) ? 'magic' : 'phys', isMain);
    }
    return totals;
}

export function fmtFlat(n: number): string {
    return `${n > 0 ? '+' : ''}${n.toLocaleString('ko-KR')}`;
}

export function fmtPct(n: number): string {
    return `${n > 0 ? '+' : ''}${n}%`;
}

// ------------------------------------------------------------------ 화면
function esc(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

const PICK_PAGE = 40;

export function renderEquipTab(body: HTMLElement, build: Build, save: () => void): void {
    let pickSlot: string | null = null;
    let editSlot: string | null = null;
    let pickCat = '';
    let keyword = '';
    let shown = PICK_PAGE;

    body.innerHTML = `
    <div class="calc-grid calc-equip-grid">
      <section class="calc-card">
        <h3>장비 선택</h3>
        <div id="eq-slots"></div>
        <p class="calc-hint">장비를 고르면 도감 옵션이 그대로 쓰이고, "직접 입력"·"옵션 편집"으로 옵션을 직접 적거나 고칠 수 있습니다. 서브 무기는 방패·화살·단검만 고를 수 있고, 착용 제한은 확인하지 않습니다.</p>
      </section>
      <section class="calc-card" id="eq-side">
        <h3>옵션 합계</h3>
        <div id="eq-totals"></div>
      </section>
    </div>
    <section class="calc-card" id="eq-panel" style="display:none; margin-top:14px;"></section>
    <datalist id="eq-opt-names">${OPTION_NAMES.map(n => `<option value="${n}">`).join('')}</datalist>`;

    const slotsEl = document.getElementById('eq-slots')!;
    const totalsEl = document.getElementById('eq-totals')!;
    const panelEl = document.getElementById('eq-panel')!;

    function closePanel(): void {
        pickSlot = null;
        editSlot = null;
        panelEl.style.display = 'none';
        panelEl.innerHTML = '';
    }

    async function renderSlots(): Promise<void> {
        const rows = await Promise.all(SLOTS.map(async slot => {
            const custom = build.custom[slot.key];
            const key = build.equip[slot.key];
            const found = key ? await findByKey(key) : null;
            const originFound = custom?.origin ? await findByKey(custom.origin) : null;
            const shownItem = found ?? originFound;
            const img = shownItem ? imageOf(shownItem.cat, shownItem.item) : '';
            const name = custom ? (custom.name || shownItem?.item.name || '직접 입력') : (found?.item.name ?? '');
            const filled = !!custom || !!found;
            const active = pickSlot === slot.key || editSlot === slot.key;
            return `
            <div class="eq-slot ${active ? 'on' : ''}">
              <span class="eq-slot-label">${slot.label}</span>
              <div class="eq-slot-item" title="${esc(name)}">
                ${filled
                    ? `${img ? `<img src="${esc(img)}" alt="${esc(name)}" loading="lazy" onerror="this.style.display='none'">` : '<span class="eq-noimg">✎</span>'}${custom ? '<em class="eq-tag">직접</em>' : ''}`
                    : '<span class="eq-noimg eq-empty">+</span>'}
              </div>
              <button type="button" class="calc-max" data-pick="${slot.key}" title="도감에서 고르기">${found ? '변경' : '도감'}</button>
              <button type="button" class="calc-max" data-edit="${slot.key}" title="${filled ? '옵션 편집' : '직접 입력'}">${filled ? '편집' : '직접'}</button>
              <button type="button" class="calc-max eq-clear" data-clear="${slot.key}" title="비우기" ${filled ? '' : 'disabled'}>✕</button>
            </div>`;
        }));
        slotsEl.innerHTML = rows.join('');
        slotsEl.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach(b => b.addEventListener('click', () => openPicker(b.dataset.pick!)));
        slotsEl.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach(b => b.addEventListener('click', () => void openEditor(b.dataset.edit!)));
        slotsEl.querySelectorAll<HTMLButtonElement>('[data-clear]').forEach(b => b.addEventListener('click', () => {
            const k = b.dataset.clear!;
            delete build.equip[k];
            delete build.custom[k];
            if (pickSlot === k || editSlot === k) closePanel();
            save();
            void refresh();
        }));
    }

    async function renderTotals(): Promise<void> {
        const t = await computeTotals(build);
        const names = [...new Set([...t.flat.keys(), ...t.pct.keys()])].sort((a, b) => a.localeCompare(b, 'ko'));
        const base: string[] = [];
        if (t.baseAtk) base.push(`<div class="eq-base"><span>무기 ATK (물리)</span><b>${t.baseAtk.toLocaleString('ko-KR')}</b></div>`);
        if (t.baseMatk) base.push(`<div class="eq-base"><span>무기 MATK (마법)</span><b>${t.baseMatk.toLocaleString('ko-KR')}</b></div>`);
        if (t.baseDef) base.push(`<div class="eq-base"><span>기본 DEF</span><b>${t.baseDef.toLocaleString('ko-KR')}</b></div>`);
        if (t.element) base.push(`<div class="eq-base"><span>무기 속성</span><b>${esc(t.element)}</b></div>`);
        const empty = !Object.keys(build.equip).length && !Object.keys(build.custom).length;
        totalsEl.innerHTML = empty
            ? '<p class="calc-dim">장비를 고르거나 직접 입력하면 옵션이 여기에 합산됩니다.</p>'
            : `${base.join('')}
               <table class="calc-table"><thead><tr><th>옵션</th><th>고정값</th><th>%</th></tr></thead><tbody>
                 ${names.map(n => `<tr><td>${esc(n)}</td><td>${t.flat.has(n) ? fmtFlat(t.flat.get(n)!) : ''}</td><td>${t.pct.has(n) ? fmtPct(t.pct.get(n)!) : ''}</td></tr>`).join('')}
               </tbody></table>
               ${t.other.length ? `<div class="eq-other"><b>기타 효과</b><ul>${t.other.map(o => `<li>${esc(o)}</li>`).join('')}</ul></div>` : ''}`;
    }

    async function refresh(): Promise<void> {
        await Promise.all([renderSlots(), renderTotals()]);
    }

    // ---------------------------------------------------------- 도감에서 고르기
    async function renderPicker(): Promise<void> {
        const slot = SLOTS.find(s => s.key === pickSlot);
        if (!slot) { closePanel(); return; }
        panelEl.style.display = '';
        const list = await loadCategory(pickCat);
        const q = keyword.trim().toLowerCase();
        const filtered = list.filter(i => !q || i.name.toLowerCase().includes(q) || (i.name_en ?? '').toLowerCase().includes(q) || statLines(i).some(l => l.toLowerCase().includes(q)));
        panelEl.innerHTML = `
          <h3>${slot.label} 도감에서 고르기</h3>
          ${slot.cats.length > 1 ? `<div class="skill-tabs" id="eq-cats">${slot.cats.map(c => `<button class="skill-tab-btn ${c.cat === pickCat ? 'active' : ''}" data-cat="${c.cat}">${c.label}</button>`).join('')}</div>` : ''}
          <div class="boss-toolbar">
            <input type="text" id="eq-search" class="search-input" placeholder="이름 · 옵션 검색..." maxlength="40" autocomplete="off" value="${esc(keyword)}">
            <span class="boss-count">${filtered.length}개</span>
            <button type="button" class="calc-max" id="eq-close">닫기</button>
          </div>
          <div class="eq-list">
            ${filtered.slice(0, shown).map(i => {
                const img = imageOf(pickCat, i);
                const lines = statLines(i).filter(l => !l.startsWith('ATK:')).slice(0, 3).join(' · ');
                const atk = statLines(i).find(l => l.startsWith('ATK:')) ?? (i.atk ? `ATK:${i.atk}` : '');
                return `<button type="button" class="eq-pick" data-key="${esc(itemKey(pickCat, i))}">
                  ${img ? `<img src="${esc(img)}" alt="" loading="lazy" onerror="this.style.display='none'">` : '<span class="eq-noimg">?</span>'}
                  <span class="eq-pick-text"><b>${esc(i.name)}</b><small>${esc(i.name_en ?? '')}</small><em>${esc([atk, lines].filter(Boolean).join(' · '))}</em></span>
                </button>`;
            }).join('') || '<div class="calc-dim">조건에 맞는 장비가 없습니다.</div>'}
          </div>
          ${filtered.length > shown ? '<div class="cons-more-wrap"><button type="button" class="trade-btn" id="eq-more">더 보기</button></div>' : ''}`;

        panelEl.querySelectorAll<HTMLButtonElement>('#eq-cats .skill-tab-btn').forEach(b => b.addEventListener('click', () => {
            pickCat = b.dataset.cat!; shown = PICK_PAGE; void renderPicker();
        }));
        const search = document.getElementById('eq-search') as HTMLInputElement;
        search.addEventListener('input', () => {
            keyword = search.value; shown = PICK_PAGE;
            void renderPicker().then(() => { const s = document.getElementById('eq-search') as HTMLInputElement | null; if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } });
        });
        document.getElementById('eq-close')!.addEventListener('click', () => { closePanel(); void renderSlots(); });
        document.getElementById('eq-more')?.addEventListener('click', () => { shown += PICK_PAGE; void renderPicker(); });
        panelEl.querySelectorAll<HTMLButtonElement>('.eq-pick').forEach(b => b.addEventListener('click', () => {
            const k = pickSlot!;
            build.equip[k] = b.dataset.key!;
            delete build.custom[k]; // 새로 고르면 이전 수정 내용은 버리고 도감 옵션 그대로 쓴다
            save();
            closePanel();
            void refresh();
        }));
    }

    function openPicker(slotKey: string): void {
        editSlot = null;
        pickSlot = slotKey;
        const slot = SLOTS.find(s => s.key === slotKey)!;
        const current = build.equip[slotKey]?.split('|')[0];
        pickCat = slot.cats.some(c => c.cat === current) ? current! : slot.cats[0].cat;
        keyword = '';
        shown = PICK_PAGE;
        void renderSlots();
        void renderPicker().then(() => panelEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    }

    // ---------------------------------------------------------- 직접 입력 / 옵션 편집
    async function openEditor(slotKey: string): Promise<void> {
        pickSlot = null;
        editSlot = slotKey;
        const slot = SLOTS.find(s => s.key === slotKey)!;
        // 도감 장비를 골라 둔 상태에서 처음 편집하면, 그 장비의 옵션을 복사해 시작한다.
        if (!build.custom[slotKey]) {
            const key = build.equip[slotKey];
            const found = key ? await findByKey(key) : null;
            if (found) {
                const p = parseItem(found.item);
                build.custom[slotKey] = { name: found.item.name, kind: MAGIC_CATS.has(found.cat) ? 'magic' : 'phys', atk: p.atk, def: p.def, options: p.options, other: p.other, origin: key };
            } else {
                build.custom[slotKey] = { name: '', kind: 'phys', atk: 0, def: 0, options: [{ name: '', value: 0, pct: false }], other: [] };
            }
            save();
        }
        void renderSlots();
        void renderTotals();
        renderEditor(slot);
        panelEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function renderEditor(slot: SlotDef): void {
        const c: CustomEquip = build.custom[slot.key];
        panelEl.style.display = '';
        panelEl.innerHTML = `
          <h3>${slot.label} ${c.origin ? '옵션 편집' : '직접 입력'}</h3>
          <div class="eq-ed-grid">
            <label class="calc-field"><span class="calc-lab">이름<small>(선택)</small></span>
              <input type="text" id="ed-name" maxlength="30" value="${esc(c.name)}" placeholder="예: 내 장비">
            </label>
            ${slot.weapon ? `
            <label class="calc-field">공격 종류
              <select id="ed-kind"><option value="phys" ${c.kind === 'phys' ? 'selected' : ''}>물리 (ATK)</option><option value="magic" ${c.kind === 'magic' ? 'selected' : ''}>마법 (MATK)</option></select>
            </label>
            <label class="calc-field">기본 ${c.kind === 'magic' ? 'MATK' : 'ATK'}
              <input type="number" id="ed-atk" min="0" value="${c.atk}">
            </label>` : ''}
            <label class="calc-field">기본 DEF
              <input type="number" id="ed-def" min="0" value="${c.def}">
            </label>
          </div>

          <div class="eq-ed-rows-head"><b>옵션</b><span class="calc-dim">이름 · 값 · % 여부</span></div>
          <div id="ed-rows"></div>
          <div class="eq-ed-actions">
            <button type="button" class="calc-max" id="ed-add">+ 옵션 추가</button>
          </div>

          <label class="calc-field" style="margin-top:10px;"><span class="calc-lab">기타 효과<small>(숫자로 합칠 수 없는 문구, 한 줄에 하나)</small></span>
            <textarea id="ed-other" rows="3" class="eq-textarea">${esc(c.other.join('\n'))}</textarea>
          </label>

          <div class="eq-ed-actions">
            ${c.origin ? '<button type="button" class="calc-max" id="ed-reset">도감 옵션으로 되돌리기</button>' : ''}
            <button type="button" class="calc-max" id="ed-close">닫기</button>
          </div>`;

        const touch = (): void => { save(); void renderSlots(); void renderTotals(); };
        const rowsEl = document.getElementById('ed-rows')!;

        const renderRows = (): void => {
            rowsEl.innerHTML = c.options.map((o, i) => `
              <div class="eq-ed-row">
                <input type="text" list="eq-opt-names" data-i="${i}" data-f="name" value="${esc(o.name)}" placeholder="옵션 이름 (예: 최대HP)" maxlength="20">
                <input type="number" data-i="${i}" data-f="value" value="${o.value}" step="any">
                <label class="eq-pct"><input type="checkbox" data-i="${i}" data-f="pct" ${o.pct ? 'checked' : ''}>%</label>
                <button type="button" class="calc-max" data-del="${i}" title="이 옵션 삭제">✕</button>
              </div>`).join('') || '<div class="calc-dim">옵션이 없습니다. "+ 옵션 추가"를 눌러 적어 넣으세요.</div>';
            rowsEl.querySelectorAll<HTMLInputElement>('input[data-f]').forEach(inp => {
                inp.addEventListener('input', () => {
                    const o = c.options[Number(inp.dataset.i)];
                    if (inp.dataset.f === 'name') o.name = inp.value;
                    else if (inp.dataset.f === 'value') o.value = Number(inp.value) || 0;
                    else o.pct = inp.checked;
                    touch();
                });
            });
            rowsEl.querySelectorAll<HTMLButtonElement>('[data-del]').forEach(b => b.addEventListener('click', () => {
                c.options.splice(Number(b.dataset.del), 1);
                renderRows();
                touch();
            }));
        };
        renderRows();

        document.getElementById('ed-name')!.addEventListener('input', e => { c.name = (e.target as HTMLInputElement).value; touch(); });
        document.getElementById('ed-def')!.addEventListener('input', e => { c.def = Number((e.target as HTMLInputElement).value) || 0; touch(); });
        document.getElementById('ed-kind')?.addEventListener('change', e => { c.kind = (e.target as HTMLSelectElement).value === 'magic' ? 'magic' : 'phys'; touch(); renderEditor(slot); });
        document.getElementById('ed-atk')?.addEventListener('input', e => { c.atk = Number((e.target as HTMLInputElement).value) || 0; touch(); });
        document.getElementById('ed-other')!.addEventListener('input', e => { c.other = (e.target as HTMLTextAreaElement).value.split('\n').map(s => s.trim()).filter(Boolean); touch(); });
        document.getElementById('ed-add')!.addEventListener('click', () => {
            c.options.push({ name: '', value: 0, pct: false });
            renderRows();
            touch();
            (rowsEl.querySelector('.eq-ed-row:last-child input') as HTMLInputElement | null)?.focus();
        });
        document.getElementById('ed-reset')?.addEventListener('click', () => {
            delete build.custom[slot.key];
            save();
            closePanel();
            void refresh();
        });
        document.getElementById('ed-close')!.addEventListener('click', () => {
            // 아무것도 적지 않은 직접 입력은 비운 것으로 본다
            const blank = !c.origin && !c.name && !c.atk && !c.def && !c.options.some(o => o.name.trim() && o.value) && !c.other.length;
            if (blank) delete build.custom[slot.key];
            save();
            closePanel();
            void refresh();
        });
    }

    void refresh();
}
