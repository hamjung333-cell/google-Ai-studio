import { TicketData } from '../types';

export const INITIAL_TICKET_DATA: TicketData = {
  productType: '기차 승차권',
  travelDate: '2026-08-11', // 2026년 08월 11일 (화) 이용일자
  
  departureStation: '묵호',
  departureTime: '19:11',
  arrivalStation: '서울',
  arrivalTime: '21:49',
  
  trainType: 'KTX-이음',
  trainNumber: '846',
  
  ticketCount: '1매',
  
  ticketPrefix: '82225',
  ticketMiddleDate: '0804', // 결제일(8월 4일) MMDD 100% 일치
  ticketSuffix: '10895-34',
  
  issueDate: '2026-08-04T12:34', // 결제/발행일시: 2026년 08월 04일 12:34
  
  paymentMethod: '네이버페이',
  cardNumber: '47386795****149*(일시불)',
  approvalDate: '2026.08.04', // 결제 승인일자
  approvalNumber: '55014482',
  amount: 30700,
  
  sellerName: '한국철도공사',
  sellerTaxId: '314-82-10024',
  sellerAddress: '대전광역시 동구 중앙로 240',
  salesDate: '2026년 08월 04일 12:37:20', // 결제 판매일자
  sellerPhone: '1588-7788'
};
