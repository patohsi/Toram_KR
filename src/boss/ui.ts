// 보스 정보 탭: public/Boss/Boss.json(toram.nimp.dev 도감 데이터 요약본)을 읽어 목록과 상세 수치를 보여 준다.
interface BossRow {
    field: string;
    level: number;
    hp: number;
    ele: number;
    d: number;
    md: number;
    hit: number;
    avoid: number;
    guard: number;
}

// 장비 탭과 같은 이미지를 쓰므로 Equipment/<카테고리>/<이미지> 경로를 그대로 가리킨다.
interface Drop {
    n: string;
    e: string;
    c: string;
    i: string;
    t?: string; // 크리스타일 때 종류 이름(예: '추가 크리스타')
    o?: string; // 크리스타 옵션 (크리스타 탭 데이터)
    ic?: string; // 크리스타 아이콘 종류 (CrystaImg/<ic>.png)
    h?: string; // 강화 전 정보
}

interface Mode {
    mode: string;
    level: number;
    ele: string;
    hp: number;
    exp: number;
    map: string;
    drops: Drop[];
}

interface Boss {
    id: number;
    name: string;
    en: string;
    kinds: string[];
    rows: BossRow[];
    modes?: Mode[];
    crystas?: Drop[]; // 보스와 이름이 같은 크리스타(크리스타 탭 데이터)
}

interface BossData {
    source: string;
    kinds: Record<string, string>;
    elements: Record<string, string>;
    bosses: Boss[];
}

let data: BossData | null = null;
let activeKind = 'all';
let keyword = '';
let openId: number | null = null;

