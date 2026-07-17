import { fmtNum } from "./rpc";

export const COLOR_OPTIONS: { id: string; name: string }[] = [
  { id: "founder_gold", name: "Founder Gold" },
  { id: "void_purple", name: "Void Purple" },
  { id: "ember_red", name: "Ember Red" },
];

export type RewardValues = {
  gems?: number;
  gold?: number;
  daily_tickets?: number;
  weekly_tickets?: number;
  summon_notes?: number;
  ability_echoes?: number;
  weapon_cores?: number;
  relic_tickets?: number;
  refinement_dust?: number;
  color_id?: string | null;
};

export function colorName(id: string): string {
  return COLOR_OPTIONS.find((color) => color.id === id)?.name ?? id;
}

export function rewardSummary(reward: RewardValues | null): string {
  if (!reward) return "—";

  const harpenny = (reward.daily_tickets ?? 0) + (reward.weekly_tickets ?? 0);
  return [
    reward.gems ? `${fmtNum(reward.gems)} gems` : null,
    reward.gold ? `${fmtNum(reward.gold)} gold` : null,
    harpenny ? `${fmtNum(harpenny)} harpenny` : null,
    reward.summon_notes ? `${fmtNum(reward.summon_notes)} summon notes` : null,
    reward.ability_echoes ? `${fmtNum(reward.ability_echoes)} ability echoes` : null,
    reward.weapon_cores ? `${fmtNum(reward.weapon_cores)} weapon cores` : null,
    reward.relic_tickets ? `${fmtNum(reward.relic_tickets)} relic tickets` : null,
    reward.refinement_dust ? `${fmtNum(reward.refinement_dust)} refinement dust` : null,
    reward.color_id ? `color: ${colorName(reward.color_id)}` : null,
  ].filter(Boolean).join(", ") || "—";
}
