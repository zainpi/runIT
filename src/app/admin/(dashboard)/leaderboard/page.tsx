"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { rpc, fmtNum } from "../../_lib/rpc";
import { Card, Table, Td, Btn, ErrorNote, OkNote, Spinner } from "../../_components/ui";

type LbRow = {
  rank: number;
  player_id: string;
  display_name: string;
  display_tag: string;
  guild_tag: string | null;
  stage_world: number;
  stage_num: number;
  score: number;
};

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LbRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("leaderboard_weekly")
      .select("*")
      .order("rank", { ascending: true });
    if (err) setError(err.message);
    else setRows((data ?? []) as LbRow[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function rebuild() {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await rpc("admin_rebuild_leaderboard");
      setOk("Leaderboard rebuilt from live player data (flagged accounts excluded).");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Leaderboard (weekly, top 100)</h1>
        <Btn onClick={rebuild} disabled={busy}>
          {busy ? "Rebuilding…" : "Rebuild now"}
        </Btn>
      </div>
      <ErrorNote error={error} />
      <OkNote msg={ok} />
      <Card>
        {!rows ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            Leaderboard is empty — press “Rebuild now”.
          </div>
        ) : (
          <Table head={["#", "Player", "Guild", "Stage", "Combat power"]}>
            {rows.map((r) => (
              <tr key={r.player_id} className="hover:bg-white/[.03]">
                <Td className="font-mono text-slate-400">{r.rank}</Td>
                <Td className="font-medium text-slate-200">
                  {r.display_name}
                  <span className="text-slate-500">#{r.display_tag}</span>
                </Td>
                <Td>{r.guild_tag ? `[${r.guild_tag}]` : "—"}</Td>
                <Td>{r.stage_world}-{r.stage_num}</Td>
                <Td>{fmtNum(r.score)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
