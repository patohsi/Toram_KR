// src/main.ts
import './style.css';
import { db } from './firebase';
import { collection, getDocs, query, orderBy, serverTimestamp, where, deleteDoc, doc, addDoc, limit } from 'firebase/firestore';
import { renderCalculatorPage } from './calculator/ui';
import { renderTradePage } from './trade/ui';
import { renderBossPage } from './boss/ui';
import { renderConsumablePage } from './consumable/ui';
import { recordPageView, loadVisitSummary, type VisitSummary } from './stats';

// =================================================
// 0. 타입 및 라우팅
// =================================================
type PageKey = 'home' | 'schedule' | 'crysta' | 'skill' | 'ability' | 'registlet' | 'food' | 'equip' | 'guide' | 'info' | 'enchant' | 'trade' | 'boss' | 'consumable' | 'calculator';

const app = document.querySelector<HTMLDivElement>('#app')!;

const routes: Record<PageKey, () => void> = {
    home: renderHomePage,
    schedule: renderSchedulePage,
    crysta: renderCrystaPage,
    skill: renderSkillPage,
    ability: renderAbilityPage,
    registlet: renderRegistletPage,
    food: renderFoodPage,
    equip: renderEquipmentPage,
    guide: renderGuidePage,
    info: renderInfoPage,
    enchant: () => renderCalculatorPage('enchant'),
    trade: renderTradePage,
    boss: renderBossPage,
    consumable: renderConsumablePage,
    calculator: () => renderCalculatorPage()
};

const PAGE_NAMES: Record<string, string> = {
    home:'홈', crysta:'크리스타', skill:'스킬', ability:'어빌리티',
    registlet:'레지스트릿', food:'요리', equip:'장비', guide:'뉴비가이드', schedule:'이벤트', enchant:'옵션부여', calculator:'계산기', trade:'거래', boss:'보스', consumable:'소모품'
};

function navigate(page: PageKey) {
    if (history.state && history.state.page === page) return;
    history.pushState({ page }, '', `#${page}`);
    routes[page]();
    window.scrollTo(0, 0);
    void recordPageView(page);
}

window.addEventListener('popstate', (event) => {
    const modal = document.getElementById('image-modal');
    if (modal && modal.style.display === 'flex') { modal.style.display = 'none'; return; }
    if (event.state?.page) { const p = event.state.page as PageKey; if (routes[p]) { routes[p](); void recordPageView(p); } }
    else { renderHomePage(); void recordPageView('home'); }
});

function initMouseBackEvent() {
    window.addEventListener('mouseup', (e) => { if (e.button === 3) { e.preventDefault(); history.back(); } });
}

// =================================================
// 1. 이벤트 스케줄 데이터
// =================================================
const eventSchedule = [
    { month: "연초", title: "신년맞이 이벤트" },
    { month: "1월", title: "메기스톤 & 고난도 (1분기)" },
    { month: "2월", title: "눈싸움 이벤트 / 발렌타인" },
    { month: "3월", title: "화이트데이" },
    { month: "4월", title: "벚꽃맞이 이벤트 / 고난도 (2분기)" },
    { month: "5월", title: "골든위크 / 황금 이벤트" },
    { month: "6월", title: "장마 이벤트" },
    { month: "7월", title: "여름 이벤트 / 주년제 이벤트 / 고난도 (3분기)" },
    { month: "8월", title: "이스터에그" },
    { month: "9월", title: "가을미각 / 황금포툼 / 고난도 (4분기)" },
    { month: "10월", title: "할로윈 이벤트" },
    { month: "11월", title: "크리스마스 이벤트" },
    { month: "상시/비정기", title: "N만명 다운로드 기념 / 콜라보 이벤트 / 복각" }
];

// =================================================
// [Page 1] 홈 화면
// =================================================
const HOME_SLIDE_IMAGES: string[] = [
    'HomeImg/slide_01.png','HomeImg/slide_02.png','HomeImg/slide_03.png',
    'HomeImg/slide_04.png','HomeImg/slide_05.png','HomeImg/slide_06.png',
    'HomeImg/slide_07.png','HomeImg/slide_08.png','HomeImg/slide_09.png','HomeImg/slide_10.png',
];
let slideTimer: ReturnType<typeof setInterval> | null = null;

const HOME_SHORTCUTS: { page: PageKey; icon: string; label: string }[] = [
    { page: 'schedule', icon: '📅', label: '이벤트' },
    { page: 'crysta', icon: '💎', label: '크리스타' },
    { page: 'skill', icon: '📖', label: '스킬' },
    { page: 'ability', icon: '🔮', label: '어빌리티' },
    { page: 'registlet', icon: '💍', label: '레지스트릿' },
    { page: 'food', icon: '🍳', label: '요리' },
    { page: 'equip', icon: '🛡️', label: '장비' },
    { page: 'boss', icon: '👹', label: '보스' },
    { page: 'guide', icon: '📘', label: '뉴비가이드' },
    { page: 'trade', icon: '🏪', label: '거래' },
    { page: 'calculator', icon: '🧮', label: '계산기' },
    { page: 'consumable', icon: '💊', label: '소모품' },
];

const QUICK_SEARCH_TARGETS: { key: string; label: string; placeholder: string }[] = [
    { key: 'crysta', label: '크리스타', placeholder: '크리스타 이름을 적어보세요…' },
    { key: 'equip', label: '장비', placeholder: '장비 이름을 적어보세요…' },
    { key: 'reg', label: '레지스트릿', placeholder: '레지스트릿 이름을 적어보세요…' },
    { key: 'food', label: '요리 주소', placeholder: '요리 이름을 적어보세요…' },
];

function renderHomePage() {
    if (slideTimer) { clearInterval(slideTimer); slideTimer = null; }
    app.innerHTML = `
    <div class="home-wrap n4-home">
      <div class="n4-paper">
        <span class="n4-tape n4-tape-l"></span><span class="n4-tape n4-tape-r"></span>

        <header class="n4-hero">
          <div class="n4-hero-text">
            <h1 class="n4-title">🌸 토람 <span>종합 정보</span> 가이드</h1>
            <p class="n4-sub">토람 온라인 한국어 다중 정보 검색 사이트</p>
          </div>
          <div class="n4-stats">
            <div class="n4-stat">💎 크리스타 <b id="stat-crysta">...</b></div>
            <div class="n4-stat">🛡️ 장비 <b id="stat-equip">...</b></div>
            <div class="n4-stat">💍 레지스트릿 <b id="stat-reg">...</b></div>
          </div>
          <div class="n4-mascot"><img src="mascot.png" alt="마스코트" onerror="this.style.display='none'"></div>
        </header>

        <div class="n4-grid">
          <div class="n4-main">
            <section class="n4-sec n4-shortcuts">
              <h2 class="n4-h"><span>바로가기</span></h2>
              <div class="n4-shortcut-grid">
                ${HOME_SHORTCUTS.map((s, i) => `<div class="sc-card n4-sticker n4-c${(i % 3) + 1}" data-page="${s.page}"><div class="n4-sticker-icon">${s.icon}</div><div class="n4-sticker-txt">${s.label}</div></div>`).join('')}
              </div>
            </section>

            <section class="n4-sec n4-search">
              <h2 class="n4-h"><span>빠른 검색</span></h2>
              <div class="n4-tabs" id="qs-tabs">
                ${QUICK_SEARCH_TARGETS.map((t, i) => `<button type="button" class="n4-tab ${i === 0 ? 'on' : ''}" data-target="${t.key}">${t.label}</button>`).join('')}
              </div>
              <div class="n4-find">
                <input type="text" id="qs-input" class="n4-find-input" placeholder="${QUICK_SEARCH_TARGETS[0].placeholder}" autocomplete="off">
                <button type="button" class="n4-find-btn" id="qs-btn">검색</button>
              </div>
            </section>

            <section class="n4-sec n4-notice">
              <h2 class="n4-h"><span>토람 공식 공지</span></h2>
              <div id="notice-list"><div class="home-loading">불러오는 중...</div></div>
            </section>
          </div>

          <aside class="n4-side">
            <section class="n4-sec">
              <h2 class="n4-h"><span>최근 가이드</span> <span class="n4-new">NEW</span></h2>
              <div id="recent-guide-list"><div class="home-loading">불러오는 중...</div></div>
            </section>
            <section class="n4-sec">
              <h2 class="n4-h"><span>최신 거래</span> <span class="n4-new">NEW</span></h2>
              <div id="recent-trade-list"><div class="home-loading">불러오는 중...</div></div>
            </section>
            <section class="n4-sec">
              <h2 class="n4-h"><span>방문 통계</span></h2>
              <div id="visit-stats"><div class="home-loading">불러오는 중...</div></div>
            </section>
          </aside>
        </div>

        <section class="n4-sec n4-gallery">
          <h2 class="n4-h"><span>갤러리</span></h2>
          <div class="img-slider-wrap">
            <div class="img-slider" id="home-slider"><div class="slider-placeholder">public/HomeImg/ 폴더에 slide_01.png ~ slide_10.png 를 넣어주세요</div></div>
            <div class="slider-dots" id="slider-dots"></div>
          </div>
        </section>
      </div>
    </div>`;

    // 바로가기
    document.querySelectorAll('.sc-card').forEach(c => c.addEventListener('click', () => navigate((c as HTMLElement).dataset.page as PageKey)));

    // 빠른 검색 (탭으로 대상을 고르고 검색창 하나로 검색)
    let qsTarget = QUICK_SEARCH_TARGETS[0].key;
    const qsInput = document.getElementById('qs-input') as HTMLInputElement;
    document.querySelectorAll<HTMLButtonElement>('#qs-tabs .n4-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('#qs-tabs .n4-tab').forEach(t => t.classList.remove('on'));
            tab.classList.add('on');
            qsTarget = tab.dataset.target!;
            qsInput.placeholder = QUICK_SEARCH_TARGETS.find(t => t.key === qsTarget)!.placeholder;
            qsInput.focus();
        });
    });
    const fillAfterNavigate = (inputId: string, value: string) => {
        setTimeout(() => { const el = document.getElementById(inputId) as HTMLInputElement | null; if (el) { el.value = value; el.dispatchEvent(new Event('input')); } }, 150);
    };
    const runQuickSearch = () => {
        const q = qsInput.value.trim();
        if (qsTarget === 'crysta') { if (!q) return; navigate('crysta'); fillAfterNavigate('nameInput', q); }
        else if (qsTarget === 'equip') { if (!q) return; navigate('equip'); fillAfterNavigate('equip-search', q); }
        else if (qsTarget === 'reg') { if (!q) return; navigate('registlet'); fillAfterNavigate('reg-name-input', q); }
        else { navigate('food'); fillAfterNavigate('food-search-input', q); }
    };
    document.getElementById('qs-btn')?.addEventListener('click', runQuickSearch);
    qsInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') runQuickSearch(); });

    loadHomeStats();
    loadOfficialNotice();
    loadRecentGuides();
    loadRecentTrades();
    loadVisitStats();
    initSlider();
}

function renderVisitStats(container: HTMLElement, data: VisitSummary) {
    const fmt = (n: number) => n.toLocaleString();
    const top = data.topPages.length
        ? data.topPages.map(([key, count]) => `${escapeHtml(PAGE_NAMES[key] || key)} <em>${fmt(count)}</em>`).join(' · ')
        : '아직 기록이 없습니다';
    container.innerHTML = `
        <div class="n4-vs-row"><span>오늘 방문</span><b>${fmt(data.today)}</b></div>
        <div class="n4-vs-row"><span>이번 달 방문</span><b>${fmt(data.month)}</b></div>
        <div class="n4-vs-row"><span>이번 달 페이지뷰</span><b>${fmt(data.monthViews)}</b></div>
        <div class="n4-vs-top"><span>인기 페이지</span> ${top}</div>`;
}

async function loadVisitStats() {
    const container = document.getElementById('visit-stats');
    if (!container) return;
    const data = await loadVisitSummary();
    if (!document.getElementById('visit-stats')) return;
    if (!data) { container.innerHTML = '<div class="home-loading">통계를 불러오지 못했습니다.</div>'; return; }
    renderVisitStats(container, data);
}

async function loadRecentTrades() {
    const container = document.getElementById('recent-trade-list');
    if (!container) return;
    try {
        const snap = await Promise.race([
            getDocs(query(collection(db, 'trades'), orderBy('createdAt', 'desc'), limit(3))),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
        ]);
        if (snap.empty) { container.innerHTML = '<div class="home-loading">아직 거래글이 없습니다.</div>'; return; }
        const labels: Record<string, string> = { selling: '판매중', reserved: '예약중', done: '완료' };
        container.innerHTML = snap.docs.map(d => {
            const t = d.data();
            const status = t.category === 'wanted' && t.status === 'selling' ? '구매중' : (labels[t.status] || '');
            return `<div class="n4-line" data-go-trade><span class="n4-line-title">${escapeHtml(String(t.title || ''))}</span><em>${escapeHtml(status)}</em></div>`;
        }).join('');
        container.querySelectorAll('[data-go-trade]').forEach(el => el.addEventListener('click', () => navigate('trade')));
    } catch {
        container.innerHTML = '<div class="home-loading">불러오지 못했습니다.</div>';
    }
}

