"use client";

import { useCallback, useEffect, useState } from "react";
import { rpc, fmtDate, fmtNum } from "../../_lib/rpc";
import {
  Card, Table, Td, Btn, Input, Select, Badge, ErrorNote, OkNote, Spinner,
} from "../../_components/ui";

// Boss ids map to data/world_bosses.json keys (world-number strings). Worlds 1-20 are the
// curated bosses; the migration falls back to the default boss art for any unknown id.
const BOSS_OPTIONS = Array.from({ length: 20 }, (_, i) => String(i + 1));

type Raid = {
  id: string;
  boss_id: string;
  boss_level: number;
  max_hp: number;
  current_hp: number;
  boss_damage: number;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "active" | "defeated" | "expired" | "cancelled";
  settled: boolean;
  defeated_at: string | null;
  created_at: string;
  schedule_source: "admin" | "cron";
  participant_count: number;
};

type RaidConfig = {
  default_max_hp: number;
  default_duration_min: number;
  hp_growth_per_level: number;
  damage_growth_per_level: number;
};

type RaidSchedule = {
  id: string;
  boss_id: string;
  every_hours: number;
  duration_minutes: number;
  enabled: boolean;
  next_run_at: string;
};

function statusTone(s: Raid["status"]): "good" | "bad" | "warn" | "neutral" {
  if (s === "active") return "good";
  if (s === "defeated") return "warn";
  if (s === "scheduled") return "neutral";
  return "bad"; // expired | cancelled
}

