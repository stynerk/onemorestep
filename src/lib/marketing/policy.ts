export const marketingChannels = [
  { id: "email", label: "수신 동의 이메일", format: "제목 · 본문 5~8줄 · 행동 유도 1개" },
  { id: "linkedin", label: "LinkedIn", format: "1,300자 이내 · 해시태그 최대 3개" },
  { id: "facebook", label: "Facebook", format: "본문 3~4문장 · 링크 자리" },
  { id: "instagram", label: "Instagram", format: "캡션 2,200자 이내 · 이미지 문구 1줄 · 해시태그 최대 5개" },
  { id: "blog", label: "블로그", format: "제목 · 소제목 3개 · 도입 단락" },
] as const;

export type ChannelId = (typeof marketingChannels)[number]["id"];

export const marketingPriority = {
  weights: { deal: 40, deadline: 30, region: 20, repeat: 10 },
  stage: { "없음": 0, "문의": 0.3, "견적": 0.6, "입찰·협상": 1 },
  dealSize: { "없음": 0, "소": 0.3, "중": 0.6, "대": 1 },
  deadlines: [
    { days: 7, factor: 1, reason: "7일 이내 마감" },
    { days: 14, factor: 0.7, reason: "14일 이내 마감" },
    { days: 30, factor: 0.4, reason: "30일 이내 마감" },
  ],
  laterDeadlineFactor: 0.1,
  region: { APAC: 1, EU: 0.8, NA: 0.8, "전 지역": 0.8, LATAM: 0.5, MEA: 0.5 },
  repeat: { windowDays: 90, factorPerRequest: 0.5, maximumFactor: 1 },
} as const;

export type MarketingRequest = {
  id: string;
  title: string;
  requester: string;
  topic: string;
  receivedDaysAgo: number;
  region: keyof typeof marketingPriority.region;
  stage: keyof typeof marketingPriority.stage;
  dealSize: keyof typeof marketingPriority.dealSize;
  deadlineDays: number | null;
  recommendedChannels: readonly ChannelId[];
  reviewMemo?: string;
};

export const marketingRequests: readonly MarketingRequest[] = [
  { id: "M01", title: "독일 대학병원 입찰용 PM-50 도입 사례 자료와 LinkedIn 소개", requester: "본사 세일즈 · 유럽 담당", topic: "PM-50:사례 자료", receivedDaysAgo: 3, region: "EU", stage: "입찰·협상", dealSize: "대", deadlineDays: 5, recommendedChannels: ["linkedin", "email", "blog"], reviewMemo: "PM-50은 안전성을 보장합니다." },
  { id: "M02", title: "일본 의료기기 전시회 참가 홍보", requester: "본사 세일즈 · 아시아 담당", topic: "japan-exhibition", receivedDaysAgo: 12, region: "APAC", stage: "문의", dealSize: "중", deadlineDays: 20, recommendedChannels: ["linkedin", "facebook", "instagram"] },
  { id: "M03", title: "PM-50 출시 소개(유럽 담당자)", requester: "본사 세일즈 · 유럽 담당", topic: "PM-50:신제품 소개", receivedDaysAgo: 23, region: "전 지역", stage: "없음", dealSize: "없음", deadlineDays: null, recommendedChannels: ["linkedin", "blog"] },
  { id: "M04", title: "미국 병원 그룹 견적 단계, US-200 비교 자료", requester: "본사 세일즈 · 북미 담당", topic: "US-200:사례 자료", receivedDaysAgo: 5, region: "NA", stage: "견적", dealSize: "중", deadlineDays: 10, recommendedChannels: ["email", "blog"] },
  { id: "M05", title: "멕시코 치과 IS-3 캠페인", requester: "본사 세일즈 · 중남미 담당", topic: "IS-3:캠페인", receivedDaysAgo: 13, region: "LATAM", stage: "견적", dealSize: "소", deadlineDays: 25, recommendedChannels: ["facebook", "instagram", "email"] },
  { id: "M06", title: "중동 공공병원 입찰, 기관 소개 자료", requester: "본사 세일즈 · 중동 담당", topic: "mea-tender", receivedDaysAgo: 7, region: "MEA", stage: "입찰·협상", dealSize: "대", deadlineDays: 40, recommendedChannels: ["email", "blog"] },
  { id: "M07", title: "PM-50 출시 소개(아시아 담당자)", requester: "본사 세일즈 · 아시아 담당", topic: "PM-50:신제품 소개", receivedDaysAgo: 2, region: "APAC", stage: "없음", dealSize: "없음", deadlineDays: null, recommendedChannels: ["linkedin", "instagram", "blog"] },
  { id: "M08", title: "국내 병원 고객 사례 블로그", requester: "본사 세일즈 · 국내 담당", topic: "korea-hospital-case", receivedDaysAgo: 1, region: "APAC", stage: "없음", dealSize: "없음", deadlineDays: null, recommendedChannels: ["blog", "linkedin"] },
];

function scoreRequest(request: MarketingRequest, requests: readonly MarketingRequest[]) {
  const { weights, stage, dealSize, deadlines, laterDeadlineFactor, region, repeat } = marketingPriority;
  const { deadlineDays } = request;
  const deadline = deadlineDays === null ? undefined : deadlines.find((tier) => deadlineDays <= tier.days);
  const repeats = requests.filter((other) => other.id !== request.id && other.topic === request.topic
    && Math.abs(other.receivedDaysAgo - request.receivedDaysAgo) <= repeat.windowDays).map((other) => other.id);
  const repeatFactor = Math.min(repeats.length * repeat.factorPerRequest, repeat.maximumFactor);
  const reasons = [
    { label: "딜 규모·단계", points: weights.deal * (stage[request.stage] + dealSize[request.dealSize]) / 2, reason: request.stage === "없음" && request.dealSize === "없음" ? "연결된 딜 단계·규모 없음" : request.stage + " · " + request.dealSize + " 규모" },
    { label: "마감일", points: weights.deadline * (deadline?.factor ?? laterDeadlineFactor), reason: deadlineDays === null ? "마감일 미지정"
      : deadlineDays < 0 ? Math.abs(deadlineDays) + "일 지남" : deadlineDays + "일 남음 · " + (deadline?.reason ?? "30일 이후 마감") },
    { label: "지역 전략", points: weights.region * region[request.region], reason: request.region + " · 시연용 지역 전략 가중치 " + region[request.region] },
    { label: "반복 요청", points: weights.repeat * repeatFactor, reason: repeats.length ? "90일 내 같은 주제 " + repeats.join(" · ") : "90일 내 같은 주제 없음" },
  ];
  return { ...request, reasons, repeats, score: Math.round(reasons.reduce((sum, item) => sum + item.points, 0)) };
}

export function rankMarketingRequests(requests: readonly MarketingRequest[]) {
  return requests.map((request) => scoreRequest(request, requests))
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
}

export const rankedMarketingRequests = rankMarketingRequests(marketingRequests);
