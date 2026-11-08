// Netlify 함수: 토람 공식 공지 목록을 서버에서 가져와 JSON 으로 돌려준다.
// 브라우저는 kr.toram.jp 를 직접 부를 수 없고(CORS), 공개 프록시는 자주 막히거나 느려서 이 함수를 먼저 쓴다.
const BASE = 'https://kr.toram.jp';
const TARGET = `${BASE}/information/?type_code=all`;

function clean(html) {
    return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

export function parseNotices(html, limit = 5) {
    const items = [];
    const seen = new Set();
    const re = /<a\b[^>]*href="([^"]*information_id[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(html)) && items.length < limit) {
        const raw = m[1].replace(/&amp;/g, '&');
        const href = raw.startsWith('http') ? raw : raw.startsWith('/') ? `${BASE}${raw}` : `${BASE}/information/${raw}`;
        const title = clean(m[2]);
        if (!title || seen.has(href)) continue;
        seen.add(href);
        items.push({ title, href });
    }
    return items;
}

export const handler = async () => {
    try {
        const res = await fetch(TARGET, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ToramInfoSite/1.0)', 'Accept-Language': 'ko' },
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const items = parseNotices(await res.text());
        if (!items.length) throw new Error('no notices');
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                // 5분 동안은 같은 결과를 재사용해서 공지 서버에 부담을 주지 않는다
                'Cache-Control': 'public, max-age=300, s-maxage=300',
            },
            body: JSON.stringify({ items }),
        };
    } catch (err) {
        return { statusCode: 502, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: String(err) }) };
    }
};