async function loadHomeStats() {
    try {
        const cats = ['normal','weapon','armor','hat','ring','enhanced_normal','enhanced_weapon','enhanced_armor','enhanced_hat','enhanced_ring'];
        const results = await Promise.all(cats.map(async c => {
            try {
                if (crystaCache[c]) return crystaCache[c].length;
                const r = await fetch(`CrystaData/${c}.json`);

                if (!r.ok) return 0;
                const d = await r.json(); crystaCache[c] = d;

                return d.length;
            } catch { return 0; }
        }));
        const el = document.getElementById('stat-crysta'); if (el) el.textContent = results.reduce((a,b)=>a+b,0).toLocaleString();
    } catch {}
    try {
        const cats = ['Handed_Sword','Two_Handed_Sword','bow','bowgun','staff','magicdevice','knuckle','halberd','katana','armor','additional','shield'];
        const results = await Promise.all(cats.map(async c => {
            try { const r = await fetch(`Equipment/${c}/${c}.js`); if (!r.ok) return 0; const t = await r.text(); const eq = t.indexOf('='); let j = t.substring(eq+1).trim(); if (j.endsWith(';')) j=j.slice(0,-1); const d = new Function(`return ${j}`)(); const items = d.items||d; return Array.isArray(items)?items.length:0; } catch { return 0; }
        }));
        const el = document.getElementById('stat-equip'); if (el) el.textContent = results.reduce((a,b)=>a+b,0).toLocaleString();
    } catch {}
    try {
        const r = await fetch('registlet/registlet_list.js');
        if (r.ok) { const t = await r.text(); const obj = new Function(`return ${t.substring(t.indexOf('{'))}`)(); const el = document.getElementById('stat-reg'); if (el && obj?.items) el.textContent = obj.items.length.toLocaleString(); }
    } catch {}
}

async function loadOfficialNotice() {
    const container = document.getElementById('notice-list'); if (!container) return;
    const BASE = 'https://kr.toram.jp';
    const TARGET_URL = `${BASE}/information/?type_code=all`;
    // 프록시 여러 개 순서대로 시도
    const PROXIES = [
        (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
        (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
        (u: string) => `https://thingproxy.freeboard.io/fetch/${u}`,
    ];

    for (const makeProxy of PROXIES) {
        try {
            const res = await fetch(makeProxy(TARGET_URL), { signal: AbortSignal.timeout(6000) });
            if (!res.ok) continue;
            const html = await res.text();
            if (!html || html.length < 100) continue;

            const doc2 = new DOMParser().parseFromString(html, 'text/html');
            const links = Array.from(doc2.querySelectorAll('a[href*="information_id"]')).slice(0, 5);
            if (links.length === 0) continue;

            container.innerHTML = links.map(link => {
                const title = (link.textContent || '').trim().replace(/\s+/g, ' ');
                const rawHref = link.getAttribute('href') || '';
                // href가 절대경로면 그대로, 상대경로면 BASE 붙이기
                const fullHref = rawHref.startsWith('http')
                    ? rawHref
                    : rawHref.startsWith('/')
                        ? `${BASE}${rawHref}`
                        : `${BASE}/information/${rawHref}`;
                const isEvent = title.includes('이벤트') || title.toLowerCase().includes('event');
                const cls = isEvent ? 'badge-event' : 'badge-notice';
                const label = isEvent ? '이벤트' : '공지';
                const short = title.length > 45 ? title.slice(0, 45) + '...' : title;
                return `<div class="notice-item"><span class="notice-badge ${cls}">${label}</span><a href="${fullHref}" target="_blank" class="notice-link">${short}</a></div>`;
            }).join('');
            return; // 성공하면 종료
        } catch { continue; }
    }
    // 모든 프록시 실패
    container.innerHTML = `<div class="notice-item"><span class="notice-badge badge-notice">공지</span><a href="${TARGET_URL}" target="_blank" class="notice-link">토람 공식 공지 확인하기 →</a></div><div style="font-size:0.75rem;color:var(--text-dim);margin-top:5px;">자동 로드 실패 · 직접 확인해주세요</div>`;
}

async function loadRecentGuides() {
    const container = document.getElementById('recent-guide-list'); if (!container) return;
    try {
        const q = query(collection(db, 'guides'), orderBy('createdAt', 'desc'), limit(3));
        const snap = await getDocs(q);
        if (snap.empty) { container.innerHTML = '<div style="color:#888;font-size:0.85rem;padding:8px 0;">아직 가이드가 없습니다.</div>'; return; }
        const names: Record<string,string> = { menu:'메뉴', money:'돈벌기', raid:'레이드', myroom:'마이룸', boss:'특수보스', job:'직업' };
        container.innerHTML = snap.docs.map(d => {
            const data = d.data();
            let dateStr = '';
            if (data.createdAt?.toDate) { const dt = data.createdAt.toDate(); dateStr = `${dt.getFullYear()}.${String(dt.getMonth()+1).padStart(2,'0')}.${String(dt.getDate()).padStart(2,'0')}`; }
            return `<div class="guide-preview-item" data-category="${data.category}"><span class="guide-cat-badge">${names[data.category]||data.category}</span><div class="guide-preview-title">${escapeHtml(data.title||'')}</div><div class="guide-preview-meta">✍️ ${escapeHtml(data.nickname||'익명')} · ${dateStr}</div></div>`;
        }).join('');
        container.querySelectorAll('.guide-preview-item').forEach(item => {
            item.addEventListener('click', () => { currentGuideTab = (item as HTMLElement).dataset.category||'menu'; navigate('guide'); });
        });
    } catch { container.innerHTML = '<div style="color:#888;font-size:0.85rem;">가이드를 불러오지 못했습니다.</div>'; }
}

async function initSlider() {
    const slider = document.getElementById('home-slider'); const dotsEl = document.getElementById('slider-dots');
    if (!slider || !dotsEl) return;
    const valid: string[] = [];
    await Promise.all(HOME_SLIDE_IMAGES.map(src => new Promise<void>(res => { const img = new Image(); img.onload = () => { valid.push(src); res(); }; img.onerror = () => res(); img.src = src; })));
    if (valid.length === 0) return;
    let cur = 0;
    const render = () => {
        slider.innerHTML = `<img src="${valid[cur]}" class="slider-img" alt="갤러리">`;
        dotsEl.innerHTML = valid.map((_,i) => `<span class="slider-dot ${i===cur?'active':''}"></span>`).join('');
        dotsEl.querySelectorAll('.slider-dot').forEach((d,i) => d.addEventListener('click', () => { cur=i; render(); reset(); }));
    };
    const reset = () => { if (slideTimer) clearInterval(slideTimer); slideTimer = setInterval(() => { cur=(cur+1)%valid.length; render(); }, 5000); };
    render(); reset();
}

// --- [Page 2] 이벤트 스케줄 페이지 ---
function renderSchedulePage() {
    const listHtml = eventSchedule.map(item => `
    <div class="event-row" style="display:flex; padding:15px; border-bottom:1px dashed var(--border-color); align-items:center;">
      <div class="event-month" style="width:80px; font-weight:bold; color:var(--accent-pink); background:rgba(255,0,127,0.1); padding:5px 10px; border-radius:20px; text-align:center; margin-right:15px; flex-shrink:0;">
        ${item.month}
      </div>
      <div class="event-title" style="font-size:1.1rem; color:var(--text-main); line-height:1.4;">
        ${item.title}
      </div>
    </div>
  `).join('');

    app.innerHTML = `
    <div class="nav-bar">
      <button class="btn-home" id="back-home">🏠 Home</button>
      <h2 style="margin:0 0 0 15px; border:none;">📅 이벤트 스케줄</h2>
    </div>

    <div class="container" style="max-width:800px;">
      <div class="schedule-box" style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:15px; padding:20px; box-shadow:0 4px 15px rgba(0,0,0,0.2);">
        ${listHtml}
      </div>

      <div style="text-align:center; margin-top:30px; color:#888; font-size:0.9rem;">
        ※ 일정은 운영사 사정에 따라 변경될 수 있습니다.
      </div>
    </div>
  `;

    document.getElementById('back-home')?.addEventListener('click', renderHomePage);
}

// --- [Page 2] 크리스타 페이지 (기능 구현 완료) ---
function renderCrystaPage() {
    app.innerHTML = `
    <div class="nav-bar">
      <button class="btn-home" id="back-home">🏠 Home</button>
      <h2 style="margin:0 0 0 15px; border:none;">💎 크리스타 검색기</h2>
    </div>

    <div class="search-container">
      <!-- 검색어 입력 -->
      <input type="text" id="nameInput" class="search-input" placeholder="크리스타 이름을 입력하세요 (실시간 검색)">

      <!-- 카테고리 필터 -->
      <div class="checkbox-group" id="category-filters">
        <input type="checkbox" id="normal" value="normal" checked> <label for="normal">노말</label>
        <input type="checkbox" id="weapon" value="weapon" checked> <label for="weapon">무기</label>
        <input type="checkbox" id="armor" value="armor" checked> <label for="armor">갑옷</label>
        <input type="checkbox" id="hat" value="hat" checked> <label for="hat">모자</label>
        <input type="checkbox" id="ring" value="ring" checked> <label for="ring">반지</label>
        
        <input type="checkbox" id="enhanced_normal" value="enhanced_normal" checked > <label for="enhanced_normal">노말(강화)</label>
        <input type="checkbox" id="enhanced_weapon" value="enhanced_weapon" checked > <label for="enhanced_weapon">무기(강화)</label>
        <input type="checkbox" id="enhanced_armor" value="enhanced_armor" checked > <label for="enhanced_armor">갑옷(강화)</label>
        <input type="checkbox" id="enhanced_hat" value="enhanced_hat" checked > <label for="enhanced_hat">모자(강화)</label>
        <input type="checkbox" id="enhanced_ring" value="enhanced_ring" checked > <label for="enhanced_ring">반지(강화)</label>
      </div>

      <!-- 옵션 필터 버튼 그룹 -->
      <div style="width:100%;">
        <div style="text-align:center; margin-bottom:8px; color:var(--text-dim); font-size:0.85rem;">옵션 선택</div>
        <div class="option-btn-group" id="option-btn-group">
          <button class="opt-btn active" data-val="none">전체</button>
          <button class="opt-btn" data-val="STR%">STR%</button>
          <button class="opt-btn" data-val="STR">STR</button>
          <button class="opt-btn" data-val="DEX%">DEX%</button>
          <button class="opt-btn" data-val="DEX">DEX</button>
          <button class="opt-btn" data-val="INT%">INT%</button>
          <button class="opt-btn" data-val="INT">INT</button>
          <button class="opt-btn" data-val="AGI%">AGI%</button>
          <button class="opt-btn" data-val="AGI">AGI</button>
          <button class="opt-btn" data-val="VIT%">VIT%</button>
          <button class="opt-btn" data-val="VIT">VIT</button>
          <button class="opt-btn" data-val="ATK%">ATK%</button>
          <button class="opt-btn" data-val="ATK">ATK</button>
          <button class="opt-btn" data-val="MATK%">MATK%</button>
          <button class="opt-btn" data-val="MATK">MATK</button>
          <button class="opt-btn" data-val="크리티컬률%">크리%</button>
          <button class="opt-btn" data-val="크리티컬률">크리</button>
          <button class="opt-btn" data-val="크리티컬데미지%">크뎀%</button>
          <button class="opt-btn" data-val="크리티컬데미지">크뎀</button>
          <button class="opt-btn" data-val="최대HP%">HP%</button>
          <button class="opt-btn" data-val="최대HP">HP</button>
          <button class="opt-btn" data-val="최대MP%">MP%</button>
          <button class="opt-btn" data-val="최대MP">MP</button>
          <button class="opt-btn" data-val="공격속도%">공속%</button>
          <button class="opt-btn" data-val="공격속도">공속</button>
          <button class="opt-btn" data-val="시전속도%">시전%</button>
          <button class="opt-btn" data-val="행동속도%">행동%</button>
          <button class="opt-btn" data-val="안정률%">안정률</button>
          <button class="opt-btn" data-val="명중%">명중%</button>
          <button class="opt-btn" data-val="명중">명중</button>
          <button class="opt-btn" data-val="절대명중%">절명%</button>
          <button class="opt-btn" data-val="회피%">회피%</button>
          <button class="opt-btn" data-val="회피">회피</button>
          <button class="opt-btn" data-val="물리내성%">물내%</button>
          <button class="opt-btn" data-val="마법내성%">마내%</button>
          <button class="opt-btn" data-val="이상내성%">이내%</button>
          <button class="opt-btn" data-val="근거리위력%">근위%</button>
          <button class="opt-btn" data-val="원거리위력%">원위%</button>
          <button class="opt-btn" data-val="발도공격%">발도%</button>
          <button class="opt-btn" data-val="어그로%">어그로%</button>
          <button class="opt-btn" data-val="마법배리어">마배리</button>
          <button class="opt-btn" data-val="물리배리어">물배리</button>
          <button class="opt-btn" data-val="비율배리어%">비배%</button>
          <button class="opt-btn" data-val="공격MP회복%">공MP%</button>
          <button class="opt-btn" data-val="공격MP회복">공MP</button>
          <button class="opt-btn" data-val="MP자연회복%">MP회%</button>
          <button class="opt-btn" data-val="HP자연회복%">HP회%</button>
        </div>
      </div>

      <!-- 수치 필터 -->
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; justify-content:center; width:100%;">
        <select id="symbol" style="padding:8px; border-radius:5px; background:var(--input-bg); color:var(--text-main); border:1px solid var(--border-color);">
          <option value="=">같음 (=)</option>
          <option value=">">큼 (>)</option>
          <option value="<">작음 (<)</option>
          <option value=">=">크거나 같음 (>=)</option>
          <option value="<=">작거나 같음 (<=)</option>
        </select>
        <input type="number" id="valueInput" placeholder="수치 입력" style="width:90px; padding:8px;">
        <input type="hidden" id="optionType" value="none">
      </div>
    </div>

    <div style="text-align:center; margin-bottom:20px;">
      <button id="randomButton" class="secondary">🎲 랜덤 크리스타 뽑기</button>
    </div>

    <!-- 결과 리스트 -->
    <div id="searchResults">
      <div style="text-align:center; padding:20px; color:#888;">검색 조건을 입력하거나 카테고리를 선택하세요.</div>
    </div>
  `;

    // 이벤트 바인딩
    document.getElementById('back-home')?.addEventListener('click', renderHomePage);

    // 실시간 검색 이벤트 연결
    const inputs = ['nameInput', 'symbol', 'valueInput'];
    inputs.forEach(id => {
        document.getElementById(id)?.addEventListener('input', performSearch);
        document.getElementById(id)?.addEventListener('change', performSearch);
    });

    // 체크박스 변경 시 검색
    document.querySelectorAll('#category-filters input').forEach(chk => {
        chk.addEventListener('change', performSearch);
    });

    document.getElementById('randomButton')?.addEventListener('click', performRandomPick);

    // 옵션 버튼 그룹 이벤트
    document.querySelectorAll('.opt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const val = (btn as HTMLElement).dataset.val || 'none';
            (document.getElementById('optionType') as HTMLInputElement).value = val;
            performSearch();
        });
    });

    // 초기 검색 실행
    performSearch();
}

