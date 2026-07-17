"use client";

import { useCallback, useEffect, useState } from "react";
import { rpc, fmtDate, fmtNum } from "../../_lib/rpc";
import {
  Card, Table, Td, Btn, Input, Select, TextArea, Badge, ErrorNote, OkNote, Spinner,
} from "../../_components/ui";
import { COLOR_OPTIONS, rewardSummary, type RewardValues } from "../../_lib/rewards";

type MailRow = {
  id: string;
  recipient_id: string;
  display_name: string | null;
  display_tag: string | null;
  subject: string;
  body: string;
  reward_json: RewardValues | null;
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
  const [harpenny, setHarpenny] = useState("");
  const [summonNotes, setSummonNotes] = useState("");
  const [abilityEchoes, setAbilityEchoes] = useState("");
  const [weaponCores, setWeaponCores] = useState("");
  const [relicTickets, setRelicTickets] = useState("");
  const [refinementDust, setRefinementDust] = useState("");
  const [colorId, setColorId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmingDeleteAll, setConfirmingDeleteAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
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

  function buildReward(): RewardValues | null {
    const reward: RewardValues = {};
    const g = parseInt(gems, 10);
    const go = parseInt(gold, 10);
    const h = parseInt(harpenny, 10);
    const sn = parseInt(summonNotes, 10);
    const ae = parseInt(abilityEchoes, 10);
    const wc = parseInt(weaponCores, 10);
    const rt = parseInt(relicTickets, 10);
    const rd = parseInt(refinementDust, 10);
    if (Number.isFinite(g) && g > 0) reward.gems = g;
    if (Number.isFinite(go) && go > 0) reward.gold = go;
    if (Number.isFinite(h) && h > 0) reward.daily_tickets = h;
    if (Number.isFinite(sn) && sn > 0) reward.summon_notes = sn;
    if (Number.isFinite(ae) && ae > 0) reward.ability_echoes = ae;
    if (Number.isFinite(wc) && wc > 0) reward.weapon_cores = wc;
    if (Number.isFinite(rt) && rt > 0) reward.relic_tickets = rt;
    if (Number.isFinite(rd) && rd > 0) reward.refinement_dust = rd;
    if (colorId) reward.color_id = colorId;
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
      setSubject(""); setBody(""); setGems(""); setGold(""); setHarpenny("");
      setSummonNotes(""); setAbilityEchoes(""); setWeaponCores("");
      setRelicTickets(""); setRefinementDust(""); setColorId("");
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

  async function removeAll() {
    setDeletingAll(true);
    setError(null);
    setOk(null);
    try {
      const deleted = await rpc<number>("admin_delete_all_mail");
      setOk(`Deleted ${fmtNum(deleted)} unclaimed mail${deleted === 1 ? "" : "s"}. Claimed mail was kept for audit.`);
      setConfirmingDeleteAll(false);
      setOffset(0);
      await load(0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeletingAll(false);
    }
  }

  const isBroadcast = !recipient.trim();
  const rewardPreview = buildReward();

  return (
    <div className="space-y-4">
      <h1 className="pixel text-2xl font-normal text-[#3a2410]">Mail & Rewards</h1>
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
            <div className="text-xs uppercase tracking-wider text-[#7a5c36]">Attached rewards (optional)</div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Gems" type="number" min={0} value={gems} onChange={(e) => setGems(e.target.value)} />
              <Input placeholder="Gold" type="number" min={0} value={gold} onChange={(e) => setGold(e.target.value)} />
              <Input placeholder="Harpenny" type="number" min={0} value={harpenny} onChange={(e) => setHarpenny(e.target.value)} />
              <Input placeholder="Summon Notes" type="number" min={0} value={summonNotes} onChange={(e) => setSummonNotes(e.target.value)} />
              <Input placeholder="Ability Echoes" type="number" min={0} value={abilityEchoes} onChange={(e) => setAbilityEchoes(e.target.value)} />
              <Input placeholder="Weapon Cores" type="number" min={0} value={weaponCores} onChange={(e) => setWeaponCores(e.target.value)} />
              <Input placeholder="Relic Tickets" type="number" min={0} value={relicTickets} onChange={(e) => setRelicTickets(e.target.value)} />
              <Input placeholder="Refinement Dust" type="number" min={0} value={refinementDust} onChange={(e) => setRefinementDust(e.target.value)} />
            </div>
            <Select value={colorId} onChange={(e) => setColorId(e.target.value)}>
              <option value="">No colour unlock</option>
              {COLOR_OPTIONS.map((color) => (
                <option key={color.id} value={color.id}>{color.name}</option>
              ))}
            </Select>
            <div className="text-xs text-[#7a5c36]">
              {rewardPreview ? rewardSummary(rewardPreview) : "No reward attached — plain message."}
            </div>
            {!confirming ? (
              <Btn disabled={!subject.trim() || !body.trim() || busy} onClick={() => setConfirming(true)}>
                {isBroadcast ? "Send to everyone…" : "Send to one player…"}
              </Btn>
            ) : (
              <div className="space-y-2 rounded-lg border border-[#d49a30] bg-[#d49a30]/15 p-3">
                <div className="text-sm text-[#7a5410]">
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

      <Card
        title={`Sent mail (${fmtNum(total)})`}
        actions={total > 0 && (
          <Btn small kind="danger" disabled={deletingAll} onClick={() => setConfirmingDeleteAll(true)}>
            Delete all…
          </Btn>
        )}
      >
        {confirmingDeleteAll && (
          <div className="mb-4 space-y-2 rounded-lg border-2 border-[#d8584a] bg-[#d8584a]/10 p-3">
            <div className="text-sm text-[#8a2a20]">
              Delete every unclaimed sent mail? This can’t be undone. Claimed mail will be kept for audit.
            </div>
            <div className="flex gap-2">
              <Btn small kind="danger" disabled={deletingAll} onClick={removeAll}>
                {deletingAll ? "Deleting…" : "Delete all"}
              </Btn>
              <Btn small kind="ghost" disabled={deletingAll} onClick={() => setConfirmingDeleteAll(false)}>Cancel</Btn>
            </div>
          </div>
        )}
        {!rows ? (
          <Spinner />
        ) : (
          <>
            <Table head={["When", "To", "Subject", "Reward", "Status", ""]}>
              {rows.map((m) => (
                <tr key={m.id} className="hover:bg-[#6b4423]/[.06]">
                  <Td className="whitespace-nowrap text-xs">{fmtDate(m.created_at)}</Td>
                  <Td className="text-xs">
                    {m.display_name ? `${m.display_name}#${m.display_tag}` : m.recipient_id.slice(0, 8)}
                  </Td>
                  <Td className="min-w-64 max-w-lg">
                    <div
                      className="whitespace-normal font-medium text-[#3a2410] [overflow-wrap:anywhere]"
                      title={m.subject}
                    >
                      {m.subject}
                    </div>
                    <div className="max-w-md truncate text-xs text-[#7a5c36]">{m.body}</div>
                  </Td>
                  <Td className="text-xs">{rewardSummary(m.reward_json)}</Td>
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
            <div className="mt-3 flex items-center justify-between text-sm text-[#5a4226]">
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
