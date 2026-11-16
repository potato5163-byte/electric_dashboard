import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_ENDPOINT =
  'https://apis.data.go.kr/B552115/SmpWithForecastDemand/getSmpWithForecastDemand';

function getTodayKstYyyymmdd(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parts.replace(/-/g, '');
}

function extractXmlTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? match[1].trim() : null;
}

interface RawKpxItem {
  [key: string]: unknown;
  tradeYmd?: string | number;
  tradeHour?: string | number;
  hour?: string | number;
  time?: string | number;
  areaName?: string;
  smp?: string | number;
  forecastDemand?: string | number;
  forecastLoad?: string | number;
  fcstLoad?: string | number;
  fcstDemand?: string | number;
  mlndSmp?: string | number;
  jejuSmp?: string | number;
}

function pickNumber(obj: RawKpxItem, keys: string[], fallback = 0): number {
  for (const k of keys) {
    const val = obj[k];
    if (val !== undefined && val !== null && val !== '') {
      const n = Number(val);
      if (!Number.isNaN(n)) return n;
    }
  }
  // Fallback: match case-insensitive substring
  for (const [k, val] of Object.entries(obj)) {
    if (val === undefined || val === null || val === '') continue;
    const lower = k.toLowerCase();
    if (keys.some((target) => lower === target.toLowerCase())) {
      const n = Number(val);
      if (!Number.isNaN(n)) return n;
    }
  }
  return fallback;
}

async function createServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.get('/api/smp-forecast', async (req, res) => {
    const rawDate = typeof req.query.date === 'string' ? req.query.date.trim() : '';
    const targetDate = /^\d{8}$/.test(rawDate) ? rawDate : getTodayKstYyyymmdd();

    const apiKey = (
      process.env.DATA_GO_KR_API_KEY ||
      process.env.KPX_API_KEY ||
      process.env.VITE_DATA_GO_KR_API_KEY ||
      ''
    ).trim();

    if (!apiKey || apiKey === 'MY_DATA_GO_KR_API_KEY' || apiKey === 'YOUR_DATA_GO_KR_SERVICE_KEY') {
      res.status(400).json({
        ok: false,
        date: targetDate,
        endpoint: BASE_ENDPOINT,
        error: '.env 파일에 DATA_GO_KR_API_KEY 인증키가 설정되어 있지 않습니다.',
        detail:
          '프로젝트 루트의 .env 파일에 공공데이터포털(data.go.kr)에서 발급받은 인증키를 입력한 뒤 서버를 재시작해주세요.',
      });
      return;
    }

    const encodedKey = apiKey.includes('%') ? apiKey : encodeURIComponent(apiKey);
    const requestUrl =
      `${BASE_ENDPOINT}?serviceKey=${encodedKey}` +
      `&pageNo=1&numOfRows=48&dataType=JSON&date=${encodeURIComponent(targetDate)}`;

    try {
      const upstream = await fetch(requestUrl, {
        method: 'GET',
        headers: { Accept: 'application/json, text/xml, */*' },
        signal: AbortSignal.timeout(10000),
      });

      const bodyText = await upstream.text();

      if (!upstream.ok) {
        res.status(upstream.status).json({
          ok: false,
          date: targetDate,
          endpoint: BASE_ENDPOINT,
          error: `공공데이터포털 API 요청 실패 (HTTP ${upstream.status})`,
          detail: bodyText.slice(0, 300) || upstream.statusText,
        });
        return;
      }

      const trimmed = bodyText.trim();
      if (trimmed.startsWith('<')) {
        const errMsg = extractXmlTag(trimmed, 'errMsg');
        const returnAuthMsg = extractXmlTag(trimmed, 'returnAuthMsg');
        const returnReasonCode = extractXmlTag(trimmed, 'returnReasonCode');
        const resultMsg = extractXmlTag(trimmed, 'resultMsg');

        res.status(502).json({
          ok: false,
          date: targetDate,
          endpoint: BASE_ENDPOINT,
          error: `공공데이터포털 인증/응답 오류${returnReasonCode ? ` (코드 ${returnReasonCode})` : ''}`,
          detail:
            [returnAuthMsg, errMsg, resultMsg].filter(Boolean).join(' · ') ||
            trimmed.slice(0, 260),
        });
        return;
      }

      let parsed: any;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        res.status(502).json({
          ok: false,
          date: targetDate,
          endpoint: BASE_ENDPOINT,
          error: 'API 응답 JSON 파싱에 실패했습니다.',
          detail: trimmed.slice(0, 260),
        });
        return;
      }

      const header = parsed?.response?.header;
      if (header && header.resultCode && header.resultCode !== '00') {
        res.status(502).json({
          ok: false,
          date: targetDate,
          endpoint: BASE_ENDPOINT,
          error: `전력거래소 API 오류 (resultCode: ${header.resultCode})`,
          detail: header.resultMsg || '알 수 없는 API 오류가 발생했습니다.',
        });
        return;
      }

      const rawItem = parsed?.response?.body?.items?.item;
      const itemsList: RawKpxItem[] = Array.isArray(rawItem)
        ? rawItem
        : rawItem
          ? [rawItem]
          : [];

      if (itemsList.length === 0) {
        res.status(404).json({
          ok: false,
          date: targetDate,
          endpoint: BASE_ENDPOINT,
          error: `${targetDate} 일자의 전력 수급 데이터가 존재하지 않습니다.`,
          detail: '조회 날짜를 변경하거나 전일/금일 데이터가 게시되었는지 확인해주세요.',
        });
        return;
      }

      const normalized = itemsList.map((it, idx) => {
        const parsedHour = pickNumber(it, ['hour', 'tradeHour', 'time', 'rn'], 0);
        const areaName = String(it.areaName ?? it.area ?? '육지');
        const isJeju = areaName.includes('제주');
        const parsedDemand = pickNumber(
          it,
          isJeju
            ? ['jlfd', 'forecastDemand', 'forecastLoad', 'fcstLoad']
            : ['mlfd', 'slfd', 'forecastDemand', 'forecastLoad', 'fcstLoad'],
          0
        );
        const parsedSmp = pickNumber(it, ['smp', 'mlndSmp', 'jejuSmp'], 0);
        return {
          tradeYmd: String(it.date ?? it.tradeYmd ?? it.tradeDate ?? targetDate),
          tradeHour: parsedHour > 0 ? parsedHour : Math.floor(idx / 2) + 1,
          areaName,
          smp: parsedSmp,
          forecastDemand: parsedDemand,
          systemDemand: pickNumber(it, ['slfd'], parsedDemand),
        };
      });

      res.json({
        ok: true,
        date: targetDate,
        endpoint: BASE_ENDPOINT,
        fetchedAt: new Date().toISOString(),
        totalCount: normalized.length,
        items: normalized,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(502).json({
        ok: false,
        date: targetDate,
        endpoint: BASE_ENDPOINT,
        error: '전력거래소 API 서버 연결에 실패했습니다.',
        detail: message,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

createServer();