// --- [로직] 크리스타 검색 ---
const imageMap: Record<string, string> = {
    normal: 'CrystaImg/normal.png',
    enhanced_normal: 'CrystaImg/enhanced_normal.png',
    weapon: 'CrystaImg/weapon.png',
    enhanced_weapon: 'CrystaImg/enhanced_weapon.png',
    armor: 'CrystaImg/armor.png',
    enhanced_armor: 'CrystaImg/enhanced_armor.png',
    hat: 'CrystaImg/hat.png',
    enhanced_hat: 'CrystaImg/enhanced_hat.png',
    ring: 'CrystaImg/ring.png',
    enhanced_ring: 'CrystaImg/enhanced_ring.png'
};

// JSON 데이터 캐싱 (매번 fetch 안 하도록)
let crystaCache: Record<string, any[]> = {};

async function performSearch() {
    const nameQuery = (document.getElementById('nameInput') as HTMLInputElement).value.toLowerCase();
    const optionType = (document.getElementById('optionType') as HTMLSelectElement).value;
    const symbol = (document.getElementById('symbol') as HTMLSelectElement).value;
    const valueStr = (document.getElementById('valueInput') as HTMLInputElement).value;
    const value = parseFloat(valueStr);

    // 체크된 카테고리 확인
    const checkedBoxes = Array.from(document.querySelectorAll('#category-filters input:checked')) as HTMLInputElement[];
    const categories = checkedBoxes.map(cb => cb.value);

    if (categories.length === 0) {
        document.getElementById('searchResults')!.innerHTML = '<div style="text-align:center; padding:20px;">카테고리를 하나 이상 선택해주세요.</div>';
        return;
    }

    const resultsContainer = document.getElementById('searchResults')!;
    resultsContainer.innerHTML = '<div style="text-align:center; padding:20px;">검색 중...</div>';

    try {
        // 데이터 로드 (병렬 처리)
        const allData = await Promise.all(categories.map(async (cat) => {
            if (!crystaCache[cat]) {
                try {
                    const res = await fetch(`CrystaData/${cat}.json`);
                    if (!res.ok) throw new Error('File not found');
                    crystaCache[cat] = await res.json();
                } catch (e) {
                    console.warn(`Failed to load ${cat}.json`);
                    crystaCache[cat] = [];
                }
            }
            // 카테고리 정보 포함해서 리턴
            return crystaCache[cat].map(item => ({ ...item, _category: cat }));
        }));

        // 데이터 평탄화
        const flatData = allData.flat();

        // 필터링
        const filtered = flatData.filter(item => {
            // 1. 이름 검색
            if (nameQuery && !item.name.toLowerCase().includes(nameQuery)) return false;

            // 2. 옵션 검색
            if (optionType !== 'none') {
                // 옵션 문자열 분석 (예: "ATK+5%")
                // 정규식: 옵션명 뒤에 숫자가 오는지 확인
                // 주의: STR 검색 시 STR%가 걸리지 않도록 처리해야 함

                // 옵션 텍스트에 해당 옵션명이 있는지 확인
                if (!item.option.includes(optionType.replace('%', ''))) return false;

                // 정확한 매칭을 위해 파싱 (간이 파싱)
                // 옵션 문자열을 줄바꿈이나 쉼표로 분리해서 확인
                const stats = item.option.split(/\n|&|,/);
                const match = stats.some((statStr: string) => {
                    if (!statStr.includes(optionType.replace('%', ''))) return false;

                    // % 여부 체크
                    const hasPercent = statStr.includes('%');
                    const targetHasPercent = optionType.includes('%');
                    if (hasPercent !== targetHasPercent) return false;

                    // 수치 비교 (값이 입력되었을 때만)
                    if (!isNaN(value)) {
                        const numMatch = statStr.match(/-?\d+(\.\d+)?/);
                        if (!numMatch) return false;
                        const num = parseFloat(numMatch[0]);

                        if (symbol === '=') return num === value;
                        if (symbol === '>') return num > value;
                        if (symbol === '<') return num < value;
                        if (symbol === '>=') return num >= value;
                        if (symbol === '<=') return num <= value;
                    }
                    return true;
                });

                if (!match) return false;
            }
            return true;
        });

        // 결과 렌더링
        renderSearchResults(filtered);

    } catch (err) {
        console.error(err);
        resultsContainer.innerHTML = '<div style="text-align:center; color:red;">데이터 로딩 오류 발생</div>';
    }
}

function renderSearchResults(data: any[]) {
    const container = document.getElementById('searchResults')!;

    if (data.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px;">검색 결과가 없습니다.</div>';
        return;
    }

    container.innerHTML = data.map(item => {
        const imgSrc = imageMap[item._category] || 'CrystaImg/normal.png';
        const formattedOption = item.option.replace(/&/g, ' · ');

        return `
      <div class="crysta-item">
        <div class="crysta-left">
          <img src="${imgSrc}" alt="icon" onerror="this.src='CrystaImg/normal.png'">
          <div class="crysta-name">${item.name}</div>
        </div>
        <div class="crysta-right">
          <div class="crysta-option">${formattedOption}</div>
          ${item.enhance ? `<div class="crysta-enhance">강화 전: ${item.enhance}</div>` : ''}
        </div>
      </div>
    `;
    }).join('');
}

async function performRandomPick() {
    const categories = Object.keys(imageMap); // 모든 카테고리
    const randomCat = categories[Math.floor(Math.random() * categories.length)];

    // 해당 카테고리 데이터 로드
    if (!crystaCache[randomCat]) {
        try {
            const res = await fetch(`CrystaData/${randomCat}.json`);
            crystaCache[randomCat] = await res.json();
        } catch {
            alert("데이터 로딩 실패");
            return;
        }
    }

    const list = crystaCache[randomCat];
    if (list.length === 0) {
        alert("해당 카테고리에 데이터가 없습니다.");
        return;
    }

    const item = list[Math.floor(Math.random() * list.length)];
    renderSearchResults([{ ...item, _category: randomCat }]);
}

// --- [Page 3] 스킬 정보 페이지 ---
// =================================================
// [Page 3] 스킬 정보 페이지 (한글화 + 경로 수정 완료)
// =================================================

// 1. 파일 매핑 (키: 한글 화면 표시용 / 값: 실제 파일 이름)
const skillFileMap: Record<string, Record<string, string>> = {
    '주무기': {
        '블레이드': 'skills_blade',
        '슛': 'skills_shot',
        '매직': 'skills_magic',
        '마샬': 'skills_martial',
        '듀얼소드': 'skills_dual_sword',
        '할버드': 'skills_halberd',
        '발도': 'skills_mononofu',
        '크러셔': 'skills_crusher',
        '스프라이트': 'skills_sprite'
    },
    '보조/생존': {
        '배틀': 'skills_battle',
        '서포트': 'skills_support',
        '서바이벌': 'skills_survival'
    },
    '강화/직업': {
        '대거': 'skills_dagger',
        '쉴드': 'skills_shield',
        '나이트': 'skills_knight',
        '헌터': 'skills_hunter',
        '프리스트': 'skills_priest',
        '어쌔신': 'skills_assassin',
        '위저드': 'skills_wizard',
        '가드': 'skills_guard'
    },
    '특수/책': {
        '닌자': 'skills_ninja',
        '네크로맨서': 'skills_Necromancer',
        '민스트럴': 'skills_minstrel',
        '댄서': 'skills_dancer',
        '골렘': 'skills_golem',
        '다크파워': 'skills_darkpower',
        '매직블레이드': 'skills_magicblade',
        '베어핸드': 'skills_barehand',
        '파르티잔': 'skills_partisan'
    },
    '생활': {
        '스미스': 'skills_smith',
        '연금술': 'skills_alchemy',
        '테이머': 'skills_tamer',
        '펫': 'skills_pet'
    }
};

// 2. 폴더 매핑 (한글 카테고리 -> 실제 영어 폴더명)
const folderMap: Record<string, string> = {
    '주무기': 'Main',
    '보조/생존': 'Assist',
    '강화/직업': 'Enforce',
    '특수/책': 'Book',
    '생활': 'Life'
};

function renderSkillPage() {
    app.innerHTML = `
    <div class="nav-bar">
      <button class="btn-home" id="back-home">🏠 Home</button>
      <h2 style="margin:0 0 0 15px; border:none;">📖 스킬정보</h2>
    </div>

    <div class="container">
      <!-- 대분류 탭 -->
      <div class="skill-tabs" id="main-category-tabs">
        <button class="skill-tab-btn active" data-cat="주무기">주무기</button>
        <button class="skill-tab-btn" data-cat="보조/생존">보조/생존</button>
        <button class="skill-tab-btn" data-cat="강화/직업">강화/직업</button>
        <button class="skill-tab-btn" data-cat="특수/책">특수/책</button>
        <button class="skill-tab-btn" data-cat="생활">생활</button>
      </div>

      <!-- 소분류 탭 -->
      <div class="skill-tabs" id="sub-category-tabs" style="background:transparent; padding-top:0;"></div>

      <!-- 스킬 트리 영역 -->
      <div class="skill-tree-wrapper">
        <div id="skill-grid" class="skill-columns-container">
          <div style="grid-column:1/-1; text-align:center; padding:50px; color:#888;">
            카테고리를 선택하세요.
          </div>
        </div>

        <!-- 하단 고정 상세 정보 -->
        <div id="skill-detail-view">
          <div style="text-align:center; color:#888;">스킬을 클릭하면 상세 정보가 여기에 표시됩니다.</div>
        </div>
      </div>
    </div>
  `;

    document.getElementById('back-home')?.addEventListener('click', renderHomePage);
    setupSkillTabs();
}

function setupSkillTabs() {
    const mainTabs = document.querySelectorAll('#main-category-tabs .skill-tab-btn');

    mainTabs.forEach(btn => {
        btn.addEventListener('click', (e) => {
            mainTabs.forEach(b => b.classList.remove('active'));
            (e.target as HTMLElement).classList.add('active');

            const cat = (e.target as HTMLElement).dataset.cat!;
            renderSubTabs(cat);
        });
    });

    // 초기 실행
    renderSubTabs('주무기');
}

