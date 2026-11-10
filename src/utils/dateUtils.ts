const KOREAN_DAYS = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * Format date string (YYYY-MM-DD) to Korean format: "2026년 08월 11일 (화)"
 */
export function formatKoreanDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return dateStr;

    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = KOREAN_DAYS[dateObj.getDay()];

    const paddedMonth = String(month).padStart(2, '0');
    const paddedDay = String(day).padStart(2, '0');

    return `${year}년 ${paddedMonth}월 ${paddedDay}일 (${dayOfWeek})`;
  } catch (e) {
    return dateStr;
  }
}

/**
 * Format datetime string (YYYY-MM-DDTHH:mm) to Korean format: "2026년 08월 04일 (화) 12:34"
 */
export function formatKoreanDateTime(dateTimeStr: string): string {
  if (!dateTimeStr) return '';
  try {
    const [datePart, timePart] = dateTimeStr.split('T');
    if (!datePart) return dateTimeStr;

    const [year, month, day] = datePart.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = KOREAN_DAYS[dateObj.getDay()];

    const paddedMonth = String(month).padStart(2, '0');
    const paddedDay = String(day).padStart(2, '0');

    const formattedTime = timePart ? timePart.substring(0, 5) : '12:00';

    return `${year}년 ${paddedMonth}월 ${paddedDay}일 (${dayOfWeek}) ${formattedTime}`;
  } catch (e) {
    return dateTimeStr;
  }
}

/**
 * Extract MMDD from ISO date string (YYYY-MM-DD or YYYY-MM-DDTHH:mm)
 */
