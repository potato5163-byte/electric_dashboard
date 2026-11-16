export type RegionCode = 'mainland' | 'jeju';
export type DayRange = 'yesterday' | 'today' | 'tomorrow';
export type LoadTier = 'off-peak' | 'mid-peak' | 'peak';

export interface HourlyRatePoint {
  hour: number;
  label: string;
  smp: number;
  forecast: number;
  yesterdaySmp: number;
  demandMw: number;
  tier: LoadTier;
  renewableSurplus: boolean;
}

export interface DailyTrendPoint {
  dayLabel: string;
  dateLabel: string;
  mainlandAvg: number;
  jejuAvg: number;
  isToday?: boolean;
}

export interface GenerationSource {
  id: string;
  name: string;
  sharePercent: number;
  outputGw: number;
  color: string;
}

export interface AppliancePreset {
  id: string;
  name: string;
  powerKw: number;
  defaultHours: number;
  description: string;
}

export interface GlossaryItem {
  term: string;
  fullName: string;
  summary: string;
  tip: string;
}

export interface RegionMarketSnapshot {
  regionName: string;
  reserveRate: number;
  reserveMw: number;
  supplyCapacityMw: number;
  recPrice: number;
  recDeltaPercent: number;
  recDeltaValue: number;
  optimalWindow: string;
  optimalAvgPrice: number;
  hourlyByDay: Record<DayRange, HourlyRatePoint[]>;
}

const mainlandTodayBase = [
  104.2, 98.6, 94.1, 92.8, 95.4, 102.3,
  116.8, 128.4, 138.9, 144.2, 139.6, 131.5,
  122.4, 126.8, 134.2, 141.5, 146.9, 152.4,
  161.8, 158.3, 149.7, 136.4, 121.9, 111.5,
];

const jejuTodayBase = [
  112.5, 106.4, 101.2, 99.8, 103.5, 114.2,
  129.6, 142.8, 151.3, 148.9, 132.4, 118.2,
  104.6, 96.4, 108.5, 126.4, 149.2, 168.5,
  179.4, 174.2, 162.8, 145.6, 129.3, 118.7,
];

function classifyTier(hour: number, smp: number, region: RegionCode): LoadTier {
  const highThreshold = region === 'jeju' ? 156 : 148;
  const lowThreshold = region === 'jeju' ? 115 : 112;
  if (smp >= highThreshold || (hour >= 17 && hour <= 20)) return 'peak';
  if (smp <= lowThreshold || hour <= 5) return 'off-peak';
  return 'mid-peak';
}

function buildHourlySeries(
  base: number[],
  region: RegionCode,
  dayOffsetFactor: number,
  demandScale: number
): HourlyRatePoint[] {
  return base.map((val, hour) => {
    const wave = Math.sin((hour + dayOffsetFactor * 3) * 0.45) * 2.4;
    const smp = Number((val * dayOffsetFactor + wave).toFixed(2));
    const forecast = Number((smp + Math.cos(hour * 0.7) * 2.1).toFixed(2));
    const yesterdaySmp = Number((val * 0.96 + Math.sin(hour * 0.5) * 1.9).toFixed(2));
    const baseDemand = region === 'mainland' ? 62500 : 780;
    const demandCurve =
      hour < 6
        ? 0.78
        : hour < 10
          ? 0.94
          : hour < 15
            ? 1.02
            : hour < 21
              ? 1.12
              : 0.89;
    const demandMw = Math.round(baseDemand * demandCurve * demandScale);
    const tier = classifyTier(hour, smp, region);
    const renewableSurplus =
      region === 'jeju'
        ? hour >= 11 && hour <= 14
        : hour >= 12 && hour <= 14 && smp < 130;

    return {
      hour,
      label: `${String(hour).padStart(2, '0')}시`,
      smp,
      forecast,
      yesterdaySmp,
      demandMw,
      tier,
      renewableSurplus,
    };
  });
}

export const MARKET_DATA: Record<RegionCode, RegionMarketSnapshot> = {
  mainland: {
    regionName: '육지',
    reserveRate: 14.8,
    reserveMw: 11420,
    supplyCapacityMw: 88640,
    recPrice: 74200,
    recDeltaPercent: 1.8,
    recDeltaValue: 1300,
    optimalWindow: '02:00 ~ 05:00',
    optimalAvgPrice: 94.1,
    hourlyByDay: {
      yesterday: buildHourlySeries(mainlandTodayBase, 'mainland', 0.95, 0.97),
      today: buildHourlySeries(mainlandTodayBase, 'mainland', 1.0, 1.0),
      tomorrow: buildHourlySeries(mainlandTodayBase, 'mainland', 1.03, 1.02),
    },
  },
  jeju: {
    regionName: '제주',
    reserveRate: 18.4,
    reserveMw: 214,
    supplyCapacityMw: 1380,
    recPrice: 74200,
    recDeltaPercent: 1.8,
    recDeltaValue: 1300,
    optimalWindow: '12:00 ~ 14:00',
    optimalAvgPrice: 103.2,
    hourlyByDay: {
      yesterday: buildHourlySeries(jejuTodayBase, 'jeju', 0.94, 0.96),
      today: buildHourlySeries(jejuTodayBase, 'jeju', 1.0, 1.0),
      tomorrow: buildHourlySeries(jejuTodayBase, 'jeju', 1.02, 1.03),
    },
  },
};

