# eaglebet-relay — ريلاي كاشير Eagle Bet

خدمة Relay عديمة الحالة (Stateless) تُشغَّل على **Render**، وظيفتها الوحيدة تمرير طلبات
واجهة كاشير Eagle Bet من Cloudflare Worker إلى `agents.eaglebet99.com` عبر IP استضافة
عادية (Frankfurt) لتجاوز حجب WAF.

## ما تفعله وما لا تفعله

| تفعل | لا تفعل |
|---|---|
| تمرّر `core/User/UserApi/Agent/Player/Statistics` فقط | لا تخزّن كوكي/توكن/كلمة سر |
| ترفض أي طلب بلا `x-cashier-proxy-key` صحيح | لا تقرأ D1 ولا تمسّ قاعدة البيانات |
| تعطي `GET /health` لفحص الحياة | لا تستقبل ويبهوك تيليغرام ولا SMS |

## الملفات

| الملف | الوظيفة |
|---|---|
| `relay.mjs` | كود الريلاي (Node http، بلا اعتماديات) |
| `Dockerfile` | صورة `node:20-alpine` |
| `render.yaml` | Blueprint جاهز: Free · Frankfurt · health `/health` · autoDeploy off |
| `.dockerignore` | استبعاد ملفات غير لازمة من الصورة |

## النشر على Render

### الطريقة الموصى بها — Blueprint

1. Render → **New → Blueprint**.
2. اختر المستودع `fadyabohamza-netizen/eaglebet-relay` (Private).
3. Render يقرأ `render.yaml` ويطلب قيمة `RELAY_KEY` فقط.
4. الصق المفتاح من `config/RELAY_KEY.txt` (خارج هذا المستودع) → **Apply**.
5. انتظر حتى تصبح الحالة **Live**، ثم اختبر `/health`.

### الطريقة اليدوية (بديل)

Render → **New → Web Service** → نفس المستودع:

| الحقل | القيمة |
|---|---|
| Runtime | Docker |
| Region | Frankfurt (EU Central) |
| Plan | Free |
| Health Check Path | `/health` |
| Auto-Deploy | No |
| `CASHIER_BASE` | `https://agents.eaglebet99.com/global/api/` |
| `RELAY_KEY` | من `config/RELAY_KEY.txt` |

> لا تضبط `PORT` — Render يمرّره تلقائياً والكود يستمع على `0.0.0.0`.

## التشغيل المحلي

```powershell
$env:PORT='8899'
$env:RELAY_KEY=(Get-Content '..\config\RELAY_KEY.txt' -Raw)
$env:CASHIER_BASE='https://agents.eaglebet99.com/global/api/'
node relay.mjs
```

## التحقق

```powershell
$relay = "https://eaglebet-relay.onrender.com"
$key   = (Get-Content '..\config\RELAY_KEY.txt' -Raw)

# حياة
curl.exe -s "$relay/health"

# بلا مفتاح ⇒ 401
curl.exe -s -o NUL -w "%{http_code}`n" -X POST "$relay/core/getData" -d "{}"

# مسار غير مسموح ⇒ 404
curl.exe -s -o NUL -w "%{http_code}`n" -X POST "$relay/admin/secret" -H "x-cashier-proxy-key: $key" -d "{}"

# بالمفتاح ⇒ JSON من الكاشير
curl.exe -s -X POST "$relay/core/getData" -H "content-type: application/json" -H "x-cashier-proxy-key: $key" -d "{}"
```

## الأمان

1. `RELAY_KEY` لا يدخل Git ولا الصورة ولا هذه الوثائق.
2. مفتاح واحد لـEagle Bet فقط — لا تشاركه مع أي وكالة أخرى.
3. لا تُضف هذا الريلاي إلى حساب/خدمة `bashan-relay` المشتركة.
4. عند تدوير المفتاح: Render → Environment → `RELAY_KEY` → Save، ثم فوراً
   `npx wrangler secret put CASHIER_PROXY_KEY` بنفس القيمة.
5. الخطة المجانية = 750 ساعة/workspace/شهر ≈ خدمة واحدة 24/7. لا تفتح خدمة مجانية ثانية
   على نفس الحساب.
