export type Language = "en" | "zh";
export type WeightUnit = "kg" | "lb";
export type ReactionType = "like" | "heart" | "care" | "thumbs_down";

export type Profile = {
  id: string;
  email: string | null;
  fullName: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  locale: Language | null;
};

export type GroupSummary = {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string;
  ownerId: string;
  createdAt: string;
  memberCount: number;
  myRole: "owner" | "member";
  myBaseReady: boolean;
  myBaseDate: string | null;
};

export type SparkPoint = {
  date: string;
  deltaKg: number;
};

export type MemberHighlight = {
  kind:
    | "base_needed"
    | "current_delta"
    | "latest_move"
    | "best_point"
    | "below_average"
    | "consistency";
  valueKg: number | null;
  auxKg: number | null;
  date: string | null;
  count: number | null;
  tone: "good" | "steady" | "warm";
};

export type DashboardMember = {
  memberId: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: "owner" | "member";
  joinedAt: string;
  baseDate: string | null;
  latestDate: string | null;
  deltaKg: number | null;
  previousDeltaKg: number | null;
  daysLogged: number;
  rank: number | null;
  badges: string[];
  highlights: MemberHighlight[];
  sparkline: SparkPoint[];
  isMe: boolean;
};

export type OwnLog = {
  id: string;
  recordedOn: string;
  weightKg: number;
  note: string | null;
  deltaKg: number | null;
};

export type FeedItem = {
  id: string;
  actorUserId: string;
  actorMemberId: string | null;
  actorName: string;
  actorAvatarUrl: string | null;
  kind: "delta_update" | "first_delta" | "base_set";
  recordedOn: string | null;
  previousDeltaKg: number | null;
  newDeltaKg: number | null;
  createdAt: string;
  reactionCounts: Record<ReactionType, number>;
  myReaction: ReactionType | null;
};

export type GroupDashboard = {
  group: {
    id: string;
    name: string;
    description: string | null;
    inviteCode: string;
    ownerId: string;
    createdAt: string;
  };
  me: {
    memberId: string;
    role: "owner" | "member";
    baseReady: boolean;
    baseDate: string | null;
  };
  stats: {
    memberCount: number;
    readyCount: number;
    loggedTodayCount: number;
    totalLossKg: number;
    bestDeltaKg: number | null;
  };
  members: DashboardMember[];
  ownLogs: OwnLog[];
  feed: FeedItem[];
};

export type ApiError = {
  error: string;
  code?: string;
};