function esc(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function num(n: number): string {
    return n.toLocaleString('ko-KR');
}

// 레벨은 난이도별 값이 있는 코린 데이터를 우선한다. 없으면 게임 데이터의 기본 수치를 쓴다.
function levelText(b: Boss): string {
    const lv = b.modes?.length ? b.modes.map(m => m.level) : b.rows.map(r => r.level);
    const lo = Math.min(...lv);
    const hi = Math.max(...lv);
    const base = lo === hi ? `Lv.${lo}` : `Lv.${lo}~${hi}`;
    return b.modes && b.modes.length > 1 ? `${base} (${b.modes.length}난이도)` : base;
}

function places(b: Boss): string[] {
    const ko = [...new Set(b.rows.map(r => r.field).filter(Boolean))];
    if (ko.length) return ko;
    return [...new Set((b.modes ?? []).map(m => m.map).filter(Boolean))];
}

function allDrops(b: Boss): Drop[] {
    return (b.modes ?? []).flatMap(m => m.drops);
}

function matches(b: Boss): boolean {
    if (activeKind !== 'all' && !b.kinds.includes(activeKind)) return false;
    const q = keyword.trim().toLowerCase();
    if (!q) return true;
    return b.name.toLowerCase().includes(q)
        || b.en.toLowerCase().includes(q)
        || places(b).some(p => p.toLowerCase().includes(q))
        || allDrops(b).some(d => d.n.toLowerCase().includes(q) || d.e.toLowerCase().includes(q));
}

function dropHtml(d: Drop): string {
    const label = d.n || d.e;
    const img = d.i
        ? `<img src="${esc(`Equipment/${d.c}/${d.i}`.split('/').map(encodeURIComponent).join('/'))}" alt="${esc(label)}" loading="lazy" onerror="this.style.display='none'">`
        : '<span class="boss-drop-noimg">?</span>';
    return `<li class="boss-drop${d.n ? '' : ' boss-drop-en'}" title="${esc(d.e)}">${img}<span>${esc(label)}</span></li>`;
}

function dropGroupsHtml(b: Boss, pick: (d: Drop) => boolean, title: string, render: (d: Drop) => string): string {
    const modes = (b.modes ?? []).map(m => ({ mode: m.mode, drops: m.drops.filter(pick) })).filter(m => m.drops.length);
    if (!modes.length) return '';
    const sig = (m: { drops: Drop[] }) => m.drops.map(d => d.e).sort().join('|');
    const same = modes.every(m => sig(m) === sig(modes[0]));
    const groups = same ? [{ label: title, drops: modes[0].drops }] : modes.map(m => ({ label: `${m.mode} ${title}`, drops: m.drops }));
    return groups.map(g => `
      <div class="boss-drops">
        <h4>${esc(g.label)}</h4>
        <ul class="boss-drop-list">${g.drops.map(render).join('')}</ul>
      </div>`).join('');
}

function crystaHtml(d: Drop): string {
    const icon = `CrystaImg/${d.ic ?? 'normal'}.png`;
    return `<li class="boss-drop boss-drop-crysta${d.n ? '' : ' boss-drop-en'}" title="${esc(d.e)}">
      <img src="${esc(icon)}" alt="" loading="lazy" onerror="this.src='CrystaImg/normal.png'">
      <span>${esc(d.n || d.e)}<small>${esc(d.t ?? '')}</small>
        ${d.o ? `<span class="boss-crysta-opt">${esc(d.o.replace(/&/g, ' · '))}</span>` : ''}
        ${d.h ? `<span class="boss-crysta-opt boss-crysta-from">강화 전: ${esc(d.h)}</span>` : ''}
      </span></li>`;
}

function ownCrystaHtml(b: Boss): string {
    if (!b.crystas?.length) return '';
    return `
      <div class="boss-drops">
        <h4>보스 크리스타</h4>
        <ul class="boss-drop-list">${b.crystas.map(crystaHtml).join('')}</ul>
      </div>`;
}

function dropsHtml(b: Boss): string {
    return dropGroupsHtml(b, d => !d.t, '드롭 장비', dropHtml) + ownCrystaHtml(b) + dropGroupsHtml(b, d => !!d.t, '드롭 크리스타', crystaHtml);
}

function modesHtml(b: Boss): string {
    // 위치는 카드 머리글의 한글 이름을 쓴다. 한글 위치가 없는 보스만 코린의 영문 맵 이름을 표에 보여 준다.
    const showMap = !b.rows.some(r => r.field);
    return `
      <div class="boss-table-wrap">
        <table class="boss-table">
          <thead><tr><th>난이도</th><th>Lv</th><th>속성</th><th>HP</th><th>경험치</th>${showMap ? '<th>출현 맵</th>' : ''}</tr></thead>
          <tbody>
            ${b.modes!.map(m => `<tr>
              <td class="boss-td-place">${esc(m.mode || '-')}</td>
              <td>${m.level}</td>
              <td>${esc(m.ele || '-')}</td>
              <td>${m.hp ? num(m.hp) : '-'}</td>
              <td>${m.exp ? num(m.exp) : '-'}</td>
              ${showMap ? `<td>${esc(m.map || '-')}</td>` : ''}
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
}

function rowsHtml(b: Boss): string {
    const elements = data!.elements;
    return `
      <div class="boss-table-wrap">
        <table class="boss-table">
          <thead><tr><th>출현 위치</th><th>Lv</th><th>속성</th><th>HP</th><th>DEF</th><th>MDEF</th><th>회피</th><th>어보이드</th><th>가드</th></tr></thead>
          <tbody>
            ${b.rows.map(r => `<tr>
              <td class="boss-td-place">${r.field ? esc(r.field) : '<span class="boss-dim">위치 정보 없음</span>'}</td>
              <td>${r.level}</td>
              <td>${esc(elements[String(r.ele)] ?? '?')}</td>
              <td>${num(r.hp)}</td>
              <td>${num(r.d)}</td>
              <td>${num(r.md)}</td>
              <td>${num(r.hit)}</td>
              <td>${r.avoid}%</td>
              <td>${r.guard}%</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
}

function detailHtml(b: Boss): string {
    if (!b.modes?.length) return rowsHtml(b) + ownCrystaHtml(b);
    return `
      ${modesHtml(b)}
      ${dropsHtml(b)}
      <div class="boss-ref">
        <h4>게임 데이터 기본 수치 (참고)</h4>
        ${rowsHtml(b)}
      </div>`;
}

function renderList(): void {
    const listEl = document.getElementById('boss-list');
    const countEl = document.getElementById('boss-count');
    if (!listEl || !data) return;
    const shown = data.bosses.filter(matches);
    if (countEl) countEl.textContent = `${shown.length}마리`;

    if (shown.length === 0) {
        listEl.innerHTML = '<div class="boss-empty">조건에 맞는 보스가 없습니다.</div>';
        return;
    }

    listEl.innerHTML = shown.map(b => {
        const open = openId === b.id;
        const where = places(b);
        const eleSet = b.modes?.length ? [...new Set(b.modes.map(m => m.ele).filter(Boolean))] : [...new Set(b.rows.map(r => data!.elements[String(r.ele)] ?? '?'))];
        return `
        <div class="boss-card ${open ? 'open' : ''}" data-id="${b.id}">
          <button type="button" class="boss-head" data-toggle="${b.id}" aria-expanded="${open}">
            <span class="boss-name">${esc(b.name)}${b.en ? `<small>${esc(b.en)}</small>` : ''}</span>
            <span class="boss-badges">${b.kinds.map(k => `<em class="boss-badge boss-badge-${k}">${esc(data!.kinds[k] ?? k)}</em>`).join('')}</span>
            <span class="boss-sum">${levelText(b)} · ${esc(eleSet.join('/'))}</span>
            <span class="boss-where">${where.length ? esc(where[0]) + (where.length > 1 ? ` 외 ${where.length - 1}곳` : '') : '위치 정보 없음'}</span>
          </button>
          ${open ? detailHtml(b) : ''}
        </div>`;
    }).join('');

    listEl.querySelectorAll<HTMLButtonElement>('[data-toggle]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = Number(btn.dataset.toggle);
            openId = openId === id ? null : id;
            renderList();
        });
    });
}

