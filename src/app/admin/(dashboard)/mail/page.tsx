"use client";

import { useCallback, useEffect, useState } from "react";
import { rpc, fmtDate, fmtNum } from "../../_lib/rpc";
import {
  Card, Table, Td, Btn, Input, TextArea, Badge, ErrorNote, OkNote, Spinner,
} from "../../_components/ui";

type MailRow = {
  id: string;
  recipient_id: string;
  display_name: string | null;
  display_tag: string | null;
  subject: string;
  body: string;
  reward_json: Record<string, unknown> | null;
  read: boolean;
  claimed: boolean;
  created_at: string;
};

const PAGE = 50;

export default function MailPage() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [gems, setGems] = useState("");
  const [gold, setGold] = useState("");
  const [daily, setDaily] = useState("");
  const [weekly, setWeekly] = useState("");
  const [recipient, setRecipient] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [rows, setRows] = useState<MailRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);

  const load = useCallback(async (off: number) => {
    try {
      const res = await rpc<{ total: number; rows: MailRow[] }>("admin_list_mail", {
        p_limit: PAGE,
        p_offset: off,
      });
      setRows(res.rows);
      setTotal(res.total);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load(offset);
  }, [offset, load]);

  function buildReward(): Record<string, number> | null {
    const reward: Record<string, number> = {};
    const g = parseInt(gems, 10);
    const go = parseInt(gold, 10);
    const d = parseInt(daily, 10);
    const w = parseInt(weekly, 10);
    if (Number.isFinite(g) && g > 0) reward.gems = g;
    if (Number.isFinite(go) && go > 0) reward.gold = go;
    if (Number.isFinite(d) && d > 0) reward.daily_tickets = d;
    if (Number.isFinite(w) && w > 0) reward.weekly_tickets = w;
    return Object.keys(reward).length ? reward : null;
  }

  async function send() {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const count = await rpc<number>("admin_broadcast_mail", {
        p_subject: subject.trim(),
        p_body: body.trim(),
        p_reward_json: buildReward(),
        p_recipient: recipient.trim() || null,
      });
      setOk(`Delivered ${fmtNum(count)} mail${count === 1 ? "" : "s"}.`);
      setSubject(""); setBody(""); setGems(""); setGold(""); setDaily(""); setWeekly("");
      setConfirming(false);
      await load(0);
      setOffset(0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      const deleted = await rpc<boolean>("admin_delete_mail", { p_id: id });
      if (!deleted) setError("Mail not deleted — claimed mail is kept for audit.");
      await load(offset);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const isBroadcast = !recipient.trim();
  const rewardPreview = buildReward();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-white">Mail & Rewards</h1>
      <ErrorNote error={error} />
      <OkNote msg={ok} />

      <Card title="Compose">
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-2">
            <Input placeholder="Subject (max 100 chars)" maxLength={100} value={subject} onChange={(e) => setSubject(e.target.value)} />
            <TextArea placeholder="Body (max 2000 chars)" rows={5} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
            <Input
              placeholder="Recipient player UUID — leave empty to send to EVERYONE"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-slate-500">Attached rewards (optional)</div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Gems" type="number" min={0} value={gems} onChange={(e) => setGems(e.target.value)} />
              <Input placeholder="Gold" type="number" min={0} value={gold} onChange={(e) => setGold(e.target.value)} />
              <Input placeholder="Daily tickets" type="number" min={0} value={daily} onChange={(e) => setDaily(e.target.value)} />
              <Input placeholder="Weekly tickets" type="number" min={0} value={weekly} onChange={(e) => setWeekly(e.target.value)} />
            </div>
            <div className="text-xs text-slate-500">
              {rewardPreview ? `reward_json: ${JSON.stringify(rewardPreview)}` : "No reward attached — plain message."}
            </div>
            {!confirming ? (
              <Btn disabled={!subject.trim() || !body.trim() || busy} onClick={() => setConfirming(true)}>
                {isBroadcast ? "Send to everyone…" : "Send to one player…"}
              </Btn>
            ) : (
              <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <div className="text-sm text-amber-300">
                  {isBroadcast
                    ? "This sends the mail (and rewards) to EVERY player. Are you sure?"
                    : `Send to player ${recipient.trim()}?`}
                </div>
                <div className="flex gap-2">
                  <Btn kind="danger" disabled={busy} onClick={send}>
                    {busy ? "Sending…" : "Yes, send it"}
                  </Btn>
                  <Btn kind="ghost" onClick={() => setConfirming(false)}>Cancel</Btn>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card title={`Sent mail (${fmtNum(total)})`}>
        {!rows ? (
          <Spinner />
        ) : (
          <>
            <Table head={["When", "To", "Subject", "Reward", "Status", ""]}>
              {rows.map((m) => (
                <tr key={m.id} className="hover:bg-white/[.03]">
                  <Td className="whitespace-nowrap text-xs">{fmtDate(m.created_at)}</Td>
                  <Td className="text-xs">
                    {m.display_name ? `${m.display_name}#${m.display_tag}` : m.recipient_id.slice(0, 8)}
                  </Td>
                  <Td>
                    <div className="font-medium text-slate-200">{m.subject}</div>
                    <div className="max-w-md truncate text-xs text-slate-500">{m.body}</div>
                  </Td>
                  <Td className="text-xs">{m.reward_json ? JSON.stringify(m.reward_json) : "—"}</Td>
                  <Td>
                    {m.claimed ? <Badge tone="good">claimed</Badge> : m.read ? <Badge>read</Badge> : <Badge tone="brand">unread</Badge>}
                  </Td>
                  <Td>
                    {!m.claimed && (
                      <Btn small kind="danger" onClick={() => remove(m.id)}>Delete</Btn>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
            <div className="mt-3 flex items-center justify-between text-sm text-slate-400">
              <Btn small kind="ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>← Prev</Btn>
              <span>{offset + 1}–{Math.min(offset + PAGE, total)} of {fmtNum(total)}</span>
              <Btn small kind="ghost" disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>Next →</Btn>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
