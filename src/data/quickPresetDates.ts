import { TicketData } from '../types';
import {
  getSequentialTicketingTime,
  getSequentialTransactionDetails
} from '../utils/dateUtils';

export interface QuickDatePreset {
  month: string; // e.g. '9월', '10월', '11월'
  monthKey: string; // e.g. '2026-10'
  monthFullLabel: string; // e.g. '2026년 10월'
  relativeLabel: '전달' | '지금 달' | '다음달';
  date: string; // YYYY-MM-DD
  label: string; // e.g. '10/14(수)'
  dayOfWeek: string; // '월', '화', '수'
}

const KOREAN_DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export type DayFilterType = 'all' | 'mon_wed' | 'all_weekdays' | 'weekend';

/**
 * 지금 달을 기준으로 전달, 지금 달, 다음달 3개월의 날짜를 동적 생성
 * 기본값: 'all' (월화수목금토일 7일 모두 표시)
 */
export function generateThreeMonthsPresets(
  baseDate: Date = new Date(),
  dayFilter: DayFilterType = 'all'
): QuickDatePreset[] {
  const currentYear = baseDate.getFullYear();
  const currentMonth = baseDate.getMonth(); // 0-indexed

  const monthConfigs: { offset: number; relativeLabel: '전달' | '지금 달' | '다음달' }[] = [
    { offset: -1, relativeLabel: '전달' },
    { offset: 0, relativeLabel: '지금 달' },
    { offset: 1, relativeLabel: '다음달' }
  ];

  const presets: QuickDatePreset[] = [];

  for (const config of monthConfigs) {
    const targetMonthDate = new Date(currentYear, currentMonth + config.offset, 1);
    const year = targetMonthDate.getFullYear();
    const monthIndex = targetMonthDate.getMonth(); // 0-indexed
    const monthNum = monthIndex + 1;
    const monthStr = `${monthNum}월`;
    const monthKey = `${year}-${String(monthNum).padStart(2, '0')}`;
    const monthFullLabel = `${year}년 ${monthStr}`;

    // Get total days in target month
    const totalDays = new Date(year, monthIndex + 1, 0).getDate();

    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(year, monthIndex, day);
      const dayOfWeekNum = d.getDay(); // 0: Sun, 1: Mon, ... 6: Sat

      let isAllowed = false;
      if (dayFilter === 'all') {
        // 월화수목금토일 7일 전체 포함
        isAllowed = true;
      } else if (dayFilter === 'mon_wed') {
        // 월(1), 화(2), 수(3)
        isAllowed = dayOfWeekNum === 1 || dayOfWeekNum === 2 || dayOfWeekNum === 3;
      } else if (dayFilter === 'all_weekdays') {
        // 평일 전체 월~금 (1~5)
        isAllowed = dayOfWeekNum >= 1 && dayOfWeekNum <= 5;
      } else if (dayFilter === 'weekend') {
        // 주말 토(6), 일(0)
        isAllowed = dayOfWeekNum === 0 || dayOfWeekNum === 6;
      }

      if (isAllowed) {
        const dayKorean = KOREAN_DAY_NAMES[dayOfWeekNum];
        const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const label = `${monthNum}/${day}(${dayKorean})`;

        presets.push({
          month: monthStr,
          monthKey,
          monthFullLabel,
          relativeLabel: config.relativeLabel,
          date: dateStr,
          label,
          dayOfWeek: dayKorean
        });
      }
    }
  }

  return presets;
}

// 기본 프리셋 (지금 달 기준 전달, 지금 달, 다음달 - 월화수목금토일 7일 전체)
export const QUICK_PRESET_DATES: QuickDatePreset[] = generateThreeMonthsPresets(new Date(), 'all');

export function getQuickPresetDates(
  refDate: Date = new Date(),
  dayFilter: DayFilterType = 'all'
): QuickDatePreset[] {
  return generateThreeMonthsPresets(refDate, dayFilter);
}

function getDeterministicHash(seedStr: string): number {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    const char = seedStr.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

export function createPresetTicketData(
  dateStr: string,
  mode: 'seoul' | 'mukho',
  presetList: QuickDatePreset[] = QUICK_PRESET_DATES,
  basePaymentDateTime: string = '2026-08-04T12:34',
  sequenceOffset?: number
): TicketData {
  // Find index in preset dates
  const dateIndex = presetList.findIndex((p) => p.date === dateStr);
  const baseIdx = dateIndex >= 0 ? dateIndex : 0;
  // Global index: Seoul = 0..N-1, Mukho = N..2N-1
  const globalIdx = sequenceOffset !== undefined
    ? sequenceOffset
    : (mode === 'mukho' ? baseIdx + Math.max(presetList.length, 32) : baseIdx);

  // 차표를 끊는 실제 소요 시간차(1~2분 간격)가 적용된 결제 일시 및 승차권/승인번호 계산
  const timeInfo = getSequentialTicketingTime(basePaymentDateTime, globalIdx);
  const txInfo = getSequentialTransactionDetails('82225', '10895-34', '55014482', globalIdx);

  if (mode === 'seoul') {
    return {
      productType: '기차 승차권',
      travelDate: dateStr,
      departureStation: '청량리',
      departureTime: '07:05',
      arrivalStation: '묵호',
      arrivalTime: '09:20',
      trainType: 'KTX-이음',
      trainNumber: '841',
      ticketCount: '1매',
      ticketPrefix: txInfo.ticketPrefix,
      ticketMiddleDate: timeInfo.ticketMiddleDate,
      ticketSuffix: txInfo.ticketSuffix,
      issueDate: timeInfo.issueDate,
      paymentMethod: '네이버페이',
      cardNumber: '47386795****149*(일시불)',
      approvalDate: timeInfo.approvalDate,
      approvalNumber: txInfo.approvalNumber,
      amount: 29100,
      sellerName: '한국철도공사',
      sellerTaxId: '314-82-10024',
      sellerAddress: '대전광역시 동구 중앙로 240',
      salesDate: timeInfo.salesDate,
      sellerPhone: '1588-7788'
    };
  } else {
    return {
      productType: '기차 승차권',
      travelDate: dateStr,
      departureStation: '묵호',
      departureTime: '19:11',
      arrivalStation: '서울',
      arrivalTime: '21:49',
      trainType: 'KTX-이음',
      trainNumber: '846',
      ticketCount: '1매',
      ticketPrefix: txInfo.ticketPrefix,
      ticketMiddleDate: timeInfo.ticketMiddleDate,
      ticketSuffix: txInfo.ticketSuffix,
      issueDate: timeInfo.issueDate,
      paymentMethod: '네이버페이',
      cardNumber: '47386795****149*(일시불)',
      approvalDate: timeInfo.approvalDate,
      approvalNumber: txInfo.approvalNumber,
      amount: 30700,
      sellerName: '한국철도공사',
      sellerTaxId: '314-82-10024',
      sellerAddress: '대전광역시 동구 중앙로 240',
      salesDate: timeInfo.salesDate,
      sellerPhone: '1588-7788'
    };
  }
}

