// Relay بسيط لطلبات كاشير الوكالة، يُشغَّل على VPS/Render/Cloud Run
// بينما Cloudflare Workers محجوب من WAF الكاشير.
//
// التشغيل:
//   PORT=8899 RELAY_KEY=... node relay.mjs
// ثم في العامل:
//   wrangler secret put CASHIER_PROXY_URL   # مثال: https://eaglebet-relay.onrender.com
//   wrangler secret put CASHIER_PROXY_KEY   # نفس RELAY_KEY
//
// لا يُقبل أي مسار خارج نطاق واجهة الكاشير، ويُرفض أي طلب بلا المفتاح.
import http from 'node:http'

const PORT = Number(process.env.PORT || 8899)
const RELAY_KEY = String(process.env.RELAY_KEY || '').trim()
const CASHIER_BASE = String(process.env.CASHIER_BASE || 'https://agents.eaglebet99.com/global/api/').replace(/\/+$/, '') + '/'
const CASHIER_ORIGIN = new URL(CASHIER_BASE).origin
const ALLOWED = /^(core|User|UserApi|Agent|Player|Statistics)\/[A-Za-z]+$/
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

if (!RELAY_KEY) {
  console.error('RELAY_KEY is required')
  process.exit(1)
}

const server = http.createServer(async (req, res) => {
  const started = Date.now()
  try {
    // فحص حياة سريع لا يلمس الكاشير (يستخدمه مراقب الـrelay).
    if (req.method === 'GET' && (req.url === '/health' || req.url === '/' || req.url === '/healthz')) {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: true, service: 'cashier-relay', uptime: Math.round(process.uptime()) }))
      return
    }
    if (req.method !== 'POST') {
      res.writeHead(405, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'method_not_allowed' }))
      return
    }
    if (String(req.headers['x-cashier-proxy-key'] || '') !== RELAY_KEY) {
      res.writeHead(401, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'unauthorized' }))
      return
    }
    const path = new URL(req.url || '/', 'http://relay').pathname.replace(/^\/+/, '')
    if (!ALLOWED.test(path)) {
      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'path_not_allowed' }))
      return
    }

    const chunks = []
    for await (const c of req) chunks.push(c)
    const body = Buffer.concat(chunks)

    const upstream = await fetch(CASHIER_BASE + path, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/plain, */*',
        'accept-language': 'ar,en-US;q=0.9,en;q=0.8',
        origin: CASHIER_ORIGIN,
        referer: CASHIER_ORIGIN + '/',
        'user-agent': UA,
        ...(req.headers.cookie ? { cookie: String(req.headers.cookie) } : {}),
        ...(req.headers.authorization ? { authorization: String(req.headers.authorization) } : {})
      },
      body,
      // لا نترك الطلب معلّقاً للأبد إذا تجمّد أصل الكاشير.
      signal: AbortSignal.timeout(45000)
    })

    const buf = Buffer.from(await upstream.arrayBuffer())
    const headers = { 'content-type': upstream.headers.get('content-type') || 'application/json' }
    const setCookie = upstream.headers.getSetCookie?.() || []
    if (setCookie.length) headers['set-cookie'] = setCookie
    res.writeHead(upstream.status, headers)
    res.end(buf)
    console.log(`${path} ${upstream.status} ${Date.now() - started}ms ${buf.length}b`)
  } catch (e) {
    res.writeHead(502, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'relay_failed', message: String(e?.message || e) }))
  }
})

server.listen(PORT, '0.0.0.0', () => console.log(`cashier relay listening on :${PORT}`))
