export const HEATER_MARKETPLACES = ["us", "ca", "de", "uk"] as const;
export type HeaterMarketplace = (typeof HEATER_MARKETPLACES)[number];

export const HEATER_CATEGORIES = [
  "tech",
  "home",
  "fashion",
  "beauty",
  "baby",
  "tools",
  "toys",
  "sports",
] as const;
export type HeaterCategory = (typeof HEATER_CATEGORIES)[number];

export type HeaterDeal = {
  asin: string;
  title: string;
  marketplace: HeaterMarketplace;
  category: HeaterCategory;
  currentPrice: number;
  referencePrice: number;
  average90DayPrice: number;
  score: number;
  confidence: number;
  reasoning: string;
  minutesAgo: number;
  seller: string;
  sellerRating: number;
  isFBA: boolean;
  isPrime: boolean;
  status: "live" | "burnedOut";
  iconName: string;
  priceHistory: Array<{ date: string; price: number }>;
  offerListingID: string | null;
};

export const HEATER_DEAL_VOTES = ["good", "bought", "bad"] as const;
export type HeaterDealVote = (typeof HEATER_DEAL_VOTES)[number];

export type HeaterDealVoteSummary = {
  goodVotes: number;
  boughtVotes: number;
  badVotes: number;
  myVote: HeaterDealVote | null;
  updatedAt: string | null;
};

export type FeedResponse = {
  data: HeaterDeal[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  fetchedAt: string | null;
};

export type EntitlementResponse = {
  active: boolean;
  productId: string;
  status: string | null;
  expiresAt: string | null;
  environment: string | null;
};

export type HeaterDiscordConnection = {
  discordUserID: string;
  username: string;
  globalName: string | null;
  serverName: string;
  isMember: boolean;
  isPending: boolean;
  hasAccessRole: boolean;
  accessGranted: boolean;
  linkedAt: string;
};

export type SessionResponse = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  accountId: string;
  appAccountToken: string;
};
