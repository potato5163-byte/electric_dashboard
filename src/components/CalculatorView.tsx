import React, { useMemo, useState } from 'react';
import { Calculator, CheckCircle2, Sparkles, Zap } from 'lucide-react';
import {
  buildHourlySeriesFromCsv,
  CsvMonthlyRow,
  getRegionValue,
} from '../data/csvLoader';
import { APPLIANCE_PRESETS, MARKET_DATA, RegionCode } from '../data/powerMarketData';

interface CalculatorViewProps {
  region: RegionCode;
  currentHour: number;
  activeRow: CsvMonthlyRow | undefined;
  prevRow: CsvMonthlyRow | undefined;
}

export const CalculatorView: React.FC<CalculatorViewProps> = ({
  region,
  currentHour,
  activeRow,
  prevRow,
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(APPLIANCE_PRESETS[0].id);
  const [powerKw, setPowerKw] = useState<number>(APPLIANCE_PRESETS[0].powerKw);
  const [durationHours, setDurationHours] = useState<number>(APPLIANCE_PRESETS[0].defaultHours);
  const [startHour, setStartHour] = useState<number>(currentHour);

  const snapshot = MARKET_DATA[region];
  const todaySeries = useMemo(() => {
    if (!activeRow) return snapshot.hourlyByDay.today;
    return buildHourlySeriesFromCsv(activeRow, prevRow, region).today;
  }, [activeRow, prevRow, region, snapshot.hourlyByDay.today]);

  const baseMonthlySmp = activeRow ? getRegionValue(activeRow, region) : 119.02;

  const handleSelectPreset = (id: string) => {
    const preset = APPLIANCE_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setSelectedPresetId(id);
    setPowerKw(preset.powerKw);
    setDurationHours(preset.defaultHours);
  };

  const calculation = useMemo(() => {
    const steps = Math.max(1, Math.round(durationHours));
    let selectedCost = 0;
    for (let i = 0; i < steps; i++) {
      const h = (startHour + i) % 24;
      selectedCost += todaySeries[h].smp * powerKw;
    }

    let bestStartHour = 0;
    let bestCost = Infinity;
    for (let s = 0; s < 24; s++) {
      let windowCost = 0;
      for (let i = 0; i < steps; i++) {
        windowCost += todaySeries[(s + i) % 24].smp * powerKw;
      }
      if (windowCost < bestCost) {
        bestCost = windowCost;
        bestStartHour = s;
      }
    }

    const totalKwh = powerKw * durationHours;
    const scale = durationHours / steps;
    const finalSelectedCost = Math.round(selectedCost * scale);
    const finalBestCost = Math.round(bestCost * scale);
    const savingsWon = Math.max(0, finalSelectedCost - finalBestCost);
    const savingsPct =
      finalSelectedCost > 0 ? Math.round((savingsWon / finalSelectedCost) * 100) : 0;

    return {
      totalKwh: totalKwh.toFixed(1),
      selectedCost: finalSelectedCost,
      bestStartHour,
      bestCost: finalBestCost,
      savingsWon,
      savingsPct,
    };
  }, [durationHours, powerKw, startHour, todaySeries]);

  return (
    <div className="px-4 pt-3 pb-4 space-y-3">
      {/* Title & Appliance Presets */}
      <section className="surface-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[17px] font-bold text-[#0F172A] tracking-tight">
              실시간 전력원가 계산기
            </h2>
            <p className="text-[12px] text-[#64748B] mt-0.5 tabular-nums-strict">
              {activeRow?.period ?? '최신'} {snapshot.regionName} CSV SMP({baseMonthlySmp.toFixed(2)}원/kWh) 기준
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#FFF7ED] flex items-center justify-center shrink-0">
            <Calculator className="w-4 h-4 text-[#FF6B00]" />
          </div>
        </div>

        <div className="mt-3.5">
          <label className="block text-[12px] font-semibold text-[#475569] mb-2">
            가전·충전 프리셋 선택
          </label>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {APPLIANCE_PRESETS.map((preset) => {
              const active = preset.id === selectedPresetId;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset.id)}
                  className={`px-3 py-2 rounded-xl border text-left shrink-0 transition-all min-h-[44px] ${
                    active
                      ? 'bg-[#FFF7ED] border-[#FF6B00] text-[#EA580C]'
                      : 'bg-white border-[#E2E8F0] text-[#334155] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div className="text-[12.5px] font-bold whitespace-nowrap">{preset.name}</div>
                  <div className="text-[10.5px] opacity-80 tabular-nums-strict whitespace-nowrap">
                    {preset.powerKw} kW · {preset.defaultHours}시간
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Inputs: Power kW & Duration */}
        <div className="mt-3.5 grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="power-kw-input"
              className="block text-[11.5px] font-semibold text-[#64748B] mb-1"
            >
              소비 전력 (kW)
            </label>
            <input
              id="power-kw-input"
              type="number"
              min={0.1}
              max={50}
              step={0.1}
              value={powerKw}
              onChange={(e) => setPowerKw(Math.max(0.1, Number(e.target.value) || 0.1))}
              className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] bg-white text-[14px] font-bold text-[#0F172A] tabular-nums-strict focus:outline-none focus:border-[#FF6B00] focus:ring-3 focus:ring-[#FF6B00]/20"
            />
          </div>

          <div>
            <label
              htmlFor="duration-input"
              className="block text-[11.5px] font-semibold text-[#64748B] mb-1"
            >
              사용 시간 (시간)
            </label>
            <input
              id="duration-input"
              type="number"
              min={0.5}
              max={12}
              step={0.5}
              value={durationHours}
              onChange={(e) =>
                setDurationHours(Math.min(12, Math.max(0.5, Number(e.target.value) || 0.5)))
              }
              className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] bg-white text-[14px] font-bold text-[#0F172A] tabular-nums-strict focus:outline-none focus:border-[#FF6B00] focus:ring-3 focus:ring-[#FF6B00]/20"
            />
          </div>
        </div>

        {/* Start Hour Slider */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="start-hour-range" className="text-[12px] font-semibold text-[#475569]">
              가동 시작 시각
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-extrabold text-[#FF6B00] tabular-nums-strict">
                {String(startHour).padStart(2, '0')}:00 시작
              </span>
              {startHour !== currentHour && (
                <button
                  type="button"
                  onClick={() => setStartHour(currentHour)}
                  className="text-[11px] font-semibold text-[#64748B] underline hover:text-[#0F172A]"
                >
                  현재 시각으로
                </button>
              )}
            </div>
          </div>

          <input
            id="start-hour-range"
            type="range"
            min={0}
            max={23}
            value={startHour}
            onChange={(e) => setStartHour(Number(e.target.value))}
            className="w-full accent-[#FF6B00] h-2 bg-[#E2E8F0] rounded-lg cursor-pointer"
          />
          <div className="mt-1 flex justify-between text-[10px] text-[#94A3B8] tabular-nums-strict">
            <span>00시</span>
            <span>06시</span>
            <span>12시</span>
            <span>18시</span>
            <span>23시</span>
          </div>
        </div>
      </section>

      {/* Result Comparison Card */}
      <section className="surface-card p-4">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-[#64748B]">
            예상 전력량 {calculation.totalKwh} kWh 기준
          </span>
          <span className="px-2 py-0.5 rounded-full bg-[#FFF7ED] text-[#EA580C] text-[11px] font-semibold">
            {activeRow?.period ?? 'CSV'} 도매시세 환산
          </span>
        </div>

        <div className="mt-2.5 flex items-baseline gap-1.5 tabular-nums-strict">
          <span className="text-[36px] font-extrabold leading-[42px] tracking-[-0.03em] text-[#0F172A]">
            {calculation.selectedCost.toLocaleString()}
          </span>
          <span className="text-[16px] font-semibold text-[#64748B]">원</span>
        </div>

        <div className="mt-3.5 p-3.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0]/60">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[#065F46] text-[12.5px] font-bold">
              {calculation.savingsWon > 0 ? (
                <>
                  <Sparkles className="w-4 h-4 text-[#10B981]" />
                  <span>
                    {String(calculation.bestStartHour).padStart(2, '0')}:00 시작 시 절약 가능
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                  <span>현재 선택한 시간대가 최저가 구간입니다!</span>
                </>
              )}
            </div>
            {calculation.savingsWon > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-white text-[#10B981] text-[11px] font-extrabold tabular-nums-strict">
                -{calculation.savingsPct}%
              </span>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between text-[12px] text-[#047857] tabular-nums-strict">
            <span>최적 시간대 예상 원가: {calculation.bestCost.toLocaleString()}원</span>
            {calculation.savingsWon > 0 && (
              <span className="font-bold">
                {calculation.savingsWon.toLocaleString()}원 절감
              </span>
            )}
          </div>
        </div>

        {calculation.savingsWon > 0 && (
          <button
            type="button"
            onClick={() => setStartHour(calculation.bestStartHour)}
            className="mt-3 w-full h-10 rounded-lg bg-[#0F172A] hover:bg-[#1E293B] active:scale-[0.98] text-white text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-all"
          >
            <Zap className="w-3.5 h-3.5 text-[#FF6B00] fill-[#FF6B00]" />
            최적 시간대({String(calculation.bestStartHour).padStart(2, '0')}:00)로 바로 맞추기
          </button>
        )}
      </section>
    </div>
  );
};
