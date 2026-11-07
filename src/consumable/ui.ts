// 소모품 탭: public/Consumable/Consumable.json(toram.nimp.dev 도감 데이터 요약본)을 분류별로 보여 준다.
interface Cat {
    id: string;
    label: string;
}

interface Item {
    id: number;
    n: string;
    en: string;
    c: string;
    d: string[];
    o?: string[];
    t?: number;
}

interface ConsumableData {
    source: string;
    cats: Cat[];
    items: Item[];
}

const PAGE_SIZE = 60;

let data: ConsumableData | null = null;
let activeCat = 'all';
let keyword = '';
let shownCount = PAGE_SIZE;

function esc(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function durationText(sec: number): string {
    if (sec % 3600 === 0) return `${sec / 3600}시간`;
    if (sec % 60 === 0) return `${sec / 60}분`;
    return `${sec}초`;
}

function matches(item: Item): boolean {
    if (activeCat !== 'all' && item.c !== activeCat) return false;
    const q = keyword.trim().toLowerCase();
    if (!q) return true;
    return item.n.toLowerCase().includes(q)
        || item.en.toLowerCase().includes(q)
        || item.d.some(l => l.toLowerCase().includes(q))
        || (item.o ?? []).some(l => l.toLowerCase().includes(q));
}

function cardHtml(item: Item): string {
    const label = data!.cats.find(c => c.id === item.c)?.label ?? '';
    return `
    <div class="cons-card">
      <div class="cons-head">
        <div class="cons-name">${esc(item.n)}${item.en ? `<small>${esc(item.en)}</small>` : ''}</div>
        <span class="cons-badge">${esc(label)}</span>
      </div>
      ${item.o?.length || item.t ? `<div class="cons-effects">${(item.o ?? []).map(o => `<span>${esc(o)}</span>`).join('')}${item.t ? `<span class="cons-time">${durationText(item.t)}</span>` : ''}</div>` : ''}
      <p class="cons-desc">${item.d.map(esc).join('<br>')}</p>
    </div>`;
}

function renderList(): void {
    const listEl = document.getElementById('cons-list');
    const countEl = document.getElementById('cons-count');
    const moreEl = document.getElementById('cons-more');
    if (!listEl || !data) return;
    const all = data.items.filter(matches);
    if (countEl) countEl.textContent = `${all.length}개`;

    if (all.length === 0) {
        listEl.innerHTML = '<div class="cons-empty">조건에 맞는 소모품이 없습니다.</div>';
        if (moreEl) moreEl.style.display = 'none';
        return;
    }

    listEl.innerHTML = all.slice(0, shownCount).map(cardHtml).join('');
    if (moreEl) moreEl.style.display = all.length > shownCount ? '' : 'none';
}

export async function renderConsumablePage(): Promise<void> {
    const app = document.querySelector<HTMLDivElement>('#app')!;
    activeCat = 'all';
    keyword = '';
    shownCount = PAGE_SIZE;

    app.innerHTML = `
    <div class="nav-bar">
      <button class="btn-home" id="back-home">🏠 Home</button>
      <h2 style="margin:0 0 0 15px; border:none;">🧪 소모품</h2>
    </div>
    <div class="container">
      <div class="skill-tabs" id="cons-tabs"></div>

      <div class="boss-toolbar">
        <input type="text" id="cons-search" class="search-input" placeholder="이름 · 효과 검색 (예: 공격력, 포션)" maxlength="40" autocomplete="off">
        <span class="boss-count" id="cons-count"></span>
      </div>

      <div id="cons-list" class="cons-grid"><div class="cons-empty">불러오는 중...</div></div>
      <div class="cons-more-wrap"><button type="button" class="trade-btn" id="cons-more" style="display:none;">더 보기</button></div>

      <p class="boss-source">데이터 출처: toram.nimp.dev 도감</p>
    </div>`;

    document.getElementById('back-home')?.addEventListener('click', () => history.back());

    try {
        if (!data) {
            const res = await fetch('Consumable/Consumable.json');
            if (!res.ok) throw new Error(String(res.status));
            data = await res.json() as ConsumableData;
        }
    } catch (err) {
        console.error('소모품 데이터 로딩 실패:', err);
        const listEl = document.getElementById('cons-list');
        if (listEl) listEl.innerHTML = '<div class="cons-empty">소모품 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>';
        return;
    }

    const used = new Set(data.items.map(i => i.c));
    const tabs = document.getElementById('cons-tabs')!;
    tabs.innerHTML = [`<button class="skill-tab-btn active" data-cat="all">전체</button>`,
        ...data.cats.filter(c => used.has(c.id)).map(c => `<button class="skill-tab-btn" data-cat="${esc(c.id)}">${esc(c.label)}</button>`)].join('');
    tabs.querySelectorAll<HTMLButtonElement>('.skill-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            activeCat = btn.dataset.cat!;
            shownCount = PAGE_SIZE;
            tabs.querySelectorAll('.skill-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
            renderList();
        });
    });

    document.getElementById('cons-search')!.addEventListener('input', (e) => {
        keyword = (e.target as HTMLInputElement).value;
        shownCount = PAGE_SIZE;
        renderList();
    });
    document.getElementById('cons-more')!.addEventListener('click', () => {
        shownCount += PAGE_SIZE;
        renderList();
    });

    renderList();
}