function renderSubTabs(mainCat: string) {
    const container = document.getElementById('sub-category-tabs')!;
    container.innerHTML = '';

    const subCats = Object.keys(skillFileMap[mainCat]);

    subCats.forEach((subCat, idx) => {
        const btn = document.createElement('button');
        btn.className = `skill-tab-btn ${idx === 0 ? 'active' : ''}`;
        btn.innerText = subCat;
        btn.onclick = () => {
            document.querySelectorAll('#sub-category-tabs .skill-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadSkillData(mainCat, subCat);
        };
        container.appendChild(btn);
    });

    if (subCats.length > 0) loadSkillData(mainCat, subCats[0]);
}

async function loadSkillData(mainCat: string, subCat: string) {
    const grid = document.getElementById('skill-grid')!;
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:20px;">데이터 로딩 중...</div>';

    document.getElementById('skill-detail-view')!.classList.remove('active');

    const fileName = skillFileMap[mainCat][subCat];
    const folderName = folderMap[mainCat]; // 한글 -> 영어 폴더명 변환
    const filePath = `SkillData/${folderName}/${fileName}.js`;

    try {
        const res = await fetch(filePath);
        if (!res.ok) throw new Error('File not found');
        const text = await res.text();

        // JS 배열 파싱
        let jsonText = text.substring(text.indexOf('['), text.lastIndexOf(']') + 1);
        const skillsData = new Function(`return ${jsonText}`)();

        renderSkillColumns(skillsData, folderName, fileName);

    } catch (err) {
        console.error(err);
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:red;">데이터 로딩 실패<br>(${filePath})</div>`;
    }
}

function renderSkillColumns(skills: any[], mainCatFolder: string, fileName: string) {
    const grid = document.getElementById('skill-grid')!;
    grid.innerHTML = '';

    // Tier 분류
    const tiers: any[][] = [[], [], [], [], [], [], []];

    skills.forEach(skill => {
        const t = skill.tier || 1;
        if (t >= 1 && t <= 6) {
            tiers[t].push(skill);
        }
    });

    // 이미지 폴더명 추출 (예: skills_blade -> blade)
    const subFolder = fileName.replace('skills_', '');

    for (let i = 1; i <= 6; i++) {
        const col = document.createElement('div');
        col.className = 'skill-tier-column';

        col.innerHTML = `<div class="tier-label">Tier ${i}</div>`;

        if (tiers[i].length > 0) {
            tiers[i].forEach((skill: any) => {
                const card = document.createElement('div');
                card.className = 'skill-card';

                const imgName = (skill.id || skill.name).replace(/\s+/g, '_');
                const imgPath = `SkillImg/${mainCatFolder}/${subFolder}/${imgName}.png`;
                const fallbackImg = 'https://toram-id.info/img/skill/unknown.png';

                card.innerHTML = `
          <img src="${imgPath}" onerror="this.onerror=null; this.src='${fallbackImg}';" alt="${skill.name}">
          <div class="skill-name">${skill.name}</div>
        `;

                card.onclick = () => {
                    document.querySelectorAll('.skill-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    showSkillDetail(skill, imgPath, fallbackImg);
                };

                col.appendChild(card);
            });
        } else {
            const empty = document.createElement('div');
            empty.style.height = '50px';
            empty.style.border = '1px dashed rgba(255,255,255,0.1)';
            empty.style.borderRadius = '6px';
            col.appendChild(empty);
        }

        grid.appendChild(col);
    }
}

function showSkillDetail(skill: any, imgSrc: string, fallback: string) {
    const view = document.getElementById('skill-detail-view')!;
    view.classList.add('active');

    const description = skill.description ? skill.description.replace(/\n/g, '<br>') : '공백';

    let tags = '';
    if (skill.mp_cost) tags += `<span class="meta-tag" style="color:#4a90e2">MP ${skill.mp_cost}</span>`;
    if (skill.type) tags += `<span class="meta-tag">${skill.type}</span>`;
    if (skill.element) tags += `<span class="meta-tag" style="color:#e24a4a">${skill.element}</span>`;
    if (skill.weapon) tags += `<span class="meta-tag">${Array.isArray(skill.weapon) ? skill.weapon.join(', ') : skill.weapon}</span>`;

    view.innerHTML = `
    <div class="detail-header">
      <img src="${imgSrc}" onerror="this.onerror=null; this.src='${fallback}';" class="detail-icon">
      <div>
        <div class="detail-title">${skill.name}</div>
        <div class="detail-meta">${tags}</div>
      </div>
    </div>
    <div class="detail-desc">${description}</div>
  `;
}

// =================================================
// [초기화]
// =================================================
renderHomePage();

// =================================================
// [초기 실행] 홈 화면 표시
// =================================================
// --- [Page 4] 장비 어빌리티 검색 ---

let traitData: any[] = [];
let traitMeta: any = {};

function renderAbilityPage() {
    app.innerHTML = `
    <div class="nav-bar">
      <button class="btn-home" id="back-home">🏠 Home</button>
      <h2 style="margin:0 0 0 15px; border:none;">🔮 장비 어빌리티 검색</h2>
    </div>

    <div class="section">
      <!-- 1. 티어 정보 (범례) -->
      <h4 style="margin-bottom:10px;">📋 티어(Tier) 정보</h4>
      <div class="trait-legend" id="trait-legend-container">
        <span style="color:#888;">데이터 로딩 중...</span>
      </div>

      <!-- 2. 카테고리 선택 -->
      <div class="trait-tabs">
        <button class="trait-tab-btn active" data-cat="all">ALL</button>
        <button class="trait-tab-btn" data-cat="basic">기본 스탯</button>
        <button class="trait-tab-btn" data-cat="combat">전투/HP/MP</button>
        <button class="trait-tab-btn" data-cat="special">특수</button>
      </div>

      <!-- 3. 검색창 -->
      <div class="search-container" style="background:transparent; border:none; box-shadow:none; padding:0; margin-bottom:20px;">
        <input type="text" id="trait-search" class="search-input" placeholder="이름, 설명, 공식으로 검색..." style="width:100%; max-width:100%;">
      </div>

      <!-- 4. 결과 리스트 -->
      <div id="trait-results">
        <div style="grid-column:1/-1; text-align:center; padding:30px; color:#888;">
          데이터를 불러오는 중입니다...
        </div>
      </div>
    </div>
  `;

    document.getElementById('back-home')?.addEventListener('click', renderHomePage);

    // 탭 클릭
    const tabs = document.querySelectorAll('.trait-tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            tabs.forEach(t => t.classList.remove('active'));
            (e.target as HTMLElement).classList.add('active');
            filterAndRenderTraits();
        });
    });

    // 검색어 입력
    document.getElementById('trait-search')?.addEventListener('input', filterAndRenderTraits);

    loadTraitData();
}

async function loadTraitData() {
    const resultsContainer = document.getElementById('trait-results');
    const legendContainer = document.getElementById('trait-legend-container');

    if (traitData.length > 0) {
        renderTraitLegend(legendContainer);
        filterAndRenderTraits();
        return;
    }

    try {
        const res = await fetch('traitDB/traitDB.js');
        if (!res.ok) throw new Error('Trait DB File not found');
        const text = await res.text();

        const objectText = text.substring(text.indexOf('{'));
        const db = new Function(`return ${objectText}`)();

        if (db && Array.isArray(db.items)) {
            traitData = db.items.map((item: any, index: number) => {
                let category = 'special';
                if (index < 5) category = 'basic';
                else if (index < 20) category = 'combat';
                return { ...item, category };
            });
            traitMeta = db.meta_info || {};

            renderTraitLegend(legendContainer);
            filterAndRenderTraits();
        } else {
            throw new Error('Invalid Data');
        }

    } catch (err) {
        console.error(err);
        if (resultsContainer) {
            resultsContainer.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#ff4444;">데이터 로딩 실패 (${err})</div>`;
        }
    }
}

function renderTraitLegend(container: HTMLElement | null) {
    if (!container || !traitMeta.circles) return;
    const circles = traitMeta.circles;
    const html = Object.entries(circles).map(([icon, desc]) =>
        `<div class="legend-item">
            <span style="font-size:1.4em; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.2));">${icon}</span>
            <span>${desc}</span>
        </div>`
    ).join('');
    container.innerHTML = html;
}

function filterAndRenderTraits() {
    const container = document.getElementById('trait-results');
    if (!container) return;

    const activeTab = document.querySelector('.trait-tab-btn.active') as HTMLElement;
    const currentCat = activeTab ? activeTab.dataset.cat : 'all';
    const searchInput = document.getElementById('trait-search') as HTMLInputElement;
    const keyword = searchInput.value.trim().toLowerCase();

    const filtered = traitData.filter(item => {
        if (currentCat !== 'all' && item.category !== currentCat) return false;
        if (keyword) {
            return item.name.toLowerCase().includes(keyword) ||
                item.name_en.toLowerCase().includes(keyword) ||
                item.description.toLowerCase().includes(keyword) ||
                (item.formula && item.formula.toLowerCase().includes(keyword));
        }
        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:#888;">검색 결과가 없습니다.</div>`;
        return;
    }

    container.innerHTML = filtered.map(item => `
      <div class="trait-card">
        <!-- 1. 헤더 (카테고리 텍스트 + 이름) -->
        <div class="trait-header">
            <span class="trait-cat-text" style="color:${getCatColor(item.category)}">
                [${getCatName(item.category)}]
            </span>
            <div style="flex:1;">
                <span class="trait-name">${item.name}</span>
                <span class="trait-en">(${item.name_en})</span>
            </div>
        </div>
        
        <!-- 2. 설명 박스 (요청하신 부분) -->
        <div class="trait-desc">${item.description}</div>
        
        <!-- 3. 하단 정보 박스 (공식, 티어 수치) -->
        ${(item.formula || item.tier_value) ? `
          <div class="trait-footer-box">
            ${item.formula ? `<div class="trait-formula">📐 공식: ${item.formula}</div>` : ''}
            ${item.tier_value ? `<div class="trait-tier-val">📊 수치: ${item.tier_value}</div>` : ''}
          </div>
        ` : ''}
      </div>
    `).join('');
}

function getCatColor(cat: string) {
    if (cat === 'basic') return '#8D6E63'; // Brown
    if (cat === 'combat') return '#E57373'; // Red
    return '#9575CD'; // Purple
}

function getCatName(cat: string) {
    if (cat === 'basic') return '기본';
    if (cat === 'combat') return '전투';
    return '특수';
}
// =================================================
// [Page 5] 레지스트릿 검색 (Registlet Search) - 수정됨
// =================================================

const REGISTLET_CATEGORIES = [
    "패시브", "블레이드 스킬", "슛 스킬", "매직 스킬", "마샬 스킬",
    "무사 스킬", "할버드 스킬", "듀얼소드 스킬", "크러셔 스킬",
    "매직 디바이스 스킬", "민스트럴 스킬", "다크파워 스킬",
    "기사 스킬", "어쌔신 스킬", "댄서 스킬", "쉴드 스킬", "특수"
];

const LEVEL_RANGES = {
    "All": (lv: any) => checkLevelRange(lv, 0, 300),
    "0~30": (lv: any) => checkLevelRange(lv, 0, 30),
    "30~100": (lv: any) => checkLevelRange(lv, 30, 100),
    "100~150": (lv: any) => checkLevelRange(lv, 100, 150),
    "150~200": (lv: any) => checkLevelRange(lv, 150, 200),
    "200~300": (lv: any) => checkLevelRange(lv, 200, 300)
};

function checkLevelRange(obtain_lv: any[], min: number, max: number) {
    if (obtain_lv.includes("All")) return true;
    return obtain_lv.some(val => typeof val === 'number' && val >= min && val <= max);
}

let registletData: any[] = [];

function renderRegistletPage() {
    app.innerHTML = `
    <div class="nav-bar">
      <button class="btn-home" id="back-home">🏠 Home</button>
      <h2 style="margin:0 0 0 15px; border:none;">💍 레지스트릿 검색</h2>
    </div>

    <div class="reg-search-container">
      
      <!-- 1. 레벨 필터 -->
      <div style="text-align:center; margin-bottom:10px; color:var(--accent-light); font-weight:bold;">획득 레벨 (Obtain Lv)</div>
      <div class="reg-lv-group">
        ${Object.keys(LEVEL_RANGES).map((range, idx) => `
          <input type="radio" name="lv-range" id="lv-${idx}" value="${range}" ${range === 'All' ? 'checked' : ''}>
          <label for="lv-${idx}">${range}</label>
        `).join('')}
      </div>

      <hr style="border:0; border-top:1px solid var(--border-color); margin:20px 0;">

      <!-- 2. 스킬 종류 (Category) - 버튼형 -->
      <div style="text-align:center; margin-bottom:10px; color:var(--accent-light); font-weight:bold;">스킬 종류 (Category)</div>
      <div class="reg-cat-group" id="reg-cat-filters">
        <!-- '전체' 버튼 -->
        <input type="radio" name="cat-select" id="cat-all" value="All" checked>
        <label for="cat-all">전체</label>
        
        <!-- 카테고리 버튼들 -->
        ${REGISTLET_CATEGORIES.map((cat, idx) => `
          <input type="radio" name="cat-select" id="cat-${idx}" value="${cat}">
          <label for="cat-${idx}">${cat}</label>
        `).join('')}
      </div>

      <hr style="border:0; border-top:1px solid var(--border-color); margin:20px 0;">

      <!-- 3. 이름 검색 -->
      <div class="reg-control-row">
        <span style="font-weight:bold;">이름 검색: </span>
        <input type="text" id="reg-name-input" class="search-input" style="margin:0; width:200px;" placeholder="검색어 입력...">
        <button id="btn-reg-search" style="padding:8px 20px;">검색</button>
      </div>
    </div>

    <!-- 결과 리스트 -->
    <div id="registlet-results">
      <div style="grid-column:1/-1; text-align:center; padding:20px; color:#888;">데이터 로딩 중...</div>
    </div>
  `;

    document.getElementById('back-home')?.addEventListener('click', renderHomePage);

    // 검색 버튼 이벤트
    document.getElementById('btn-reg-search')?.addEventListener('click', filterRegistlets);

    // 엔터키 지원
    document.getElementById('reg-name-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') filterRegistlets();
    });

    // 라디오 버튼(레벨, 카테고리) 변경 시 자동 검색 (선택사항: 원치 않으면 제거 가능)
    document.querySelectorAll('input[name="lv-range"], input[name="cat-select"]').forEach(el => {
        el.addEventListener('change', filterRegistlets);
    });

    loadRegistletData();
}

