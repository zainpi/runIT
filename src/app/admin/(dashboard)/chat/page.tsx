"use client";

import { useCallback, useEffect, useState } from "react";
import { rpc, fmtDate } from "../../_lib/rpc";
import { Card, Btn, Badge, ErrorNote, OkNote, Spinner } from "../../_components/ui";

type ChatMsg = {
  id: string;
  channel: string;
  guild_id: string | null;
  sender_id: string;
  content: string;
  created_at: string;
  display_name: string | null;
  display_tag: string | null;
  sender_flagged: boolean;
};

export default function ChatPage() {
  const [rows, setRows] = useState<ChatMsg[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await rpc<ChatMsg[]>("admin_list_chat", { p_limit: 100 }));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function loadMore() {
    if (!rows || rows.length === 0) return;
    setLoadingMore(true);
    try {
      const older = await rpc<ChatMsg[]>("admin_list_chat", {
        p_limit: 100,
        p_before: rows[rows.length - 1].created_at,
      });
      setRows([...rows, ...older]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await rpc("admin_delete_chat_message", { p_id: id });
      setRows((r) => (r ? r.filter((m) => m.id !== id) : r));
      setOk("Message deleted.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function flagSender(m: ChatMsg) {
    setError(null);
    try {
      await rpc("admin_flag_player", {
        p_id: m.sender_id,
        p_reason: `chat moderation: "${m.content.slice(0, 120)}"`,
      });
      setOk(`Flagged ${m.display_name ?? m.sender_id.slice(0, 8)}.`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Chat</h1>
        <Btn small kind="ghost" onClick={load}>Refresh</Btn>
      </div>
      <ErrorNote error={error} />
      <OkNote msg={ok} />
      <Card>
        {!rows ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">No messages.</div>
        ) : (
          <>
            <ul className="divide-y divide-white/5">
              {rows.map((m) => (
                <li key={m.id} className="flex items-start gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-medium text-slate-300">
                        {m.display_name ?? "?"}
                        <span className="text-slate-500">#{m.display_tag ?? "????"}</span>
                      </span>
                      <Badge tone={m.channel === "world" ? "brand" : "neutral"}>{m.channel}</Badge>
                      {m.sender_flagged && <Badge tone="bad">flagged</Badge>}
                      <span>{fmtDate(m.created_at)}</span>
                    </div>
                    <div className="mt-0.5 break-words text-sm text-slate-200">{m.content}</div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Btn small kind="danger" onClick={() => remove(m.id)}>Delete</Btn>
                    {!m.sender_flagged && (
                      <Btn small kind="ghost" onClick={() => flagSender(m)}>Flag sender</Btn>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 text-center">
              <Btn small kind="ghost" disabled={loadingMore} onClick={loadMore}>
                {loadingMore ? "Loading…" : "Load older messages"}
              </Btn>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
