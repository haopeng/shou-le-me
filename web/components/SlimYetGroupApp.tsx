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
  Weight,
  X,
  ZoomIn
} from "lucide-react";
import Image from "next/image";
import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  copy,
  getInitialLanguage,
  getUrlLanguage,
  setUrlLanguage,
  withLanguageParam
} from "@/lib/i18n";
import { hasSupabaseConfig, supabase, supabaseAnonKey, supabaseUrl } from "@/lib/supabaseClient";
import type {
  FeedItem,
  GroupDashboard,
  GroupSummary,
  Language,
  PersonalDashboard,
  Profile,
  ReactionType,
  WeightUnit
} from "@/lib/types";

type AuthMode = "signin" | "signup" | "reset" | "recover";

type SlimYetGroupAppProps = {
  inviteCode?: string;
};

type ActiveView = "personal" | "group";

type LogFormState = {
  weight: string;
  date: string;
  note: string;
};

type SupabaseAuthSettings = {
  external?: {
    google?: boolean;
  };
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

function getUrlGroupToken() {
  if (typeof window === "undefined") {
    return null;
  }

  const token = new URLSearchParams(window.location.search).get("group")?.trim();
  return token || null;
}

function getUrlViewToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return new URLSearchParams(window.location.search).get("view");
}

function findGroupFromUrl(groups: GroupSummary[]) {
  const token = getUrlGroupToken();
  if (!token) {
    return null;
  }

  const normalizedToken = token.toUpperCase();
  return (
    groups.find(
      (group) => group.inviteCode.toUpperCase() === normalizedToken || group.id === token
    ) ?? null
  );
}

function writeSelectionUrl({
  language,
  inviteCode,
  view,
  replace = false
}: {
  language: Language;
  inviteCode?: string;
  view?: "me";
  replace?: boolean;
}) {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  url.pathname = "/";
  url.searchParams.set("lang", language);

  if (inviteCode) {
    url.searchParams.set("group", inviteCode);
    url.searchParams.delete("view");
  } else if (view === "me") {
    url.searchParams.set("view", "me");
    url.searchParams.delete("group");
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl === currentUrl) {
    return;
  }

  const method = replace ? "replaceState" : "pushState";
  window.history[method](window.history.state, "", nextUrl);
}