export async function renderBossPage(): Promise<void> {
    const app = document.querySelector<HTMLDivElement>('#app')!;
    activeKind = 'all';
    keyword = '';
    openId = null;

    app.innerHTML = `
    <div class="nav-bar">
      <button class="btn-home" id="back-home">🏠 Home</button>
      <h2 style="margin:0 0 0 15px; border:none;">👹 보스 정보</h2>
    </div>
    <div class="container">
      <div class="boss-notice">
        게임 데이터 기준의 <b>기본 수치</b>입니다. 난이도·레벨 선택, 페이즈, 부위별 수치는 반영되지 않아 실제 전투와 다를 수 있습니다.
      </div>

      <div class="skill-tabs" id="boss-tabs"></div>

      <div class="boss-toolbar">
        <input type="text" id="boss-search" class="search-input" placeholder="보스 이름 · 위치 · 드롭 장비 검색..." maxlength="40" autocomplete="off">
        <span class="boss-count" id="boss-count"></span>
      </div>

      <div id="boss-list"><div class="boss-empty">불러오는 중...</div></div>

      <p class="boss-source">데이터 출처: toram.nimp.dev 도감 · coryn.club</p>
    </div>`;

    document.getElementById('back-home')?.addEventListener('click', () => history.back());

    try {
        if (!data) {
            const res = await fetch('Boss/Boss.json');
            if (!res.ok) throw new Error(String(res.status));
            data = await res.json() as BossData;
        }
    } catch (err) {
        console.error('보스 데이터 로딩 실패:', err);
        const listEl = document.getElementById('boss-list');
        if (listEl) listEl.innerHTML = '<div class="boss-empty">보스 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>';
        return;
    }

    const tabs = document.getElementById('boss-tabs')!;
    const kindEntries = Object.entries(data.kinds);
    tabs.innerHTML = [`<button class="skill-tab-btn active" data-kind="all">전체</button>`,
        ...kindEntries.map(([k, label]) => `<button class="skill-tab-btn" data-kind="${esc(k)}">${esc(label)}</button>`)].join('');
    tabs.querySelectorAll<HTMLButtonElement>('.skill-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            activeKind = btn.dataset.kind!;
            openId = null;
            tabs.querySelectorAll('.skill-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
            renderList();
        });
    });

    document.getElementById('boss-search')!.addEventListener('input', (e) => {
        keyword = (e.target as HTMLInputElement).value;
        openId = null;
        renderList();
    });

    renderList();
}
