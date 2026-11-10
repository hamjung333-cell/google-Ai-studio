import React from 'react';
import { TicketData, GeneratorSettings } from '../types';
import {
  formatKoreanDate,
  formatKoreanDateTime,
  formatWon,
  formatApprovalDate,
  formatSalesDate
} from '../utils/dateUtils';

interface ReceiptPreviewProps {
  ticket: TicketData;
  settings: GeneratorSettings;
  previewRef?: React.RefObject<HTMLDivElement | null> | null;
  isExport?: boolean;
}

export const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({
  ticket,
  settings,
  previewRef,
  isExport = false
}) => {
  // Show red highlight on fixed preset items in preview, but NEVER during export or print
  const isFixedMarked = !isExport && settings.showRedBoxes !== false;

  const formattedTravelDate =
    ticket.travelDateFormatted || formatKoreanDate(ticket.travelDate);
  const formattedIssueDate =
    ticket.issueDateFormatted || formatKoreanDateTime(ticket.issueDate);
  const approvalDateDisplay =
    ticket.approvalDate || formatApprovalDate(ticket.issueDate);
  const salesDateDisplay =
    ticket.salesDate || formatSalesDate(ticket.issueDate);

  const formattedAmount = formatWon(ticket.amount);

  return (
    <div className="flex flex-col items-center shadow-xl">
      {/* Receipt Canvas */}
      <div
        ref={previewRef}
        id="receipt-card"
        className="w-[380px] bg-white text-[#111111] border border-gray-100 flex flex-col font-sans select-none overflow-hidden rounded-none"
        style={{
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Pretendard', 'Malgun Gothic', 'Noto Sans KR', sans-serif"
        }}
      >
        {/* Header */}
        <div className="pt-8 pb-3 px-6 text-center">
          <h1 className="text-[22px] font-bold text-[#000000] tracking-tight">
            승차권 영수증
          </h1>
        </div>

        {/* Top Dashed Divider */}
        <div className="my-2.5 px-6 flex items-center">
          <svg className="w-full h-[2px] overflow-visible" preserveAspectRatio="none">
            <line
              x1="0"
              y1="1"
              x2="100%"
              y2="1"
              stroke="#D1D5DB"
              strokeWidth="1.5"
              strokeDasharray="4 8"
            />
          </svg>
        </div>

        {/* Section 1: 구매 정보 */}
        <div className="px-6 pt-4 pb-1">
          <h2 className="text-[18px] font-bold text-[#000000] mb-3.5">
            구매 정보
          </h2>

          <div className="space-y-3.5 text-[15px] leading-snug">
            {/* 상품유형 */}
            <div className="flex justify-between items-center">
              <span className="text-[#666666] font-normal">상품유형</span>
              <span className="text-[#111111] font-normal">
                {ticket.productType}
              </span>
            </div>

            {/* 이용일자 (가변 - 선택한 날짜에 따라 변경) */}
            <div className="flex justify-between items-center">
              <span className="text-[#666666] font-normal">이용일자</span>
              <span className="text-[#111111] font-normal">
                {formattedTravelDate}
              </span>
            </div>

            {/* 여정정보 */}
            <div className="flex justify-between items-center">
              <span className="text-[#666666] font-normal">여정정보</span>
              <span className="text-[#111111] font-normal">
                {ticket.departureStation} {ticket.departureTime} →{' '}
                {ticket.arrivalStation} {ticket.arrivalTime}
              </span>
            </div>

            {/* 열차정보 (노선에 따라 변경) */}
            <div className="flex justify-between items-center">
              <span className="text-[#666666] font-normal">열차정보</span>
              <span className="text-[#111111] font-normal">
                {ticket.trainType} {ticket.trainNumber}
              </span>
            </div>

            {/* 매수정보 */}
            <div className="flex justify-between items-center">
              <span className="text-[#666666] font-normal">매수정보</span>
              <span className="text-[#111111] font-normal">
                {ticket.ticketCount}
              </span>
            </div>

            {/* 승차권 번호 (중간 4자리 발행월일 고정 - 빨간 표시) */}
            <div className="flex justify-between items-center">
              <span className="text-[#666666] font-normal">승차권 번호</span>
              <span className="text-[#111111] font-normal flex items-center">
                <span>{ticket.ticketPrefix}-</span>
                <span
                  className={
                    isFixedMarked
                      ? 'preview-fixed-mark border-2 border-red-600 px-1 py-0.5 rounded-xs font-semibold text-red-600 bg-red-50/40'
                      : ''
                  }
                  title="고정 항목: 승차권 번호 중간 4자리(발행월일)"
                >
                  {ticket.ticketMiddleDate}
                </span>
                <span>-{ticket.ticketSuffix}</span>
              </span>
            </div>

            {/* 발행 일시 (고정 발행일시 - 빨간 표시) */}
            <div className="flex justify-between items-center">
              <span className="text-[#666666] font-normal">발행 일시</span>
              <span
                className={
                  isFixedMarked
                    ? 'preview-fixed-mark border-2 border-red-600 px-2 py-0.5 -mr-1 rounded-xs font-semibold text-red-600 bg-red-50/40'
                    : 'text-[#111111] font-normal'
                }
                title="고정 항목: 발행 일시"
              >
                {formattedIssueDate}
              </span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="px-6 my-4">
          <div className="border-b border-[#E5E7EB]" />
        </div>

        {/* Section 2: 결제 정보 */}
        <div className="px-6 py-1">
          <h2 className="text-[18px] font-bold text-[#000000] mb-3.5">
            결제 정보
          </h2>

          <div className="space-y-3.5 text-[15px] leading-snug">
            {/* 결제방식 */}
            <div className="flex justify-between items-center">
              <span className="text-[#666666] font-normal">결제방식</span>
              <span className="text-[#111111] font-normal">
                {ticket.paymentMethod}
              </span>
            </div>

            {/* 카드번호 */}
            <div className="flex justify-between items-center">
              <span className="text-[#666666] font-normal">카드번호</span>
              <span className="text-[#111111] font-normal">
                {ticket.cardNumber}
              </span>
            </div>

            {/* 승인일자 (고정 승인일자 - 빨간 표시) */}
            <div className="flex justify-between items-center">
              <span className="text-[#666666] font-normal">승인일자</span>
              <span
                className={
                  isFixedMarked
                    ? 'preview-fixed-mark border-2 border-red-600 px-2 py-0.5 -mr-1 rounded-xs font-semibold text-red-600 bg-red-50/40'
                    : 'text-[#111111] font-normal'
                }
                title="고정 항목: 승인일자"
              >
                {approvalDateDisplay}
              </span>
            </div>

            {/* 승인번호 */}
            <div className="flex justify-between items-center">
              <span className="text-[#666666] font-normal">승인번호</span>
              <span className="text-[#111111] font-normal">
                {ticket.approvalNumber}
              </span>
            </div>

            {/* 결제금액 */}
            <div className="flex justify-between items-center">
              <span className="text-[#666666] font-normal">결제금액</span>
              <span className="text-[#111111] font-normal">
                {formattedAmount}
              </span>
            </div>

            {/* 총 영수 금액 */}
            <div className="flex justify-between items-center pt-2">
              <span className="text-[#666666] font-normal">총 영수 금액</span>
              <span className="text-[20px] font-bold text-[#000000]">
                {formattedAmount}
              </span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="px-6 my-4">
          <div className="border-b border-[#E5E7EB]" />
        </div>

        {/* Section 3: 판매자 정보 */}
        <div className="px-6 pt-1 pb-8">
          <h2 className="text-[18px] font-bold text-[#000000] mb-3.5">
            판매자 정보
          </h2>

          <div className="space-y-3.5 text-[15px] leading-snug">
            {/* 사업자 */}
            <div className="flex justify-between items-center">
              <span className="text-[#666666] font-normal">사업자</span>
              <span className="text-[#111111] font-normal">
                {ticket.sellerName}
              </span>
            </div>

            {/* 사업자번호 */}
            <div className="flex justify-between items-center">
              <span className="text-[#666666] font-normal">사업자번호</span>
              <span className="text-[#111111] font-normal">
                {ticket.sellerTaxId}
              </span>
            </div>

            {/* 주소 */}
            <div className="flex justify-between items-center">
              <span className="text-[#666666] font-normal">주소</span>
              <span className="text-[#111111] font-normal">
                {ticket.sellerAddress}
              </span>
            </div>

            {/* 판매일자 (고정 판매일자 - 빨간 표시) */}
            <div className="flex justify-between items-center">
              <span className="text-[#666666] font-normal">판매일자</span>
              <span
                className={
                  isFixedMarked
                    ? 'preview-fixed-mark border-2 border-red-600 px-2 py-0.5 -mr-1 rounded-xs font-semibold text-red-600 bg-red-50/40'
                    : 'text-[#111111] font-normal'
                }
                title="고정 항목: 판매일자"
              >
                {salesDateDisplay}
              </span>
            </div>

            {/* 대표전화 */}
            <div className="flex justify-between items-center">
              <span className="text-[#666666] font-normal">대표전화</span>
              <span className="text-[#111111] font-normal">
                {ticket.sellerPhone}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
