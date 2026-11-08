// src/stats.ts
// 방문 통계: 하루 단위(stats_daily)와 월 단위(stats_monthly) 문서에 방문자 수와 페이지뷰를 올린다.
//  - visits: 브라우저 하루 1회(처음 들어온 날 한 번만 센다)
//  - views : 페이지를 볼 때마다 1
//  - pages : 페이지별 views
// 개인정보는 저장하지 않는다. 시간 기준은 한국 시간(KST).

import { db } from './firebase';
import { doc, getDoc, increment, writeBatch } from 'firebase/firestore';

const VISIT_KEY = 'toram-visit-day';
const CACHE_KEY = 'toram-visit-summary';
const CACHE_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 8000;

export interface VisitSummary {
    today: number;
    month: number;
    monthViews: number;
    topPages: [string, number][];
}

export function kstDay(now: Date = new Date()): string {
    return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error('timeout')), ms);
        promise.then(
            v => { window.clearTimeout(timer); resolve(v); },
            e => { window.clearTimeout(timer); reject(e); },
        );
    });
}

function readStore(key: string): string {
    try { return localStorage.getItem(key) || ''; } catch { return ''; }
}
function writeStore(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { /* 저장할 수 없는 환경은 무시 */ }
}
function readSession(key: string): string {
    try { return sessionStorage.getItem(key) || ''; } catch { return ''; }
}
function writeSession(key: string, value: string): void {
    try { sessionStorage.setItem(key, value); } catch { /* 무시 */ }
}

// 개발 중(localhost)에는 통계를 올리지 않는다.
function isDevHost(): boolean {
    return ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
}

// 이번 페이지 로드에서 기록 중인(또는 끝난) 요청. 방문자 수를 읽기 전에 이 기록이 끝나길 기다려서,
// 방금 한 방문이 반영되기 전 값이 보이거나 5분 동안 저장되는 일을 막는다.
let pendingRecord: Promise<void> | null = null;

export function recordPageView(page: string): Promise<void> {
    const p = writePageView(page);
    pendingRecord = p;
    return p;
}

async function writePageView(page: string): Promise<void> {
    if (isDevHost()) return;
    if (!/^[a-z]{2,12}$/.test(page)) return;

    const day = kstDay();
    const month = day.slice(0, 7);
    const newVisitor = readStore(VISIT_KEY) !== day;

    const counts = {
        visits: increment(newVisitor ? 1 : 0),
        views: increment(1),
        pages: { [page]: increment(1) },
    };

    try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'stats_daily', day), { date: day, month, ...counts }, { merge: true });
        batch.set(doc(db, 'stats_monthly', month), { month, ...counts }, { merge: true });
        await withTimeout(batch.commit(), TIMEOUT_MS);
        if (newVisitor) writeStore(VISIT_KEY, day);
    } catch (err) {
        console.warn('방문 통계를 기록하지 못했습니다:', err);
    }
}

interface DailyDoc { visits?: number }
interface MonthlyDoc { visits?: number; views?: number; pages?: Record<string, number> }

export async function loadVisitSummary(): Promise<VisitSummary | null> {
    const day = kstDay();
    const month = day.slice(0, 7);

    // 홈 화면은 그린 직후에 이 함수를 부르고 그 다음에 방문을 기록하므로, 기록 요청이 등록될 때까지 한 박자 기다린다.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    if (pendingRecord) {
        // 방금 한 기록이 반영된 뒤의 값을 읽는다 (저장된 이전 값은 버린다)
        try { await pendingRecord; } catch { /* 기록 실패와 상관없이 읽기는 시도한다 */ }
        try { sessionStorage.removeItem(CACHE_KEY); } catch { /* 무시 */ }
        pendingRecord = null;
    }

    try {
        const cached = JSON.parse(readSession(CACHE_KEY) || 'null') as { at: number; day: string; data: VisitSummary } | null;
        if (cached && cached.day === day && Date.now() - cached.at < CACHE_MS) return cached.data;
    } catch { /* 캐시가 깨졌으면 새로 읽는다 */ }

    try {
        const [dailySnap, monthlySnap] = await withTimeout(
            Promise.all([getDoc(doc(db, 'stats_daily', day)), getDoc(doc(db, 'stats_monthly', month))]),
            TIMEOUT_MS,
        );
        const daily = dailySnap.data() as DailyDoc | undefined;
        const monthly = monthlySnap.data() as MonthlyDoc | undefined;
        const topPages = Object.entries(monthly?.pages ?? {})
            .filter(([key]) => key !== 'home')
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
        const data: VisitSummary = {
            today: daily?.visits ?? 0,
            month: monthly?.visits ?? 0,
            monthViews: monthly?.views ?? 0,
            topPages,
        };
        writeSession(CACHE_KEY, JSON.stringify({ at: Date.now(), day, data }));
        return data;
    } catch (err) {
        console.warn('방문 통계를 불러오지 못했습니다:', err);
        return null;
    }
}
