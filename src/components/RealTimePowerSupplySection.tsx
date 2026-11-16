import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, RefreshCw } from 'lucide-react';
import { RegionCode } from '../data/powerMarketData';

interface ApiForecastItem {
  tradeYmd: string;
  tradeHour: number;
  areaName: string;
  smp: number;
  forecastDemand: number;
}

interface ApiSuccessResponse {
  ok: true;
  date: string;
  endpoint: string;
  fetchedAt: string;
  totalCount: number;
  items: ApiForecastItem[];
}

interface ApiErrorResponse {
  ok: false;
  date?: string;
  endpoint?: string;
  error: string;
  detail?: string;
}

interface RealTimePowerSupplySectionProps {
  region: RegionCode;
  currentHour: number;
}

function getTodayKstInputDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export const RealTimePowerSupplySection: React.FC<RealTimePowerSupplySectionProps> = ({
  region,
  currentHour,
}) => {
  const [queryDate, setQueryDate] = useState<string>(() => getTodayKstInputDate());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [data, setData] = useState<ApiSuccessResponse | null>(null);
  const [errorInfo, setErrorInfo] = useState<ApiErrorResponse | null>(null);

  const fetchSupplyData = useCallback(async (dateInput: string) => {
    setIsLoading(true);
    setErrorInfo(null);

    const yyyymmdd = dateInput.replace(/-/g, '');
    try {
      const res = await fetch(`/api/smp-forecast?date=${encodeURIComponent(yyyymmdd)}`);
      const payload = (await res.json()) as ApiSuccessResponse | ApiErrorResponse;

      if (!res.ok || !payload.ok) {
        const errPayload = !payload.ok
          ? payload
          : { ok: false as const, error: `요청 실패 (HTTP ${res.status})` };
        setData(null);
        setErrorInfo(errPayload);
        return;
      }

      setData(payload);
    } catch (err) {
      setData(null);
      setErrorInfo({
        ok: false,
        date: yyyymmdd,
        endpoint: 'https://apis.data.go.kr/B552115/SmpWithForecastDemand',
        error: '실시간 전력 수급 API 호출 중 네트워크 오류가 발생했습니다.',
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSupplyData(queryDate);
  }, [fetchSupplyData, queryDate]);

  const regionLabel = region === 'mainland' ? '육지' : '제주';

  const regionItems = useMemo(() => {
    if (!data?.items) return [];
    const matched = data.items.filter((it) => it.areaName.includes(regionLabel));
    return (matched.length > 0 ? matched : data.items).sort(
      (a, b) => a.tradeHour - b.tradeHour
    );
  }, [data, regionLabel]);

  const summary = useMemo(() => {
    if (regionItems.length === 0) return null;
    // API tradeHour is 1..24 (end of interval); currentHour 0..23 maps to tradeHour = currentHour + 1
    const targetTradeHour = currentHour + 1;
    const currentItem =
      regionItems.find((it) => it.tradeHour === targetTradeHour) ??
      regionItems[regionItems.length - 1];

    const demands = regionItems.map((it) => it.forecastDemand).filter((d) => d > 0);
    const maxDemand = demands.length > 0 ? Math.max(...demands) : 0;
    const minDemand = demands.length > 0 ? Math.min(...demands) : 0;
    const peakHourItem = regionItems.find((it) => it.forecastDemand === maxDemand);

    return {
      currentItem,
      maxDemand,
      minDemand,
      peakHour: peakHourItem?.tradeHour ?? 18,
    };
  }, [currentHour, regionItems]);

  return (
    <section className="surface-card p-4" aria-label="실시간 전력 수급">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#FFF7ED] flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4 text-[#FF6B00]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-[16px] font-bold tracking-[-0.015em] text-[#0F172A] truncate">
                실시간 전력 수급
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#475569] text-[10.5px] font-semibold whitespace-nowrap">
                공공데이터 API
              </span>
            </div>
            <p className="text-[11.5px] text-[#64748B] truncate">
              KPX 하루전 발전계획 수요예측 · {regionLabel}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void fetchSupplyData(queryDate)}
          disabled={isLoading}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#E2E8F0] text-[11.5px] font-semibold text-[#334155] hover:bg-[#F1F5F9] active:scale-[0.98] transition-all min-h-[32px] shrink-0 disabled:opacity-60"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin text-[#FF6B00]' : ''}`} />
          재조회
        </button>
      </div>

      {/* Date Picker Control */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <label htmlFor="supply-api-date" className="text-[11.5px] font-semibold text-[#64748B]">
          조회 거래일자
        </label>
        <input
          id="supply-api-date"
          type="date"
          value={queryDate}
          onChange={(e) => {
            if (e.target.value) setQueryDate(e.target.value);
          }}
          className="h-9 px-2.5 rounded-lg border border-[#CBD5E1] bg-white text-[12.5px] font-semibold text-[#0F172A] tabular-nums-strict focus:outline-none focus:border-[#FF6B00] focus:ring-3 focus:ring-[#FF6B00]/20"
        />
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="mt-3 space-y-2.5">
          <div className="h-[68px] rounded-xl bg-[#F1F5F9] animate-pulse" />
          <div className="h-[88px] rounded-xl bg-[#F1F5F9] animate-pulse" />
        </div>
      )}

      {/* Error State (explicitly displayed inside the section as requested) */}
      {!isLoading && errorInfo && (
        <div
          role="alert"
          className="mt-3 p-3.5 rounded-xl bg-[#FFF1F2] border border-[#FECDD3] space-y-2"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-[#E11D48] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-[#9F1239]">{errorInfo.error}</div>
              {errorInfo.detail && (
                <p className="mt-1 text-[12px] leading-[17px] text-[#BE123C] break-words">
                  {errorInfo.detail}
                </p>
              )}
            </div>
          </div>
          <div className="pt-2 border-t border-[#FECDD3]/70 text-[11px] text-[#9F1239]/80 break-all tabular-nums-strict">
            요청 주소: {errorInfo.endpoint ?? 'https://apis.data.go.kr/B552115/SmpWithForecastDemand'}
            {errorInfo.date ? ` (date=${errorInfo.date})` : ''}
          </div>
        </div>
      )}

      {/* Populated State */}
      {!isLoading && !errorInfo && summary && (
        <div className="mt-3 space-y-3">
          {/* Primary Current Forecast Demand & SMP */}
          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] font-semibold text-[#64748B] tabular-nums-strict">
                {String(summary.currentItem.tradeHour).padStart(2, '0')}시 예측 전력수요 ({summary.currentItem.areaName})
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#10B981] text-[10.5px] font-semibold">
                연동 정상
              </span>
            </div>

            <div className="mt-1.5 flex items-baseline justify-between gap-2 tabular-nums-strict">
              <div className="flex items-baseline gap-1">
                <span className="text-[28px] font-extrabold text-[#0F172A] tracking-tight leading-none">
                  {summary.currentItem.forecastDemand.toLocaleString()}
                </span>
                <span className="text-[13px] font-semibold text-[#64748B]">MW</span>
              </div>
              <div className="text-right">
                <span className="text-[12px] font-bold text-[#FF6B00]">
                  SMP {summary.currentItem.smp.toFixed(2)}원
                </span>
              </div>
            </div>

            <div className="mt-2.5 pt-2.5 border-t border-[#E2E8F0] grid grid-cols-2 gap-2 text-[11.5px] tabular-nums-strict">
              <div>
                <span className="text-[#64748B]">금일 최대 수요 ({summary.peakHour}시)</span>
                <div className="font-bold text-[#0F172A] mt-0.5">
                  {summary.maxDemand.toLocaleString()} MW
                </div>
              </div>
              <div className="text-right">
                <span className="text-[#64748B]">금일 최저 수요</span>
                <div className="font-bold text-[#0F172A] mt-0.5">
                  {summary.minDemand.toLocaleString()} MW
                </div>
              </div>
            </div>
          </div>

          {/* 24-Hour Forecast Demand Mini Strip */}
          <div>
            <div className="flex items-center justify-between text-[11px] font-semibold text-[#64748B] mb-1.5">
              <span>시간대별 수요예측 추이 (01~24시)</span>
              <span className="tabular-nums-strict">총 {regionItems.length}건</span>
            </div>
            <div className="h-[68px] flex items-end justify-between gap-[2px] border-b border-[#E2E8F0] pb-1">
              {regionItems.map((it) => {
                const ratio =
                  summary.maxDemand > 0 ? it.forecastDemand / summary.maxDemand : 0.5;
                const heightPct = Math.max(16, Math.round(ratio * 100));
                const isNow = it.tradeHour === currentHour + 1;
                return (
                  <div
                    key={`${it.areaName}-${it.tradeHour}`}
                    title={`${it.tradeHour}시: ${it.forecastDemand.toLocaleString()} MW / SMP ${it.smp}원`}
                    style={{ height: `${heightPct}%` }}
                    className={`flex-1 rounded-t-[3px] ${
                      isNow ? 'bg-[#FF6B00]' : 'bg-[#CBD5E1]'
                    }`}
                  />
                );
              })}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-[#94A3B8] tabular-nums-strict">
              <span>01시</span>
              <span>06시</span>
              <span>12시</span>
              <span>18시</span>
              <span>24시</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