async function loadRegistletData() {
    const container = document.getElementById('registlet-results');
    if (!container) return;

    if (registletData.length > 0) {
        filterRegistlets();
        return;
    }

    try {
        const res = await fetch('registlet/registlet_list.js');
        if (!res.ok) throw new Error('File not found');
        const text = await res.text();

        const objectText = text.substring(text.indexOf('{'));
        const db = new Function(`return ${objectText}`)();

        if (db && Array.isArray(db.items)) {
            registletData = db.items;
            filterRegistlets();
        } else {
            throw new Error('Invalid data format');
        }

    } catch (err) {
        console.error(err);
        container.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#ff4444;">데이터 로딩 실패</div>`;
    }
}

function filterRegistlets() {
    const container = document.getElementById('registlet-results');
    if (!container) return;

    // 1. 검색어 (공백 제거 및 소문자 변환)
    const nameInput = document.getElementById('reg-name-input') as HTMLInputElement;
    const nameQuery = nameInput.value.trim().toLowerCase(); // ★ trim() 추가

    // 2. 카테고리 (라디오 버튼)
    const catRadio = document.querySelector('input[name="cat-select"]:checked') as HTMLInputElement;
    const selectedCat = catRadio ? catRadio.value : 'All';

    // 3. 레벨 (라디오 버튼)
    const lvRadio = document.querySelector('input[name="lv-range"]:checked') as HTMLInputElement;
    const selectedLvRange = lvRadio ? lvRadio.value : 'All';

    const filtered = registletData.filter(item => {
        // 이름 필터링 (★ item.name이 존재하는지 확인)
        if (nameQuery && (!item.name || !item.name.toLowerCase().includes(nameQuery))) {
            return false;
        }

        // 카테고리 필터링
        if (selectedCat !== 'All' && item.category !== selectedCat) return false;

        // 레벨 필터링
        // @ts-ignore
        const rangeCheck = LEVEL_RANGES[selectedLvRange];
        if (rangeCheck && !rangeCheck(item.obtain_lv)) return false;

        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:#888;">검색 결과가 없습니다.</div>`;
        return;
    }

    container.innerHTML = filtered.map(item => {
        const lvText = Array.isArray(item.obtain_lv) ? item.obtain_lv.join(', ') : item.obtain_lv;
        return `
      <div class="registlet-card">
        <div class="reg-header">
          <span class="reg-category">${item.category}</span>
          <span class="reg-name">${item.name}</span>
        </div>
        <div class="reg-body">
          <div class="reg-desc">${item.description}</div>
          <div class="reg-meta">
            <span>🆙 ${item.max_lv_info}</span>
            <span>📍 Lv: ${lvText}</span>
          </div>
        </div>
      </div>
    `;
    }).join('');
}
// =================================================
// [Page 6] 요리 주소 검색 (Food Code)
// =================================================

const FOOD_CATEGORIES = [
    "전체 보기",
    "HP / MP / AMPR",
    "기본 스탯",
    "공격 관련",
    "속성 데미지 (유리)",
    "내성 / 방어 / 회피",
    "속성 내성",
    "기타"
];

let foodData: any[] = [];

function renderFoodPage() {
    app.innerHTML = `
    <div class="nav-bar">
      <button class="btn-home" id="back-home">🏠 Home</button>
      <h2 style="margin:0 0 0 15px; border:none;">🍳 요리 주소 검색</h2>
    </div>

    <div class="reg-search-container">
      <!-- 1. 카테고리 필터 (버튼형) -->
      <div class="reg-cat-group" id="food-cat-filters">
        ${FOOD_CATEGORIES.map((cat, idx) => `
          <input type="radio" name="food-cat" id="f-cat-${idx}" value="${cat}" ${idx === 0 ? 'checked' : ''}>
          <label for="f-cat-${idx}">${cat}</label>
        `).join('')}
      </div>

      <hr style="border:0; border-top:1px solid var(--border-color); margin:20px 0;">

      <!-- 2. 검색어 입력 -->
      <div class="reg-control-row" style="justify-content:center;">
        <input type="text" id="food-search-input" class="search-input" placeholder="요리 이름 검색..." style="width:100%; max-width:400px;">
      </div>
    </div>

    <!-- 결과 리스트 -->
    <div id="food-results" class="food-list-container">
      <div style="text-align:center; padding:20px; color:#888;">데이터 로딩 중...</div>
    </div>
  `;

    document.getElementById('back-home')?.addEventListener('click', renderHomePage);

    // 이벤트 연결
    document.querySelectorAll('input[name="food-cat"]').forEach(el => {
        el.addEventListener('change', filterFoodCodes);
    });

    document.getElementById('food-search-input')?.addEventListener('input', filterFoodCodes);

    loadFoodData();
}
async function loadFoodData() {
    const container = document.getElementById('food-results')!;

    if (foodData.length > 0) {
        filterFoodCodes();
        return;
    }

    try {
        const res = await fetch('FoodCode.js');
        if (!res.ok) throw new Error('File not found');
        const text = await res.text();

        // 1. "const FoodCode =" 부분 찾기
        const eqIndex = text.indexOf('=');
        if (eqIndex === -1) throw new Error('Invalid JS format');

        // 2. 등호 뒤의 객체 내용만 추출 ({ ... })
        let jsonContent = text.substring(eqIndex + 1).trim();

        // 3. 끝에 세미콜론(;) 제거
        if (jsonContent.endsWith(';')) {
            jsonContent = jsonContent.slice(0, -1);
        }

        // 4. 문자열을 실제 자바스크립트 객체로 변환
        const dataObj = new Function(`return ${jsonContent}`)();

        // 5. 객체 내부의 'items' 배열을 가져옴
        if (dataObj && Array.isArray(dataObj.items)) {
            foodData = dataObj.items; // ★ 여기가 핵심 수정 포인트
            filterFoodCodes();
        } else {
            throw new Error('Data structure mismatch: .items array not found');
        }

    } catch (err) {
        console.error('Food Data Load Error:', err);
        container.innerHTML = `<div style="text-align:center; color:#ff4444;">
      데이터 로딩 실패<br>
      <span style="font-size:0.8rem; color:#aaa;">${err}</span>
    </div>`;
    }
}
function filterFoodCodes() {
    const container = document.getElementById('food-results');
    if (!container) return;

    const searchInput = document.getElementById('food-search-input') as HTMLInputElement;
    const keyword = searchInput.value.trim().toLowerCase();

    const catRadio = document.querySelector('input[name="food-cat"]:checked') as HTMLInputElement;
    const selectedCat = catRadio ? catRadio.value : "전체 보기";

    const filtered = foodData.filter((item: any) => {
        // 카테고리 필터
        if (selectedCat !== "전체 보기" && item.category !== selectedCat) return false;

        // 검색어 필터
        if (keyword) {
            const matchName = item.name.toLowerCase().includes(keyword);
            const matchEn = item.name_en ? item.name_en.toLowerCase().includes(keyword) : false;
            return matchName || matchEn;
        }
        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:20px; color:#888;">검색 결과가 없습니다.</div>`;
        return;
    }

    container.innerHTML = filtered.map((item: any) => {
        // 코드 버튼 생성
        const codesHtml = item.codes.map((codeObj: any) => `
      <button class="code-btn" onclick="copyToClipboard('${codeObj.code}')">
        <span class="code-val">${codeObj.code}</span>
        <span class="code-lv">Lv ${codeObj.lv}</span>
      </button>
    `).join('');

        return `
      <div class="food-card">
        <div class="food-header">
          <span class="food-cat-badge">${item.category}</span>
          <div class="food-name">
            ${item.name} <span class="food-en">(${item.name_en})</span>
          </div>
        </div>
        <div class="food-codes">
          ${codesHtml}
        </div>
      </div>
    `;
    }).join('');
}

// 전역 함수로 등록 (onclick에서 호출하기 위해)
(window as any).copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
        alert(`코드 복사 완료: ${text}`);
    }).catch(err => {
        console.error('복사 실패:', err);
    });
};

// =================================================
// [Page 7] 장비 & 파밍 검색 (Advanced)
// =================================================

// 1. 일반 장비 카테고리
const EQUIP_CATEGORIES: Record<string, string> = {
    'Handed_Sword': '한손검',
    'Two_Handed_Sword': '양손검',
    'bow': '활',
    'bowgun': '보우건',
    'staff': '지팡이',
    'magicdevice': '마도구',
    'knuckle': '너클',
    'halberd': '선풍창',
    'katana': '발도검',
    'armor': '몸장비',
    'additional': '추가장비',
    'shield': '방패',
    'Arrow': '화살',
    'Dagger': '단검'
};

// 2. 카테고리별 하위 태그 (Sub-filters). 데이터의 category 필드와 매칭한다.
const EQUIP_SUBTAGS: Record<string, string[]> = {
    'Arrow': [
        '전체',
        '무속성', '불속성', '물속성', '바람속성', '땅속성', '빛속성', '어둠속성'
    ],
    'Dagger': [
        '전체',
        '대장간/드랍', '퀘스트', '필드/보스', '한정/이벤트'
    ]
};

// 3. 이미지가 없는 카테고리 (이름/옵션/획득처만 보여준다)
const NO_IMAGE_CATEGORIES = ['Arrow', 'Dagger'];

// 상태 변수
let currentEquipData: any[] = [];
let filteredEquipData: any[] = [];
let currentCategory = 'Handed_Sword';
let currentSubTag = '전체';
let modalImages: string[] = [];
let modalCurrentIndex = 0;

function renderEquipmentPage() {
    const categories = EQUIP_CATEGORIES;

    // 하위 태그가 있는 카테고리(화살/단검)에서만 태그 버튼 표시
    let tagsHtml = '';
    if (EQUIP_SUBTAGS[currentCategory] && EQUIP_SUBTAGS[currentCategory].length > 1) {
        tagsHtml = `<div class="skill-tabs sub-tags" id="equip-sub-tags" style="margin-top:10px;">
      ${EQUIP_SUBTAGS[currentCategory].map(tag => `
        <button class="skill-tab-btn ${tag === currentSubTag ? 'active' : ''}" data-tag="${tag}">
          ${tag.replace('화살: ', '').replace('단검: ', '')}
        </button>
      `).join('')}
    </div>`;
    }

    app.innerHTML = `
    <div class="nav-bar">
      <button class="btn-home" id="back-home">🏠 Home</button>
      <h2 style="margin:0 0 0 15px; border:none;">
        🛡️ 장비 검색
      </h2>
    </div>

    <div class="container">
      <!-- 메인 카테고리 -->
      <div class="skill-tabs" id="equip-category-tabs">
        ${Object.entries(categories).map(([key, name]) => `
          <button class="skill-tab-btn ${key === currentCategory ? 'active' : ''}" data-cat="${key}">
            ${name}
          </button>
        `).join('')}
      </div>

      <!-- 하위 태그 (화살/단검) -->
      ${tagsHtml}

      <div class="search-container" style="background:transparent; border:none; padding:0; margin-bottom:20px;">
        <input type="text" id="equip-search" class="search-input" placeholder="이름 검색 (한글/영어)...">
      </div>

      <div class="equip-slider-wrap">
        <div id="equip-grid" class="equip-grid-container">
          <div style="grid-column:1/-1; text-align:center; padding:50px; color:#888;">데이터 로딩 중...</div>
        </div>
      </div>
    </div>
  `;

    document.getElementById('back-home')?.addEventListener('click', renderHomePage);

    // 카테고리 탭 클릭
    document.querySelectorAll('#equip-category-tabs .skill-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            currentCategory = target.dataset.cat!;
            currentSubTag = '전체';
            renderEquipmentPage();
        });
    });

    // 서브 태그 클릭
    document.querySelectorAll('#equip-sub-tags .skill-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            document.querySelectorAll('#equip-sub-tags .skill-tab-btn').forEach(b => b.classList.remove('active'));
            target.classList.add('active');

            currentSubTag = target.dataset.tag!;
            filterEquipment('');
        });
    });

    document.getElementById('equip-search')?.addEventListener('input', (e) => {
        const keyword = (e.target as HTMLInputElement).value.trim();
        filterEquipment(keyword);
    });

    loadEquipmentData(currentCategory);
}

/**
 * PC에서는 그리드를 #app의 800px 제한 밖으로 화면 전체 폭까지 넓힌다 (8열 그리드가 들어갈 공간 확보).
 * 100vw 대신 실제 측정값을 px로 계산해서 스크롤바 오차로 인한 여백 삐져나감을 막는다.
 */
function sizeEquipGridColumns() {
    const wrap = document.querySelector<HTMLElement>('.equip-slider-wrap');
    if (!wrap) return;

    if (window.innerWidth <= 600) {
        wrap.style.width = '';
        wrap.style.marginLeft = '';
        return;
    }

    wrap.style.width = '';
    wrap.style.marginLeft = '';
    const rect = wrap.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    wrap.style.width = `${viewportWidth}px`;
    wrap.style.marginLeft = `${-rect.left}px`;
}
window.addEventListener('resize', sizeEquipGridColumns);

