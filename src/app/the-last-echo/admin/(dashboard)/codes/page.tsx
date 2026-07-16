"use client";

import { useCallback, useEffect, useState } from "react";
import { rpc, fmtDate, fmtNum } from "../../_lib/rpc";
import {
  Card, Table, Td, Btn, Input, Select, Badge, ErrorNote, OkNote, Spinner,
} from "../../_components/ui";

// Cosmetic name-colour unlocks — mirrors the game's data/cosmetic_colors.json.
const COLOR_OPTIONS: { id: string; name: string }[] = [
  { id: "founder_gold", name: "Founder Gold" },
  { id: "void_purple", name: "Void Purple" },
  { id: "ember_red", name: "Ember Red" },
];

function colorName(id: string): string {
  return COLOR_OPTIONS.find((c) => c.id === id)?.name ?? id;
}

type RedeemCode = {
  code: string;
  gems: number;
  gold: number;
  daily_tickets: number;
  weekly_tickets: number;
  summon_notes: number;
  ability_echoes: number;
  weapon_cores: number;
  relic_tickets: number;
  refinement_dust: number;
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
  const [harpenny, setHarpenny] = useState("");
  const [summonNotes, setSummonNotes] = useState("");
  const [abilityEchoes, setAbilityEchoes] = useState("");
  const [weaponCores, setWeaponCores] = useState("");
  const [relicTickets, setRelicTickets] = useState("");
  const [refinementDust, setRefinementDust] = useState("");
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
          // Harpenny routes through the daily-ticket column — in-game daily/weekly
          // tickets were merged into the single Harpenny token (2026-06-22).
          p_daily_tickets: num(harpenny),
          p_summon_notes: num(summonNotes),
          p_ability_echoes: num(abilityEchoes),
          p_weapon_cores: num(weaponCores),
          p_relic_tickets: num(relicTickets),
          p_refinement_dust: num(refinementDust),
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
      setCode(""); setGems(""); setGold(""); setHarpenny("");
      setSummonNotes(""); setAbilityEchoes(""); setWeaponCores("");
      setRelicTickets(""); setRefinementDust("");
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
      <h1 className="pixel text-2xl font-normal text-[#3a2410]">Codes</h1>
      <div className="flex gap-2">
        {(["redeem", "referral"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === t ? "bg-[#6b4423] text-[#f3e7c9]" : "text-[#5a4226] hover:bg-[#6b4423]/10"
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
              <Input placeholder="Harpenny" type="number" min={0} value={harpenny} onChange={(e) => setHarpenny(e.target.value)} />
              <Input placeholder="Summon Notes" type="number" min={0} value={summonNotes} onChange={(e) => setSummonNotes(e.target.value)} />
              <Input placeholder="Ability Echoes" type="number" min={0} value={abilityEchoes} onChange={(e) => setAbilityEchoes(e.target.value)} />
              <Input placeholder="Weapon Cores" type="number" min={0} value={weaponCores} onChange={(e) => setWeaponCores(e.target.value)} />
              <Input placeholder="Relic Tickets" type="number" min={0} value={relicTickets} onChange={(e) => setRelicTickets(e.target.value)} />
              <Input placeholder="Refinement Dust" type="number" min={0} value={refinementDust} onChange={(e) => setRefinementDust(e.target.value)} />
              <Input placeholder="Expires in N days (blank = never)" type="number" min={0} value={expiresDays} onChange={(e) => setExpiresDays(e.target.value)} />
            </>
          )}
          <Select value={colorId} onChange={(e) => setColorId(e.target.value)}>
            <option value="">No colour unlock</option>
            {COLOR_OPTIONS.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
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
                <tr key={c.code} className="hover:bg-[#6b4423]/[.06]">
                  <Td className="font-mono font-medium text-[#3a2410]">{c.code}</Td>
                  <Td className="text-xs">
                    {[
                      c.gems ? `${fmtNum(c.gems)} gems` : null,
                      c.gold ? `${fmtNum(c.gold)} gold` : null,
                      // daily + weekly are the same in-game token (Harpenny); sum any legacy split.
                      (c.daily_tickets + c.weekly_tickets)
                        ? `${fmtNum(c.daily_tickets + c.weekly_tickets)} harpenny` : null,
                      c.summon_notes ? `${fmtNum(c.summon_notes)} summon notes` : null,
                      c.ability_echoes ? `${fmtNum(c.ability_echoes)} ability echoes` : null,
                      c.weapon_cores ? `${fmtNum(c.weapon_cores)} weapon cores` : null,
                      c.relic_tickets ? `${fmtNum(c.relic_tickets)} relic tickets` : null,
                      c.refinement_dust ? `${fmtNum(c.refinement_dust)} refinement dust` : null,
                      c.color_id ? `color: ${colorName(c.color_id)}` : null,
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
                <tr key={c.code} className="hover:bg-[#6b4423]/[.06]">
                  <Td className="font-mono font-medium text-[#3a2410]">{c.code}</Td>
                  <Td>{fmtNum(c.gems)}</Td>
                  <Td className="text-xs">{c.color_id ? colorName(c.color_id) : "—"}</Td>
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
