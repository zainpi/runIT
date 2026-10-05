import { Card } from "../../_components/ui";

export default function LeaderboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="pixel text-2xl font-normal text-[#3a2410]">Leaderboard</h1>
      <Card>
        <p role="status" className="py-4 text-sm text-[#7a5c36]">
          Rankings are temporarily unavailable while verified rankings are prepared.
        </p>
      </Card>
    </div>
  );
}
