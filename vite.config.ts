import { defineConfig } from 'vite'

export default defineConfig({
    base: './',
    plugins: [
        {
            // 개발 서버에서도 배포 환경(Netlify 함수)과 같은 주소로 공지 함수를 부를 수 있게 한다.
            name: 'dev-netlify-notice',
            configureServer(server) {
                server.middlewares.use('/.netlify/functions/notice', async (_req, res) => {
                    const mod = await import('./netlify/functions/notice.mjs')
                    const result = await mod.handler()
                    res.statusCode = result.statusCode
                    for (const [key, value] of Object.entries(result.headers)) res.setHeader(key, value as string)
                    res.end(result.body)
                })
            },
        },
    ],
})
