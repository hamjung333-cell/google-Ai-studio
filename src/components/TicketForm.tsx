import React, { useState, useMemo } from 'react';
import { TicketData, GeneratorSettings, RouteMode } from '../types';
import {
  extractMMDD,
  formatApprovalDate,
  formatSalesDate,
  getDefaultFileName,
  formatKoreanDate
} from '../utils/dateUtils';
import {
  getQuickPresetDates,
  createPresetTicketData,
  QuickDatePreset,
  DayFilterType
} from '../data/quickPresetDates';
import {
  Calendar,
  Train,
  Clock,
  Ticket,
  Download,
  RotateCcw,
  Sparkles,
  Eye,
  EyeOff,
  CreditCard,
  Building2,
  CheckCircle2,
  RefreshCw,
  MapPin,
  Check,
  Package,
  FileText,
  ChevronLeft,
  ChevronRight,
  Printer,
  CheckSquare,
  Square,
  Sliders,
  ChevronDown,
  AlertCircle
} from 'lucide-react';
import { MultiTicketPrintModal } from './MultiTicketPrintModal';

interface TicketFormProps {
  ticket: TicketData;
  onChangeTicket: (newTicket: TicketData) => void;
  settings: GeneratorSettings;
  onChangeSettings: (newSettings: GeneratorSettings) => void;
  onDownloadPng: () => void;
  onResetDefaults: () => void;
  isDownloading: boolean;
  onOpenBatchModal?: () => void;
  selectedDates: string[];
  onChangeSelectedDates: (dates: string[]) => void;
  routeMode: RouteMode;
  onChangeRouteMode: (mode: RouteMode) => void;
  onOpenMultiPrintModal: () => void;
}

const TRAIN_TYPES = [
  'KTX-이음',
  'KTX',
  'KTX-산천',
  'SRT',
  'ITX-새마을',
  'ITX-마음',
  '무궁화호',
  'ITX-청춘'
];

