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
  max_hp: number;
  current_hp: number;
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
};

function statusTone(s: Raid["status"]): "good" | "bad" | "warn" | "neutral" {
  if (s === "active") return "good";
  if (s === "defeated") return "warn";
  if (s === "scheduled") return "neutral";
  return "bad"; // expired | cancelled
}

export default function RaidsPage() {
  const [raids, setRaids] = useState<Raid[] | null>(null);
  const [config, setConfig] = useState<RaidConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Schedule form state.
  const [bossId, setBossId] = useState("10");
  const [startLocal, setStartLocal] = useState(""); // datetime-local (admin local time)
  const [duration, setDuration] = useState("");
  const [maxHp, setMaxHp] = useState("");

  const load = useCallback(async () => {
    try {
      const [list, cfg] = await Promise.all([
        rpc<Raid[]>("admin_list_raids", { p_limit: 100 }),
        rpc<RaidConfig>("admin_get_raid_config"),
      ]);
      setRaids(list);
      setConfig(cfg);
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
      const res = await rpc<{ ok?: boolean; duplicate?: boolean }>("admin_schedule_raid", {
        p_boss_id: bossId,
        p_starts_at: startIso,
        p_duration_minutes: dur,
        p_max_hp: hp,
      });
      setOk(res?.duplicate ? "That raid was already scheduled." : "Raid scheduled.");
      setStartLocal("");
      setMaxHp("");
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

  return (
    <div className="space-y-4">
      <h1 className="pixel text-2xl font-normal text-[#3a2410]">World Raids</h1>

      <ErrorNote error={error} />
      <OkNote msg={ok} />

      <Card title="Schedule a raid">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
        </div>
        <div className="mt-2 text-xs text-[#5a4226]">
          {startIso ? (
            <>Schedules for <span className="font-mono">{startIso}</span> (UTC).</>
          ) : (
            <>Times are entered in your local timezone and converted to UTC for the server.</>
          )}
        </div>
        <div className="mt-3">
          <Btn disabled={busy || !startIso} onClick={schedule}>
            {busy ? "Scheduling…" : "Schedule raid"}
          </Btn>
        </div>
      </Card>

      <Card title={`Raids (${raids ? fmtNum(raids.length) : "…"})`}>
        {!raids ? (
          <Spinner />
        ) : (
          <Table head={["Boss", "Starts", "Ends", "HP", "Players", "Src", "Status", ""]}>
            {raids.map((r) => (
              <tr key={r.id} className="hover:bg-[#6b4423]/[.06]">
                <Td className="font-mono text-[#3a2410]">{`W${r.boss_id}`}</Td>
                <Td className="text-xs">{fmtDate(r.starts_at)}</Td>
                <Td className="text-xs">{fmtDate(r.ends_at)}</Td>
                <Td className="text-xs">
                  {fmtNum(Math.round(r.current_hp))} / {fmtNum(Math.round(r.max_hp))}
                </Td>
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
