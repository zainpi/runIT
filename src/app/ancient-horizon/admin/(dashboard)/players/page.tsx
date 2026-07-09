"use client";

import { useCallback, useEffect, useState } from "react";
import { rpc, fmtDate, fmtNum } from "../../_lib/rpc";
import {
  Card, Table, Td, Btn, Input, TextArea, Badge, ErrorNote, OkNote, Spinner,
} from "../../_components/ui";

type PlayerRow = {
  id: string;
  display_name: string;
  display_tag: string;
  stage_world: number;
  stage_num: number;
  combat_power: number;
  created_at: string;
  updated_at: string;
  guild_name: string | null;
  guild_tag: string | null;
  email: string | null;
  is_guest: boolean;
  flagged: boolean;
  flag_reason: string | null;
  last_login: string | null;
};

type PlayerDetail = {
  player: Record<string, unknown> | null;
  email: string | null;
  auth_created: string | null;
  flagged: { flag_reason: string; flagged_at: string } | null;
  guild: { name: string; tag: string } | null;
  logins: { occurred_at: string; provider: string | null; platform: string | null; app_version: string | null }[];
  mail_count: number;
  recent_mail: { id: string; subject: string; claimed: boolean; created_at: string }[];
  redemptions: { code: string; redeemed_at: string }[];
  referral: { code: string; redeemed_at: string } | null;
  receipts: { transaction_id: string; platform: string; product_id: string; validated_at: string; granted: boolean }[];
  entitlements: { speed_access_until: string } | null;
  has_cloud_save: boolean;
  chat_count: number;
  reports_against: number;
};

const PAGE = 50;