async function loadEquipmentData(categoryName: string) {
    const grid = document.getElementById('equip-grid')!;

    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px;">데이터 로딩 중...</div>';

    // 폴더명 = 파일명
    const filePath = `Equipment/${categoryName}/${categoryName}.js`;

    try {
        const res = await fetch(filePath);
        if (!res.ok) throw new Error(`File not found: ${filePath}`);
        const text = await res.text();

        // JS 파싱 (기존 로직 유지)
        // 1. 등호(=) 찾기
        const eqIndex = text.indexOf('=');
        if (eqIndex === -1) throw new Error("Invalid JS format");

        // 2. 객체 부분 추출
        let jsonContent = text.substring(eqIndex + 1).trim();
        if (jsonContent.endsWith(';')) jsonContent = jsonContent.slice(0, -1);

        const dataObj = new Function(`return ${jsonContent}`)();

        let items = [];
        if (dataObj.items && Array.isArray(dataObj.items)) {
            items = dataObj.items;
        } else if (Array.isArray(dataObj)) {
            items = dataObj;
        } else {
            items = [];
        }

        currentEquipData = items.reverse();

        // 로드 후 필터링
        const searchInput = document.getElementById('equip-search') as HTMLInputElement;
        if (searchInput) searchInput.value = '';
        filterEquipment('');

    } catch (err) {
        console.error(err);
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#ff4444;">
      데이터 로딩 실패<br>(${filePath})<br>
      <span style="font-size:0.8rem; color:#aaa;">${err}</span>
    </div>`;
    }
}

function filterEquipment(keyword: string) {
    let filtered = currentEquipData;

    // 1. 태그 필터링 (화살/단검 하위 태그)
    if (currentSubTag !== '전체') {
        filtered = filtered.filter((item: any) => {
            // 데이터의 category 필드가 존재하는지 확인 후 검사
            if (!item.category) return false;

            // 태그 이름에서 불필요한 접두사 제거 (UI와 데이터 매칭)
            // 예: "화살: 불속성" -> "불속성"
            let tagKey = currentSubTag;
            if (tagKey.includes(': ')) {
                tagKey = tagKey.split(': ')[1];
            }

            // 데이터의 카테고리 문자열에 태그 키워드가 포함되어 있는지 확인
            return item.category.includes(tagKey);
        });
    }

    // 2. 검색어 필터링 (이름 + 영문명 + ★스탯★)
    if (keyword) {
        const lowerKey = keyword.toLowerCase();
        filtered = filtered.filter((item: any) => {
            // 이름 검색
            const name = item.name ? item.name.toLowerCase() : '';
            const nameEn = item.name_en ? item.name_en.toLowerCase() : '';

            // ★ 스탯 검색 추가
            let statsText = '';
            if (item.stats) {
                if (Array.isArray(item.stats)) {
                    statsText = item.stats.join(' ').toLowerCase();
                } else {
                    statsText = item.stats.toLowerCase();
                }
            }

            const dropText = item.drop ? String(item.drop).toLowerCase() : '';

            // 이름, 스탯, 획득처 중에 키워드가 있으면 통과
            return name.includes(lowerKey) || nameEn.includes(lowerKey) || statsText.includes(lowerKey) || dropText.includes(lowerKey);
        });
    }

    filteredEquipData = filtered;

    renderEquipGrid();
    // 검색/필터가 바뀌면 슬라이더도 맨 처음으로 되돌린다
    document.getElementById('equip-grid')?.scrollTo({ left: 0 });
}

function renderEquipGrid() {
    const grid = document.getElementById('equip-grid')!;
    grid.innerHTML = '';

    if (filteredEquipData.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px; color:#888;">결과가 없습니다.</div>';
        return;
    }

    const isNoImageCategory = NO_IMAGE_CATEGORIES.includes(currentCategory);

    filteredEquipData.forEach((item: any) => {
        const card = document.createElement('div');
        card.className = 'equip-card';

        // ★ [수정됨] 이미지 리스트 감지 로직
        // item.image 자체가 배열인지 확인하고, 아니면 단일 배열로 만듭니다.
        let imgList: string[] = [];
        if (Array.isArray(item.image)) {
            imgList = item.image; // 주신 데이터처럼 image: [...] 인 경우
        } else if (Array.isArray(item.images)) {
            imgList = item.images; // 혹시 images: [...] 인 경우 대응
        } else {
            // 단일 파일명인 경우
            imgList = [item.image || (item.id ? `${item.id}.jpg` : 'unknown.png')];
        }

        let activeIdx = 0;
        const isMulti = imgList.length > 1;

        // [경로 계산 함수]
        const getFullImgPath = (name: string) => `Equipment/${currentCategory}/${name}`;

        // [JPG/PNG 자동 전환 핸들러]
        const handleImgError = (imgEl: HTMLImageElement) => {
            const src = imgEl.src;
            if (src.includes('.jpg')) imgEl.src = src.replace('.jpg', '.png');
            else if (src.includes('.png')) imgEl.src = src.replace('.png', '.jpg');
            else imgEl.src = 'https://toram-id.info/img/skill/unknown.png';
            imgEl.onerror = null;
        };


        // 3. 이미지 섹션 생성 (슬라이드 버튼 포함)
        let imgContent = '';
        if (!isNoImageCategory) {
            imgContent = `
                <div class="equip-image-wrapper">
                    ${isMulti ? `<button class="slide-btn prev">◀</button>` : ''}
                    <div class="equip-img-box">
                        <img src="${getFullImgPath(imgList[activeIdx])}" class="main-img" alt="${item.name}" loading="lazy">
                    </div>
                    ${isMulti ? `<button class="slide-btn next">▶</button>` : ''}
                    ${isMulti ? `<div class="img-counter">1 / ${imgList.length}</div>` : ''}
                </div>`;
        }


        // 5. ★ [질문하신 스탯 텍스트 처리 부분] - 변수로 다시 분리함
        // 화살/단검 데이터는 atk, stability, stats[], drop 필드로 되어 있다
        const statLines: string[] = [];
        if (item.atk) statLines.push(`ATK:${item.atk}${item.stability ? `(${item.stability})` : ''}`);
        if (Array.isArray(item.stats)) statLines.push(...item.stats);
        else if (item.stats) statLines.push(...String(item.stats).split('\n'));
        let statsHtml = statLines.length
            ? `<div class="equip-stats highlight" style="margin-top:10px;">${statLines.join('<br>')}</div>`
            : (item.base_def || item.base_atk ? `<div class="equip-stats">${item.base_atk ? 'ATK: ' + item.base_atk : 'DEF: ' + item.base_def}</div>` : '');
        if (item.drop) statsHtml += `<div class="equip-drop"><b>획득처</b> ${item.drop}</div>`;
        const catBadge = item.category ? `<span class="trait-cat-badge" style="margin-bottom:5px; display:inline-block;">${item.category}</span>` : '';

        card.innerHTML = `
            ${imgContent}
            <div class="equip-info">
                ${catBadge}
                <div class="equip-name" style="font-size:1.1rem;">${item.name}</div>
                <div class="equip-name-en" style="margin-bottom:5px;">${item.name_en || ''}</div>
                ${statsHtml}
            </div>
        `;

        // ★ [수정됨] 이미지 로드 실패 시 에러 핸들러 연결 및 클릭 시 확대 모달 연결
        const mainImg = card.querySelector('.main-img') as HTMLImageElement;
        if (mainImg) {
            mainImg.onerror = () => handleImgError(mainImg);
            mainImg.addEventListener('click', () => {
                const fullPaths = imgList.map(n => getFullImgPath(n));
                openImageModalWithSlide(fullPaths, activeIdx, item.name);
            });
        }

        // ★ [수정됨] 카드 내 좌우 화살표 클릭 시 이미지 교체 로직
        if (isMulti) {
            const counter = card.querySelector('.img-counter') as HTMLElement;
            card.querySelector('.prev')?.addEventListener('click', (e) => {
                e.stopPropagation();
                activeIdx = (activeIdx - 1 + imgList.length) % imgList.length;
                mainImg.src = getFullImgPath(imgList[activeIdx]);
                mainImg.onerror = () => handleImgError(mainImg); // 이미지 바뀔 때마다 에러 핸들러 재작동
                counter.innerText = `${activeIdx + 1} / ${imgList.length}`;
            });
            card.querySelector('.next')?.addEventListener('click', (e) => {
                e.stopPropagation();
                activeIdx = (activeIdx + 1) % imgList.length;
                mainImg.src = getFullImgPath(imgList[activeIdx]);
                mainImg.onerror = () => handleImgError(mainImg);
                counter.innerText = `${activeIdx + 1} / ${imgList.length}`;
            });
        }
        grid.appendChild(card);
    });

    sizeEquipGridColumns();
}
function openImageModalWithSlide(imgList: string[], startIndex: number, title: string) {
    modalImages = imgList;
    modalCurrentIndex = startIndex;

    let modal = document.getElementById('image-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'image-modal';
        modal.className = 'image-modal';
        modal.innerHTML = `
            <button class="modal-arrow m-prev">◀</button>
            <div class="modal-stage"><img class="modal-content" id="modal-img"></div>
            <button class="modal-arrow m-next">▶</button>
            <div id="modal-caption" class="modal-caption"></div>
        `;
        document.body.appendChild(modal);


       // ★ [수정됨] 배경 클릭 시 사이트가 나가지지 않고 모달만 닫히도록 history.back() 실행
        modal.addEventListener('click', (e) => { if (e.target === modal) history.back(); });

        // ★ [수정됨] 모달 내부 슬라이드 이동 버튼 이벤트
        modal.querySelector('.m-prev')?.addEventListener('click', (e) => {
            e.stopPropagation();
            modalCurrentIndex = (modalCurrentIndex - 1 + modalImages.length) % modalImages.length;
            updateModalUI();
        });
        modal.querySelector('.m-next')?.addEventListener('click', (e) => {
            e.stopPropagation();
            modalCurrentIndex = (modalCurrentIndex + 1) % modalImages.length;
            updateModalUI();
        });
    }

    const updateModalUI = () => {
        const mImg = document.getElementById('modal-img') as HTMLImageElement;
        const mCap = document.getElementById('modal-caption') as HTMLElement;
        const arrows = modal?.querySelectorAll('.modal-arrow');

        mImg.src = modalImages[modalCurrentIndex];
        // 모달에서도 JPG/PNG 교차 에러 대응
        mImg.onerror = () => {
            if (mImg.src.includes('.jpg')) mImg.src = mImg.src.replace('.jpg', '.png');
            else if (mImg.src.includes('.png')) mImg.src = mImg.src.replace('.png', '.jpg');
            mImg.onerror = null;
        };
        mCap.innerText = `${title} (${modalCurrentIndex + 1} / ${modalImages.length})`;

        // 이미지가 1장뿐이면 화살표 버튼 숨김
        arrows?.forEach((a: any) => a.style.display = modalImages.length > 1 ? 'block' : 'none');
    };

    updateModalUI();
    modal.style.display = 'flex';

    // ★ [수정됨] 핵심: 뒤로가기 버튼 클릭 시 사이트가 나가지 않고 모달만 닫히게 하기 위해 가짜 히스토리 기록
    history.pushState({ modalOpen: true }, '');
}

// =================================================
// [기능] 낮/밤 테마 토글 (Day/Night Switch)
// =================================================
function initGlobalFeatures() {
    // 1. 테마 버튼 (기존)
    const themeBtn = document.createElement('button');
    themeBtn.className = 'theme-toggle-btn';
    themeBtn.id = 'theme-btn';
    themeBtn.onclick = toggleTheme;
    document.body.appendChild(themeBtn);

    const savedTheme = localStorage.getItem('toram-theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeBtn.innerText = '☀️ 낮 모드';
    } else {
        themeBtn.innerText = '🌙 밤 모드';
    }

    // 2. 상단 이동 버튼 (Top)
    const topBtn = document.createElement('button');
    topBtn.className = 'scroll-top-btn';
    topBtn.innerText = '⬆️ Top';
    topBtn.onclick = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    document.body.appendChild(topBtn);

    // 3. 홈 이동 버튼 (Home) - [추가됨]
    const homeBtn = document.createElement('button');
    homeBtn.className = 'float-home-btn';
    homeBtn.innerText = '🏠 Home';
    homeBtn.onclick = () => {
        navigate('home'); // 라우터 함수 호출
    };
    document.body.appendChild(homeBtn);

    // 스크롤 이벤트 감지 -> 버튼 2개 동시 표시/숨김
    window.addEventListener('scroll', () => {
        if (window.scrollY > 150) {
            topBtn.classList.add('show');
            homeBtn.classList.add('show');
        } else {
            topBtn.classList.remove('show');
            homeBtn.classList.remove('show');
        }
    });
}

function toggleTheme() {
    // (기존 동일)
    const body = document.body;
    const btn = document.getElementById('theme-btn') as HTMLButtonElement;
    body.classList.toggle('dark-mode');
    if (body.classList.contains('dark-mode')) {
        btn.innerText = '☀️ 낮 모드';
        localStorage.setItem('toram-theme', 'dark');
    } else {
        btn.innerText = '🌙 밤 모드';
        localStorage.setItem('toram-theme', 'light');
    }
}

// =================================================
// [Page 8] 뉴비 가이드 (Newbie Guide) - 탭 기능 추가
// =================================================

// 가이드 카테고리 설정
const GUIDE_TABS = [
    { id: 'menu', name: '메뉴 (기본)' },
    { id: 'money', name: '돈 벌기' },
    { id: 'raid', name: '레이드' },
    { id: 'myroom', name: '마이룸' },
    { id: 'boss', name: '특수보스' },
    { id: 'job', name: '직업 가이드' },
    { id: 'enchant_share', name: '옵션부여 공유' },
];

const ADMIN_PASSWORD_HASH = import.meta.env.VITE_ADMIN_PASSWORD_HASH;

let currentGuideTab = 'menu'; // 현재 선택된 탭
let guideFirestoreCache: Record<string, any[]> = {};

// =================================================
// [유틸] SHA-256 해시 생성
// =================================================
async function sha256(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// 이스케이프된 텍스트 안의 URL을 클릭 가능한 링크로 바꾸고 줄바꿈을 <br>로 변환한다.
function linkifyEscapedText(escapedText: string): string {
    return escapedText
        .replace(/(https?:\/\/[^\s<]+)/g, url => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`)
        .replace(/\n/g, '<br>');
}