export const TicketForm: React.FC<TicketFormProps> = ({
  ticket,
  onChangeTicket,
  settings,
  onChangeSettings,
  onDownloadPng,
  onResetDefaults,
  isDownloading,
  onOpenBatchModal,
  selectedDates,
  onChangeSelectedDates,
  routeMode,
  onChangeRouteMode,
  onOpenMultiPrintModal
}) => {
  // Base month date: 항상 지금 달(new Date())을 기준으로 설정
  const [baseMonthDate, setBaseMonthDate] = useState<Date>(new Date());
  const [dayFilter, setDayFilter] = useState<DayFilterType>('all');

  // Dynamic 3-month presets: 전달, 지금 달, 다음달
  const presetDates = useMemo(() => {
    return getQuickPresetDates(baseMonthDate, dayFilter);
  }, [baseMonthDate, dayFilter]);

  // Group by unique months (전달, 지금 달, 다음달 3개 그룹)
  const monthGroups = useMemo(() => {
    const groups: {
      month: string;
      monthKey: string;
      monthFullLabel: string;
      relativeLabel: '전달' | '지금 달' | '다음달';
      dates: QuickDatePreset[];
    }[] = [];

    const seen = new Set<string>();
    for (const p of presetDates) {
      if (!seen.has(p.monthKey)) {
        seen.add(p.monthKey);
        groups.push({
          month: p.month,
          monthKey: p.monthKey,
          monthFullLabel: p.monthFullLabel,
          relativeLabel: p.relativeLabel,
          dates: presetDates.filter((item) => item.monthKey === p.monthKey)
        });
      }
    }
    return groups;
  }, [presetDates]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    setBaseMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setBaseMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };
  const handleResetCurrentMonth = () => {
    setBaseMonthDate(new Date());
  };

  // 3군데 일괄 동기화 (발행일시, 승차권 번호 중간 4자리 MMDD, 승인일자, 판매일자)
  const syncAllThreeDates = (targetDateStr: string, customTime?: string) => {
    const cleanDate = targetDateStr.replace(/\./g, '-');
    const [y, m, d] = cleanDate.split('-');
    const mmdd = `${m.padStart(2, '0')}${d.padStart(2, '0')}`;
    const approvalFormatted = `${y}.${m.padStart(2, '0')}.${d.padStart(2, '0')}`;

    const currentTime =
      customTime ||
      (ticket.issueDate && ticket.issueDate.includes('T')
        ? ticket.issueDate.split('T')[1].substring(0, 5)
        : '15:03');
    const newIssueDate = `${cleanDate}T${currentTime}`;

    onChangeTicket({
      ...ticket,
      issueDate: newIssueDate,
      ticketMiddleDate: mmdd,
      approvalDate: approvalFormatted,
      salesDate: formatSalesDate(newIssueDate)
    });
  };

  const handleFieldChange = (field: keyof TicketData, value: any) => {
    const updated = { ...ticket, [field]: value };

    // Auto-sync ticket middle date, approval date, and sales date when issueDate changes (3곳 일치)
    if (field === 'issueDate') {
      updated.ticketMiddleDate = extractMMDD(value);
      if (settings.autoSyncTicketNumberDate) {
        updated.approvalDate = formatApprovalDate(value);
        updated.salesDate = formatSalesDate(value);
      }
    }

    // Auto-sync issueDate and ticket middle date when approvalDate changes to keep 3곳 일치
    if (field === 'approvalDate' && typeof value === 'string') {
      const match = value.match(/^(\d{4})[.-](\d{2})[.-](\d{2})$/);
      if (match && settings.autoSyncTicketNumberDate) {
        const [, y, m, d] = match;
        updated.ticketMiddleDate = `${m}${d}`;
        const currentTime = ticket.issueDate && ticket.issueDate.includes('T')
          ? ticket.issueDate.split('T')[1].substring(0, 5)
          : '15:03';
        updated.issueDate = `${y}-${m}-${d}T${currentTime}`;
        updated.salesDate = formatSalesDate(updated.issueDate);
      }
    }

    onChangeTicket(updated);
  };

  // Helper to apply quick date & route preset to active preview
  // 이용일자(travelDate) 및 열차 노선 정보만 변경하고, 결제일 관련 4개 항목(승차권 중간 4자리, 발행일시, 승인일자, 판매일자)은 사용자가 설정한 결제일 그대로 100% 유지
  const handleApplyDatePreset = (dateStr: string, mode: RouteMode = routeMode) => {
    const effectiveMode: 'seoul' | 'mukho' = mode === 'seoul' ? 'seoul' : 'mukho';
    const presetTicket = createPresetTicketData(dateStr, effectiveMode, presetDates, ticket.issueDate);
    onChangeTicket({
      ...ticket,
      travelDate: presetTicket.travelDate,
      departureStation: presetTicket.departureStation,
      departureTime: presetTicket.departureTime,
      arrivalStation: presetTicket.arrivalStation,
      arrivalTime: presetTicket.arrivalTime,
      trainType: presetTicket.trainType,
      trainNumber: presetTicket.trainNumber,
      amount: effectiveMode === 'seoul' ? 29100 : 30700,
      // 결제일(issueDate, ticketMiddleDate, approvalDate, salesDate)은 기존 ticket의 결제일 설정값 철저히 유지
      issueDate: ticket.issueDate,
      ticketMiddleDate: ticket.ticketMiddleDate,
      approvalDate: ticket.approvalDate,
      salesDate: ticket.salesDate
    });
  };

  // Date selection click handler: DIRECT MULTI-CLICK
  const handleDateClick = (dateStr: string) => {
    // 1. Toggle selection in selectedDates
    if (selectedDates.includes(dateStr)) {
      if (selectedDates.length > 1) {
        onChangeSelectedDates(selectedDates.filter((d) => d !== dateStr));
      } else {
        // Keep at least one or allow unchecking
        onChangeSelectedDates([]);
      }
    } else {
      onChangeSelectedDates([...selectedDates, dateStr]);
    }

    // 2. Immediately update the live preview to this clicked date (결제일 유지)
    handleApplyDatePreset(dateStr, routeMode);
  };

  // Bulk selectors
  const handleSelectAllPresets = () => {
    const all = presetDates.map((p) => p.date);
    onChangeSelectedDates(all);
    if (all.length > 0 && !all.includes(ticket.travelDate)) {
      handleApplyDatePreset(all[0], routeMode);
    }
  };

  const handleClearSelectedDates = () => {
    onChangeSelectedDates([]);
  };

  const handleToggleMonthSelection = (groupDates: QuickDatePreset[]) => {
    const groupDateStrs = groupDates.map((d) => d.date);
    const isAllSelected = groupDateStrs.every((d) => selectedDates.includes(d));
    if (isAllSelected) {
      const remaining = selectedDates.filter((d) => !groupDateStrs.includes(d));
      onChangeSelectedDates(remaining);
      if (remaining.length > 0 && !remaining.includes(ticket.travelDate)) {
        handleApplyDatePreset(remaining[0], routeMode);
      }
    } else {
      const combined = Array.from(new Set([...selectedDates, ...groupDateStrs]));
      onChangeSelectedDates(combined);
      if (groupDateStrs.length > 0 && !combined.includes(ticket.travelDate)) {
        handleApplyDatePreset(groupDateStrs[0], routeMode);
      }
    }
  };

  // Generate random approval number (8 digits)
  const randomizeApprovalNumber = () => {
    const rand8 = Math.floor(10000000 + Math.random() * 90000000).toString();
    handleFieldChange('approvalNumber', rand8);
  };

  // Generate random card number
  const randomizeCardNumber = () => {
    const rand8 = Math.floor(10000000 + Math.random() * 90000000).toString();
    const rand3 = Math.floor(100 + Math.random() * 900).toString();
    const newCard = `${rand8}****${rand3}*(일시불)`;
    handleFieldChange('cardNumber', newCard);
  };

  // Generate random issue time (HH:mm)
  const randomizeIssueTime = () => {
    const datePart = ticket.issueDate ? ticket.issueDate.split('T')[0] : '2026-08-22';
    const randomHour = Math.floor(7 + Math.random() * 16).toString().padStart(2, '0');
    const randomMin = Math.floor(Math.random() * 60).toString().padStart(2, '0');
    const newDateTime = `${datePart}T${randomHour}:${randomMin}`;
    handleFieldChange('issueDate', newDateTime);
  };

  // Extract date and time parts from ticket.issueDate for the clean inputs
  const issueDatePart = ticket.issueDate && ticket.issueDate.includes('T')
    ? ticket.issueDate.split('T')[0]
    : '2026-08-22';
  const issueTimePart = ticket.issueDate && ticket.issueDate.includes('T')
    ? ticket.issueDate.split('T')[1].substring(0, 5)
    : '15:03';

  return (
    <div className="space-y-5">
      {/* ─────────────────────────────────────────────────────────────
          SECTION 1 (최상단 1): 💳 결제일 설정 (이용일자 제외 4곳 완벽 일치 연동)
          - 이용일자(탑승일)를 제외한 나머지 승차권 번호 중간 4자리(MMDD), 결제 승인일자, 판매일자, 발행일시가 결제일에 맞춰 일치됩니다.
          - 1달 규칙 완전 제거됨
         ───────────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-1.5">
                <span>1. 결제일 설정</span>
                <span className="text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                  승차권 4곳 자동 일치
                </span>
              </h2>
              <p className="text-xs text-gray-500">
                이용일자(탑승일)를 제외한 승차권 번호 중간 4자리(MMDD), 승인일자, 판매일자, 발행일시가 결제일에 맞춰 일치됩니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => syncAllThreeDates(ticket.travelDate || '2026-08-11')}
              className="px-2.5 py-1 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
              title="원할 경우 결제일을 현재 탑승일과 동일하게 맞춤"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>⚡ 결제일을 이용일({ticket.travelDate})과 동일하게 맞추기</span>
            </button>
            <button
              type="button"
              onClick={randomizeIssueTime}
              className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1"
              title="시간(시:분) 무작위 변경"
            >
              <RefreshCw className="w-3 h-3 text-gray-600" />
              <span>시간 무작위</span>
            </button>
          </div>
        </div>

        {/* Inputs for Payment Date & Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-red-50/40 p-3.5 rounded-xl border border-red-100">
          <div>
            <label className="text-xs font-bold text-gray-700 flex items-center justify-between mb-1">
              <span>결제 / 승인 일자</span>
              <span className="text-[10px] text-red-600 font-mono font-bold">YYYY-MM-DD</span>
            </label>
            <input
              type="date"
              value={issueDatePart}
              onChange={(e) => syncAllThreeDates(e.target.value, issueTimePart)}
              className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg font-mono font-bold focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none text-gray-900 shadow-2xs"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 flex items-center justify-between mb-1">
              <span>결제 / 발행 시간</span>
              <span className="text-[10px] text-red-600 font-mono font-bold">HH:mm</span>
            </label>
            <input
              type="time"
              value={issueTimePart}
              onChange={(e) => {
                const newDateTime = `${issueDatePart}T${e.target.value}`;
                handleFieldChange('issueDate', newDateTime);
              }}
              className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg font-mono font-bold focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none text-gray-900 shadow-2xs"
            />
          </div>
        </div>

        {/* Real-time 4-Place Sync Status Pill & Sequential Ticketing Time Note */}
        <div className="space-y-2">
          <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl px-3.5 py-2 text-xs flex flex-wrap items-center justify-between gap-2 text-emerald-900">
            <div className="flex items-center gap-1.5 font-medium flex-wrap">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>결제일 4곳 일치 상태:</span>
              <span className="font-mono font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                승차권 중간 [{ticket.ticketMiddleDate}]
              </span>
              <span className="text-emerald-400">·</span>
              <span className="font-mono font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                승인 [{ticket.approvalDate}]
              </span>
              <span className="text-emerald-400">·</span>
              <span className="font-mono font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                발행 [{issueDatePart} {issueTimePart}]
              </span>
              <span className="text-emerald-400">·</span>
              <span className="font-mono font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                판매 [{ticket.salesDate}]
              </span>
            </div>
            <span className="text-[11px] text-emerald-700 font-semibold ml-auto">
              ✓ 결제일 일치 완료
            </span>
          </div>

          <div className="text-[11px] text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-2 shadow-2xs">
            <Clock className="w-4 h-4 text-red-600 shrink-0" />
            <span>
              <b>다중 발권 시 실제 예매 시간차(1~2분 간격) 자동 적용:</b> 여러 날짜를 다중 선택하거나 왕복(서울↔묵호) 일괄 선택 시, 실제 차표를 끊는 시간을 고려하여 각 영수증마다 순차적인 발권 시간 및 판매일시가 자연스럽게 적용됩니다.
            </span>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2 (최상단 2): 💰 결제 정보 설정 (금액, 수단, 카드, 승인번호)
         ───────────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5 space-y-3.5">
        <div className="flex items-center gap-2.5 border-b border-gray-100 pb-3">
          <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
            <CreditCard className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-gray-900">
              2. 결제 정보
            </h2>
            <p className="text-xs text-gray-500">
              결제 금액, 결제 수단, 카드번호, 승인번호를 손쉽게 수정하세요.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 1. 결제 금액 */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-gray-700">결제 금액</label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleFieldChange('amount', 29100)}
                  className={`px-2 py-0.5 text-[11px] rounded font-bold border transition-all ${
                    ticket.amount === 29100
                      ? 'bg-red-600 text-white border-red-600 shadow-2xs'
                      : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  29,100원 (서울)
                </button>
                <button
                  type="button"
                  onClick={() => handleFieldChange('amount', 30700)}
                  className={`px-2 py-0.5 text-[11px] rounded font-bold border transition-all ${
                    ticket.amount === 30700
                      ? 'bg-red-600 text-white border-red-600 shadow-2xs'
                      : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  30,700원 (묵호)
                </button>
              </div>
            </div>
            <div className="relative">
              <input
                type="number"
                value={ticket.amount}
                onChange={(e) => handleFieldChange('amount', Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg font-bold font-mono text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none pr-8"
                placeholder="29100"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500 select-none">
                원
              </span>
            </div>
          </div>

          {/* 2. 결제 수단 */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-gray-700">결제 수단</label>
              <div className="flex items-center gap-1">
                {['네이버페이', '카카오페이', '신용카드', '토스페이'].map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => handleFieldChange('paymentMethod', method)}
                    className={`px-1.5 py-0.5 text-[11px] rounded font-medium border transition-colors ${
                      ticket.paymentMethod === method
                        ? 'bg-red-600 text-white border-red-600 font-bold'
                        : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              value={ticket.paymentMethod}
              onChange={(e) => handleFieldChange('paymentMethod', e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg font-medium text-gray-900 focus:ring-2 focus:ring-red-500 outline-none"
              placeholder="네이버페이"
            />
          </div>

          {/* 3. 카드 번호 */}
          <div className="sm:col-span-2 space-y-1.5 bg-gray-50 p-3 rounded-xl border border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                <span>카드 번호</span>
                <span className="text-[10px] text-gray-400 font-normal">(마스킹 형태)</span>
              </label>

              <div className="flex items-center gap-1 flex-wrap">
                {[
                  { label: '기본값', value: '47386795****149*(일시불)' },
                  { label: '고정 1', value: '53614892****104*(일시불)' },
                  { label: '고정 2', value: '94108215****382*(일시불)' },
                  { label: '고정 3', value: '35620941****775*(일시불)' }
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleFieldChange('cardNumber', preset.value)}
                    className={`px-2 py-0.5 text-[11px] rounded border transition-all ${
                      ticket.cardNumber === preset.value
                        ? 'bg-red-600 text-white border-red-600 font-bold shadow-2xs'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={randomizeCardNumber}
                  className="px-2 py-0.5 text-[11px] rounded border border-red-200 text-red-600 bg-white hover:bg-red-50 font-bold flex items-center gap-0.5 transition-colors"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  무작위
                </button>
              </div>
            </div>
            <input
              type="text"
              value={ticket.cardNumber}
              onChange={(e) => handleFieldChange('cardNumber', e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg font-mono font-bold text-gray-900 focus:ring-2 focus:ring-red-500 outline-none"
              placeholder="47386795****149*(일시불)"
            />
          </div>

          {/* 4. 승인 번호 */}
          <div className="sm:col-span-2 space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-gray-700">승인 번호 (8자리)</label>
              <button
                type="button"
                onClick={randomizeApprovalNumber}
                className="text-[11px] text-red-600 hover:text-red-700 font-bold hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                승인번호 무작위 생성
              </button>
            </div>
            <input
              type="text"
              value={ticket.approvalNumber}
              onChange={(e) => handleFieldChange('approvalNumber', e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg font-mono font-bold text-gray-900 focus:ring-2 focus:ring-red-500 outline-none"
              placeholder="8자리 승인번호 (e.g. 10608918)"
            />
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 3 (최상단 3): 📅 이용일 다중 클릭 선택기 ("내가 다중 클릭할 수 있게")
         ───────────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-1.5">
                <span>3. 이용일 선택</span>
                <span className="text-[11px] font-bold text-white bg-red-600 px-2 py-0.5 rounded-full">
                  다중 클릭 지원
                </span>
              </h2>
              <p className="text-xs text-gray-500">
                날짜 칩을 클릭하여 여러 날짜를 다중 선택하세요. 실시간 미리보기와 일괄 출력이 연동됩니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenBatchModal && (
              <button
                type="button"
                onClick={onOpenBatchModal}
                className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1"
                title="전체 날짜 한 번에 일괄 다운로드"
              >
                <Package className="w-3.5 h-3.5 text-red-500" />
                <span>일괄 저장 (ZIP)</span>
              </button>
            )}
          </div>
        </div>

        {/* 1. Route Mode Switcher (오전 서울 ⇄ 오후 묵호) */}
        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-gray-700">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-red-600" />
              여정 노선 선택
            </span>
            <span className="text-[11px] font-semibold text-gray-500">
              선택 시 열차번호·시간·금액이 자동 설정됩니다.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                onChangeRouteMode('seoul');
                if (ticket.travelDate) {
                  handleApplyDatePreset(ticket.travelDate, 'seoul');
                }
              }}
              className={`p-3 rounded-xl text-left border transition-all flex items-center justify-between cursor-pointer ${
                routeMode === 'seoul'
                  ? 'bg-red-600 text-white border-red-600 shadow-sm ring-2 ring-red-400/40'
                  : 'bg-white text-gray-800 border-gray-200 hover:bg-red-50/50 hover:border-red-300'
              }`}
            >
              <div>
                <div className="font-bold text-sm flex items-center gap-1.5">
                  <span>🌅 오전 서울 출발</span>
                  {routeMode === 'seoul' && <Check className="w-4 h-4 text-white" />}
                </div>
                <div className={`text-xs mt-1 ${routeMode === 'seoul' ? 'text-red-100' : 'text-gray-500'}`}>
                  청량리 07:05 → 묵호 09:20<br />(KTX-이음 841 | <b>29,100원</b>)
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                onChangeRouteMode('mukho');
                if (ticket.travelDate) {
                  handleApplyDatePreset(ticket.travelDate, 'mukho');
                }
              }}
              className={`p-3 rounded-xl text-left border transition-all flex items-center justify-between cursor-pointer ${
                routeMode === 'mukho'
                  ? 'bg-red-600 text-white border-red-600 shadow-sm ring-2 ring-red-400/40'
                  : 'bg-white text-gray-800 border-gray-200 hover:bg-red-50/50 hover:border-red-300'
              }`}
            >
              <div>
                <div className="font-bold text-sm flex items-center gap-1.5">
                  <span>🌆 오후 묵호 출발</span>
                  {routeMode === 'mukho' && <Check className="w-4 h-4 text-white" />}
                </div>
                <div className={`text-xs mt-1 ${routeMode === 'mukho' ? 'text-red-100' : 'text-gray-500'}`}>
                  묵호 19:11 → 서울 21:49<br />(KTX-이음 846 | <b>30,700원</b>)
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                onChangeRouteMode('both');
                if (ticket.travelDate) {
                  handleApplyDatePreset(ticket.travelDate, 'both');
                }
              }}
              className={`p-3 rounded-xl text-left border transition-all flex items-center justify-between cursor-pointer ${
                routeMode === 'both'
                  ? 'bg-red-600 text-white border-red-600 shadow-sm ring-2 ring-red-400/40'
                  : 'bg-white text-gray-800 border-gray-200 hover:bg-red-50/50 hover:border-red-300'
              }`}
            >
              <div>
                <div className="font-bold text-sm flex items-center gap-1.5">
                  <span>🔄 왕복 둘 다 한 번에</span>
                  {routeMode === 'both' && <Check className="w-4 h-4 text-white" />}
                </div>
                <div className={`text-xs mt-1 ${routeMode === 'both' ? 'text-red-100' : 'text-gray-500'}`}>
                  <b>서울 ➔ 묵호 및 묵호 ➔ 서울</b><br />(선택 일자당 2장씩 자동 생성)
                </div>
              </div>
            </button>
          </div>

          {routeMode === 'both' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-950 flex items-center gap-2">
              <span className="font-bold text-red-700 shrink-0">✓ 왕복 둘 다 생성:</span>
              <span>
                선택한 각 날짜마다 [오전 서울 ➔ 묵호]와 [오후 묵호 ➔ 서울] 2장의 승차권이 <b>차표 끊는 시간차(1~2분 간격)</b>를 두고 한 번에 출력·저장됩니다.
              </span>
            </div>
          )}
        </div>

        {/* 2. Month Navigation & Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 bg-gray-50 p-2.5 rounded-xl border border-gray-200 text-xs">
          {/* Month shift */}
          <div className="flex items-center gap-1 bg-white px-1.5 py-1 rounded-lg border border-gray-300 shadow-2xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 hover:bg-gray-100 rounded text-gray-600"
              title="전달로 이동"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetCurrentMonth}
              className="px-2 py-0.5 font-bold text-red-600 hover:text-red-700"
              title="지금 달 기준으로 복귀"
            >
              지금 달 기준
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 hover:bg-gray-100 rounded text-gray-600"
              title="다음달로 이동"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Day filter */}
          <div className="flex flex-wrap items-center gap-1 bg-white p-0.5 rounded-lg border border-gray-300 shadow-2xs">
            <button
              type="button"
              onClick={() => setDayFilter('all')}
              className={`px-2.5 py-1 rounded-md font-bold text-xs transition-colors ${
                dayFilter === 'all'
                  ? 'bg-red-600 text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              전체 (월~일)
            </button>
            <button
              type="button"
              onClick={() => setDayFilter('all_weekdays')}
              className={`px-2.5 py-1 rounded-md font-bold text-xs transition-colors ${
                dayFilter === 'all_weekdays'
                  ? 'bg-red-600 text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              평일 (월~금)
            </button>
            <button
              type="button"
              onClick={() => setDayFilter('weekend')}
              className={`px-2.5 py-1 rounded-md font-bold text-xs transition-colors ${
                dayFilter === 'weekend'
                  ? 'bg-red-600 text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              주말 (토·일)
            </button>
            <button
              type="button"
              onClick={() => setDayFilter('mon_wed')}
              className={`px-2.5 py-1 rounded-md font-bold text-xs transition-colors ${
                dayFilter === 'mon_wed'
                  ? 'bg-red-600 text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              월·화·수
            </button>
          </div>

          {/* Bulk select & status */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 font-bold">
              <span className="text-gray-600">선택:</span>
              <span className="bg-red-600 text-white px-2 py-0.5 rounded-md font-mono text-xs">
                {selectedDates.length}개
              </span>
            </div>
            <button
              type="button"
              onClick={handleSelectAllPresets}
              className="px-2 py-1 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded font-medium text-xs transition-colors"
            >
              전체 선택
            </button>
            <button
              type="button"
              onClick={handleClearSelectedDates}
              className="px-2 py-1 bg-white hover:bg-gray-100 text-gray-500 border border-gray-300 rounded font-medium text-xs transition-colors"
            >
              선택 해제
            </button>
          </div>
        </div>

        {/* 3. 3-Month Date Chips (전달 · 지금 달 · 다음달) */}
        <div className="space-y-3">
          {monthGroups.map((group) => {
            const isCurrent = group.relativeLabel === '지금 달';
            const groupSelectedCount = group.dates.filter((d) => selectedDates.includes(d.date)).length;
            const isAllGroupSelected =
              groupSelectedCount === group.dates.length && group.dates.length > 0;

            return (
              <div
                key={group.monthKey}
                className={`p-3.5 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-red-50/30 border-red-200 ring-1 ring-red-300/40'
                    : 'bg-gray-50/60 border-gray-200'
                } space-y-2.5`}
              >
                <div className="flex items-center justify-between text-xs font-bold">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        group.relativeLabel === '지금 달'
                          ? 'bg-red-600 text-white'
                          : group.relativeLabel === '전달'
                          ? 'bg-gray-200 text-gray-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {group.relativeLabel}
                    </span>
                    <span className="text-gray-900 text-sm font-bold">{group.monthFullLabel}</span>
                    <span className="text-gray-400 font-normal text-xs">
                      ({group.dates.length}일)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleMonthSelection(group.dates)}
                    className="text-xs font-medium text-gray-600 hover:text-gray-900 px-2 py-0.5 bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors shadow-2xs"
                  >
                    {isAllGroupSelected ? '월 전체 해제' : '월 전체 선택'} ({groupSelectedCount}/{group.dates.length})
                  </button>
                </div>

                {/* Date Chips: DIRECT MULTI-CLICKABLE */}
                <div className="flex flex-wrap gap-2">
                  {group.dates.map((p) => {
                    const isChecked = selectedDates.includes(p.date);
                    const isPreviewActive = ticket.travelDate === p.date;
                    const isSunday = p.dayOfWeek === '일';
                    const isSaturday = p.dayOfWeek === '토';

                    return (
                      <button
                        key={p.date}
                        type="button"
                        onClick={() => handleDateClick(p.date)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs border ${
                          isChecked
                            ? 'bg-red-600 text-white border-red-600 ring-2 ring-red-400/40 shadow-sm'
                            : isPreviewActive
                            ? 'bg-red-50 text-red-700 border-red-400 ring-2 ring-red-300'
                            : isSunday
                            ? 'bg-white hover:bg-rose-50 text-gray-800 border-rose-200 hover:border-rose-300'
                            : isSaturday
                            ? 'bg-white hover:bg-blue-50 text-gray-800 border-blue-200 hover:border-blue-300'
                            : 'bg-white hover:bg-gray-100 text-gray-800 border-gray-300 hover:border-gray-400'
                        }`}
                        title="클릭하여 다중 선택 및 실시간 미리보기"
                      >
                        {/* Checkbox indicator */}
                        <span
                          className={`w-3.5 h-3.5 rounded flex items-center justify-center transition-colors shrink-0 ${
                            isChecked
                              ? 'bg-white text-red-600 shadow-2xs'
                              : 'border border-gray-400 bg-gray-50'
                          }`}
                        >
                          {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <span>{p.label.split('(')[0]}</span>
                          <span
                            className={`text-[11px] font-bold ${
                              isChecked
                                ? 'text-white'
                                : isSunday
                                ? 'text-rose-600'
                                : isSaturday
                                ? 'text-blue-600'
                                : 'text-gray-500'
                            }`}
                          >
                            ({p.dayOfWeek})
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* 4. Action Bar for Multi-Date Output (A4 PDF & ZIP) */}
        {selectedDates.length > 0 && (
          <div className="bg-gradient-to-r from-red-600 to-rose-700 text-white rounded-xl p-3.5 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="space-y-0.5 text-center sm:text-left">
              <div className="font-bold text-sm flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
                <Printer className="w-4 h-4 text-white" />
                <span>
                  선택한 <b>{selectedDates.length}개 날짜</b> (총 <b>{routeMode === 'both' ? selectedDates.length * 2 : selectedDates.length}장</b>
                  {routeMode === 'both' ? ': 서울>묵호 + 묵호>서울 왕복' : routeMode === 'seoul' ? ': 서울 출발' : ': 묵호 출발'}) 다중 출력 준비
                </span>
              </div>
              <p className="text-xs text-red-100">
                차표 끊는 시간차(1~2분 간격)가 자동 적용된 승차권을 <b>A4 PDF/인쇄</b>하거나 <b>바탕화면에 ZIP 파일</b>로 일괄 저장할 수 있습니다.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onOpenMultiPrintModal}
                className="px-3.5 py-2 bg-white text-red-700 hover:bg-red-50 font-bold rounded-lg text-xs shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-red-600" />
                <span>선택 {routeMode === 'both' ? selectedDates.length * 2 : selectedDates.length}장 A4 일괄 인쇄 (PDF)</span>
              </button>
              <button
                type="button"
                onClick={onOpenMultiPrintModal}
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Package className="w-3.5 h-3.5 text-red-400" />
                <span>선택 {routeMode === 'both' ? selectedDates.length * 2 : selectedDates.length}장 ZIP 저장</span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 4 (하단 접이식): ⚙️ 기타 상세 설정 (열차 세부, 파일명, 판매자 정보)
         ───────────────────────────────────────────────────────────── */}
      <details className="group bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <summary className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between text-xs font-bold text-gray-700 select-none transition-colors">
          <span className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-gray-500" />
            <span>기타 상세 설정 (열차 노선 세부, 저장 파일명, 판매자 정보, 미리보기 설정)</span>
          </span>
          <ChevronDown className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" />
        </summary>

        <div className="p-4 sm:p-5 border-t border-gray-100 space-y-4 bg-gray-50/40 text-xs">
          {/* 열차 상세 정보 */}
          <div className="space-y-2 bg-white p-3.5 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-800 flex items-center gap-1.5">
                <Train className="w-4 h-4 text-red-600" />
                열차 종류 및 구간 상세
              </span>
              <button
                type="button"
                onClick={() => {
                  onChangeTicket({
                    ...ticket,
                    departureStation: ticket.arrivalStation,
                    arrivalStation: ticket.departureStation,
                    departureTime: ticket.arrivalTime,
                    arrivalTime: ticket.departureTime
                  });
                }}
                className="px-2 py-0.5 text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 font-medium transition-colors"
              >
                출발 ⇄ 도착 전환
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-gray-600">출발역</label>
                <input
                  type="text"
                  value={ticket.departureStation}
                  onChange={(e) => handleFieldChange('departureStation', e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-600">출발시간</label>
                <input
                  type="text"
                  value={ticket.departureTime}
                  onChange={(e) => handleFieldChange('departureTime', e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-600">도착역</label>
                <input
                  type="text"
                  value={ticket.arrivalStation}
                  onChange={(e) => handleFieldChange('arrivalStation', e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-600">도착시간</label>
                <input
                  type="text"
                  value={ticket.arrivalTime}
                  onChange={(e) => handleFieldChange('arrivalTime', e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div>
                <label className="text-[11px] font-bold text-gray-600">열차 종류</label>
                <select
                  value={ticket.trainType}
                  onChange={(e) => handleFieldChange('trainType', e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium"
                >
                  {TRAIN_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-600">열차 번호</label>
                <input
                  type="text"
                  value={ticket.trainNumber}
                  onChange={(e) => handleFieldChange('trainNumber', e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-bold font-mono"
                  placeholder="841"
                />
              </div>
            </div>
          </div>

          {/* 저장 파일명 설정 */}
          <div className="space-y-1.5 bg-white p-3.5 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between">
              <label className="font-bold text-gray-800 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-red-600" />
                <span>저장 파일명 수정 (개별 PNG 저장 시)</span>
              </label>
              <button
                type="button"
                onClick={() => handleFieldChange('customFileName', '')}
                className="text-[11px] text-gray-500 hover:text-red-600 underline font-medium"
              >
                기본 포맷({getDefaultFileName(ticket)})으로 초기화
              </button>
            </div>
            <div className="relative">
              <input
                type="text"
                value={
                  ticket.customFileName !== undefined
                    ? ticket.customFileName
                    : getDefaultFileName(ticket)
                }
                onChange={(e) => handleFieldChange('customFileName', e.target.value)}
                placeholder={getDefaultFileName(ticket)}
                className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-300 rounded-lg font-mono font-bold focus:bg-white focus:ring-2 focus:ring-red-500 outline-none text-gray-900 pr-14"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 select-none">
                .png
              </span>
            </div>
          </div>

          {/* 미리보기 및 해상도 설정 */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-gray-200">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700">
              <input
                type="checkbox"
                checked={settings.showRedBoxes}
                onChange={(e) =>
                  onChangeSettings({
                    ...settings,
                    showRedBoxes: e.target.checked
                  })
                }
                className="w-4 h-4 accent-red-600 rounded text-red-600 focus:ring-red-500"
              />
              <span className="flex items-center gap-1">
                {settings.showRedBoxes ? (
                  <Eye className="w-3.5 h-3.5 text-red-600" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5 text-gray-400" />
                )}
                <span>미리보기 고정 항목 빨간색 표시 (출력 시 자동 제외)</span>
              </span>
            </label>

            <div className="flex items-center gap-1.5 text-gray-600">
              <span className="font-medium">저장 해상도:</span>
              {[1, 2, 3].map((scale) => (
                <button
                  key={scale}
                  type="button"
                  onClick={() => onChangeSettings({ ...settings, exportScale: scale })}
                  className={`px-2 py-0.5 rounded font-mono font-bold transition-colors ${
                    settings.exportScale === scale
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {scale}x
                </button>
              ))}
            </div>
          </div>

          {/* 판매자 정보 */}
          <div className="bg-white p-3.5 rounded-xl border border-gray-200 space-y-2">
            <span className="font-bold text-gray-800 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-gray-600" />
              판매자 정보 (사업자번호, 상호 등)
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-500">사업자명</label>
                <input
                  type="text"
                  value={ticket.sellerName}
                  onChange={(e) => handleFieldChange('sellerName', e.target.value)}
                  className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500">사업자번호</label>
                <input
                  type="text"
                  value={ticket.sellerTaxId}
                  onChange={(e) => handleFieldChange('sellerTaxId', e.target.value)}
                  className="w-full px-2 py-1 border border-gray-200 rounded text-xs font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
};