export default function RaidsPage() {
  const [raids, setRaids] = useState<Raid[] | null>(null);
  const [schedules, setSchedules] = useState<RaidSchedule[] | null>(null);
  const [config, setConfig] = useState<RaidConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Schedule form state.
  const [bossId, setBossId] = useState("10");
  const [startLocal, setStartLocal] = useState(""); // datetime-local (admin local time)
  const [duration, setDuration] = useState("");
  const [maxHp, setMaxHp] = useState("");
  const [repeatEveryHours, setRepeatEveryHours] = useState("");
  const baseHp = config?.default_max_hp ?? 10_000_000_000;
  const hpGrowth = config?.hp_growth_per_level ?? 0.35;
  const damageGrowth = config?.damage_growth_per_level ?? 0.12;

  const load = useCallback(async () => {
    try {
      const [list, cfg, scheduled] = await Promise.all([
        rpc<Raid[]>("admin_list_raids", { p_limit: 100 }),
        rpc<RaidConfig>("admin_get_raid_config"),
        rpc<RaidSchedule[]>("admin_list_raid_schedules"),
      ]);
      setRaids(list);
      setConfig(cfg);
      setSchedules(scheduled);
      if (!duration && cfg?.default_duration_min) setDuration(String(cfg.default_duration_min));
    } catch (e) {
      setError((e as Error).message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The datetime-local input is interpreted as the admin's LOCAL time; toISOString()
  // converts it to the UTC instant the server schedules against.
  const startIso = startLocal ? new Date(startLocal).toISOString() : "";

  async function schedule() {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      if (!startIso) throw new Error("Pick a start time.");
      const startsAtMs = new Date(startIso).getTime();
      if (!Number.isFinite(startsAtMs) || startsAtMs <= Date.now()) {
        throw new Error("Start time must be in the future.");
      }
      const dur = parseInt(duration, 10);
      if (!Number.isFinite(dur) || dur < 5 || dur > 1440) {
        throw new Error("Duration must be 5–1440 minutes.");
      }
      const hp = maxHp.trim() ? parseFloat(maxHp) : null;
      if (hp !== null && (!Number.isFinite(hp) || hp <= 0)) {
        throw new Error("Max HP must be a positive number, or blank for the default.");
      }
      const everyHours = repeatEveryHours.trim() ? Number(repeatEveryHours) : null;
      if (everyHours !== null && (!Number.isFinite(everyHours) || everyHours < 1 || everyHours > 720)) {
        throw new Error("Repeat interval must be 1–720 hours.");
      }

      if (everyHours === null) {
        const res = await rpc<{ ok?: boolean; duplicate?: boolean }>("admin_schedule_raid", {
          p_boss_id: bossId,
          p_starts_at: startIso,
          p_duration_minutes: dur,
          p_max_hp: hp,
        });
        setOk(res?.duplicate ? "That raid was already scheduled." : "Raid scheduled.");
      } else {
        await rpc("admin_create_raid_schedule", {
          p_boss_id: bossId,
          p_starts_at: startIso,
          p_every_hours: everyHours,
          p_duration_minutes: dur,
          p_max_hp: hp,
        });
        setOk(`Raid schedule created: every ${everyHours} hour${everyHours === 1 ? "" : "s"}.`);
      }
      setStartLocal("");
      setMaxHp("");
      setRepeatEveryHours("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    setError(null);
    setOk(null);
    try {
      await rpc("admin_cancel_raid", { p_raid_id: id });
      setOk("Raid cancelled.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function cancelSchedule(id: string) {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await rpc("admin_cancel_raid_schedule", { p_schedule_id: id });
      setOk("Recurring raid schedule paused.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="pixel text-2xl font-normal text-[#3a2410]">World Raids</h1>

      <ErrorNote error={error} />
      <OkNote msg={ok} />

      <p className="text-sm text-[#5a4226]">
        Bosses begin at <span className="font-semibold text-[#3a2410]">{fmtNum(baseHp)} HP</span>.
        Each defeat permanently raises that boss one level: <span className="font-semibold text-[#3a2410]">+{Math.round(hpGrowth * 100)}% HP</span> and <span className="font-semibold text-[#3a2410]">+{Math.round(damageGrowth * 100)}% damage</span> per level.
      </p>

      <Card title="Schedule a raid">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <label className="text-xs text-[#5a4226]">
            Boss (world)
            <Select value={bossId} onChange={(e) => setBossId(e.target.value)}>
              {BOSS_OPTIONS.map((b) => (
                <option key={b} value={b}>{`World ${b}`}</option>
              ))}
            </Select>
          </label>
          <label className="text-xs text-[#5a4226]">
            Start (your local time)
            <Input
              type="datetime-local"
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
            />
          </label>
          <label className="text-xs text-[#5a4226]">
            Duration (minutes, 5–1440)
            <Input
              type="number"
              min={5}
              max={1440}
              placeholder={config ? String(config.default_duration_min) : "120"}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </label>
          <label className="text-xs text-[#5a4226]">
            Max HP (blank = default)
            <Input
              type="number"
              min={1}
              placeholder={config ? fmtNum(config.default_max_hp) : "10000000000"}
              value={maxHp}
              onChange={(e) => setMaxHp(e.target.value)}
            />
          </label>
          <label className="text-xs text-[#5a4226]">
            Repeat every (hours, optional)
            <Input
              type="number"
              min={1}
              max={720}
              placeholder="One-time raid"
              value={repeatEveryHours}
              onChange={(e) => setRepeatEveryHours(e.target.value)}
            />
          </label>
        </div>
        <div className="mt-2 text-xs text-[#5a4226]">
          {startIso ? (
            <>Schedules for <span className="font-mono">{startIso}</span> (UTC).</>
          ) : (
            <>Times are entered in your local timezone and converted to UTC for the server.</>
          )}
          <span className="block mt-1">Recurring raids launch on this start time, then every chosen number of hours. Each defeat increases that boss&apos;s level.</span>
        </div>
        <div className="mt-3">
          <Btn disabled={busy || !startIso} onClick={schedule}>
            {busy ? "Scheduling…" : "Schedule raid"}
          </Btn>
        </div>
      </Card>

      <Card title="Recurring raid schedules">
        {!schedules ? (
          <Spinner />
        ) : schedules.length === 0 ? (
          <p className="text-sm text-[#5a4226]">No recurring raid schedules yet.</p>
        ) : (
          <Table head={["Boss", "Every", "Duration", "Next raid", "Status", ""]}>
            {schedules.map((schedule) => (
              <tr key={schedule.id} className="hover:bg-[#6b4423]/[.06]">
                <Td className="font-mono text-[#3a2410]">{`W${schedule.boss_id}`}</Td>
                <Td>{`${schedule.every_hours}h`}</Td>
                <Td>{`${schedule.duration_minutes} min`}</Td>
                <Td className="text-xs">{fmtDate(schedule.next_run_at)}</Td>
                <Td><Badge tone={schedule.enabled ? "good" : "neutral"}>{schedule.enabled ? "active" : "paused"}</Badge></Td>
                <Td>{schedule.enabled ? <Btn small kind="danger" disabled={busy} onClick={() => cancelSchedule(schedule.id)}>Pause</Btn> : "—"}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title={`Raids (${raids ? fmtNum(raids.length) : "…"})`}>
        {!raids ? (
          <Spinner />
        ) : (
          <Table head={["Boss", "Lvl", "Starts", "Ends", "HP", "DMG", "Players", "Src", "Status", ""]}>
            {raids.map((r) => (
              <tr key={r.id} className="hover:bg-[#6b4423]/[.06]">
                <Td className="font-mono text-[#3a2410]">{`W${r.boss_id}`}</Td>
                <Td>{fmtNum(r.boss_level ?? 1)}</Td>
                <Td className="text-xs">{fmtDate(r.starts_at)}</Td>
                <Td className="text-xs">{fmtDate(r.ends_at)}</Td>
                <Td className="text-xs">
                  {fmtNum(Math.round(r.current_hp))} / {fmtNum(Math.round(r.max_hp))}
                </Td>
                <Td>{fmtNum(Math.round(r.boss_damage ?? 0))}</Td>
                <Td>{fmtNum(r.participant_count)}</Td>
                <Td className="text-xs">{r.schedule_source}</Td>
                <Td>
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                  {r.settled ? <span className="ml-1 text-[10px] text-[#5a4226]">settled</span> : null}
                </Td>
                <Td>
                  {r.status === "scheduled" || r.status === "active" ? (
                    <Btn small kind="danger" onClick={() => cancel(r.id)}>
                      Cancel
                    </Btn>
                  ) : (
                    <span className="text-[#5a4226]">—</span>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