function showMsg(el: HTMLElement, msg: string, type: 'error' | 'success') {
    el.innerText = msg;
    el.style.color = type === 'error' ? '#ff4444' : '#44ff88';
}

function clearWriteForm() {
    ['write-nickname', 'write-title', 'write-password'].forEach(id => {
        (document.getElementById(id) as HTMLInputElement).value = '';
    });
    (document.getElementById('write-content') as HTMLTextAreaElement).value = '';
    document.getElementById('content-counter')!.innerText = '0';
    document.getElementById('write-message')!.innerText = '';
}

// =================================================
// [렌더링] 뉴비 가이드 페이지
// =================================================
function renderGuidePage() {
    app.innerHTML = `
    <div class="nav-bar">
      <button class="btn-home" id="back-home">🏠 Home</button>
      <h2 style="margin:0 0 0 15px; border:none;">📘 뉴비 가이드</h2>
    </div>

    <div class="container">

      <!-- 탭 -->
      <div class="guide-tabs">
        ${GUIDE_TABS.map(tab => `
          <button class="guide-tab-btn ${tab.id === currentGuideTab ? 'active' : ''}" data-id="${tab.id}">
            ${tab.name}
          </button>
        `).join('')}
      </div>

      <!-- 검색 + 글쓰기 버튼 -->
      <div style="display:flex; gap:10px; align-items:center; margin-bottom:15px; flex-wrap:wrap;">
        <input type="text" id="guide-search" class="search-input"
          placeholder="제목 또는 내용 검색..."
          style="flex:1; margin:0; min-width:180px;">
        <button id="btn-open-write" style="
          background:linear-gradient(135deg,var(--accent-pink),#ff6b9d);
          color:white; border:none; padding:10px 20px;
          border-radius:20px; font-size:0.9rem; cursor:pointer;
          white-space:nowrap; box-shadow:0 4px 12px rgba(255,0,127,0.3);">
          ✏️ 가이드 작성
        </button>
      </div>

      <!-- 글쓰기 폼 (기본 숨김) -->
      <div id="guide-write-form" style="display:none; background:var(--card-bg);
        border:1px solid var(--border-color); border-radius:15px; padding:25px; margin-bottom:25px;">

        <h3 style="margin:0 0 20px 0; color:var(--accent-pink);">✏️ 가이드 작성</h3>

        <!-- 카테고리 -->
        <div style="margin-bottom:14px;">
          <label style="display:block; margin-bottom:6px; color:var(--accent-light); font-weight:bold;">카테고리 *</label>
          <select id="write-category" style="width:100%; padding:10px; border-radius:8px;
            background:var(--input-bg); color:white; border:1px solid var(--border-color);">
            ${GUIDE_TABS.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
          </select>
        </div>

        <!-- 닉네임 -->
        <div style="margin-bottom:14px;">
          <label style="display:block; margin-bottom:6px; color:var(--accent-light); font-weight:bold;">
            작성자 닉네임 * <span style="color:#888;font-size:0.8rem;">(최대 20자)</span>
          </label>
          <input type="text" id="write-nickname" maxlength="20" placeholder="닉네임 입력"
            style="width:100%; padding:10px; border-radius:8px;
            background:var(--input-bg); color:white; border:1px solid var(--border-color); box-sizing:border-box;">
        </div>

        <!-- 제목 -->
        <div style="margin-bottom:14px;">
          <label style="display:block; margin-bottom:6px; color:var(--accent-light); font-weight:bold;">
            제목 * <span style="color:#888;font-size:0.8rem;">(최대 50자)</span>
          </label>
          <input type="text" id="write-title" maxlength="50" placeholder="가이드 제목"
            style="width:100%; padding:10px; border-radius:8px;
            background:var(--input-bg); color:white; border:1px solid var(--border-color); box-sizing:border-box;">
        </div>

        <!-- 내용 -->
        <div style="margin-bottom:14px;">
          <label style="display:block; margin-bottom:6px; color:var(--accent-light); font-weight:bold;">
            내용 * <span style="color:#888;font-size:0.8rem;">(최대 2000자)</span>
          </label>
          <textarea id="write-content" maxlength="2000" rows="8"
            placeholder="가이드 내용을 입력하세요&#10;줄바꿈도 그대로 표시됩니다."
            style="width:100%; padding:10px; border-radius:8px;
            background:var(--input-bg); color:white; border:1px solid var(--border-color);
            resize:vertical; box-sizing:border-box; font-family:inherit;"></textarea>
          <div style="text-align:right; color:#888; font-size:0.8rem; margin-top:3px;">
            <span id="content-counter">0</span> / 2000
          </div>
        </div>

        <!-- 삭제용 비밀번호 -->
        <div style="margin-bottom:20px;">
          <label style="display:block; margin-bottom:6px; color:var(--accent-light); font-weight:bold;">
            삭제용 비밀번호 * <span style="color:#888;font-size:0.8rem;">(나중에 본인 글 삭제 시 필요, 최소 4자)</span>
          </label>
          <input type="password" id="write-password" maxlength="20" placeholder="삭제용 비밀번호 설정"
            style="width:100%; padding:10px; border-radius:8px;
            background:var(--input-bg); color:white; border:1px solid var(--border-color); box-sizing:border-box;">
        </div>

        <!-- 버튼 -->
        <div style="display:flex; gap:10px; justify-content:flex-end;">
          <button id="btn-cancel-write" style="padding:10px 22px; border-radius:20px;
            background:transparent; color:#888; border:1px solid #555; cursor:pointer;">취소</button>
          <button id="btn-submit-write" style="padding:10px 22px; border-radius:20px;
            background:linear-gradient(135deg,var(--accent-pink),#ff6b9d);
            color:white; border:none; cursor:pointer; font-weight:bold;">게시하기</button>
        </div>

        <div id="write-message" style="margin-top:12px; text-align:center; font-size:0.9rem;"></div>
      </div>

      <!-- 가이드 리스트 -->
      <div id="guide-list" class="guide-list-container">
        <div style="text-align:center; padding:50px; color:#888;">로딩 중...</div>
      </div>
    </div>

    <!-- 삭제 확인 모달 -->
    <div id="delete-modal" style="display:none; position:fixed; inset:0;
      background:rgba(0,0,0,0.75); z-index:9999;
      justify-content:center; align-items:center;">
      <div style="background:var(--card-bg); border:1px solid var(--border-color);
        border-radius:15px; padding:30px; width:90%; max-width:380px;">
        <h3 style="margin:0 0 15px 0; color:#ff4444;">🗑️ 게시글 삭제</h3>
        <p style="color:#aaa; margin-bottom:15px; font-size:0.9rem; line-height:1.6;">
          작성 시 설정한 비밀번호를 입력해주세요.<br>
          <span style="color:#ff8c8c; font-size:0.85rem;">※ 관리자 비밀번호로도 삭제 가능합니다.</span>
        </p>
        <input type="password" id="delete-password-input" placeholder="비밀번호 입력"
          style="width:100%; padding:10px; border-radius:8px; background:var(--input-bg);
          color:white; border:1px solid var(--border-color); box-sizing:border-box; margin-bottom:8px;">
        <div id="delete-message" style="font-size:0.85rem; margin-bottom:14px; min-height:18px;"></div>
        <div style="display:flex; gap:10px; justify-content:flex-end;">
          <button id="btn-delete-cancel" style="padding:8px 18px; border-radius:15px;
            background:transparent; color:#888; border:1px solid #555; cursor:pointer;">취소</button>
          <button id="btn-delete-confirm" style="padding:8px 18px; border-radius:15px;
            background:#ff4444; color:white; border:none; cursor:pointer; font-weight:bold;">삭제</button>
        </div>
      </div>
    </div>
  `;

    // ── 이벤트 바인딩 ─────────────────────────────
    document.getElementById('back-home')?.addEventListener('click', () => navigate('home'));

    document.querySelectorAll('.guide-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            document.querySelectorAll('.guide-tab-btn').forEach(b => b.classList.remove('active'));
            target.classList.add('active');
            currentGuideTab = target.dataset.id!;
            loadGuideFromFirestore(currentGuideTab);
        });
    });

    document.getElementById('guide-search')?.addEventListener('input', (e) => {
        renderGuideItems((e.target as HTMLInputElement).value.trim());
    });

    document.getElementById('btn-open-write')?.addEventListener('click', () => {
        const form = document.getElementById('guide-write-form')!;
        const isOpen = form.style.display !== 'none';
        form.style.display = isOpen ? 'none' : 'block';
        if (!isOpen) {
            (document.getElementById('write-category') as HTMLSelectElement).value = currentGuideTab;
        }
    });

    document.getElementById('btn-cancel-write')?.addEventListener('click', () => {
        document.getElementById('guide-write-form')!.style.display = 'none';
        clearWriteForm();
    });

    document.getElementById('write-content')?.addEventListener('input', (e) => {
        document.getElementById('content-counter')!.innerText =
            String((e.target as HTMLTextAreaElement).value.length);
    });

    document.getElementById('btn-submit-write')?.addEventListener('click', submitGuidePost);
    document.getElementById('btn-delete-cancel')?.addEventListener('click', closeDeleteModal);

    loadGuideFromFirestore(currentGuideTab);
}