function SharedTrendChart({
  dashboard,
  unit,
  language
}: {
  dashboard: GroupDashboard;
  unit: WeightUnit;
  language: Language;
}) {
  const plottedMembers = dashboard.members.filter((member) => member.sparkline.length >= 2);

  if (!plottedMembers.length) {
    return <div className="trend-empty-line">{copy[language].noTrend}</div>;
  }

  const colors = ["#ff563f", "#24c6bc", "#7064ff", "#ffb84d", "#32a86d", "#d92d45"];
  const width = 940;
  const height = 280;
  const padLeft = 58;
  const padRight = 30;
  const padTop = 24;
  const padBottom = 44;
  const dates = Array.from(
    new Set(plottedMembers.flatMap((member) => member.sparkline.map((point) => point.date)))
  ).sort((left, right) => left.localeCompare(right));
  const dateIndex = new Map(dates.map((date, index) => [date, index]));
  const values = plottedMembers.flatMap((member) => member.sparkline.map((point) => point.deltaKg));
  const rawMin = Math.min(...values, -0.5);
  const rawMax = Math.max(...values, 0.5);
  const padding = Math.max(0.3, (rawMax - rawMin) * 0.14);
  const min = Math.min(rawMin - padding, 0);
  const max = Math.max(rawMax + padding, 0);
  const range = max - min || 1;
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;
  const xFor = (date: string) => {
    const index = dateIndex.get(date) ?? 0;
    return padLeft + (index / Math.max(1, dates.length - 1)) * chartWidth;
  };
  const yFor = (value: number) => padTop + ((max - value) / range) * chartHeight;
  const axisValues = Array.from(new Set([roundOne(max), 0, roundOne(min)]));

  return (
    <div className="shared-trend-wrap">
      <svg className="shared-trend-plot" viewBox={`0 0 ${width} ${height}`} role="img">
        {axisValues.map((value) => (
          <g key={value}>
            <path
              d={`M ${padLeft} ${yFor(value).toFixed(2)} L ${width - padRight} ${yFor(value).toFixed(2)}`}
              className={value === 0 ? "shared-trend-zero" : "shared-trend-grid"}
            />
            <text x={16} y={yFor(value) + 4} className="shared-trend-axis-label">
              {formatNumber(toDisplayWeight(value, unit))}
            </text>
          </g>
        ))}

        {plottedMembers.map((member, index) => {
          const color = colors[index % colors.length];
          const sortedPoints = member.sparkline
            .slice()
            .sort((left, right) => left.date.localeCompare(right.date));
          const path = sortedPoints
            .map((point, pointIndex) => {
              const command = pointIndex === 0 ? "M" : "L";
              return `${command} ${xFor(point.date).toFixed(2)} ${yFor(point.deltaKg).toFixed(2)}`;
            })
            .join(" ");
          const latest = sortedPoints.at(-1)!;

          return (
            <g key={member.memberId}>
              <path
                d={path}
                className={classNames("shared-trend-path", member.rank === 1 && "winner")}
                style={{ stroke: color }}
              />
              <circle
                cx={xFor(latest.date)}
                cy={yFor(latest.deltaKg)}
                r={member.rank === 1 ? 7 : 5}
                className="shared-trend-dot"
                style={{ fill: color }}
              />
              <text
                x={Math.min(width - padRight - 76, xFor(latest.date) + 10)}
                y={yFor(latest.deltaKg) + 4}
                className="shared-trend-label"
                style={{ fill: color }}
              >
                {member.displayName}
              </text>
            </g>
          );
        })}

        {dates.length > 0 && (
          <>
            <text x={padLeft} y={height - 10} className="shared-trend-date-label">
              {dates[0]}
            </text>
            <text x={width - padRight} y={height - 10} className="shared-trend-date-label end">
              {dates.at(-1)}
            </text>
          </>
        )}
      </svg>

      <div className="shared-trend-legend">
        {plottedMembers.map((member, index) => {
          const color = colors[index % colors.length];
          return (
            <span className={member.isMe ? "me" : ""} key={member.memberId}>
              <i style={{ background: color }} />
              {member.displayName}
              <strong>
                {member.deltaKg === null ? "--" : formatDeltaText(member.deltaKg, unit, language)}
              </strong>
            </span>
          );
        })}
      </div>
    </div>
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

function personalHighlightText(
  highlight: PersonalDashboard["highlights"][number],
  unit: WeightUnit,
  language: Language
) {
  const t = copy[language];
  const value = highlight.valueKg;

  switch (highlight.kind) {
    case "personal_low":
      return `${t.personalLow}: ${formatNumber(toDisplayWeight(value ?? 0, unit))} ${t[unit]}`;
    case "below_average":
      return `${t.personalBelowAverage}: ${formatNumber(toDisplayWeight(value ?? 0, unit))} ${
        t[unit]
      }`;
    case "latest_move":
      return `${t.personalLatestMove}: ${formatDeltaText(value ?? 0, unit, language)}`;
    case "consistency":
      return `${t.highlightConsistency}: ${highlight.count ?? 0}`;
    default:
      return "";
  }
}

function PersonalWeightChart({
  dashboard,
  unit,
  language
}: {
  dashboard: PersonalDashboard;
  unit: WeightUnit;
  language: Language;
}) {
  const t = copy[language];
  const logs = dashboard.logs;

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

  const width = 720;
  const height = 250;
  const padX = 30;
  const padY = 32;
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

  return (
    <section className="panel own-chart-panel personal-chart-panel">
      <div className="chart-heading">
        <div>
          <div className="panel-title">
            <LineChart size={18} />
            <span>{t.stream}</span>
          </div>
          <p className="micro-copy">
            {belowAverage
              ? t.personalBelowAverage
              : language === "zh"
                ? "继续记录，个人趋势会更清楚"
                : "Keep logging to sharpen your private trend"}
          </p>
        </div>
        <div className="chart-kpis">
          <div>
            <span>{t.average30}</span>
            <strong>
              {formatNumber(toDisplayWeight(dashboard.stats.average30Kg ?? 0, unit))} {t[unit]}
            </strong>
          </div>
          <div>
            <span>{t.lowestWeight}</span>
            <strong>
              {formatNumber(toDisplayWeight(dashboard.stats.lowestWeightKg ?? 0, unit))} {t[unit]}
            </strong>
          </div>
        </div>
      </div>

      <svg className="own-chart" viewBox={`0 0 ${width} ${height}`} role="img">
        <defs>
          <linearGradient id="personal-weight-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#34d5c7" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#ff7a48" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path className="own-chart-fill personal-fill" d={fillPath} />
        <path
          className="own-chart-average"
          d={`M ${padX} ${yFor(average).toFixed(2)} L ${width - padX} ${yFor(average).toFixed(
            2
          )}`}
        />
        <path className="own-chart-path" d={path} />
        <circle className="own-chart-low" cx={xFor(lowIndex)} cy={yFor(low)} r="6" />
        <circle className="own-chart-last" cx={xFor(values.length - 1)} cy={yFor(last)} r="7" />
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

function LogWeightForm({
  logForm,
  setLogForm,
  onSubmit,
  busy,
  language,
  title,
  hint
}: {
  logForm: LogFormState;
  setLogForm: (updater: (current: LogFormState) => LogFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  busy: string | null;
  language: Language;
  title: string;
  hint?: string;
}) {
  const t = copy[language];

  return (
    <form className="action-panel log-action-panel" onSubmit={onSubmit}>
      <div className="panel-title">
        <Weight size={18} />
        <span>{title}</span>
      </div>
      {hint && <p className="micro-copy panel-hint">{hint}</p>}
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
            onChange={(event) => setLogForm((current) => ({ ...current, date: event.target.value }))}
            required
          />
        </label>
        <label>
          <span>{t.note}</span>
          <input
            value={logForm.note}
            onChange={(event) => setLogForm((current) => ({ ...current, note: event.target.value }))}
          />
        </label>
        <button className="primary-button aqua" disabled={busy === "log"} type="submit">
          {t.saveLog}
        </button>
      </div>
    </form>
  );
}

function PersonalDashboardView({
  dashboard,
  unit,
  language,
  logForm,
  setLogForm,
  onLog,
  onDeleteLog,
  busy
}: {
  dashboard: PersonalDashboard | null;
  unit: WeightUnit;
  language: Language;
  logForm: LogFormState;
  setLogForm: (updater: (current: LogFormState) => LogFormState) => void;
  onLog: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteLog: (date: string) => void;
  busy: string | null;
}) {
  const t = copy[language];

  if (!dashboard) {
    return (
      <section className="empty-workspace">
        <Image src="/brand/thermal-jewel.png" alt="" width={104} height={104} />
        <h2>{t.loading}</h2>
      </section>
    );
  }

  const latestWeight =
    dashboard.stats.latestWeightKg === null
      ? "--"
      : `${formatNumber(toDisplayWeight(dashboard.stats.latestWeightKg, unit))} ${t[unit]}`;
  const firstDelta =
    dashboard.stats.changeFromFirstKg === null
      ? "--"
      : formatDeltaText(dashboard.stats.changeFromFirstKg, unit, language);
  const latestMove =
    dashboard.stats.changeFromPreviousKg === null
      ? "--"
      : formatDeltaText(dashboard.stats.changeFromPreviousKg, unit, language);
  const lowestWeight =
    dashboard.stats.lowestWeightKg === null
      ? "--"
      : `${formatNumber(toDisplayWeight(dashboard.stats.lowestWeightKg, unit))} ${t[unit]}`;

  return (
    <>
      <section className="personal-hero">
        <div>
          <p className="eyebrow">{t.privateToYou}</p>
          <h2>{t.personalDashboard}</h2>
          <p>{t.personalDashboardHint}</p>
        </div>
        <div className="privacy-badge">
          <Lock size={17} />
          <span>{t.privateToYou}</span>
        </div>
      </section>

      <section className="score-strip personal-score-strip">
        <div className="score-card cool">
          <Weight size={19} />
          <span>{t.latestWeight}</span>
          <strong>{latestWeight}</strong>
        </div>
        <div className="score-card">
          <ArrowDownRight size={19} />
          <span>{t.sinceFirst}</span>
          <strong
            className={
              dashboard.stats.changeFromFirstKg !== null && dashboard.stats.changeFromFirstKg <= 0
                ? "good"
                : "warm"
            }
          >
            {firstDelta}
          </strong>
        </div>
        <div className="score-card">
          <Activity size={19} />
          <span>{t.latestMove}</span>
          <strong
            className={
              dashboard.stats.changeFromPreviousKg !== null &&
              dashboard.stats.changeFromPreviousKg <= 0
                ? "good"
                : "warm"
            }
          >
            {latestMove}
          </strong>
        </div>
        <div className="score-card hot">
          <Trophy size={19} />
          <span>{t.lowestWeight}</span>
          <strong>{lowestWeight}</strong>
        </div>
      </section>

      <LogWeightForm
        busy={busy}
        hint={t.logAppliesAllGroups}
        language={language}
        logForm={logForm}
        onSubmit={onLog}
        setLogForm={setLogForm}
        title={t.logWeight}
      />

      <div className="personal-dashboard-grid">
        <div className="right-stack">
          <PersonalWeightChart dashboard={dashboard} unit={unit} language={language} />

          {dashboard.highlights.length > 0 && (
            <section className="panel">
              <div className="panel-title">
                <Sparkles size={18} />
                <span>{t.trendBoard}</span>
              </div>
              <div className="highlight-list personal-highlights">
                {dashboard.highlights.map((highlight, index) => (
                  <span className={highlight.tone} key={`${highlight.kind}-${index}`}>
                    {personalHighlightText(highlight, unit, language)}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>

        <section className="panel logs-panel">
          <div className="panel-title">
            <Activity size={18} />
            <span>{t.myLogs}</span>
          </div>
          <div className="log-list">
            {dashboard.logs.length ? (
              dashboard.logs
                .slice()
                .reverse()
                .slice(0, 14)
                .map((log) => (
                  <article className="log-row personal-log-row" key={log.id}>
                    <span>{log.recordedOn}</span>
                    <strong>
                      {formatNumber(toDisplayWeight(log.weightKg, unit))} {t[unit]}
                    </strong>
                    <small>{log.note || t.privateToYou}</small>
                    <button
                      className="icon-button ghost"
                      type="button"
                      aria-label="Delete log"
                      onClick={() => onDeleteLog(log.recordedOn)}
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
    </>
  );
}

function highlightText(
  highlight: GroupDashboard["members"][number]["highlights"][number],
  unit: WeightUnit,
  language: Language
) {
  const t = copy[language];
  const value = highlight.valueKg;

  switch (highlight.kind) {
    case "base_needed":
      return t.highlightBaseNeeded;
    case "current_delta":
      return `${t.highlightCurrentDelta}: ${formatDeltaText(value ?? 0, unit, language)}`;
    case "latest_move": {
      const key: keyof typeof t =
        value === null || value === 0
          ? "highlightLatestMoveFlat"
          : value < 0
            ? "highlightLatestMoveDown"
            : "highlightLatestMoveUp";
      return `${t[key]}: ${formatDeltaText(value ?? 0, unit, language)}`;
    }
    case "best_point":
      return `${t.highlightBestPoint}: ${formatDeltaText(value ?? 0, unit, language)}`;
    case "below_average":
      return `${t.highlightBelowAverage}: ${formatNumber(toDisplayWeight(value ?? 0, unit))} ${
        t[unit]
      }`;
    case "consistency":
      return `${t.highlightConsistency}: ${highlight.count ?? 0}`;
    default:
      return "";
  }
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

function MemberTrendBoard({
  dashboard,
  unit,
  language,
  onMemberSelect
}: {
  dashboard: GroupDashboard;
  unit: WeightUnit;
  language: Language;
  onMemberSelect: (member: GroupDashboard["members"][number]) => void;
}) {
  const t = copy[language];

  return (
    <section className="panel trend-board-panel">
      <div className="chart-heading">
        <div>
          <div className="panel-title">
            <LineChart size={18} />
            <span>{t.trendBoard}</span>
          </div>
          <p className="micro-copy">{t.trendBoardHint}</p>
        </div>
      </div>

      <SharedTrendChart dashboard={dashboard} unit={unit} language={language} />

      <div className="trend-card-grid">
        {dashboard.members.map((member) => {
          const displayDelta =
            member.deltaKg === null ? null : toDisplayWeight(member.deltaKg, unit);
          const winner = member.rank === 1;

          return (
            <article
              className={classNames("trend-card", winner && "winner", member.isMe && "me")}
              key={member.memberId}
              onClick={() => onMemberSelect(member)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onMemberSelect(member);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="trend-card-head">
                <Avatar name={member.displayName} url={member.avatarUrl} />
                <div>
                  <div className="leader-name">
                    <strong>{member.displayName}</strong>
                    {member.isMe && <span>{t.you}</span>}
                  </div>
                  <small>
                    {member.rank ? `#${member.rank}` : "--"} · {member.daysLogged} {t.loggedDays}
                  </small>
                </div>
                <div className="trend-delta">
                  <strong className={displayDelta !== null && displayDelta <= 0 ? "good" : "warm"}>
                    {displayDelta === null ? "--" : `${formatNumber(displayDelta)} ${t[unit]}`}
                  </strong>
                  <span>{t.delta}</span>
                </div>
              </div>

              <div className="highlight-list">
                {member.highlights.map((highlight, index) => (
                  <span className={highlight.tone} key={`${highlight.kind}-${index}`}>
                    {highlightText(highlight, unit, language)}
                  </span>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
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

function MemberProfileModal({
  member,
  unit,
  language,
  onClose
}: {
  member: GroupDashboard["members"][number];
  unit: WeightUnit;
  language: Language;
  onClose: () => void;
}) {
  const t = copy[language];
  const [zoomed, setZoomed] = useState(false);
  const displayDelta = member.deltaKg === null ? null : toDisplayWeight(member.deltaKg, unit);
  const joinedDate = new Date(member.joinedAt).toLocaleDateString(
    language === "zh" ? "zh-CN" : "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric"
    }
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="member-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        aria-labelledby="member-profile-title"
        aria-modal="true"
        className="member-modal"
        role="dialog"
      >
        <button
          aria-label={t.close}
          className="icon-button ghost member-modal-close"
          onClick={onClose}
          type="button"
        >
          <X size={18} />
        </button>

        <div className="member-modal-head">
          <button
            aria-label={t.zoomPhoto}
            className={classNames("member-photo-button", zoomed && "zoomed")}
            onClick={() => setZoomed((current) => !current)}
            type="button"
          >
            {member.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={member.displayName} src={member.avatarUrl} />
            ) : (
              <span>{initials(member.displayName) || "SY"}</span>
            )}
            <i>
              <ZoomIn size={15} />
            </i>
          </button>

          <div>
            <p className="eyebrow">{t.publicGroupProfile}</p>
            <h2 id="member-profile-title">{member.displayName}</h2>
            <div className="hero-meta member-profile-meta">
              {member.isMe && <span>{t.you}</span>}
              <span>{member.role === "owner" ? t.owner : t.member}</span>
              <span>
                <Lock size={15} />
                {t.privateBase}
              </span>
            </div>
          </div>
        </div>

        <div className="member-stats-grid">
          <div>
            <span>{t.delta}</span>
            <strong className={displayDelta !== null && displayDelta <= 0 ? "good" : "warm"}>
              {displayDelta === null ? "--" : `${formatNumber(displayDelta)} ${t[unit]}`}
            </strong>
          </div>
          <div>
            <span>{t.rank}</span>
            <strong>{member.rank ? `#${member.rank}` : "--"}</strong>
          </div>
          <div>
            <span>{t.loggedDays}</span>
            <strong>{member.daysLogged}</strong>
          </div>
          <div>
            <span>{t.latestLog}</span>
            <strong>{member.latestDate ?? "--"}</strong>
          </div>
          <div>
            <span>{t.joinedOn}</span>
            <strong>{joinedDate}</strong>
          </div>
        </div>

        <div className="highlight-list member-modal-highlights">
          {member.badges.map((badge) => (
            <span className="steady" key={badge}>
              {badge in t ? t[badge as keyof typeof t] : badge.replace(/^badge/, "")}
            </span>
          ))}
          {member.highlights.map((highlight, index) => (
            <span className={highlight.tone} key={`${highlight.kind}-${index}`}>
              {highlightText(highlight, unit, language)}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

type LocalLog = {
  id: string;
  recordedOn: string;
  weightKg: number;
  note: string | null;
};

type LocalMember = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: "owner" | "member";
  baseWeightKg: number | null;
  baseDate: string | null;
  logs: LocalLog[];
  isMe?: boolean;
};

type LocalGroup = {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string;
  ownerId: string;
  createdAt: string;
  members: LocalMember[];
  feed: FeedItem[];
};

type LocalPreviewState = {
  nickname: string;
  avatarUrl: string | null;
  selectedGroupId: string;
  ownLogs: LocalLog[];
  groups: LocalGroup[];
};

const localMeId = "local-me";
const localStoreKey = "slim-yet-local-preview";

function localId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function sampleLocalState(language: Language): LocalPreviewState {
  const t = copy[language];
  const groupId = "local-launch";
  const ownLogs: LocalLog[] = [
    { id: "me-1", recordedOn: "2026-06-16", weightKg: 82.4, note: null },
    { id: "me-2", recordedOn: "2026-06-19", weightKg: 81.8, note: null },
    { id: "me-3", recordedOn: "2026-06-22", weightKg: 81.2, note: "Felt good" }
  ];
  const amyLogs: LocalLog[] = [
    { id: "amy-1", recordedOn: "2026-06-15", weightKg: 69.8, note: null },
    { id: "amy-2", recordedOn: "2026-06-18", weightKg: 69.6, note: null },
    { id: "amy-3", recordedOn: "2026-06-22", weightKg: 69.0, note: null }
  ];
  const jayLogs: LocalLog[] = [
    { id: "jay-1", recordedOn: "2026-06-15", weightKg: 91.2, note: null },
    { id: "jay-2", recordedOn: "2026-06-19", weightKg: 90.9, note: null },
    { id: "jay-3", recordedOn: "2026-06-22", weightKg: 91.0, note: null }
  ];

  return {
    nickname: language === "zh" ? "我" : "Me",
    avatarUrl: null,
    selectedGroupId: groupId,
    ownLogs,
    groups: [
      {
        id: groupId,
        name: t.sampleGroupName,
        description: t.sampleGroupDescription,
        inviteCode: "LOCAL24",
        ownerId: localMeId,
        createdAt: "2026-06-15T08:00:00.000Z",
        members: [
          {
            userId: localMeId,
            displayName: language === "zh" ? "我" : "Me",
            avatarUrl: null,
            role: "owner",
            baseWeightKg: 82.4,
            baseDate: "2026-06-16",
            logs: ownLogs,
            isMe: true
          },
          {
            userId: "local-amy",
            displayName: "Amy",
            avatarUrl: null,
            role: "member",
            baseWeightKg: 69.8,
            baseDate: "2026-06-15",
            logs: amyLogs
          },
          {
            userId: "local-jay",
            displayName: "Jay",
            avatarUrl: null,
            role: "member",
            baseWeightKg: 91.2,
            baseDate: "2026-06-15",
            logs: jayLogs
          }
        ],
        feed: [
          {
            id: "feed-1",
            actorUserId: "local-amy",
            actorMemberId: "local-amy",
            actorName: "Amy",
            actorAvatarUrl: null,
            kind: "delta_update",
            recordedOn: "2026-06-22",
            previousDeltaKg: -0.2,
            newDeltaKg: -0.8,
            createdAt: "2026-06-22T19:20:00.000Z",
            reactionCounts: { like: 2, heart: 1, care: 0, thumbs_down: 0 },
            myReaction: "heart"
          },
          {
            id: "feed-2",
            actorUserId: localMeId,
            actorMemberId: localMeId,
            actorName: language === "zh" ? "我" : "Me",
            actorAvatarUrl: null,
            kind: "delta_update",
            recordedOn: "2026-06-22",
            previousDeltaKg: -0.6,
            newDeltaKg: -1.2,
            createdAt: "2026-06-22T07:45:00.000Z",
            reactionCounts: { like: 1, heart: 1, care: 1, thumbs_down: 0 },
            myReaction: null
          }
        ]
      }
    ]
  };
}

function localHighlights(
  logs: LocalLog[],
  sparkline: Array<{ date: string; deltaKg: number }>,
  deltaKg: number | null,
  previousDeltaKg: number | null
): GroupDashboard["members"][number]["highlights"] {
  if (deltaKg === null) {
    return [
      {
        kind: "base_needed",
        valueKg: null,
        auxKg: null,
        date: null,
        count: null,
        tone: "warm"
      }
    ];
  }

  const highlights: GroupDashboard["members"][number]["highlights"] = [
    {
      kind: "current_delta",
      valueKg: deltaKg,
      auxKg: null,
      date: sparkline.at(-1)?.date ?? null,
      count: null,
      tone: deltaKg <= 0 ? "good" : "warm"
    }
  ];

  if (previousDeltaKg !== null) {
    const move = roundOne(deltaKg - previousDeltaKg);
    highlights.push({
      kind: "latest_move",
      valueKg: move,
      auxKg: previousDeltaKg,
      date: sparkline.at(-1)?.date ?? null,
      count: null,
      tone: move < 0 ? "good" : move === 0 ? "steady" : "warm"
    });
  }

  if (sparkline.length >= 2) {
    const best = sparkline.reduce((winner, point) =>
      point.deltaKg < winner.deltaKg ? point : winner
    );
    highlights.push({
      kind: "best_point",
      valueKg: best.deltaKg,
      auxKg: null,
      date: best.date,
      count: null,
      tone: "good"
    });
  }

  if (logs.length >= 3) {
    highlights.push({
      kind: "consistency",
      valueKg: null,
      auxKg: null,
      date: null,
      count: logs.length,
      tone: "steady"
    });
  }

  return highlights.slice(0, 4);
}

function buildLocalDashboard(state: LocalPreviewState, language: Language): GroupDashboard {
  const group = state.groups.find((item) => item.id === state.selectedGroupId) ?? state.groups[0];
  const normalizedMembers = group.members.map((member) =>
    member.userId === localMeId
      ? {
          ...member,
          displayName: state.nickname || copy[language].you,
          avatarUrl: state.avatarUrl,
          logs: state.ownLogs,
          isMe: true
        }
      : member
  );
  const computed = normalizedMembers.map((member) => {
    const logs = member.logs
      .slice()
      .sort((left, right) => left.recordedOn.localeCompare(right.recordedOn));
    const latest = logs.at(-1) ?? null;
    const previous = logs.length >= 2 ? logs.at(-2) : null;
    const baseWeight = member.baseWeightKg;
    const deltaKg = baseWeight !== null && latest ? roundOne(latest.weightKg - baseWeight) : null;
    const previousDeltaKg =
      baseWeight !== null && previous ? roundOne(previous.weightKg - baseWeight) : null;
    const sparkline =
      baseWeight === null
        ? []
        : logs.map((log) => ({
            date: log.recordedOn,
            deltaKg: roundOne(log.weightKg - baseWeight)
          }));

    return { member, logs, latest, deltaKg, previousDeltaKg, sparkline };
  });
  const ranked = computed
    .filter((entry) => entry.deltaKg !== null)
    .sort((left, right) => left.deltaKg! - right.deltaKg!);
  const rankByUser = new Map<string, number>();
  ranked.forEach((entry, index) => rankByUser.set(entry.member.userId, index + 1));
  const today = todayIso();
  const members = computed
    .map((entry) => ({
      memberId: entry.member.userId,
      userId: entry.member.userId,
      displayName: entry.member.displayName,
      avatarUrl: entry.member.avatarUrl,
      role: entry.member.role,
      joinedAt: group.createdAt,
      baseDate: entry.member.baseDate,
      latestDate: entry.latest?.recordedOn ?? null,
      deltaKg: entry.deltaKg,
      previousDeltaKg: entry.previousDeltaKg,
      daysLogged: entry.logs.length,
      rank: rankByUser.get(entry.member.userId) ?? null,
      badges: entry.deltaKg === null ? [] : entry.deltaKg <= 0 ? ["badgeBelowStart"] : [],
      highlights: localHighlights(entry.logs, entry.sparkline, entry.deltaKg, entry.previousDeltaKg),
      sparkline: entry.sparkline,
      isMe: entry.member.userId === localMeId
    }))
    .sort((left, right) => (left.rank ?? 99) - (right.rank ?? 99));
  const deltas = members
    .map((member) => member.deltaKg)
    .filter((delta): delta is number => delta !== null);
  const me = normalizedMembers.find((member) => member.userId === localMeId)!;

  return {
    group: {
      id: group.id,
      name: group.name,
      description: group.description,
      inviteCode: group.inviteCode,
      ownerId: group.ownerId,
      createdAt: group.createdAt
    },
    me: {
      memberId: localMeId,
      role: "owner",
      baseReady: me.baseWeightKg !== null,
      baseDate: me.baseDate
    },
    stats: {
      memberCount: members.length,
      readyCount: members.filter((member) => member.baseDate).length,
      loggedTodayCount: members.filter((member) => member.latestDate === today).length,
      totalLossKg: roundOne(deltas.reduce((sum, delta) => sum + Math.max(0, -delta), 0)),
      bestDeltaKg: deltas.length ? roundOne(Math.min(...deltas)) : null
    },
    members,
    ownLogs: state.ownLogs
      .slice()
      .sort((left, right) => left.recordedOn.localeCompare(right.recordedOn))
      .map((log) => ({
        id: log.id,
        recordedOn: log.recordedOn,
        weightKg: log.weightKg,
        note: log.note,
        deltaKg: me.baseWeightKg !== null ? roundOne(log.weightKg - me.baseWeightKg) : null
      })),
    feed: group.feed.map((item) =>
      item.actorUserId === localMeId
        ? {
            ...item,
            actorName: state.nickname || copy[language].you,
            actorAvatarUrl: state.avatarUrl
          }
        : item
    )
  };
}

function localReactionCounts(): Record<ReactionType, number> {
  return { like: 0, heart: 0, care: 0, thumbs_down: 0 };
}

function sortedLogs(logs: LocalLog[]) {
  return logs.slice().sort((left, right) => left.recordedOn.localeCompare(right.recordedOn));
}

function upsertLocalLog(logs: LocalLog[], nextLog: Omit<LocalLog, "id">) {
  const existing = logs.find((log) => log.recordedOn === nextLog.recordedOn);
  const merged = existing
    ? logs.map((log) => (log.recordedOn === nextLog.recordedOn ? { ...log, ...nextLog } : log))
    : [...logs, { id: localId("log"), ...nextLog }];

  return sortedLogs(merged);
}

function syncLocalMe(groups: LocalGroup[], ownLogs: LocalLog[], nickname: string, avatarUrl: string | null) {
  return groups.map((group) => ({
    ...group,
    members: group.members.map((member) =>
      member.userId === localMeId
        ? {
            ...member,
            displayName: nickname,
            avatarUrl,
            logs: ownLogs,
            isMe: true
          }
        : member
    )
  }));
}

function latestDeltaForGroup(group: LocalGroup, logs: LocalLog[]) {
  const me = group.members.find((member) => member.userId === localMeId);
  const latest = sortedLogs(logs).at(-1);

  if (!me?.baseWeightKg || !latest) {
    return null;
  }

  return roundOne(latest.weightKg - me.baseWeightKg);
}

function localInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function localSampleBuddies(language: Language) {
  return sampleLocalState(language).groups[0].members
    .filter((member) => member.userId !== localMeId)
    .map((member) => ({
      ...member,
      userId: localId("buddy"),
      logs: member.logs.map((log) => ({ ...log, id: localId("log") })),
      isMe: false
    }));
}

function LocalPreviewApp({ inviteCode }: SlimYetGroupAppProps) {
  const [language, setLanguage] = useState<Language>("en");
  const [unit, setUnit] = useState<WeightUnit>("kg");
  const [state, setState] = useState<LocalPreviewState>(() => sampleLocalState("en"));
  const [hydrated, setHydrated] = useState(false);
  const [profileForm, setProfileForm] = useState({ nickname: "", avatarUrl: "" });
  const [groupForm, setGroupForm] = useState({ name: "", description: "" });
  const [joinCode, setJoinCode] = useState(inviteCode ?? "");
  const [baseForm, setBaseForm] = useState({ weight: "", date: todayIso() });
  const [logForm, setLogForm] = useState({ weight: "", date: todayIso(), note: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [origin, setOrigin] = useState("https://shou-le-me.vercel.app");
  const [handledInvite, setHandledInvite] = useState<string | null>(null);
  const t = copy[language];
  const dashboard = useMemo(() => buildLocalDashboard(state, language), [state, language]);
  const selectedGroup =
    state.groups.find((group) => group.id === state.selectedGroupId) ?? state.groups[0];
  const topMember = dashboard.members.find((member) => member.rank === 1) ?? null;
  const shareLink = withLanguageParam(
    `${origin.replace(/\/$/, "")}/join/${dashboard.group.inviteCode}`,
    language
  );
  const readyToCompete = dashboard.me.baseReady;
  const languageButtonLabel = language === "en" ? "中文" : "EN";
  const labelForBadge = (badge: string) =>
    badge in t ? t[badge as keyof typeof t] : badge.replace(/^badge/, "");

  function chooseLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    setUrlLanguage(nextLanguage);
  }

  useEffect(() => {
    const initialLanguage = getInitialLanguage();
    const savedUnit = window.localStorage.getItem("slim-yet-unit");
    const savedState = window.localStorage.getItem(localStoreKey);
    setLanguage(initialLanguage);
    setUnit(savedUnit === "lb" ? "lb" : "kg");
    setOrigin(process.env.NEXT_PUBLIC_APP_URL || window.location.origin);

    if (savedState) {
      try {
        const parsed = JSON.parse(savedState) as LocalPreviewState;
        if (parsed?.groups?.length && parsed?.ownLogs) {
          setState({
            ...parsed,
            avatarUrl: parsed.avatarUrl ?? null
          });
          setProfileForm({
            nickname: parsed.nickname ?? "",
            avatarUrl: parsed.avatarUrl ?? ""
          });
          setHydrated(true);
          return;
        }
      } catch {
        window.localStorage.removeItem(localStoreKey);
      }
    }

    const sampleState = sampleLocalState(initialLanguage);
    setState(sampleState);
    setProfileForm({
      nickname: sampleState.nickname,
      avatarUrl: sampleState.avatarUrl ?? ""
    });
    setHydrated(true);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-Hans" : "en";
    document.title = copy[language].appName;
    window.localStorage.setItem("slim-yet-language", language);
  }, [language]);

  useEffect(() => {
    window.localStorage.setItem("slim-yet-unit", unit);
  }, [unit]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(localStoreKey, JSON.stringify(state));
  }, [hydrated, state]);

  useEffect(() => {
    if (!inviteCode || !hydrated || handledInvite === inviteCode) {
      return;
    }

    const normalizedCode = inviteCode.toUpperCase();
    const existing = state.groups.find((group) => group.inviteCode === normalizedCode);
    if (existing) {
      setState((current) => ({ ...current, selectedGroupId: existing.id }));
      setHandledInvite(inviteCode);
      return;
    }

    setState((current) => {
      const groupId = localId("group");
      const nextGroup: LocalGroup = {
        id: groupId,
        name: language === "zh" ? "邀请小组" : "Invite Group",
        description: language === "zh" ? "从分享链接加入的本地预览小组" : "Local preview group from a shared link",
        inviteCode: normalizedCode,
        ownerId: "local-host",
        createdAt: new Date().toISOString(),
        members: [
          {
            userId: localMeId,
            displayName: current.nickname,
            avatarUrl: current.avatarUrl,
            role: "member",
            baseWeightKg: null,
            baseDate: null,
            logs: current.ownLogs,
            isMe: true
          },
          ...localSampleBuddies(language)
        ],
        feed: []
      };
      return {
        ...current,
        selectedGroupId: groupId,
        groups: [...current.groups, nextGroup]
      };
    });
    setHandledInvite(inviteCode);
  }, [handledInvite, hydrated, inviteCode, language, state.groups]);

  function showMessage(nextMessage: string) {
    setError(null);
    setMessage(nextMessage);
  }

  function handleLocalAvatarUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/") || file.size > 1_500_000) {
      setError(t.errorFallback);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const avatarUrl = typeof reader.result === "string" ? reader.result : null;
      if (!avatarUrl) {
        setError(t.errorFallback);
        return;
      }

      setProfileForm((current) => ({ ...current, avatarUrl }));
      setState((current) => ({
        ...current,
        avatarUrl,
        groups: syncLocalMe(current.groups, current.ownLogs, current.nickname, avatarUrl)
      }));
      showMessage(t.avatarUploaded);
    };
    reader.onerror = () => setError(t.errorFallback);
    reader.readAsDataURL(file);
  }

  function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState((current) => {
      const nickname = profileForm.nickname.trim() || copy[language].you;
      const avatarUrl = profileForm.avatarUrl.trim() || null;
      return {
        ...current,
        nickname,
        avatarUrl,
        groups: syncLocalMe(current.groups, current.ownLogs, nickname, avatarUrl)
      };
    });
    showMessage(language === "zh" ? "资料已保存。" : "Profile saved.");
  }

  function handleCreateGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = groupForm.name.trim();

    if (!name) {
      setError(t.errorFallback);
      return;
    }

    setState((current) => {
      const groupId = localId("group");
      const nextGroup: LocalGroup = {
        id: groupId,
        name,
        description: groupForm.description.trim() || null,
        inviteCode: localInviteCode(),
        ownerId: localMeId,
        createdAt: new Date().toISOString(),
        members: [
          {
            userId: localMeId,
            displayName: current.nickname,
            avatarUrl: current.avatarUrl,
            role: "owner",
            baseWeightKg: null,
            baseDate: null,
            logs: current.ownLogs,
            isMe: true
          },
          ...localSampleBuddies(language)
        ],
        feed: []
      };

      return {
        ...current,
        selectedGroupId: groupId,
        groups: [...current.groups, nextGroup]
      };
    });
    setGroupForm({ name: "", description: "" });
    showMessage(language === "zh" ? "小组已创建。" : "Group created.");
  }

  function handleJoinGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCode = joinCode.trim().toUpperCase();

    if (!normalizedCode) {
      setError(t.errorFallback);
      return;
    }

    setState((current) => {
      const existing = current.groups.find((group) => group.inviteCode === normalizedCode);
      if (existing) {
        return { ...current, selectedGroupId: existing.id };
      }

      const groupId = localId("group");
      const nextGroup: LocalGroup = {
        id: groupId,
        name: language === "zh" ? `小组 ${normalizedCode}` : `Group ${normalizedCode}`,
        description: language === "zh" ? "本地预览加入的小组" : "Joined in local preview",
        inviteCode: normalizedCode,
        ownerId: "local-host",
        createdAt: new Date().toISOString(),
        members: [
          {
            userId: localMeId,
            displayName: current.nickname,
            avatarUrl: current.avatarUrl,
            role: "member",
            baseWeightKg: null,
            baseDate: null,
            logs: current.ownLogs,
            isMe: true
          },
          ...localSampleBuddies(language)
        ],
        feed: []
      };

      return {
        ...current,
        selectedGroupId: groupId,
        groups: [...current.groups, nextGroup]
      };
    });
    showMessage(language === "zh" ? "已加入本地预览小组。" : "Joined a local preview group.");
  }

  function handleBase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const baseWeightKg = fromDisplayWeight(baseForm.weight, unit);

    if (baseWeightKg === null) {
      setError(t.errorFallback);
      return;
    }

    setState((current) => {
      const nextOwnLogs = upsertLocalLog(current.ownLogs, {
        recordedOn: baseForm.date,
        weightKg: baseWeightKg,
        note: null
      });
      const groupsWithLogs = syncLocalMe(
        current.groups,
        nextOwnLogs,
        current.nickname,
        current.avatarUrl
      );
      const nextGroups = groupsWithLogs.map((group) => {
        if (group.id !== current.selectedGroupId) {
          return group;
        }

        const baseFeedItem: FeedItem = {
          id: localId("feed"),
          actorUserId: localMeId,
          actorMemberId: localMeId,
          actorName: current.nickname,
          actorAvatarUrl: current.avatarUrl,
          kind: "base_set",
          recordedOn: baseForm.date,
          previousDeltaKg: null,
          newDeltaKg: 0,
          createdAt: new Date().toISOString(),
          reactionCounts: localReactionCounts(),
          myReaction: null
        };

        return {
          ...group,
          members: group.members.map((member) =>
            member.userId === localMeId
              ? {
                  ...member,
                  baseWeightKg,
                  baseDate: baseForm.date,
                  logs: nextOwnLogs
                }
              : member
          ),
          feed: [baseFeedItem, ...group.feed]
        };
      });

      return {
        ...current,
        ownLogs: nextOwnLogs,
        groups: nextGroups
      };
    });
    showMessage(language === "zh" ? "私密基准已设置。" : "Private base set.");
  }

  function handleLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const weightKg = fromDisplayWeight(logForm.weight, unit);

    if (weightKg === null) {
      setError(t.errorFallback);
      return;
    }

    setState((current) => {
      const nextOwnLogs = upsertLocalLog(current.ownLogs, {
        recordedOn: logForm.date,
        weightKg,
        note: logForm.note.trim() || null
      });
      const groupsWithLogs = syncLocalMe(
        current.groups,
        nextOwnLogs,
        current.nickname,
        current.avatarUrl
      );
      const nextGroups = groupsWithLogs.map((group) => {
        const previousDeltaKg = latestDeltaForGroup(group, current.ownLogs);
        const newDeltaKg = latestDeltaForGroup(group, nextOwnLogs);
        const shouldPostFeed =
          newDeltaKg !== null && (previousDeltaKg === null || previousDeltaKg !== newDeltaKg);

        if (!shouldPostFeed) {
          return group;
        }

        const kind: FeedItem["kind"] = previousDeltaKg === null ? "first_delta" : "delta_update";
        const feedItem: FeedItem = {
          id: localId("feed"),
          actorUserId: localMeId,
          actorMemberId: localMeId,
          actorName: current.nickname,
          actorAvatarUrl: current.avatarUrl,
          kind,
          recordedOn: logForm.date,
          previousDeltaKg,
          newDeltaKg,
          createdAt: new Date().toISOString(),
          reactionCounts: localReactionCounts(),
          myReaction: null
        };

        return {
          ...group,
          feed: [feedItem, ...group.feed]
        };
      });

      return {
        ...current,
        ownLogs: nextOwnLogs,
        groups: nextGroups
      };
    });
    setLogForm((current) => ({ ...current, note: "" }));
    showMessage(language === "zh" ? "体重已记录，小组变化已更新。" : "Weight logged. Group deltas updated.");
  }

  function handleDeleteLog(date: string) {
    setState((current) => {
      const nextOwnLogs = current.ownLogs.filter((log) => log.recordedOn !== date);
      return {
        ...current,
        ownLogs: nextOwnLogs,
        groups: syncLocalMe(current.groups, nextOwnLogs, current.nickname, current.avatarUrl)
      };
    });
    showMessage(language === "zh" ? "记录已删除。" : "Log deleted.");
  }

  async function handleReaction(feedId: string, reaction: ReactionType) {
    const busyKey = `react-${feedId}-${reaction}`;
    setBusy(busyKey);
    setState((current) => ({
      ...current,
      groups: current.groups.map((group) => {
        if (group.id !== current.selectedGroupId) {
          return group;
        }

        return {
          ...group,
          feed: group.feed.map((item) => {
            if (item.id !== feedId) {
              return item;
            }

            const reactionCounts = { ...item.reactionCounts };
            if (item.myReaction) {
              reactionCounts[item.myReaction] = Math.max(0, reactionCounts[item.myReaction] - 1);
            }

            const myReaction = item.myReaction === reaction ? null : reaction;
            if (myReaction) {
              reactionCounts[myReaction] += 1;
            }

            return { ...item, reactionCounts, myReaction };
          })
        };
      })
    }));
    setBusy(null);
  }

  async function handleShare() {
    await navigator.clipboard?.writeText(shareLink).catch(() => undefined);
    showMessage(t.copied);
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-row compact">
          <Image src="/brand/spark-coin.png" alt="" width={58} height={58} priority />
          <div>
            <h1>{t.appName}</h1>
          </div>
          <div className="setup-pill local-pill">
            <ShieldCheck size={16} />
            <span>{t.previewMode}</span>
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
            className="icon-button language-button"
            type="button"
            onClick={() => chooseLanguage(language === "en" ? "zh" : "en")}
            aria-label="Switch language"
          >
            <Languages size={18} />
            <span>{languageButtonLabel}</span>
          </button>
        </div>
      </header>

      <div className="toast preview-toast">
        <ShieldCheck size={16} />
        <span>
          {t.previewNote} · {t.localOnly}
        </span>
      </div>

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
            <div className="profile-avatar-row">
              <Avatar
                name={profileForm.nickname || state.nickname || t.you}
                url={profileForm.avatarUrl || state.avatarUrl}
              />
              <label className="avatar-upload-button">
                <ImageIcon size={16} />
                <span>{t.choosePhoto}</span>
                <input type="file" accept="image/*" onChange={handleLocalAvatarUpload} />
              </label>
            </div>
            <form className="compact-form" onSubmit={handleSaveProfile}>
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
              <button className="secondary-button full" type="submit">
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
              <button className="primary-button full" type="submit">
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
              <button className="secondary-button full" type="submit">
                {t.join}
              </button>
            </form>
          </section>
        </aside>

        <section className="workspace">
          <nav className="group-tabs" aria-label={t.groups}>
            {state.groups.map((group) => (
              <button
                type="button"
                className={group.id === state.selectedGroupId ? "active" : ""}
                key={group.id}
                onClick={() => setState((current) => ({ ...current, selectedGroupId: group.id }))}
              >
                <span>{group.name}</span>
                <small>
                  {group.members.length} {t.members}
                </small>
              </button>
            ))}
          </nav>

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

          <MemberTrendBoard
            dashboard={dashboard}
            language={language}
            onMemberSelect={() => undefined}
            unit={unit}
          />

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
                <button className="primary-button" type="submit">
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
                <button className="primary-button aqua" type="submit">
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
                          {member.badges.length ? (
                            member.badges.map((badge) => (
                              <small key={badge}>{labelForBadge(badge)}</small>
                            ))
                          ) : member.baseDate ? (
                            <small>{t.privateBase}</small>
                          ) : (
                            <small>{t.noBase}</small>
                          )}
                        </div>
                      </div>
                      <div className="delta-cell">
                        <strong
                          className={displayDelta !== null && displayDelta <= 0 ? "good" : "warm"}
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
        </section>
      </div>

    </main>
  );
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
  const [personalDashboard, setPersonalDashboard] = useState<PersonalDashboard | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>("personal");
  const [selectedMember, setSelectedMember] = useState<GroupDashboard["members"][number] | null>(
    null
  );
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
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(null);

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
    document.title = copy[language].appName;
    window.localStorage.setItem("slim-yet-language", language);
  }, [language]);

  useEffect(() => {
    window.localStorage.setItem("slim-yet-unit", unit);
  }, [unit]);

  useEffect(() => {
    if (!supabaseUrl || !supabaseAnonKey) {
      setGoogleEnabled(false);
      return;
    }

    fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: {
        apikey: supabaseAnonKey
      }
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((settings: SupabaseAuthSettings | null) => {
        setGoogleEnabled(Boolean(settings?.external?.google));
      })
      .catch(() => setGoogleEnabled(null));
  }, []);

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

    if (!getUrlLanguage() && (mePayload.profile.locale === "zh" || mePayload.profile.locale === "en")) {
      chooseLanguage(mePayload.profile.locale);
    }

    const groupsPayload = await apiFetch<{ groups: GroupSummary[] }>("/api/groups");
    const urlGroup = findGroupFromUrl(groupsPayload.groups);
    setGroups(groupsPayload.groups);

    if (urlGroup) {
      setSelectedGroupId(urlGroup.id);
      setActiveView("group");
      return;
    }

    setSelectedGroupId((current) => current ?? groupsPayload.groups[0]?.id ?? null);
    if (getUrlViewToken() === "me") {
      setActiveView("personal");
    }
  }

  async function loadPersonalDashboard() {
    const payload = await apiFetch<PersonalDashboard>("/api/me/dashboard");
    setPersonalDashboard(payload);
  }

  async function loadDashboard(groupId = selectedGroupId) {
    if (!groupId) {
      setDashboard(null);
      return;
    }

    const payload = await apiFetch<GroupDashboard>(`/api/groups/${groupId}`);
    setDashboard(payload);
  }

  function showPersonalView(replace = false) {
    setSelectedMember(null);
    setActiveView("personal");
    writeSelectionUrl({ language, view: "me", replace });
  }

  function showGroupView(group: Pick<GroupSummary, "id" | "inviteCode">, replace = false) {
    setSelectedMember(null);
    setSelectedGroupId(group.id);
    setActiveView("group");
    writeSelectionUrl({ language, inviteCode: group.inviteCode, replace });
  }

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setGroups([]);
      setDashboard(null);
      setPersonalDashboard(null);
      setActiveView("personal");
      return;
    }

    run("load", async () => {
      await Promise.all([loadMeAndGroups(), loadPersonalDashboard()]);
    });
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
    if (!session) {
      return;
    }

    function syncSelectionFromUrl() {
      const urlGroup = findGroupFromUrl(groups);
      setSelectedMember(null);
      if (urlGroup) {
        setSelectedGroupId(urlGroup.id);
        setActiveView("group");
        return;
      }

      if (getUrlViewToken() === "me" || !getUrlGroupToken()) {
        setActiveView("personal");
      }
    }

    window.addEventListener("popstate", syncSelectionFromUrl);
    return () => window.removeEventListener("popstate", syncSelectionFromUrl);
  }, [groups, session]);

  useEffect(() => {
    if (!inviteCode || !session || handledInvite === inviteCode) {
      return;
    }

    setHandledInvite(inviteCode);
    run("join", async () => {
      const payload = await apiFetch<{ groupId: string; inviteCode: string }>("/api/groups/join", {
        method: "POST",
        body: JSON.stringify({ inviteCode })
      });
      showGroupView({ id: payload.groupId, inviteCode: payload.inviteCode }, true);
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
          redirectTo: window.location.href
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
                emailRedirectTo: window.location.href
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

    if (googleEnabled === false) {
      setMessage(null);
      setError(t.googleNotEnabled);
      return;
    }

    await run("google", async () => {
      const { error: googleError } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.href
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

  async function handleAvatarUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file || !session) {
      return;
    }

    await run("avatar", async () => {
      const formData = new FormData();
      formData.append("avatar", file);

      const response = await fetch("/api/me/avatar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: formData
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        profile?: Profile;
      };

      if (!response.ok || !payload.profile) {
        throw new Error(payload.error ?? t.errorFallback);
      }

      setProfile(payload.profile);
      setProfileForm((current) => ({
        ...current,
        avatarUrl: payload.profile?.avatarUrl ?? ""
      }));
      setMessage(t.avatarUploaded);
      await loadMeAndGroups();
      if (selectedGroupId) {
        await loadDashboard(selectedGroupId);
      }
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
      showGroupView(payload.group);
      await loadMeAndGroups();
      await loadDashboard(payload.group.id);
    });
  }

  async function handleJoinGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run("join", async () => {
      const payload = await apiFetch<{ groupId: string; inviteCode: string }>("/api/groups/join", {
        method: "POST",
        body: JSON.stringify({ inviteCode: joinCode })
      });
      showGroupView({ id: payload.groupId, inviteCode: payload.inviteCode });
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
      await Promise.all([loadMeAndGroups(), loadPersonalDashboard(), loadDashboard(selectedGroupId)]);
    });
  }

  async function handleLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const weightKg = fromDisplayWeight(logForm.weight, unit);
    if (!weightKg) {
      setError(t.errorFallback);
      return;
    }

    await run("log", async () => {
      const payload = await apiFetch<{ readyGroupCount: number }>("/api/me/logs", {
        method: "POST",
        body: JSON.stringify({ weightKg, recordedOn: logForm.date, note: logForm.note })
      });
      setLogForm((current) => ({ ...current, note: "" }));
      await Promise.all([
        loadPersonalDashboard(),
        loadMeAndGroups(),
        selectedGroupId ? loadDashboard(selectedGroupId) : Promise.resolve()
      ]);
      setMessage(t.logSavedAll.replace("{count}", String(payload.readyGroupCount)));
    });
  }

  async function handleDeleteLog(date: string) {
    await run("delete", async () => {
      await apiFetch(`/api/me/logs?date=${date}`, {
        method: "DELETE"
      });
      await Promise.all([
        loadPersonalDashboard(),
        loadMeAndGroups(),
        selectedGroupId ? loadDashboard(selectedGroupId) : Promise.resolve()
      ]);
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

    await navigator.clipboard.writeText(shareLink);
    setMessage(t.copied);
  }

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;
  const readyToCompete = Boolean(dashboard?.me.baseReady);
  const shareLink = dashboard
    ? withLanguageParam(`${origin.replace(/\/$/, "")}/join/${dashboard.group.inviteCode}`, language)
    : "";

  const topMember = dashboard?.members.find((member) => member.rank === 1) ?? null;
  const labelForBadge = (badge: string) =>
    badge in t ? t[badge as keyof typeof t] : badge.replace(/^badge/, "");
  function chooseLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    setUrlLanguage(nextLanguage);
  }

  const toggleLanguage = () => chooseLanguage(language === "en" ? "zh" : "en");
  const languageButtonLabel = language === "en" ? "中文" : "EN";

  if (!hasSupabaseConfig) {
    return <LocalPreviewApp inviteCode={inviteCode} />;
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
              className="icon-button language-button"
              type="button"
              onClick={toggleLanguage}
              aria-label="Switch language"
            >
              <Languages size={18} />
              <span>{languageButtonLabel}</span>
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

          {googleEnabled === false ? (
            <p className="form-message">{t.googleNotEnabled}</p>
          ) : (
            <button
              className="secondary-button full"
              type="button"
              onClick={handleGoogle}
              disabled={busy === "google"}
            >
              <Sparkles size={17} />
              {t.continueWithGoogle}
            </button>
          )}

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
            className="icon-button language-button"
            type="button"
            onClick={toggleLanguage}
            aria-label="Switch language"
          >
            <Languages size={18} />
            <span>{languageButtonLabel}</span>
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
            <div className="profile-avatar-row">
              <Avatar
                name={profileForm.nickname || profileForm.fullName || profile?.email || t.you}
                url={profileForm.avatarUrl || profile?.avatarUrl || null}
              />
              <label className="avatar-upload-button">
                <ImageIcon size={16} />
                <span>{busy === "avatar" ? t.uploadingAvatar : t.choosePhoto}</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={busy === "avatar"}
                  onChange={handleAvatarUpload}
                />
              </label>
            </div>
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
            <button
              type="button"
              className={activeView === "personal" ? "active personal-tab" : "personal-tab"}
              onClick={() => showPersonalView()}
            >
              <span>
                <Lock size={15} />
                {t.myDashboard}
              </span>
              <small>{t.privateToYou}</small>
            </button>
            {groups.length ? (
              groups.map((group) => (
                <button
                  type="button"
                  className={activeView === "group" && group.id === selectedGroupId ? "active" : ""}
                  key={group.id}
                  onClick={() => showGroupView(group)}
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

          {activeView === "personal" ? (
            <PersonalDashboardView
              busy={busy}
              dashboard={personalDashboard}
              language={language}
              logForm={logForm}
              onDeleteLog={handleDeleteLog}
              onLog={handleLog}
              setLogForm={setLogForm}
              unit={unit}
            />
          ) : selectedGroup && dashboard ? (
            <>
              <div className="view-banner">
                <span>{t.viewingGroup}</span>
                <strong>{dashboard.group.name}</strong>
                <small>{t.groupViewHint}</small>
              </div>

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

              <MemberTrendBoard
                dashboard={dashboard}
                language={language}
                onMemberSelect={setSelectedMember}
                unit={unit}
              />

              <section className="action-row">
                <form className="action-panel" onSubmit={handleBase}>
                  <div className="panel-title">
                    <ShieldCheck size={18} />
                    <span>{t.setBase}</span>
                  </div>
                  <p className="micro-copy panel-hint">
                    {t.baseForGroup} {dashboard.group.name}
                  </p>
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

                <LogWeightForm
                  busy={busy}
                  hint={t.logAppliesAllGroups}
                  language={language}
                  logForm={logForm}
                  onSubmit={handleLog}
                  setLogForm={setLogForm}
                  title={t.logWeight}
                />
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
                          onClick={() => setSelectedMember(member)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedMember(member);
                            }
                          }}
                          role="button"
                          tabIndex={0}
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

      {selectedMember && (
        <MemberProfileModal
          language={language}
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          unit={unit}
        />
      )}
    </main>
  );
}
