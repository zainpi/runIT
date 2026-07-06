"use client";

import { useCallback, useEffect, useState } from "react";
import { rpc, fmtDate } from "../../_lib/rpc";
import { Card, Table, Td, Btn, Badge, ErrorNote, OkNote, Spinner } from "../../_components/ui";

type Report = {
  id: string;
  reason: string;
  created_at: string;
  reporter_id: string;
  reporter_name: string | null;
  reporter_tag: string | null;
  reported_id: string;
  reported_name: string | null;
  reported_tag: string | null;
  message_content: string | null;
  reported_flagged: boolean;
};

export default function ReportsPage() {
  const [rows, setRows] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await rpc<Report[]>("admin_list_reports", { p_limit: 200 }));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function dismiss(id: string) {
    try {
      await rpc("admin_dismiss_report", { p_id: id });
      setRows((r) => (r ? r.filter((x) => x.id !== id) : r));
      setOk("Report dismissed.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function flag(r: Report) {
    try {
      await rpc("admin_flag_player", {
        p_id: r.reported_id,
        p_reason: `player report: ${r.reason.slice(0, 200)}`,
      });
      setOk(`Flagged ${r.reported_name ?? r.reported_id.slice(0, 8)}.`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-white">Player reports</h1>
      <ErrorNote error={error} />
      <OkNote msg={ok} />
      <Card>
        {!rows ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">No open reports. 🎉</div>
        ) : (
          <Table head={["When", "Reported", "By", "Reason", "Message", ""]}>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-white/[.03]">
                <Td className="whitespace-nowrap text-xs">{fmtDate(r.created_at)}</Td>
                <Td>
                  <span className="font-medium text-slate-200">
                    {r.reported_name ?? "?"}
                    <span className="text-slate-500">#{r.reported_tag ?? "????"}</span>
                  </span>
                  {r.reported_flagged && (
                    <div className="mt-0.5"><Badge tone="bad">flagged</Badge></div>
                  )}
                </Td>
                <Td className="text-xs">
                  {r.reporter_name ?? "?"}#{r.reporter_tag ?? "????"}
                </Td>
                <Td className="max-w-xs text-xs">{r.reason}</Td>
                <Td className="max-w-xs text-xs italic text-slate-400">
                  {r.message_content ?? "—"}
                </Td>
                <Td>
                  <div className="flex gap-1.5">
                    {!r.reported_flagged && (
                      <Btn small kind="danger" onClick={() => flag(r)}>Flag</Btn>
                    )}
                    <Btn small kind="ghost" onClick={() => dismiss(r.id)}>Dismiss</Btn>
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
