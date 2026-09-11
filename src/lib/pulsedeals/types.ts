export const PULSE_MARKETPLACES = ["de", "uk", "es", "fr", "it"] as const;
export type PulseMarketplace = (typeof PULSE_MARKETPLACES)[number];

export const PULSE_CATEGORIES = [
  "tech",
  "home",
  "fashion",
  "beauty",
  "baby",
  "tools",
  "toys",
  "sports",
] as const;
export type PulseCategory = (typeof PULSE_CATEGORIES)[number];

export type PulseDeal = {
  asin: string;
  title: string;
  marketplace: PulseMarketplace;
  category: PulseCategory;
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
  imageURL?: string | null;
};

export const PULSE_DEAL_VOTES = ["good", "bought", "bad"] as const;
export type PulseDealVote = (typeof PULSE_DEAL_VOTES)[number];

export type PulseDealVoteSummary = {
  goodVotes: number;
  boughtVotes: number;
  badVotes: number;
  myVote: PulseDealVote | null;
  updatedAt: string | null;
};

export type FeedResponse = {
  data: PulseDeal[];
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

export type PulseDiscordConnection = {
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