export default function PlayersPage() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("created_at");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<PlayerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [selected, setSelected] = useState<PlayerRow | null>(null);
  const [detail, setDetail] = useState<PlayerDetail | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [mailSubject, setMailSubject] = useState("");
  const [mailBody, setMailBody] = useState("");
  const [mailGems, setMailGems] = useState("");

  const load = useCallback(async (q: string, s: string, off: number) => {
    setError(null);
    try {
      const res = await rpc<{ total: number; rows: PlayerRow[] }>("admin_list_players", {
        p_search: q || null,
        p_limit: PAGE,
        p_offset: off,
        p_sort: s,
      });
      setRows(res.rows);
      setTotal(res.total);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load(query, sort, offset);
  }, [query, sort, offset, load]);

  async function openDetail(p: PlayerRow) {
    setSelected(p);
    setDetail(null);
    setOk(null);
    try {
      setDetail(await rpc<PlayerDetail>("admin_get_player", { p_id: p.id }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function toggleFlag(p: PlayerRow) {
    setError(null);
    setOk(null);
    try {
      if (p.flagged) {
        await rpc("admin_unflag_player", { p_id: p.id });
        setOk(`Unflagged ${p.display_name}#${p.display_tag} — they will re-enter the leaderboard on next rebuild.`);
      } else {
        const reason = flagReason.trim() || "flagged from admin dashboard";
        await rpc("admin_flag_player", { p_id: p.id, p_reason: reason });
        setOk(`Flagged ${p.display_name}#${p.display_tag} — excluded from leaderboard rebuilds.`);
      }
      setFlagReason("");
      await load(query, sort, offset);
      if (selected?.id === p.id) openDetail({ ...p, flagged: !p.flagged });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function sendMail() {
    if (!selected) return;
    setError(null);
    setOk(null);
    try {
      const gems = parseInt(mailGems, 10);
      const reward = Number.isFinite(gems) && gems > 0 ? { gems } : null;
      await rpc("admin_broadcast_mail", {
        p_subject: mailSubject.trim(),
        p_body: mailBody.trim(),
        p_reward_json: reward,
        p_recipient: selected.id,
      });
      setOk(`Mail sent to ${selected.display_name}#${selected.display_tag}.`);
      setMailSubject("");
      setMailBody("");
      setMailGems("");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="pixel text-2xl font-normal text-[#3a2410]">Players</h1>
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setOffset(0);
            setQuery(search);
          }}
        >
          <Input
            placeholder="Search name, email, or player UUID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
          <Btn type="submit">Search</Btn>
        </form>
        <select
          value={sort}
          onChange={(e) => {
            setOffset(0);
            setSort(e.target.value);
          }}
          className="rounded-lg border border-[#8a5a2b] bg-[#fbf2dc] px-3 py-2 text-sm text-[#3a2410]"
        >
          <option value="created_at">Newest</option>
          <option value="updated_at">Recently active</option>
          <option value="combat_power">Combat power</option>
          <option value="stage">Stage</option>
        </select>
      </div>

      <ErrorNote error={error} />
      <OkNote msg={ok} />

      <Card title={`${fmtNum(total)} players`}>
        {!rows ? (
          <Spinner />
        ) : (
          <>
            <Table head={["Player", "Account", "Stage", "CP", "Guild", "Last login", "Joined", ""]}>
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-[#6b4423]/[.06]">
                  <Td>
                    <button className="text-left text-[#3f7a24] hover:underline" onClick={() => openDetail(p)}>
                      {p.display_name}
                      <span className="text-[#7a5c36]">#{p.display_tag}</span>
                    </button>
                    {p.flagged && (
                      <div className="mt-0.5">
                        <Badge tone="bad">flagged</Badge>
                      </div>
                    )}
                  </Td>
                  <Td className="max-w-[180px] truncate text-xs text-[#5a4226]">
                    {p.is_guest ? <Badge>guest</Badge> : p.email}
                  </Td>
                  <Td>
                    {p.stage_world}-{p.stage_num}
                  </Td>
                  <Td>{fmtNum(p.combat_power)}</Td>
                  <Td className="text-xs">{p.guild_tag ? `[${p.guild_tag}] ${p.guild_name}` : "—"}</Td>
                  <Td className="text-xs">{fmtDate(p.last_login)}</Td>
                  <Td className="text-xs">{fmtDate(p.created_at)}</Td>
                  <Td>
                    <Btn small kind={p.flagged ? "ghost" : "danger"} onClick={() => toggleFlag(p)}>
                      {p.flagged ? "Unflag" : "Flag"}
                    </Btn>
                  </Td>
                </tr>
              ))}
            </Table>
            <div className="mt-3 flex items-center justify-between text-sm text-[#5a4226]">
              <Btn small kind="ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
                ← Prev
              </Btn>
              <span>
                {offset + 1}–{Math.min(offset + PAGE, total)} of {fmtNum(total)}
              </span>
              <Btn small kind="ghost" disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>
                Next →
              </Btn>
            </div>
          </>
        )}
      </Card>

      {selected && (
        <Card
          title={`${selected.display_name}#${selected.display_tag}`}
          actions={
            <Btn small kind="ghost" onClick={() => setSelected(null)}>
              Close
            </Btn>
          }
        >
          {!detail ? (
            <Spinner />
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2 text-[#4a3218]">
                  <div><span className="text-[#7a5c36]">UUID:</span> <span className="break-all text-xs">{selected.id}</span></div>
                  <div><span className="text-[#7a5c36]">Email:</span> {detail.email ?? "guest"}</div>
                  <div><span className="text-[#7a5c36]">Mail:</span> {detail.mail_count}</div>
                  <div><span className="text-[#7a5c36]">Chat msgs:</span> {detail.chat_count}</div>
                  <div><span className="text-[#7a5c36]">Reports against:</span> {detail.reports_against}</div>
                  <div><span className="text-[#7a5c36]">Cloud save:</span> {detail.has_cloud_save ? "yes" : "no"}</div>
                  <div><span className="text-[#7a5c36]">2× speed until:</span> {fmtDate(detail.entitlements?.speed_access_until)}</div>
                  <div><span className="text-[#7a5c36]">Referral used:</span> {detail.referral?.code ?? "—"}</div>
                </div>
                {detail.flagged && (
                  <div className="text-[#8a2a20]">
                    Flagged {fmtDate(detail.flagged.flagged_at)}: {detail.flagged.flag_reason}
                  </div>
                )}
                {!selected.flagged && (
                  <div className="flex gap-2">
                    <Input placeholder="Flag reason…" value={flagReason} onChange={(e) => setFlagReason(e.target.value)} />
                    <Btn small kind="danger" onClick={() => toggleFlag(selected)}>Flag</Btn>
                  </div>
                )}
                <div>
                  <div className="mb-1 text-xs uppercase tracking-wider text-[#7a5c36]">Recent logins</div>
                  {detail.logins.length === 0 ? (
                    <div className="text-[#7a5c36]">None recorded.</div>
                  ) : (
                    <ul className="space-y-0.5 text-xs text-[#5a4226]">
                      {detail.logins.slice(0, 8).map((l, i) => (
                        <li key={i}>
                          {fmtDate(l.occurred_at)} — {l.provider ?? "?"} / {l.platform ?? "?"} {l.app_version ?? ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <div className="mb-1 text-xs uppercase tracking-wider text-[#7a5c36]">Code redemptions</div>
                  {detail.redemptions.length === 0 ? (
                    <div className="text-[#7a5c36]">None.</div>
                  ) : (
                    <ul className="space-y-0.5 text-xs text-[#5a4226]">
                      {detail.redemptions.map((r) => (
                        <li key={r.code}>{r.code} — {fmtDate(r.redeemed_at)}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wider text-[#7a5c36]">Send mail to this player</div>
                <Input placeholder="Subject" maxLength={100} value={mailSubject} onChange={(e) => setMailSubject(e.target.value)} />
                <TextArea placeholder="Body" rows={3} maxLength={2000} value={mailBody} onChange={(e) => setMailBody(e.target.value)} />
                <Input placeholder="Gems reward (optional)" type="number" min={0} value={mailGems} onChange={(e) => setMailGems(e.target.value)} />
                <Btn onClick={sendMail} disabled={!mailSubject.trim() || !mailBody.trim()}>
                  Send mail
                </Btn>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
