"use client";

import {
  Activity,
  ArrowDownRight,
  CalendarDays,
  Clipboard,
  Flame,
  Gauge,
  Heart,
  Image as ImageIcon,
  Languages,
  LineChart,
  Link as LinkIcon,
  Lock,
  LogOut,
  Mail,
  Medal,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Smile,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Trophy,
  UserRound,
  Users,
  Weight
} from "lucide-react";
import Image from "next/image";
import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { copy, getInitialLanguage } from "@/lib/i18n";
import { hasSupabaseConfig, supabase } from "@/lib/supabaseClient";
import type {
  FeedItem,
  GroupDashboard,
  GroupSummary,
  Language,
  Profile,
  ReactionType,
  WeightUnit
} from "@/lib/types";

type AuthMode = "signin" | "signup" | "reset" | "recover";

type SlimYetGroupAppProps = {
  inviteCode?: string;
};

const KG_PER_LB = 0.45359237;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function toDisplayWeight(kg: number, unit: WeightUnit) {
  return unit === "kg" ? kg : kg / KG_PER_LB;
}

function fromDisplayWeight(value: string, unit: WeightUnit) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.round((unit === "kg" ? parsed : parsed * KG_PER_LB) * 10) / 10;
}

function formatNumber(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function DeltaSparkline({
  points,
  winner
}: {
  points: GroupDashboard["members"][number]["sparkline"];
  winner?: boolean;
}) {
  if (points.length < 2) {
    return <div className="sparkline empty-line" aria-hidden="true" />;
  }

  const width = 160;
  const height = 54;
  const values = points.map((point) => point.deltaKg);
  const min = Math.min(...values, -0.5);
  const max = Math.max(...values, 0.5);
  const range = max - min || 1;
  const path = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((point.deltaKg - min) / range) * (height - 10) - 5;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} role="img">
      <path d={`M 0 ${height / 2} L ${width} ${height / 2}`} className="sparkline-zero" />
      <path d={path} className={winner ? "sparkline-path winner" : "sparkline-path"} />
    </svg>
  );
}