export function extractMMDD(dateTimeStr: string): string {
  if (!dateTimeStr) return '0822';
  try {
    const datePart = dateTimeStr.split('T')[0];
    const parts = datePart.split('-');
    if (parts.length >= 3) {
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${month}${day}`;
    }
    return '0822';
  } catch (e) {
    return '0822';
  }
}

/**
 * Format YYYY.MM.DD for approval date
 */
export function formatApprovalDate(dateTimeStr: string): string {
  if (!dateTimeStr) return '2026.08.22';
  try {
    const datePart = dateTimeStr.split('T')[0];
    const [y, m, d] = datePart.split('-');
    if (y && m && d) {
      return `${y}.${m.padStart(2, '0')}.${d.padStart(2, '0')}`;
    }
    return '2026.08.22';
  } catch (e) {
    return '2026.08.22';
  }
}

/**
 * Format sales date e.g. "2026년 08월 22일 15:03:25" from ISO datetime string
 */
export function formatSalesDate(dateTimeStr: string): string {
  if (!dateTimeStr) return '2026년 08월 22일 15:03:25';
  try {
    const [datePart, timePart] = dateTimeStr.split('T');
    if (!datePart) return '2026년 08월 22일 15:03:25';
    const [y, m, d] = datePart.split('-');
    const paddedM = m.padStart(2, '0');
    const paddedD = d.padStart(2, '0');
    
    let time = '15:03:25';
    if (timePart) {
      const parts = timePart.split(':');
      const hh = parts[0].padStart(2, '0');
      const mm = parts[1] ? parts[1].padStart(2, '0') : '00';
      const ss = parts[2] ? parts[2].padStart(2, '0') : '25';
      time = `${hh}:${mm}:${ss}`;
    }
    return `${y}년 ${paddedM}월 ${paddedD}일 ${time}`;
  } catch (e) {
    return '2026년 08월 22일 15:03:25';
  }
}

/**
 * Number to Korean Won currency string (e.g. 27400 -> "27,400원")
 */
export function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

/**
 * Generate default filename e.g. "서울_0810" or "묵호_0810"
 */
export function getDefaultFileName(ticket: { travelDate: string; departureStation: string }): string {
  if (!ticket) return '서울_0810';
  const datePart = (ticket.travelDate || '2026-08-10').split('T')[0];
  const parts = datePart.split('-');
  let mmdd = '0810';
  if (parts.length >= 3) {
    mmdd = `${parts[1].padStart(2, '0')}${parts[2].padStart(2, '0')}`;
  }
  const isMukho = ticket.departureStation?.includes('묵호');
  const tag = isMukho ? '묵호' : '서울';
  return `${tag}_${mmdd}`;
}

export interface KtxBookingRuleResult {
  isValid: boolean; // 1달 규정 준수 여부 (당일 ~ 1달 전 범위 내이면 true)
  isSameDate: boolean; // 당일 예매
  isAdvanceBooking: boolean; // 1달 이내 정상 사전 예매 (예: 10월 2일 결제 -> 10월 22일 탑승)
  isExceedOneMonth: boolean; // 1달 초과 규칙 불일치 에러 (예: 9월 2일 결제 -> 10월 22일 탑승)
  isPaymentAfterTravel: boolean; // 탑승일 이후 결제 에러
  diffDays: number; // 탑승일 - 결제일 일수
  oneMonthBeforeLimit: string; // 예매 가능 시작일 (예: 2026-09-22)
  paymentDateStr: string;
  travelDateStr: string;
  severity: 'none' | 'error';
  errorMessage: string | null;
  statusBadgeText: string;
}

/**
 * 탑승일 기준 정확히 1달(1개월) 전 날짜 계산
 * 예: 10월 22일 탑승일 -> 1달 전은 9월 22일
 */
export function getOneMonthBeforeDate(dateStr: string): string {
  try {
    const clean = (dateStr || '').split('T')[0];
    const [y, m, d] = clean.split('-').map(Number);
    if (!y || !m || !d) return clean;

    let prevYear = y;
    let prevMonth = m - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = y - 1;
    }

    // 이전 달의 말일 계산 (예: 9월은 30일)
    const daysInPrevMonth = new Date(prevYear, prevMonth, 0).getDate();
    const prevDay = Math.min(d, daysInPrevMonth);

    return `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevDay).padStart(2, '0')}`;
  } catch (e) {
    return dateStr;
  }
}

/**
 * KTX 승차권 1달 전 예약 규정 검증
 * - KTX 규정: 승차권은 열차 탑승일 기준 1개월 전(오전 7시)부터 당일까지 예매 가능
 * - [정상 예시] 결제일: 10월 2일, 탑승일: 10월 22일 -> 탑승 20일 전으로 1달 규정 내 정상 예매 (에러 아님!)
 * - [불일치 에러 예시] 결제일: 9월 2일, 탑승일: 10월 22일 -> 1달 전(9월 22일)보다 이전이므로 1달 규칙 불일치 에러!
 */
export function validateKtxBookingDates(issueDateISO: string, travelDateISO: string): KtxBookingRuleResult {
  const paymentDateStr = (issueDateISO || '').split('T')[0];
  const travelDateStr = (travelDateISO || '').split('T')[0];

  if (!paymentDateStr || !travelDateStr) {
    return {
      isValid: true,
      isSameDate: true,
      isAdvanceBooking: false,
      isExceedOneMonth: false,
      isPaymentAfterTravel: false,
      diffDays: 0,
      oneMonthBeforeLimit: '',
      paymentDateStr,
      travelDateStr,
      severity: 'none',
      errorMessage: null,
      statusBadgeText: '정상'
    };
  }

  const [pY, pM, pD] = paymentDateStr.split('-').map(Number);
  const [tY, tM, tD] = travelDateStr.split('-').map(Number);

  const pDate = new Date(pY, pM - 1, pD);
  const tDate = new Date(tY, tM - 1, tD);

  const diffTime = tDate.getTime() - pDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  const oneMonthBeforeStr = getOneMonthBeforeDate(travelDateStr);
  const [obY, obM, obD] = oneMonthBeforeStr.split('-').map(Number);
  const obDate = new Date(obY, obM - 1, obD);

  // 1. 당일 결제 & 당일 탑승
  if (paymentDateStr === travelDateStr) {
    return {
      isValid: true,
      isSameDate: true,
      isAdvanceBooking: false,
      isExceedOneMonth: false,
      isPaymentAfterTravel: false,
      diffDays: 0,
      oneMonthBeforeLimit: oneMonthBeforeStr,
      paymentDateStr,
      travelDateStr,
      severity: 'none',
      errorMessage: null,
      statusBadgeText: '당일 예매 (정상)'
    };
  }

  // 2. 결제 날짜가 탑승일 이후인 경우 (시간 역전 오류)
  if (pDate > tDate) {
    return {
      isValid: false,
      isSameDate: false,
      isAdvanceBooking: false,
      isExceedOneMonth: false,
      isPaymentAfterTravel: true,
      diffDays,
      oneMonthBeforeLimit: oneMonthBeforeStr,
      paymentDateStr,
      travelDateStr,
      severity: 'error',
      errorMessage: `결제 날짜(${paymentDateStr})가 탑승일(${travelDateStr})보다 늦습니다. KTX 승차권은 열차 탑승일 이후에 결제할 수 없습니다.`,
      statusBadgeText: '시간 역전 오류'
    };
  }

  // 3. 탑승일 1달(1개월) 전 규정 초과 (너무 일찍 예매, 예: 9월 2일 결제 -> 10월 22일 탑승)
  if (pDate < obDate) {
    return {
      isValid: false,
      isSameDate: false,
      isAdvanceBooking: false,
      isExceedOneMonth: true,
      isPaymentAfterTravel: false,
      diffDays,
      oneMonthBeforeLimit: oneMonthBeforeStr,
      paymentDateStr,
      travelDateStr,
      severity: 'error',
      errorMessage: `🚫 KTX 1달 예매 규칙 불일치: 탑승일(${travelDateStr}) 승차권은 1개월 전(${oneMonthBeforeStr})부터만 예매 가능합니다. (${paymentDateStr} 결제는 탑승 ${diffDays}일 전으로 1달 규정 위반입니다.)`,
      statusBadgeText: '1달 규칙 불일치 에러'
    };
  }

  // 4. 탑승일 1개월 이내 정상 사전 예매 (예: 10월 2일 결제 -> 10월 22일 탑승)
  // 이는 정상적인 KTX 예매이므로 에러나 경고가 아닙니다!
  return {
    isValid: true,
    isSameDate: false,
    isAdvanceBooking: true,
    isExceedOneMonth: false,
    isPaymentAfterTravel: false,
    diffDays,
    oneMonthBeforeLimit: oneMonthBeforeStr,
    paymentDateStr,
    travelDateStr,
    severity: 'none',
    errorMessage: null,
    statusBadgeText: `KTX 정상 사전예매 (${diffDays}일 전 예매, 1달 규정 일치)`
  };
}

/**
 * 다중 발권 시 실제 예매/결제 소요 시간(1~3분 간격)을 고려하여
 * 발권 순서(sequenceIndex)에 따라 차표를 끊는 시간을 자연스럽게 차등 적용
 * 
 * @param baseIssueDateISO 기준 결제일시 (예: "2026-08-04T12:34")
 * @param sequenceIndex 발권 순번 (0, 1, 2, ...)
 * @returns { issueDate, salesDate, ticketMiddleDate, approvalDate }
 */
export function getSequentialTicketingTime(
  baseIssueDateISO: string,
  sequenceIndex: number = 0
): {
  issueDate: string;
  salesDate: string;
  ticketMiddleDate: string;
  approvalDate: string;
} {
  const cleanIso = baseIssueDateISO || '2026-08-04T12:34';
  const [datePart, timePart = '12:34'] = cleanIso.split('T');
  const [y = '2026', m = '08', d = '04'] = datePart.split('-');
  const [hh = '12', mm = '34'] = timePart.split(':');

  const baseHour = parseInt(hh, 10) || 12;
  const baseMinute = parseInt(mm, 10) || 34;

  const mmdd = `${m.padStart(2, '0')}${d.padStart(2, '0')}`;
  const approvalDate = `${y}.${m.padStart(2, '0')}.${d.padStart(2, '0')}`;

  if (sequenceIndex <= 0) {
    return {
      issueDate: `${datePart}T${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`,
      salesDate: `${y}년 ${m.padStart(2, '0')}월 ${d.padStart(2, '0')}일 ${hh.padStart(2, '0')}:${mm.padStart(2, '0')}:20`,
      ticketMiddleDate: mmdd,
      approvalDate
    };
  }

  // 순번에 따른 누적 예매 소요 초 계산 (각 티켓당 약 1분 15초 ~ 2분 15초 간격)
  let cumulativeSeconds = 20;
  for (let i = 1; i <= sequenceIndex; i++) {
    const stepSeed = (i * 47 + 23) % 61;
    const gapSeconds = 75 + stepSeed; // 75초 ~ 135초 (1분 15초 ~ 2분 15초)
    cumulativeSeconds += gapSeconds;
  }

  const addedMinutes = Math.floor(cumulativeSeconds / 60);
  const remainingSeconds = cumulativeSeconds % 60;

  const totalMinutes = baseMinute + addedMinutes;
  const finalHour = (baseHour + Math.floor(totalMinutes / 60)) % 24;
  const finalMinute = totalMinutes % 60;

  const hhStr = String(finalHour).padStart(2, '0');
  const mmStr = String(finalMinute).padStart(2, '0');
  const ssStr = String(remainingSeconds).padStart(2, '0');

  const issueDate = `${datePart}T${hhStr}:${mmStr}`;
  const salesDate = `${y}년 ${m.padStart(2, '0')}월 ${d.padStart(2, '0')}일 ${hhStr}:${mmStr}:${ssStr}`;

  return {
    issueDate,
    salesDate,
    ticketMiddleDate: mmdd,
    approvalDate
  };
}

/**
 * 순번에 따라 자연스럽게 달라지는 승차권 접미번호 및 승인번호 생성
 */
export function getSequentialTransactionDetails(
  basePrefix: string = '82225',
  baseSuffix: string = '10895-34',
  baseApproval: string = '55014482',
  sequenceIndex: number = 0
): {
  ticketPrefix: string;
  ticketSuffix: string;
  approvalNumber: string;
} {
  if (sequenceIndex <= 0) {
    return {
      ticketPrefix: basePrefix,
      ticketSuffix: baseSuffix,
      approvalNumber: baseApproval
    };
  }

  // suffix: 10895-34 -> 순번에 따라 +1씩 자연스럽게 증가
  const parts = baseSuffix.split('-');
  const part1Num = parseInt(parts[0], 10) || 10895;
  const part2Num = parseInt(parts[1], 10) || 34;

  const nextPart1 = part1Num + sequenceIndex;
  const nextPart2 = (part2Num + sequenceIndex) % 100;
  const ticketSuffix = `${nextPart1}-${String(nextPart2).padStart(2, '0')}`;

  // approval: 55014482 -> 순번에 따라 +11씩 증가
  const approvalBase = parseInt(baseApproval, 10) || 55014482;
  const nextApproval = String(approvalBase + sequenceIndex * 11);

  return {
    ticketPrefix: basePrefix,
    ticketSuffix,
    approvalNumber: nextApproval
  };
}

