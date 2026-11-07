// 계산기 스킬 탭: 어두운 캔버스 위에 둥근 스킬 버튼을 격자 좌표로 놓고, 선행 관계를 선으로 잇는다.
// 클릭하면 선택한 단위(1/5/10)만큼 레벨이 오르고, 최대 레벨에서 다시 누르면 0으로 돌아간다. 우클릭은 내리기.
import { Build } from './state';

interface Skill {
    id: string;
    n: string;
    t: number;
    k: string; // 'A' 액티브 / 'P' 패시브 / ''
    img: string;
    g: [number, number]; // 격자 좌표 [열, 행]
    pre?: string;
}

interface Tree {
    id: string;
    group: string;
    name: string;
    skills: Skill[];
}

interface SkillData {
    maxLevel: number;
    prereqLevel: number;
    groups: { id: string; label: string }[];
    trees: Tree[];
}

const CELL_W = 88;
const CELL_H = 66;
const PAD = 14;
const NODE = 46;

let data: SkillData | null = null;
let step = 1;

async function loadSkills(): Promise<SkillData | null> {
    if (data) return data;
    try {
        const res = await fetch('Calculator/skills.json');
        if (!res.ok) throw new Error(String(res.status));
        data = await res.json() as SkillData;
    } catch (err) {
        console.error('스킬 데이터 로딩 실패:', err);
    }
    return data;
}