// =================================================
// [로드] Firestore에서 가이드 불러오기
// =================================================
async function loadGuideFromFirestore(tabId: string) {
    const container = document.getElementById('guide-list')!;
    container.innerHTML = '<div style="text-align:center;padding:50px;color:#888;">로딩 중...</div>';

    try {

        const q = query(
            collection(db, 'guides'),
            where('category', '==', tabId),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        guideFirestoreCache[tabId] = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderGuideItems('');

    } catch (err: any) {
        console.error(err);
        const indexUrl = err?.message?.match(/https:\/\/\S+/)?.[0];
        container.innerHTML = `
            <div style="text-align:center;color:#ff4444;padding:30px;">
                데이터를 불러오지 못했습니다.<br>
                ${indexUrl
                ? `<a href="${indexUrl}" target="_blank"
                        style="color:#4af;font-size:0.85rem;text-decoration:underline;">
                        👉 여기를 클릭해서 Firestore 인덱스를 생성해주세요
                       </a>`
                : `<span style="font-size:0.8rem;color:#aaa;">${err}</span>`}
            </div>`;
    }
}

// =================================================
// [렌더링] 가이드 카드 목록
// =================================================
function renderGuideItems(keyword: string) {
    const container = document.getElementById('guide-list');
    if (!container) return;
    container.innerHTML = '';

    const data = guideFirestoreCache[currentGuideTab] || [];
    const lk = keyword.toLowerCase();
    const filtered = lk
        ? data.filter((item: any) =>
            item.title?.toLowerCase().includes(lk) ||
            item.content?.toLowerCase().includes(lk))
        : data;

    if (filtered.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:50px;color:#888;">
            ${keyword ? '검색 결과가 없습니다.' : '아직 작성된 가이드가 없습니다. 첫 번째 가이드를 작성해보세요! 🌸'}
        </div>`;
        return;
    }
    filtered.forEach((item: any) => {
        const card = document.createElement('div');
        card.className = 'guide-card';

        // 날짜 포맷
        let dateStr = '';
        if (item.createdAt?.toDate) {
            const d = item.createdAt.toDate();
            dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
        }

        card.innerHTML = `
        <!-- 헤더 (항상 보임, 클릭 시 펼침) -->
            <div class="guide-card-header">
                <div class="guide-card-title-area">
                    <div class="guide-card-title">${escapeHtml(item.title || '제목 없음')}</div>
                    <div class="guide-card-meta">
                        <span>✍️ ${escapeHtml(item.nickname || '익명')}</span>
                        ${dateStr ? `<span>📅 ${dateStr}</span>` : ''}
                    </div>
                </div>
                <div class="guide-card-actions">
                    <button class="btn-edit-post" data-id="${item.id}">✏️ 수정</button>
                    <button class="btn-delete-post" data-id="${item.id}">🗑️ 삭제</button>
                    <span class="guide-toggle-icon">▼</span>
                </div>
            </div>

            <!-- 본문 (접힘/펼침) -->
            <div class="guide-card-body">
                <div class="guide-card-content">${linkifyEscapedText(escapeHtml(item.content || ''))}</div>
            </div>
        `;

        // 헤더 클릭 시 펼치기/접기
        const header = card.querySelector('.guide-card-header')!;
        header.addEventListener('click', (e) => {
            // 삭제 버튼 클릭은 무시
            if ((e.target as HTMLElement).classList.contains('btn-delete-post')) return;
            card.classList.toggle('open');
        });

        // 수정 버튼
        card.querySelector('.btn-edit-post')?.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(item);
        });

        // 삭제 버튼
        card.querySelector('.btn-delete-post')?.addEventListener('click', (e) => {
            e.stopPropagation();
            openDeleteModal(item.id, item.passwordHash);
        });

        container.appendChild(card);
    });
}

// =================================================
// [제출] 게시글 작성
// =================================================
async function submitGuidePost() {
    const nickname = (document.getElementById('write-nickname') as HTMLInputElement).value.trim();
    const title = (document.getElementById('write-title') as HTMLInputElement).value.trim();
    const content = (document.getElementById('write-content') as HTMLTextAreaElement).value.trim();
    const category = (document.getElementById('write-category') as HTMLSelectElement).value;
    const password = (document.getElementById('write-password') as HTMLInputElement).value;
    const msgEl = document.getElementById('write-message')!;
    const submitBtn = document.getElementById('btn-submit-write') as HTMLButtonElement;

    if (!nickname) { showMsg(msgEl, '❌ 닉네임을 입력해주세요.', 'error'); return; }
    if (!title) { showMsg(msgEl, '❌ 제목을 입력해주세요.', 'error'); return; }
    if (!content) { showMsg(msgEl, '❌ 내용을 입력해주세요.', 'error'); return; }
    if (!password) { showMsg(msgEl, '❌ 삭제용 비밀번호를 설정해주세요.', 'error'); return; }
    if (password.length < 4) { showMsg(msgEl, '❌ 비밀번호는 최소 4자 이상이어야 합니다.', 'error'); return; }

    submitBtn.disabled = true;
    submitBtn.innerText = '게시 중...';

    try {

        const passwordHash = await sha256(password);

        await addDoc(collection(db, 'guides'), {
            category,
            nickname,
            title,
            content,
            passwordHash,
            createdAt: serverTimestamp(),
        });

        showMsg(msgEl, '✅ 게시글이 등록되었습니다!', 'success');
        clearWriteForm();

        delete guideFirestoreCache[category];
        currentGuideTab = category;
        document.querySelectorAll('.guide-tab-btn').forEach(b => {
            b.classList.toggle('active', (b as HTMLElement).dataset.id === category);
        });

        setTimeout(() => {
            document.getElementById('guide-write-form')!.style.display = 'none';
            msgEl.innerText = '';
            loadGuideFromFirestore(category);
        }, 1200);

    } catch (err) {
        console.error(err);
        showMsg(msgEl, '❌ 등록 실패. 잠시 후 다시 시도해주세요.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = '게시하기';
    }
}

// =================================================
// [수정] 모달
// =================================================
function openEditModal(item: any) {
    // 기존 수정 모달 있으면 제거
    document.getElementById('edit-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'edit-modal';
    modal.style.cssText = 'display:flex; position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:9999; justify-content:center; align-items:center;';
    modal.innerHTML = `
        <div style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:15px; padding:28px; width:94%; max-width:780px; max-height:92vh; overflow-y:auto;">
            <h3 style="margin:0 0 18px; color:var(--accent-pink);">✏️ 가이드 수정</h3>

            <div style="margin-bottom:12px;">
                <label style="display:block; margin-bottom:5px; font-size:0.85rem; color:var(--accent-light); font-weight:bold;">제목</label>
                <input type="text" id="edit-title" maxlength="50" value="${escapeHtml(item.title||'')}"
                    style="width:100%; padding:9px; border-radius:8px; background:var(--input-bg); color:var(--text-main); border:1px solid var(--border-color); box-sizing:border-box;">
            </div>

            <div style="margin-bottom:12px;">
                <label style="display:block; margin-bottom:5px; font-size:0.85rem; color:var(--accent-light); font-weight:bold;">내용</label>
                <textarea id="edit-content" maxlength="2000" rows="16"
                    style="width:100%; min-height:300px; padding:12px; line-height:1.6; font-size:0.95rem; border-radius:8px; background:var(--input-bg); color:var(--text-main); border:1px solid var(--border-color); resize:vertical; box-sizing:border-box; font-family:inherit;">${escapeHtml(item.content||'')}</textarea>
            </div>

            <div style="margin-bottom:18px;">
                <label style="display:block; margin-bottom:5px; font-size:0.85rem; color:var(--accent-light); font-weight:bold;">
                    비밀번호 확인 <span style="color:#888; font-size:0.78rem;">(작성 시 설정한 비밀번호)</span>
                </label>
                <input type="password" id="edit-password" placeholder="비밀번호 입력"
                    style="width:100%; padding:9px; border-radius:8px; background:var(--input-bg); color:var(--text-main); border:1px solid var(--border-color); box-sizing:border-box;">
            </div>

            <div id="edit-message" style="font-size:0.85rem; margin-bottom:12px; min-height:18px;"></div>

            <div style="display:flex; gap:10px; justify-content:flex-end;">
                <button id="btn-edit-cancel" style="padding:8px 18px; border-radius:15px; background:transparent; color:#888; border:1px solid #555; cursor:pointer; box-shadow:none;">취소</button>
                <button id="btn-edit-confirm" style="padding:8px 18px; border-radius:15px; background:var(--accent-pink); color:white; border:none; cursor:pointer; font-weight:bold;">저장</button>
            </div>
        </div>`;

    document.body.appendChild(modal);

    document.getElementById('btn-edit-cancel')?.addEventListener('click', () => modal.remove());
    // 배경을 눌러도 닫지 않는다. 쓰던 내용이 사라지지 않게 취소 버튼으로만 닫는다.

    document.getElementById('btn-edit-confirm')?.addEventListener('click', async () => {
        const newTitle = (document.getElementById('edit-title') as HTMLInputElement).value.trim();
        const newContent = (document.getElementById('edit-content') as HTMLTextAreaElement).value.trim();
        const password = (document.getElementById('edit-password') as HTMLInputElement).value;
        const msgEl = document.getElementById('edit-message')!;
        const btn = document.getElementById('btn-edit-confirm') as HTMLButtonElement;

        if (!newTitle) { showMsg(msgEl, '❌ 제목을 입력해주세요.', 'error'); return; }
        if (!newContent) { showMsg(msgEl, '❌ 내용을 입력해주세요.', 'error'); return; }
        if (!password) { showMsg(msgEl, '❌ 비밀번호를 입력해주세요.', 'error'); return; }

        btn.disabled = true;
        btn.innerText = '저장 중...';

        try {
            const inputHash = await sha256(password);
            const isOwner = item.passwordHash && inputHash === item.passwordHash;
            const isAdmin = inputHash === ADMIN_PASSWORD_HASH;

            if (!isOwner && !isAdmin) {
                showMsg(msgEl, '❌ 비밀번호가 올바르지 않습니다.', 'error');
                btn.disabled = false; btn.innerText = '저장';
                return;
            }

            const { updateDoc, doc: fsDoc } = await import('firebase/firestore');
            await updateDoc(fsDoc(db, 'guides', item.id), {
                title: newTitle,
                content: newContent,
            });

            // 캐시 업데이트
            const cached = guideFirestoreCache[currentGuideTab];
            if (cached) {
                const idx = cached.findIndex((c: any) => c.id === item.id);
                if (idx !== -1) { cached[idx].title = newTitle; cached[idx].content = newContent; }
            }

            modal.remove();
            renderGuideItems('');
        } catch (err) {
            console.error(err);
            showMsg(msgEl, '❌ 수정 실패. 다시 시도해주세요.', 'error');
            btn.disabled = false; btn.innerText = '저장';
        }
    });
}

// =================================================
// [삭제] 모달
// =================================================
let pendingDeleteId: string | null = null;
let pendingDeleteHash: string | null = null;

function openDeleteModal(docId: string, passwordHash: string | null) {
    pendingDeleteId = docId;
    pendingDeleteHash = passwordHash;
    document.getElementById('delete-modal')!.style.display = 'flex';
    (document.getElementById('delete-password-input') as HTMLInputElement).value = '';
    document.getElementById('delete-message')!.innerText = '';

    const confirmBtn = document.getElementById('btn-delete-confirm')!;
    const newBtn = confirmBtn.cloneNode(true) as HTMLElement;
    confirmBtn.replaceWith(newBtn);
    newBtn.addEventListener('click', confirmDelete);
}

function closeDeleteModal() {
    document.getElementById('delete-modal')!.style.display = 'none';
    pendingDeleteId = null;
    pendingDeleteHash = null;
}

async function confirmDelete() {
    const input = (document.getElementById('delete-password-input') as HTMLInputElement).value;
    const msgEl = document.getElementById('delete-message')!;
    const btn = document.getElementById('btn-delete-confirm') as HTMLButtonElement;

    if (!input) { showMsg(msgEl, '❌ 비밀번호를 입력해주세요.', 'error'); return; }
    if (!pendingDeleteId) return;

    btn.disabled = true;
    btn.innerText = '삭제 중...';

    try {
        const inputHash = await sha256(input);
        const isOwner = pendingDeleteHash && inputHash === pendingDeleteHash;
        const isAdmin = inputHash === ADMIN_PASSWORD_HASH;

        if (!isOwner && !isAdmin) {
            showMsg(msgEl, '❌ 비밀번호가 올바르지 않습니다.', 'error');
            btn.disabled = false;
            btn.innerText = '삭제';
            return;
        }

        await deleteDoc(doc(db, 'guides', pendingDeleteId));

        guideFirestoreCache[currentGuideTab] = (guideFirestoreCache[currentGuideTab] || [])
            .filter((item: any) => item.id !== pendingDeleteId);

        closeDeleteModal();
        renderGuideItems('');

    } catch (err) {
        console.error(err);
        showMsg(msgEl, '❌ 삭제 실패. 다시 시도해주세요.', 'error');
        btn.disabled = false;
        btn.innerText = '삭제';
    }
}


// =================================================
// [Page 9] 정보 페이지 (Credits)
// =================================================

function renderInfoPage() {
    app.innerHTML = `
    <div class="nav-bar">
      <button class="btn-home" id="back-home">🏠 Home</button>
      <h2 style="margin:0 0 0 15px; border:none;">ℹ️ 정보 (Credits)</h2>
    </div>

    <div class="container" style="max-width:600px;">
      
      <div class="info-card">
        <h3>👑 제작</h3>
        <p><strong>제작/개발:</strong> patohsi </p>
        <p><strong>토람 닉네임 (toram name):</strong> aoiusagi </p>
      </div>

      <div class="info-card">
        <h3>🤝 참여자 (토람온라인 닉네임) </h3>
        <ul style="padding-left:20px; color:var(--text-dim);">
          <li>데이터 제공: 스왈로 </li>
          <li>이미지 도움: cat </li>
          <li>디자인 조언: last night</li>
        </ul>
      </div>

      <div class="info-card">
        <h3>📚 참고 데이터</h3>
        <p>Toram Online Wiki, Coryn Club, 토람온라인 연구소, Aries 길드 </p>
      </div>

      <h3 style="margin-top:30px; border-bottom:1px solid #444; padding-bottom:10px;">🔗 관련 링크</h3>
      <div class="link-grid">
        <a href="https://github.com/patohsh/Toram_KR" target="_blank" class="link-box">
          <div class="link-icon">🐙</div>
          <div>GitHub</div>
        </a>
        <a href="https://toram.jp" target="_blank" class="link-box">
          <div class="link-icon">🌐</div>
          <div>Official Site</div>
        </a>
        <a href="https://coryn.club" target="_blank" class="link-box">
          <div class="link-icon">🛡️</div>
          <div>Coryn Club</div>
        </a>
        <a href="https://patohsh.github.io/patohsi/index.html" target="_blank" class="link-box">
          <div class="link-icon">💬</div>
          <div>patohsi</div>
        </a>
        <a href="https://www.youtube.com/@patohsi" target="_blank" class="link-box">
          <div class="link-icon">▶️</div>
          <div>YouTube</div>
        </a>
      </div>

      <div style="text-align:center; margin-top:50px; color:#666; font-size:0.8rem;">
        © 2025 Toram Tools. All rights reserved.<br>
        This is a fan-made site and is not affiliated with Asobimo Inc.
      </div>
    </div>
  `;

    document.getElementById('back-home')?.addEventListener('click', renderHomePage);
}

// 1. 마우스 백버튼 감지 시작
initMouseBackEvent();
document.getElementById('site-foot-info')?.addEventListener('click', () => navigate('info'));

// 2. 테마 및 탑버튼 초기화
initGlobalFeatures();

// 3. 앱 시작 (초기 진입 시 홈 화면)
// History 상태가 있으면 그 페이지로, 없으면 홈으로
if (history.state && history.state.page) {
    const page = history.state.page as PageKey;
    if (routes[page]) { routes[page](); void recordPageView(page); }
    else { renderHomePage(); void recordPageView('home'); }
} else {
    // 초기 URL 해시 확인 (예: #schedule)
    const hash = window.location.hash.replace('#', '') as PageKey;
    if (hash && routes[hash]) {
        // 해시가 있으면 해당 페이지로 이동 및 히스토리 대체
        history.replaceState({ page: hash }, '', `#${hash}`);
        routes[hash]();
        void recordPageView(hash);
    } else {
        // 기본 홈
        history.replaceState({ page: 'home' }, '', '#home');
        renderHomePage();
        void recordPageView('home');
    }
}