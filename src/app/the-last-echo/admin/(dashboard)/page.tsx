"use client";

import { useEffect, useState } from "react";
import { rpc, fmtNum } from "../_lib/rpc";
import { Card, StatCard, ErrorNote, Spinner, Badge } from "../_components/ui";

type DayCount = { day: string; count: number };
type Stats = {
  players_total: number;
  players_new_24h: number;
  players_new_7d: number;
  players_active_24h: number;
  players_active_7d: number;
  logins_24h: number;
  logins_7d: number;
  chat_messages_24h: number;
  chat_messages_total: number;
  mail_total: number;
  mail_unclaimed: number;
  guilds_total: number;
  flagged_total: number;
  reports_total: number;
  redeem_codes_active: number;
  redeem_uses_total: number;
  referral_codes_active: number;
  referral_uses_total: number;
  receipts_total: number;
  cloud_saves_total: number;
  maintenance: boolean;
  maintenance_message: string;
  signups_by_day: DayCount[];
  logins_by_day: DayCount[];
};

function MiniBars({ data, label }: { data: DayCount[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div>
      <div className="mb-2 text-xs uppercase tracking-wider text-[#7a5c36]">{label}</div>
      {data.length === 0 ? (
        <div className="text-sm text-[#7a5c36]">No data in the last 30 days.</div>
      ) : (
        <div className="flex h-24 items-end gap-1">
          {data.map((d) => (
            <div
              key={d.day}
              title={`${d.day}: ${d.count}`}
              className="flex-1 rounded-t bg-[#6b4423]/70 hover:bg-[#8a5a2b]"
              style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function OverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    rpc<Stats>("admin_get_stats").then(setStats).catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <ErrorNote error={error} />;
  if (!stats) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="pixel text-2xl font-normal text-[#3a2410]">Overview</h1>
        {stats.maintenance ? (
          <Badge tone="warn">Maintenance mode is ON</Badge>
        ) : (
          <Badge tone="good">Game is live</Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Total players" value={fmtNum(stats.players_total)} />
        <StatCard
          label="Active (24h / 7d)"
          value={`${fmtNum(stats.players_active_24h)} / ${fmtNum(stats.players_active_7d)}`}
        />
        <StatCard
          label="New players (24h / 7d)"
          value={`${fmtNum(stats.players_new_24h)} / ${fmtNum(stats.players_new_7d)}`}
        />
        <StatCard
          label="Logins (24h / 7d)"
          value={`${fmtNum(stats.logins_24h)} / ${fmtNum(stats.logins_7d)}`}
        />
        <StatCard
          label="Chat messages"
          value={fmtNum(stats.chat_messages_total)}
          sub={`${fmtNum(stats.chat_messages_24h)} in last 24h`}
        />
        <StatCard
          label="Mail sent"
          value={fmtNum(stats.mail_total)}
          sub={`${fmtNum(stats.mail_unclaimed)} rewards unclaimed`}
        />
        <StatCard
          label="Redeem codes"
          value={fmtNum(stats.redeem_codes_active)}
          sub={`${fmtNum(stats.redeem_uses_total)} total uses`}
        />
        <StatCard
          label="Referral codes"
          value={fmtNum(stats.referral_codes_active)}
          sub={`${fmtNum(stats.referral_uses_total)} total uses`}
        />
        <StatCard label="Guilds" value={fmtNum(stats.guilds_total)} />
        <StatCard label="Cloud saves" value={fmtNum(stats.cloud_saves_total)} />
        <StatCard label="Purchase receipts" value={fmtNum(stats.receipts_total)} />
        <StatCard
          label="Flagged / reports"
          value={`${fmtNum(stats.flagged_total)} / ${fmtNum(stats.reports_total)}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <MiniBars data={stats.signups_by_day} label="Signups — last 30 days" />
        </Card>
        <Card>
          <MiniBars data={stats.logins_by_day} label="Unique daily logins — last 30 days" />
        </Card>
      </div>
    </div>
  );
}
