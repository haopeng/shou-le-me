export type WeightRecordKind = "all_time" | "year" | "month" | "week";

export type WeightRecordBreakthrough = {
  kind: WeightRecordKind;
  improvementKg: number;
};

type WeightRecordLog = {
  recordedOn: string;
  weightKg: number;
};

function roundTenth(value: number) {
  return Math.round(value * 10) / 10;
}

function isoWeekKey(dateString: string) {
  const date = new Date(`${dateString}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const weekYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${weekYear}-W${String(week).padStart(2, "0")}`;
}

export function findWeightRecordBreakthroughs(
  existingLogs: WeightRecordLog[],
  recordedOn: string,
  weightKg: number
): WeightRecordBreakthrough[] {
  const year = recordedOn.slice(0, 4);
  const month = recordedOn.slice(0, 7);
  const week = isoWeekKey(recordedOn);
  const scopes: Array<{
    kind: WeightRecordKind;
    matches: (log: WeightRecordLog) => boolean;
  }> = [
    { kind: "all_time", matches: () => true },
    { kind: "year", matches: (log) => log.recordedOn.startsWith(year) },
    { kind: "month", matches: (log) => log.recordedOn.startsWith(month) },
    { kind: "week", matches: (log) => isoWeekKey(log.recordedOn) === week }
  ];

  return scopes.flatMap(({ kind, matches }) => {
    const previousWeights = existingLogs.filter(matches).map((log) => log.weightKg);
    if (!previousWeights.length) {
      return [];
    }

    const previousBestKg = Math.min(...previousWeights);
    if (weightKg >= previousBestKg) {
      return [];
    }

    return [{ kind, improvementKg: roundTenth(previousBestKg - weightKg) }];
  });
}