function OwnWeightChart({
  dashboard,
  unit,
  language
}: {
  dashboard: GroupDashboard;
  unit: WeightUnit;
  language: Language;
}) {
  const t = copy[language];
  const logs = dashboard.ownLogs;

  if (logs.length < 2) {
    return (
      <section className="panel own-chart-panel">
        <div className="panel-title">
          <LineChart size={18} />
          <span>{t.stream}</span>
        </div>
        <div className="empty-state">{t.noLogs}</div>
      </section>
    );
  }

  const width = 620;
  const height = 230;
  const padX = 26;
  const padY = 30;
  const values = logs.map((log) => toDisplayWeight(log.weightKg, unit));
  const low = Math.min(...values);
  const high = Math.max(...values);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const last = values.at(-1)!;
  const range = Math.max(1, high - low);
  const yFor = (value: number) =>
    height - padY - ((value - low) / range) * (height - padY * 2);
  const xFor = (index: number) =>
    padX + (index / Math.max(1, logs.length - 1)) * (width - padX * 2);

  const path = values
    .map((value, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command} ${xFor(index).toFixed(2)} ${yFor(value).toFixed(2)}`;
    })
    .join(" ");

  const fillPath = `${path} L ${xFor(values.length - 1).toFixed(2)} ${height - padY} L ${padX} ${
    height - padY
  } Z`;
  const lowIndex = values.indexOf(low);
  const belowAverage = last < average;
  const latestDelta = dashboard.ownLogs.at(-1)?.deltaKg ?? null;

  return (
    <section className="panel own-chart-panel">
      <div className="chart-heading">
        <div>
          <div className="panel-title">
            <LineChart size={18} />
            <span>{t.stream}</span>
          </div>
          <p className="micro-copy">
            {belowAverage
              ? language === "zh"
                ? "最新体重低于个人平均"
                : "Latest is below your own average"
              : language === "zh"
                ? "保持记录，趋势会更清楚"
                : "Keep logging to sharpen the trend"}
          </p>
        </div>
        <div className="chart-kpis">
          <div>
            <span>{t.weight}</span>
            <strong>
              {formatNumber(last)} {t[unit]}
            </strong>
          </div>
          <div>
            <span>{t.delta}</span>
            <strong className={latestDelta !== null && latestDelta <= 0 ? "good" : "warm"}>
              {formatNumber(toDisplayWeight(latestDelta ?? 0, unit))} {t[unit]}
            </strong>
          </div>
        </div>
      </div>

      <svg className="own-chart" viewBox={`0 0 ${width} ${height}`} role="img">
        <defs>
          <linearGradient id="weight-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#34d5c7" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#ff7a48" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path className="own-chart-fill" d={fillPath} />
        <path
          className="own-chart-average"
          d={`M ${padX} ${yFor(average).toFixed(2)} L ${width - padX} ${yFor(average).toFixed(
            2
          )}`}
        />
        <path className="own-chart-path" d={path} />
        <circle className="own-chart-low" cx={xFor(lowIndex)} cy={yFor(low)} r="6" />
        <circle
          className="own-chart-last"
          cx={xFor(values.length - 1)}
          cy={yFor(last)}
          r="7"
        />
        <text x={padX} y={22} className="chart-label">
          {formatNumber(high)} {t[unit]}
        </text>
        <text x={padX} y={height - 8} className="chart-label">
          {formatNumber(low)} {t[unit]}
        </text>
      </svg>
    </section>
  );
}

function formatDeltaText(deltaKg: number, unit: WeightUnit, language: Language) {
  const value = toDisplayWeight(deltaKg, unit);
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value)} ${copy[language][unit]}`;
}

function feedCheer(item: FeedItem, language: Language) {
  const t = copy[language];

  if (item.previousDeltaKg !== null && item.newDeltaKg !== null) {
    const improvement = item.previousDeltaKg - item.newDeltaKg;
    if (improvement >= 0.5) {
      return t.feedBigAchievement;
    }
    if (improvement > 0) {
      return t.feedNiceMove;
    }
  }

  if (item.newDeltaKg !== null && item.newDeltaKg <= 0) {
    return t.feedBelowBase;
  }

  return t.feedShowingUp;
}

function feedSentence(item: FeedItem, unit: WeightUnit, language: Language) {
  const t = copy[language];

  if (item.kind === "base_set") {
    return `${item.actorName} ${t.feedBaseSet}.`;
  }

  if (item.previousDeltaKg === null && item.newDeltaKg !== null) {
    return `${item.actorName} ${t.feedFirstDelta} ${formatDeltaText(
      item.newDeltaKg,
      unit,
      language
    )}. ${feedCheer(item, language)}.`;
  }

  if (item.previousDeltaKg !== null && item.newDeltaKg !== null) {
    if (language === "zh") {
      return `${item.actorName}的${t.feedDeltaChanged} ${formatDeltaText(
        item.previousDeltaKg,
        unit,
        language
      )} ${t.feedDeltaTo} ${formatDeltaText(item.newDeltaKg, unit, language)}. ${feedCheer(
        item,
        language
      )}.`;
    }

    return `${item.actorName}'s ${t.feedDeltaChanged} ${formatDeltaText(
      item.previousDeltaKg,
      unit,
      language
    )} ${t.feedDeltaTo} ${formatDeltaText(item.newDeltaKg, unit, language)}. ${feedCheer(
      item,
      language
    )}.`;
  }

  return `${item.actorName} ${t.feedShowingUp}.`;
}

function FeedPanel({
  dashboard,
  unit,
  language,
  onReact,
  busy
}: {
  dashboard: GroupDashboard;
  unit: WeightUnit;
  language: Language;
  onReact: (feedId: string, reaction: ReactionType) => Promise<void>;
  busy: string | null;
}) {
  const t = copy[language];
  const reactionMeta: Record<
    ReactionType,
    {
      label: string;
      icon: ReactNode;
    }
  > = {
    like: { label: t.reactionLike, icon: <ThumbsUp size={15} /> },
    heart: { label: t.reactionHeart, icon: <Heart size={15} /> },
    care: { label: t.reactionCare, icon: <Smile size={15} /> },
    thumbs_down: { label: t.reactionThumbsDown, icon: <ThumbsDown size={15} /> }
  };

  return (
    <section className="panel feed-panel">
      <div className="panel-title">
        <Sparkles size={18} />
        <span>{t.feed}</span>
      </div>
      <div className="feed-list">
        {dashboard.feed.length ? (
          dashboard.feed.map((item) => (
            <article className="feed-item" key={item.id}>
              <Avatar name={item.actorName} url={item.actorAvatarUrl} />
              <div className="feed-main">
                <p>{feedSentence(item, unit, language)}</p>
                <time dateTime={item.createdAt}>
                  {new Date(item.createdAt).toLocaleString(language === "zh" ? "zh-CN" : "en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit"
                  })}
                </time>
                <div className="reaction-row">
                  {(Object.keys(reactionMeta) as ReactionType[]).map((reaction) => (
                    <button
                      className={classNames(
                        "reaction-button",
                        item.myReaction === reaction && "active"
                      )}
                      disabled={busy === `react-${item.id}-${reaction}`}
                      key={reaction}
                      onClick={() => onReact(item.id, reaction)}
                      title={reactionMeta[reaction].label}
                      type="button"
                    >
                      {reactionMeta[reaction].icon}
                      <span>{item.reactionCounts[reaction]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state">{t.noFeed}</div>
        )}
      </div>
    </section>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return (
      <div
        aria-label={name}
        className="avatar image-avatar"
        style={{ backgroundImage: `url(${url})` }}
      />
    );
  }

  return <div className="avatar fallback-avatar">{initials(name) || "SY"}</div>;
}

export default function SlimYetGroupApp({ inviteCode }: SlimYetGroupAppProps) {
  const [language, setLanguage] = useState<Language>("en");
  const [unit, setUnit] = useState<WeightUnit>("kg");
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<GroupDashboard | null>(null);
  const [profileForm, setProfileForm] = useState({
    fullName: "",
    nickname: "",
    avatarUrl: ""
  });
  const [groupForm, setGroupForm] = useState({ name: "", description: "" });
  const [joinCode, setJoinCode] = useState(inviteCode ?? "");
  const [baseForm, setBaseForm] = useState({ weight: "", date: todayIso() });
  const [logForm, setLogForm] = useState({ weight: "", date: todayIso(), note: "" });
  const [handledInvite, setHandledInvite] = useState<string | null>(null);
  const [origin, setOrigin] = useState("https://shou-le-me.vercel.app");

  const t = copy[language];

  useEffect(() => {
    const initialLanguage = getInitialLanguage();
    const savedUnit = window.localStorage.getItem("slim-yet-unit");
    setLanguage(initialLanguage);
    setUnit(savedUnit === "lb" ? "lb" : "kg");
    setOrigin(process.env.NEXT_PUBLIC_APP_URL || window.location.origin);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-Hans" : "en";
    window.localStorage.setItem("slim-yet-language", language);
  }, [language]);

  useEffect(() => {
    window.localStorage.setItem("slim-yet-unit", unit);
  }, [unit]);

  useEffect(() => {
    if (!supabase) {
      setBooting(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setBooting(false);
    });

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") {
        setAuthMode("recover");
      }
      setSession(nextSession);
      setBooting(false);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  const apiFetch = useMemo(() => {
    return async <T,>(path: string, init?: RequestInit): Promise<T> => {
      if (!session) {
        throw new Error(t.errorFallback);
      }

      const response = await fetch(path, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          ...(init?.headers ?? {})
        }
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? t.errorFallback);
      }
      return payload as T;
    };
  }, [session, t.errorFallback]);

  async function run(action: string, task: () => Promise<void>) {
    setBusy(action);
    setError(null);
    setMessage(null);
    try {
      await task();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.errorFallback);
    } finally {
      setBusy(null);
    }
  }

  async function loadMeAndGroups() {
    const mePayload = await apiFetch<{ profile: Profile }>("/api/me");
    setProfile(mePayload.profile);
    setProfileForm({
      fullName: mePayload.profile.fullName ?? "",
      nickname: mePayload.profile.nickname ?? "",
      avatarUrl: mePayload.profile.avatarUrl ?? ""
    });

    if (mePayload.profile.locale === "zh" || mePayload.profile.locale === "en") {
      setLanguage(mePayload.profile.locale);
    }

    const groupsPayload = await apiFetch<{ groups: GroupSummary[] }>("/api/groups");
    setGroups(groupsPayload.groups);
    setSelectedGroupId((current) => current ?? groupsPayload.groups[0]?.id ?? null);
  }

  async function loadDashboard(groupId = selectedGroupId) {
    if (!groupId) {
      setDashboard(null);
      return;
    }

    const payload = await apiFetch<GroupDashboard>(`/api/groups/${groupId}`);
    setDashboard(payload);
  }

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setGroups([]);
      setDashboard(null);
      return;
    }

    run("load", loadMeAndGroups);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    if (!session || !selectedGroupId) {
      setDashboard(null);
      return;
    }

    run("dashboard", () => loadDashboard(selectedGroupId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId, session?.access_token]);

  useEffect(() => {
    if (!inviteCode || !session || handledInvite === inviteCode) {
      return;
    }

    setHandledInvite(inviteCode);
    run("join", async () => {
      const payload = await apiFetch<{ groupId: string }>("/api/groups/join", {
        method: "POST",
        body: JSON.stringify({ inviteCode })
      });
      setSelectedGroupId(payload.groupId);
      await loadMeAndGroups();
      await loadDashboard(payload.groupId);
      setMessage(t.joined);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteCode, session?.access_token, handledInvite]);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = supabase;
    if (!client) {
      return;
    }

    if (authMode === "reset") {
      await run("auth", async () => {
        const { error: resetError } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin
        });
        if (resetError) {
          throw resetError;
        }
        setMessage(t.checkInbox);
      });
      return;
    }

    if (authMode === "recover") {
      await run("auth", async () => {
        const { error: updateError } = await client.auth.updateUser({ password: newPassword });
        if (updateError) {
          throw updateError;
        }
        setMessage(language === "zh" ? "密码已更新。" : "Password updated.");
        setAuthMode("signin");
      });
      return;
    }

    await run("auth", async () => {
      const result =
        authMode === "signup"
          ? await client.auth.signUp({
              email,
              password,
              options: {
                emailRedirectTo: window.location.origin
              }
            })
          : await client.auth.signInWithPassword({ email, password });

      if (result.error) {
        throw result.error;
      }

      if (authMode === "signup" && !result.data.session) {
        setMessage(t.emailConfirmation);
      }
    });
  }

  async function handleGoogle() {
    const client = supabase;
    if (!client) {
      return;
    }

    await run("google", async () => {
      const { error: googleError } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin
        }
      });
      if (googleError) {
        throw googleError;
      }
    });
  }

  async function handleSignOut() {
    const client = supabase;
    if (!client) {
      return;
    }

    await client.auth.signOut();
    setSession(null);
  }

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run("profile", async () => {
      const payload = await apiFetch<{ profile: Profile }>("/api/me", {
        method: "PATCH",
        body: JSON.stringify({ ...profileForm, locale: language })
      });
      setProfile(payload.profile);
      setMessage(language === "zh" ? "资料已保存。" : "Profile saved.");
      await loadMeAndGroups();
    });
  }

  async function handleCreateGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run("create", async () => {
      const payload = await apiFetch<{ group: GroupSummary }>("/api/groups", {
        method: "POST",
        body: JSON.stringify(groupForm)
      });
      setGroupForm({ name: "", description: "" });
      setSelectedGroupId(payload.group.id);
      await loadMeAndGroups();
      await loadDashboard(payload.group.id);
    });
  }

  async function handleJoinGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run("join", async () => {
      const payload = await apiFetch<{ groupId: string }>("/api/groups/join", {
        method: "POST",
        body: JSON.stringify({ inviteCode: joinCode })
      });
      setSelectedGroupId(payload.groupId);
      await loadMeAndGroups();
      await loadDashboard(payload.groupId);
    });
  }

  async function handleBase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedGroupId) {
      return;
    }

    const baseWeightKg = fromDisplayWeight(baseForm.weight, unit);
    if (!baseWeightKg) {
      setError(t.errorFallback);
      return;
    }

    await run("base", async () => {
      await apiFetch(`/api/groups/${selectedGroupId}/base`, {
        method: "PATCH",
        body: JSON.stringify({ baseWeightKg, baseDate: baseForm.date })
      });
      await loadMeAndGroups();
      await loadDashboard(selectedGroupId);
    });
  }

  async function handleLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedGroupId) {
      return;
    }

    const weightKg = fromDisplayWeight(logForm.weight, unit);
    if (!weightKg) {
      setError(t.errorFallback);
      return;
    }

    await run("log", async () => {
      await apiFetch(`/api/groups/${selectedGroupId}/logs`, {
        method: "POST",
        body: JSON.stringify({ weightKg, recordedOn: logForm.date, note: logForm.note })
      });
      setLogForm((current) => ({ ...current, note: "" }));
      await loadDashboard(selectedGroupId);
    });
  }

  async function handleDeleteLog(date: string) {
    if (!selectedGroupId) {
      return;
    }

    await run("delete", async () => {
      await apiFetch(`/api/groups/${selectedGroupId}/logs?date=${date}`, {
        method: "DELETE"
      });
      await loadDashboard(selectedGroupId);
    });
  }

  async function handleReaction(feedId: string, reaction: ReactionType) {
    if (!selectedGroupId) {
      return;
    }

    await run(`react-${feedId}-${reaction}`, async () => {
      await apiFetch(`/api/groups/${selectedGroupId}/feed/${feedId}/reactions`, {
        method: "POST",
        body: JSON.stringify({ reaction })
      });
      await loadDashboard(selectedGroupId);
    });
  }

  async function handleShare() {
    if (!dashboard) {
      return;
    }

    const link = `${origin.replace(/\/$/, "")}/join/${dashboard.group.inviteCode}`;
    await navigator.clipboard.writeText(link);
    setMessage(t.copied);
  }

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;
  const readyToCompete = Boolean(dashboard?.me.baseReady);
  const shareLink = dashboard
    ? `${origin.replace(/\/$/, "")}/join/${dashboard.group.inviteCode}`
    : "";

  const topMember = dashboard?.members.find((member) => member.rank === 1) ?? null;
  const labelForBadge = (badge: string) =>
    badge in t ? t[badge as keyof typeof t] : badge.replace(/^badge/, "");

  if (!hasSupabaseConfig) {
    return (
      <main className="app-shell centered-shell">
        <section className="config-panel">
          <Image src="/brand/thermal-jewel.png" alt="" width={96} height={96} priority />
          <h1>{t.appName}</h1>
          <p>{t.configuredSoon}</p>
          <p>{t.envHelp}</p>
        </section>
      </main>
    );
  }

  if (booting) {
    return (
      <main className="app-shell centered-shell">
        <div className="loading-mark">
          <Flame size={38} />
          <span>{t.loading}</span>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="auth-shell">
        <section className="auth-brand">
          <div className="brand-row">
            <Image src="/brand/thermal-jewel.png" alt="" width={86} height={86} priority />
            <div>
              <p className="eyebrow">{t.cnName}</p>
              <h1>{t.appName}</h1>
            </div>
          </div>
          <p className="tagline">{t.tagline}</p>
          <div className="auth-proof">
            <span>
              <ShieldCheck size={17} />
              {t.privateBase}
            </span>
            <span>
              <ArrowDownRight size={17} />
              {t.delta}
            </span>
            <span>
              <Trophy size={17} />
              {t.leaderboard}
            </span>
          </div>
        </section>

        <section className="auth-panel">
          <div className="top-actions">
            <button
              className="icon-button"
              type="button"
              onClick={() => setLanguage(language === "en" ? "zh" : "en")}
              aria-label="Switch language"
            >
              <Languages size={18} />
            </button>
          </div>

          <div className="auth-tabs">
            <button
              type="button"
              className={authMode === "signin" ? "active" : ""}
              onClick={() => setAuthMode("signin")}
            >
              {t.signIn}
            </button>
            <button
              type="button"
              className={authMode === "signup" ? "active" : ""}
              onClick={() => setAuthMode("signup")}
            >
              {t.signUp}
            </button>
            <button
              type="button"
              className={authMode === "reset" ? "active" : ""}
              onClick={() => setAuthMode("reset")}
            >
              {t.reset}
            </button>
          </div>

          <form className="stack-form" onSubmit={handleAuth}>
            {authMode === "recover" ? (
              <label>
                <span>{t.newPassword}</span>
                <div className="input-wrap">
                  <Lock size={17} />
                  <input
                    type="password"
                    minLength={6}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                  />
                </div>
              </label>
            ) : (
              <>
                <label>
                  <span>{t.email}</span>
                  <div className="input-wrap">
                    <Mail size={17} />
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                  </div>
                </label>

                {authMode !== "reset" && (
                  <label>
                    <span>{t.password}</span>
                    <div className="input-wrap">
                      <Lock size={17} />
                      <input
                        type="password"
                        minLength={6}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                      />
                    </div>
                  </label>
                )}
              </>
            )}

            <button className="primary-button" disabled={busy === "auth"} type="submit">
              {authMode === "reset"
                ? t.sendReset
                : authMode === "recover"
                  ? t.updatePassword
                  : authMode === "signup"
                    ? t.signUp
                    : t.signIn}
            </button>
          </form>

          <button
            className="secondary-button full"
            type="button"
            onClick={handleGoogle}
            disabled={busy === "google"}
          >
            <Sparkles size={17} />
            {t.continueWithGoogle}
          </button>

          {(message || error) && (
            <p className={error ? "form-message error" : "form-message"}>{error ?? message}</p>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-row compact">
          <Image src="/brand/spark-coin.png" alt="" width={58} height={58} priority />
          <div>
            <p className="eyebrow">{t.cnName}</p>
            <h1>{t.appName}</h1>
          </div>
        </div>
        <div className="header-actions">
          <div className="segmented-control" aria-label={t.unit}>
            <button
              type="button"
              className={unit === "kg" ? "active" : ""}
              onClick={() => setUnit("kg")}
            >
              {t.kg}
            </button>
            <button
              type="button"
              className={unit === "lb" ? "active" : ""}
              onClick={() => setUnit("lb")}
            >
              {t.lb}
            </button>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={() => setLanguage(language === "en" ? "zh" : "en")}
            aria-label="Switch language"
          >
            <Languages size={18} />
          </button>
          <button className="icon-button" type="button" onClick={handleSignOut} aria-label={t.signOut}>
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {(message || error) && (
        <div className={error ? "toast error" : "toast"}>{error ?? message}</div>
      )}

      <div className="app-grid">
        <aside className="side-rail">
          <section className="panel profile-panel">
            <div className="panel-title">
              <UserRound size={18} />
              <span>{t.profile}</span>
            </div>
            {profile?.email && <p className="profile-email">{profile.email}</p>}
            <form className="compact-form" onSubmit={handleSaveProfile}>
              <label>
                <span>{t.fullName}</span>
                <input
                  value={profileForm.fullName}
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, fullName: event.target.value }))
                  }
                />
              </label>
              <label>
                <span>{t.nickname}</span>
                <input
                  value={profileForm.nickname}
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, nickname: event.target.value }))
                  }
                />
              </label>
              <label>
                <span>{t.avatarUrl}</span>
                <div className="input-wrap slim">
                  <ImageIcon size={16} />
                  <input
                    value={profileForm.avatarUrl}
                    onChange={(event) =>
                      setProfileForm((current) => ({ ...current, avatarUrl: event.target.value }))
                    }
                  />
                </div>
              </label>
              <button className="secondary-button full" disabled={busy === "profile"} type="submit">
                {t.saveProfile}
              </button>
            </form>
          </section>

          <section className="panel">
            <div className="panel-title">
              <Plus size={18} />
              <span>{t.createGroup}</span>
            </div>
            <form className="compact-form" onSubmit={handleCreateGroup}>
              <label>
                <span>{t.groupName}</span>
                <input
                  value={groupForm.name}
                  onChange={(event) =>
                    setGroupForm((current) => ({ ...current, name: event.target.value }))
                  }
                  required
                />
              </label>
              <label>
                <span>{t.description}</span>
                <textarea
                  value={groupForm.description}
                  onChange={(event) =>
                    setGroupForm((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </label>
              <button className="primary-button full" disabled={busy === "create"} type="submit">
                {t.create}
              </button>
            </form>
          </section>

          <section className="panel">
            <div className="panel-title">
              <LinkIcon size={18} />
              <span>{t.joinGroup}</span>
            </div>
            <form className="compact-form" onSubmit={handleJoinGroup}>
              <label>
                <span>{t.inviteCode}</span>
                <input
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value)}
                  required
                />
              </label>
              <button className="secondary-button full" disabled={busy === "join"} type="submit">
                {t.join}
              </button>
            </form>
          </section>
        </aside>

        <section className="workspace">
          <nav className="group-tabs" aria-label={t.groups}>
            {groups.length ? (
              groups.map((group) => (
                <button
                  type="button"
                  className={group.id === selectedGroupId ? "active" : ""}
                  key={group.id}
                  onClick={() => setSelectedGroupId(group.id)}
                >
                  <span>{group.name}</span>
                  <small>
                    {group.memberCount} {t.members}
                  </small>
                </button>
              ))
            ) : (
              <div className="empty-state compact-empty">{t.noGroups}</div>
            )}
          </nav>

          {selectedGroup && dashboard ? (
            <>
              <section className="group-hero">
                <div>
                  <p className="eyebrow">{selectedGroup.description || t.leaderboard}</p>
                  <h2>{dashboard.group.name}</h2>
                  <div className="hero-meta">
                    <span>
                      <Users size={16} />
                      {dashboard.stats.memberCount} {t.members}
                    </span>
                    <span>
                      <ShieldCheck size={16} />
                      {t.privateBase}
                    </span>
                    {topMember && (
                      <span>
                        <Medal size={16} />
                        {topMember.displayName}
                      </span>
                    )}
                  </div>
                </div>
                <div className="share-box">
                  <code>{shareLink}</code>
                  <button className="icon-button hot" type="button" onClick={handleShare}>
                    <Clipboard size={18} />
                  </button>
                </div>
              </section>

              <section className="score-strip">
                <div className="score-card hot">
                  <Flame size={19} />
                  <span>{t.totalLoss}</span>
                  <strong>
                    {formatNumber(toDisplayWeight(dashboard.stats.totalLossKg, unit))} {t[unit]}
                  </strong>
                </div>
                <div className="score-card">
                  <Users size={19} />
                  <span>{t.ready}</span>
                  <strong>
                    {dashboard.stats.readyCount}/{dashboard.stats.memberCount}
                  </strong>
                </div>
                <div className="score-card">
                  <CalendarDays size={19} />
                  <span>{t.today}</span>
                  <strong>{dashboard.stats.loggedTodayCount}</strong>
                </div>
                <div className="score-card cool">
                  <Gauge size={19} />
                  <span>{t.bestDrop}</span>
                  <strong>
                    {dashboard.stats.bestDeltaKg === null
                      ? "--"
                      : `${formatNumber(toDisplayWeight(dashboard.stats.bestDeltaKg, unit))} ${
                          t[unit]
                        }`}
                  </strong>
                </div>
              </section>

              <section className="action-row">
                <form className="action-panel" onSubmit={handleBase}>
                  <div className="panel-title">
                    <ShieldCheck size={18} />
                    <span>{t.setBase}</span>
                  </div>
                  <div className="inline-fields">
                    <label>
                      <span>{t.baseWeight}</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        min="40"
                        value={baseForm.weight}
                        onChange={(event) =>
                          setBaseForm((current) => ({ ...current, weight: event.target.value }))
                        }
                        required
                      />
                    </label>
                    <label>
                      <span>{t.baseDate}</span>
                      <input
                        type="date"
                        value={baseForm.date}
                        onChange={(event) =>
                          setBaseForm((current) => ({ ...current, date: event.target.value }))
                        }
                        required
                      />
                    </label>
                    <button className="primary-button" disabled={busy === "base"} type="submit">
                      {t.setBase}
                    </button>
                  </div>
                </form>

                <form className="action-panel" onSubmit={handleLog}>
                  <div className="panel-title">
                    <Weight size={18} />
                    <span>{t.logWeight}</span>
                  </div>
                  <div className="inline-fields">
                    <label>
                      <span>{t.weight}</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        min="40"
                        value={logForm.weight}
                        onChange={(event) =>
                          setLogForm((current) => ({ ...current, weight: event.target.value }))
                        }
                        required
                      />
                    </label>
                    <label>
                      <span>{t.today}</span>
                      <input
                        type="date"
                        value={logForm.date}
                        onChange={(event) =>
                          setLogForm((current) => ({ ...current, date: event.target.value }))
                        }
                        required
                      />
                    </label>
                    <label>
                      <span>{t.note}</span>
                      <input
                        value={logForm.note}
                        onChange={(event) =>
                          setLogForm((current) => ({ ...current, note: event.target.value }))
                        }
                      />
                    </label>
                    <button className="primary-button aqua" disabled={busy === "log"} type="submit">
                      {t.saveLog}
                    </button>
                  </div>
                </form>
              </section>

              {!readyToCompete && <div className="nudge-bar">{t.noBase}</div>}

              <div className="dashboard-grid">
                <section className="panel leaderboard-panel">
                  <div className="panel-title">
                    <Trophy size={18} />
                    <span>{t.leaderboard}</span>
                  </div>
                  <div className="leaderboard">
                    {dashboard.members.map((member) => {
                      const displayDelta =
                        member.deltaKg === null ? null : toDisplayWeight(member.deltaKg, unit);
                      const winner = member.rank === 1;
                      return (
                        <article
                          className={classNames("leader-row", winner && "winner", member.isMe && "me")}
                          key={member.memberId}
                        >
                          <div className="rank-cell">{member.rank ?? "-"}</div>
                          <Avatar name={member.displayName} url={member.avatarUrl} />
                          <div className="leader-main">
                            <div className="leader-name">
                              <strong>{member.displayName}</strong>
                              {member.isMe && <span>{t.you}</span>}
                              {member.role === "owner" && <span>{t.owner}</span>}
                            </div>
                            <div className="badge-row">
                              {member.badges.length
                                ? member.badges.map((badge) => (
                                    <small key={badge}>{labelForBadge(badge)}</small>
                                  ))
                                : member.baseDate
                                  ? <small>{t.privateBase}</small>
                                  : <small>{t.noBase}</small>}
                            </div>
                          </div>
                          <DeltaSparkline points={member.sparkline} winner={winner} />
                          <div className="delta-cell">
                            <strong
                              className={
                                displayDelta !== null && displayDelta <= 0 ? "good" : "warm"
                              }
                            >
                              {displayDelta === null
                                ? "--"
                                : `${formatNumber(displayDelta)} ${t[unit]}`}
                            </strong>
                            <span>{member.latestDate ?? "--"}</span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>

                <div className="right-stack">
                  <FeedPanel
                    busy={busy}
                    dashboard={dashboard}
                    language={language}
                    onReact={handleReaction}
                    unit={unit}
                  />

                  <OwnWeightChart dashboard={dashboard} unit={unit} language={language} />

                  <section className="panel logs-panel">
                    <div className="panel-title">
                      <Activity size={18} />
                      <span>{t.myLogs}</span>
                    </div>
                    <div className="log-list">
                      {dashboard.ownLogs.length ? (
                        dashboard.ownLogs
                          .slice()
                          .reverse()
                          .slice(0, 10)
                          .map((log) => (
                            <article className="log-row" key={log.id}>
                              <span>{log.recordedOn}</span>
                              <strong>
                                {formatNumber(toDisplayWeight(log.weightKg, unit))} {t[unit]}
                              </strong>
                              <small>
                                {log.deltaKg === null
                                  ? "--"
                                  : `${formatNumber(toDisplayWeight(log.deltaKg, unit))} ${t[unit]}`}
                              </small>
                              <button
                                className="icon-button ghost"
                                type="button"
                                aria-label="Delete log"
                                onClick={() => handleDeleteLog(log.recordedOn)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </article>
                          ))
                      ) : (
                        <div className="empty-state">{t.noLogs}</div>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            </>
          ) : (
            <section className="empty-workspace">
              <Image src="/brand/thermal-jewel.png" alt="" width={104} height={104} />
              <h2>{t.noGroups}</h2>
              <button className="secondary-button" type="button" onClick={() => run("load", loadMeAndGroups)}>
                <RefreshCcw size={17} />
                {t.groups}
              </button>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}