function esc(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function levelOf(build: Build, tree: Tree, id: string): number {
    return build.skills[tree.id]?.[id] ?? 0;
}

function setLevel(build: Build, tree: Tree, id: string, level: number, max: number): void {
    const levels = (build.skills[tree.id] ??= {});
    const v = Math.max(0, Math.min(max, Math.trunc(level)));
    if (v > 0) levels[id] = v; else delete levels[id];
}

export function treeSpent(build: Build, tree: Tree): number {
    return Object.values(build.skills[tree.id] ?? {}).reduce((a, b) => a + b, 0);
}

export async function renderSkillTab(body: HTMLElement, build: Build, save: () => void): Promise<void> {
    body.innerHTML = '<div class="calc-card calc-soon">스킬 데이터를 불러오는 중...</div>';
    const d = await loadSkills();
    if (!d) {
        body.innerHTML = '<div class="calc-card calc-soon">스킬 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>';
        return;
    }
    const MAX = d.maxLevel;
    const PRE = d.prereqLevel;
    const firstTree = (g: string): Tree => d.trees.find(t => t.group === g)!;
    let groupId = d.groups.find(g => d.trees.some(t => t.group === g.id && treeSpent(build, t) > 0))?.id ?? d.groups[0].id;
    let treeId = (d.trees.find(t => t.group === groupId && treeSpent(build, t) > 0) ?? firstTree(groupId)).id;

    const treeMax = (t: Tree): number => t.skills.length * MAX;
    const groupSpent = (g: string): number => d.trees.filter(t => t.group === g).reduce((s, t) => s + treeSpent(build, t), 0);
    const groupMax = (g: string): number => d.trees.filter(t => t.group === g).reduce((s, t) => s + treeMax(t), 0);
    const icon = (t: Tree): string => t.skills.find(s => s.img)?.img ?? '';
    const imgTag = (src: string): string => (src ? `<img src="${esc(src)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : '<span class="sk2-noimg">?</span>');

    body.innerHTML = `
      <section class="calc-card sk2">
        <div class="sk2-top">
          <div class="sk2-title">스킬 <span class="calc-dim" id="sk2-all"></span></div>
          <div class="sk2-actions">
            <span class="sk2-steps" id="sk2-steps">
              ${[1, 5, 10].map(n => `<button type="button" class="sk2-step ${n === step ? 'on' : ''}" data-step="${n}" title="클릭 한 번에 ${n}씩">${n}</button>`).join('')}
            </span>
            <button type="button" class="calc-max" id="sk2-save">저장</button>
            <button type="button" class="calc-max" id="sk2-load">불러오기</button>
            <button type="button" class="calc-max sk2-danger" id="sk2-reset">초기화</button>
            <small class="calc-dim">이 기기에 자동 저장</small>
          </div>
        </div>
        <div class="sk2-main">
          <nav class="sk2-groups" id="sk2-groups"></nav>
          <nav class="sk2-trees" id="sk2-trees"></nav>
          <div class="sk2-canvas" id="sk2-canvas"></div>
        </div>
        <p class="calc-hint">스킬을 누르면 올라가고, 최대 레벨에서 다시 누르면 0으로 돌아갑니다. 우클릭(길게 누르기)은 내리기입니다. 선행 스킬이 Lv${PRE} 미만이면 올릴 때 자동으로 채워집니다.</p>
      </section>`;

    const allEl = document.getElementById('sk2-all')!;
    const groupsEl = document.getElementById('sk2-groups')!;
    const treesEl = document.getElementById('sk2-trees')!;
    const canvasEl = document.getElementById('sk2-canvas')!;

    const treeOf = (id: string): Tree => d.trees.find(t => t.id === id)!;

    // 선행 스킬을 필요한 만큼 올린다 (부모의 부모까지 거슬러 올라감)
    function ensurePrereq(tree: Tree, skill: Skill): void {
        let cur: Skill | undefined = skill;
        const seen = new Set<string>();
        while (cur?.pre && !seen.has(cur.id)) {
            seen.add(cur.id);
            const parent: Skill | undefined = tree.skills.find(s => s.id === cur!.pre);
            if (!parent) break;
            if (levelOf(build, tree, parent.id) < PRE) setLevel(build, tree, parent.id, PRE, MAX);
            cur = parent;
        }
    }

    // 자식이 투자되어 있으면 부모는 선행 레벨 아래로 내릴 수 없다
    function minLevelFor(tree: Tree, skill: Skill): number {
        return tree.skills.some(c => c.pre === skill.id && levelOf(build, tree, c.id) > 0) ? PRE : 0;
    }

    function renderTop(): void {
        const spent = d!.groups.reduce((s, g) => s + groupSpent(g.id), 0);
        const max = d!.groups.reduce((s, g) => s + groupMax(g.id), 0);
        allEl.textContent = `전체 (${spent}/${max})`;
    }

    function renderGroups(): void {
        groupsEl.innerHTML = d!.groups.map(g => `
          <button type="button" class="sk2-group ${g.id === groupId ? 'on' : ''}" data-g="${g.id}">
            <span class="sk2-gicon">${imgTag(icon(firstTree(g.id)))}</span>
            <b>${esc(g.label)}</b>
            <small>(${groupSpent(g.id)}/${groupMax(g.id)})</small>
          </button>`).join('');
        groupsEl.querySelectorAll<HTMLButtonElement>('[data-g]').forEach(b => b.addEventListener('click', () => {
            groupId = b.dataset.g!;
            treeId = firstTree(groupId).id;
            renderAll();
        }));
    }

    function renderTrees(): void {
        treesEl.innerHTML = d!.trees.filter(t => t.group === groupId).map(t => `
          <button type="button" class="sk2-tree ${t.id === treeId ? 'on' : ''}" data-t="${t.id}">
            <span class="sk2-ticon">${imgTag(icon(t))}</span>
            <span><b>${esc(t.name)}</b><small>(${treeSpent(build, t)}/${treeMax(t)})</small></span>
          </button>`).join('');
        treesEl.querySelectorAll<HTMLButtonElement>('[data-t]').forEach(b => b.addEventListener('click', () => {
            treeId = b.dataset.t!;
            renderAll();
        }));
    }

    function renderBoard(): void {
        const tree = treeOf(treeId);
        const cols = Math.max(...tree.skills.map(s => s.g[0])) + 1;
        const rows = Math.max(...tree.skills.map(s => s.g[1])) + 1;
        const width = cols * CELL_W + PAD * 2;
        const height = rows * CELL_H + PAD * 2 + 56;
        const cx = (s: Skill): number => PAD + s.g[0] * CELL_W + CELL_W / 2;
        const cy = (s: Skill): number => PAD + s.g[1] * CELL_H + NODE / 2;

        // 선행 관계 선: 부모 → 자식, 가운데에서 꺾이는 직각선
        const lines = tree.skills.filter(s => s.pre).map(s => {
            const p = tree.skills.find(x => x.id === s.pre);
            if (!p) return '';
            const x1 = cx(p), y1 = cy(p), x2 = cx(s), y2 = cy(s);
            const mid = x1 + (x2 - x1) / 2;
            const on = levelOf(build, tree, s.id) > 0;
            return `<polyline class="sk2-line ${on ? 'on' : ''}" points="${x1},${y1} ${mid},${y1} ${mid},${y2} ${x2},${y2}" />`;
        }).join('');

        canvasEl.innerHTML = `
          <div class="sk2-board" style="width:${width}px;height:${height}px;">
            <svg width="${width}" height="${height}" class="sk2-lines" aria-hidden="true">${lines}</svg>
            ${tree.skills.map(s => {
                const lv = levelOf(build, tree, s.id);
                const lock = s.pre ? levelOf(build, tree, s.pre) < PRE : false;
                return `
                <div class="sk2-node ${lv ? 'on' : ''} ${lv >= MAX ? 'max' : ''}" style="left:${PAD + s.g[0] * CELL_W}px;top:${PAD + s.g[1] * CELL_H}px;width:${CELL_W}px;">
                  <button type="button" class="sk2-btn ${lock && !lv ? 'lock' : ''}" data-s="${esc(s.id)}" title="${esc(s.n)}${s.k ? (s.k === 'A' ? ' (액티브)' : ' (패시브)') : ''}">
                    ${imgTag(s.img)}
                  </button>
                  <span class="sk2-lv">Lv ${lv}/${MAX}</span>
                  <span class="sk2-nm">${esc(s.n)}</span>
                </div>`;
            }).join('')}
          </div>`;

        const skillOf = (id: string): Skill => tree.skills.find(s => s.id === id)!;
        const changed = (): void => { save(); renderTop(); renderGroups(); renderTrees(); renderBoard(); };

        canvasEl.querySelectorAll<HTMLButtonElement>('.sk2-btn').forEach(b => {
            const s = skillOf(b.dataset.s!);
            b.addEventListener('click', () => {
                const cur = levelOf(build, tree, s.id);
                if (cur >= MAX) {
                    setLevel(build, tree, s.id, minLevelFor(tree, s), MAX);
                } else {
                    setLevel(build, tree, s.id, cur + step, MAX);
                    ensurePrereq(tree, s);
                }
                changed();
            });
            b.addEventListener('contextmenu', e => {
                e.preventDefault();
                const next = Math.max(minLevelFor(tree, s), levelOf(build, tree, s.id) - step);
                setLevel(build, tree, s.id, next, MAX);
                changed();
            });
        });
    }

    function renderAll(): void {
        renderTop();
        renderGroups();
        renderTrees();
        renderBoard();
    }

    document.getElementById('sk2-steps')!.querySelectorAll<HTMLButtonElement>('[data-step]').forEach(b => b.addEventListener('click', () => {
        step = Number(b.dataset.step);
        document.querySelectorAll('#sk2-steps .sk2-step').forEach(x => x.classList.toggle('on', x === b));
    }));

    document.getElementById('sk2-reset')!.addEventListener('click', () => {
        const total = d.groups.reduce((s, g) => s + groupSpent(g.id), 0);
        if (!total || !confirm('모든 스킬 투자를 초기화할까요?')) return;
        build.skills = {};
        save();
        renderAll();
    });

    // 저장/불러오기: 투자 상태를 글자(JSON)로 복사하고 붙여 넣어 되돌린다
    document.getElementById('sk2-save')!.addEventListener('click', async () => {
        const text = JSON.stringify(build.skills);
        try {
            await navigator.clipboard.writeText(text);
            alert('스킬 투자 상태를 복사했습니다. 메모장 등에 붙여 넣어 보관하세요.');
        } catch {
            prompt('아래 내용을 복사해 보관하세요.', text);
        }
    });
    document.getElementById('sk2-load')!.addEventListener('click', () => {
        const text = prompt('저장해 둔 스킬 투자 내용을 붙여 넣으세요.');
        if (!text) return;
        try {
            const parsed = JSON.parse(text) as Record<string, Record<string, number>>;
            const next: Record<string, Record<string, number>> = {};
            for (const t of d.trees) {
                for (const s of t.skills) {
                    const v = Math.trunc(Number(parsed?.[t.id]?.[s.id]));
                    if (Number.isFinite(v) && v > 0) (next[t.id] ??= {})[s.id] = Math.min(MAX, v);
                }
            }
            build.skills = next;
            save();
            renderAll();
        } catch {
            alert('붙여 넣은 내용을 읽을 수 없습니다.');
        }
    });

    renderAll();
}
