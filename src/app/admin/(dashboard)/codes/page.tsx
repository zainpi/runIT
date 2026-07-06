"use client";

import { useCallback, useEffect, useState } from "react";
import { rpc, fmtDate, fmtNum } from "../../_lib/rpc";
import {
  Card, Table, Td, Btn, Input, Badge, ErrorNote, OkNote, Spinner,
} from "../../_components/ui";

type RedeemCode = {
  code: string;
  gems: number;
  gold: number;
  daily_tickets: number;
  weekly_tickets: number;
  color_id: string | null;
  max_uses: number | null;
  uses_count: number;
  active: boolean;
  expires_at: string | null;
  created_at: string;
};

type ReferralCode = {
  code: string;
  gems: number;
  color_id: string | null;
  max_uses: number | null;
  uses_count: number;
  active: boolean;
  created_at: string;
};

export default function CodesPage() {
  const [tab, setTab] = useState<"redeem" | "referral">("redeem");
  const [redeem, setRedeem] = useState<RedeemCode[] | null>(null);
  const [referral, setReferral] = useState<ReferralCode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // create form state
  const [code, setCode] = useState("");
  const [gems, setGems] = useState("");
  const [gold, setGold] = useState("");
  const [daily, setDaily] = useState("");
  const [weekly, setWeekly] = useState("");
  const [colorId, setColorId] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresDays, setExpiresDays] = useState("");

  const load = useCallback(async () => {
    try {
      const [rc, rf] = await Promise.all([
        rpc<RedeemCode[]>("admin_list_redeem_codes"),
        rpc<ReferralCode[]>("admin_list_referral_codes"),
      ]);
      setRedeem(rc);
      setReferral(rf);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function num(v: string): number {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  async function create() {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      if (tab === "redeem") {
        const days = num(expiresDays);
        const created = await rpc<string>("admin_create_redeem_code", {
          p_code: code.trim(),
          p_gems: num(gems),
          p_gold: num(gold),
          p_daily_tickets: num(daily),
          p_weekly_tickets: num(weekly),
          p_color_id: colorId.trim() || null,
          p_max_uses: num(maxUses) || null,
          p_expires_at: days
            ? new Date(Date.now() + days * 86400_000).toISOString()
            : null,
        });
        setOk(`Redeem code ${created} created.`);
      } else {
        const created = await rpc<string>("admin_create_referral_code", {
          p_code: code.trim(),
          p_gems: num(gems) || 1350,
          p_color_id: colorId.trim() || null,
          p_max_uses: num(maxUses) || null,
        });
        setOk(`Referral code ${created} created.`);
      }
      setCode(""); setGems(""); setGold(""); setDaily(""); setWeekly("");
      setColorId(""); setMaxUses(""); setExpiresDays("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(kind: "redeem" | "referral", c: string, active: boolean) {
    setError(null);
    try {
      await rpc("admin_set_code_active", { p_kind: kind, p_code: c, p_active: !active });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-white">Codes</h1>
      <div className="flex gap-2">
        {(["redeem", "referral"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === t ? "bg-brand-600/20 text-brand-200" : "text-slate-400 hover:bg-white/5"
            }`}
          >
            {t === "redeem" ? "Redeem codes" : "Referral codes"}
          </button>
        ))}
      </div>

      <ErrorNote error={error} />
      <OkNote msg={ok} />

      <Card title={`Create ${tab} code`}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Input placeholder="CODE (3–32 chars)" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <Input placeholder={tab === "referral" ? "Gems (default 1350)" : "Gems"} type="number" min={0} value={gems} onChange={(e) => setGems(e.target.value)} />
          {tab === "redeem" && (
            <>
              <Input placeholder="Gold" type="number" min={0} value={gold} onChange={(e) => setGold(e.target.value)} />
              <Input placeholder="Daily tickets" type="number" min={0} value={daily} onChange={(e) => setDaily(e.target.value)} />
              <Input placeholder="Weekly tickets" type="number" min={0} value={weekly} onChange={(e) => setWeekly(e.target.value)} />
              <Input placeholder="Expires in N days (blank = never)" type="number" min={0} value={expiresDays} onChange={(e) => setExpiresDays(e.target.value)} />
            </>
          )}
          <Input placeholder="Color unlock id (optional)" value={colorId} onChange={(e) => setColorId(e.target.value)} />
          <Input placeholder="Max uses (blank = unlimited)" type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
        </div>
        <div className="mt-3">
          <Btn disabled={busy || code.trim().length < 3} onClick={create}>
            {busy ? "Creating…" : "Create code"}
          </Btn>
        </div>
      </Card>

      {tab === "redeem" ? (
        <Card title={`Redeem codes (${redeem ? fmtNum(redeem.length) : "…"})`}>
          {!redeem ? (
            <Spinner />
          ) : (
            <Table head={["Code", "Rewards", "Uses", "Expires", "Status", ""]}>
              {redeem.map((c) => (
                <tr key={c.code} className="hover:bg-white/[.03]">
                  <Td className="font-mono font-medium text-slate-200">{c.code}</Td>
                  <Td className="text-xs">
                    {[
                      c.gems ? `${fmtNum(c.gems)} gems` : null,
                      c.gold ? `${fmtNum(c.gold)} gold` : null,
                      c.daily_tickets ? `${c.daily_tickets} daily` : null,
                      c.weekly_tickets ? `${c.weekly_tickets} weekly` : null,
                      c.color_id ? `color: ${c.color_id}` : null,
                    ].filter(Boolean).join(", ") || "—"}
                  </Td>
                  <Td>{fmtNum(c.uses_count)}{c.max_uses ? ` / ${fmtNum(c.max_uses)}` : ""}</Td>
                  <Td className="text-xs">{c.expires_at ? fmtDate(c.expires_at) : "never"}</Td>
                  <Td>{c.active ? <Badge tone="good">active</Badge> : <Badge tone="bad">disabled</Badge>}</Td>
                  <Td>
                    <Btn small kind={c.active ? "danger" : "ghost"} onClick={() => toggle("redeem", c.code, c.active)}>
                      {c.active ? "Disable" : "Enable"}
                    </Btn>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      ) : (
        <Card title={`Referral codes (${referral ? fmtNum(referral.length) : "…"})`}>
          {!referral ? (
            <Spinner />
          ) : (
            <Table head={["Code", "Gems", "Color", "Uses", "Status", ""]}>
              {referral.map((c) => (
                <tr key={c.code} className="hover:bg-white/[.03]">
                  <Td className="font-mono font-medium text-slate-200">{c.code}</Td>
                  <Td>{fmtNum(c.gems)}</Td>
                  <Td className="text-xs">{c.color_id ?? "—"}</Td>
                  <Td>{fmtNum(c.uses_count)}{c.max_uses ? ` / ${fmtNum(c.max_uses)}` : ""}</Td>
                  <Td>{c.active ? <Badge tone="good">active</Badge> : <Badge tone="bad">disabled</Badge>}</Td>
                  <Td>
                    <Btn small kind={c.active ? "danger" : "ghost"} onClick={() => toggle("referral", c.code, c.active)}>
                      {c.active ? "Disable" : "Enable"}
                    </Btn>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}