export const SEVEN_DAY_TREND: DailyTrendPoint[] = [
  { dayLabel: '월', dateLabel: '11/09', mainlandAvg: 121.4, jejuAvg: 132.8 },
  { dayLabel: '화', dateLabel: '11/10', mainlandAvg: 124.8, jejuAvg: 135.2 },
  { dayLabel: '수', dateLabel: '11/11', mainlandAvg: 119.6, jejuAvg: 128.4 },
  { dayLabel: '목', dateLabel: '11/12', mainlandAvg: 127.3, jejuAvg: 139.1 },
  { dayLabel: '금', dateLabel: '11/13', mainlandAvg: 131.5, jejuAvg: 144.6 },
  { dayLabel: '토', dateLabel: '11/14', mainlandAvg: 125.1, jejuAvg: 134.9 },
  { dayLabel: '오늘', dateLabel: '11/15', mainlandAvg: 130.6, jejuAvg: 137.5, isToday: true },
];

export const GENERATION_MIX: GenerationSource[] = [
  { id: 'nuclear', name: '원자력', sharePercent: 32.4, outputGw: 24.8, color: '#0F172A' },
  { id: 'lng', name: 'LNG(가스)', sharePercent: 28.1, outputGw: 21.5, color: '#FF6B00' },
  { id: 'coal', name: '석탄', sharePercent: 24.6, outputGw: 18.8, color: '#64748B' },
  { id: 'renewable', name: '신재생(태양광·풍력)', sharePercent: 12.7, outputGw: 9.7, color: '#10B981' },
  { id: 'other', name: '양수·기타', sharePercent: 2.2, outputGw: 1.7, color: '#CBD5E1' },
];

export const APPLIANCE_PRESETS: AppliancePreset[] = [
  {
    id: 'ev',
    name: '전기차 완속 충전',
    powerKw: 7.0,
    defaultHours: 4,
    description: '7kW 완속 충전기 기준',
  },
  {
    id: 'ac',
    name: '스탠드 에어컨',
    powerKw: 1.8,
    defaultHours: 3,
    description: '냉방 표준 운전 기준',
  },
  {
    id: 'dryer',
    name: '의류 건조기',
    powerKw: 1.5,
    defaultHours: 2,
    description: '히트펌프 표준 코스',
  },
  {
    id: 'induction',
    name: '인덕션 레인지',
    powerKw: 2.2,
    defaultHours: 1,
    description: '2구 동시 조리 기준',
  },
  {
    id: 'washer',
    name: '드럼 세탁기',
    powerKw: 0.8,
    defaultHours: 1.5,
    description: '온수 세탁 코스 기준',
  },
];

export const GLOSSARY_ITEMS: GlossaryItem[] = [
  {
    term: 'SMP (계통한계가격)',
    fullName: 'System Marginal Price',
    summary:
      '매 시간 전력 수요를 맞추기 위해 가동되는 가장 단가가 높은 발전기(주로 LNG)의 발전단가로 결정되는 실시간 전력 도매가격입니다.',
    tip: '전력 수요가 몰리는 저녁 17~21시에 SMP가 가장 높게 형성됩니다.',
  },
  {
    term: 'REC (신재생에너지 공급인증서)',
    fullName: 'Renewable Energy Certificate',
    summary:
      '태양광·풍력 등 신재생에너지 설비로 전력을 생산했음을 증명하는 인증서로, 현물 시장에서 거래되는 친환경 전력 가치 지표입니다.',
    tip: '1REC는 신재생 발전량 1,000kWh(1MWh)에 해당합니다.',
  },
  {
    term: '전력 공급예비율',
    fullName: 'Power Supply Reserve Ratio',
    summary:
      '최대 전력 수요를 초과해 확보하고 있는 여유 전력의 비율입니다. 10% 이상이면 안정, 5.5% 미만이면 수급 경보 단계에 해당합니다.',
    tip: '예비율이 높을수록 발전 단가가 안정되는 경향이 있습니다.',
  },
];
