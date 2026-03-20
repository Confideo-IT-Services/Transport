import { useEffect, useMemo, useRef, useState } from "react";

import { ragApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

function parseMarkdownTable(text: string): {
  before: string;
  headers: string[];
  rows: string[][];
  after: string;
} | null {
  const lines = text.split(/\r?\n/);

  // Detect a Markdown table block:
  // | h1 | h2 |
  // | --- | --- |
  // | a  | b  |
  const start = lines.findIndex((line, idx) => {
    if (idx + 1 >= lines.length) return false;
    const l0 = line.trim();
    const l1 = lines[idx + 1].trim();
    const looksHeader = l0.startsWith("|") && l0.endsWith("|");
    const looksSep = l1.startsWith("|") && l1.endsWith("|") && /-/.test(l1) && /\|/.test(l1);
    return looksHeader && looksSep;
  });

  if (start === -1) return null;

  let end = start + 2; // start at header+separator
  while (end < lines.length) {
    const l = lines[end].trim();
    if (!l.startsWith("|") || !l.endsWith("|")) break;
    end += 1;
  }

  const headerLine = lines[start].trim();
  const sepLine = lines[start + 1].trim();
  void sepLine; // separator isn't needed for parsing content

  const splitRow = (row: string) =>
    row
      .trim()
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());

  const headers = splitRow(headerLine);
  const rows = lines.slice(start + 2, end).map((r) => splitRow(r));

  const before = lines.slice(0, start).join("\n").trim();
  const after = lines.slice(end).join("\n").trim();

  return { before, headers, rows, after };
}

function MessageContent({ text, role }: { text: string; role: ChatRole }) {
  const parsedTable = useMemo(() => parseMarkdownTable(text), [text]);

  if (!parsedTable) {
    return (
      <div
        className={[
          "whitespace-pre-wrap break-words text-sm leading-relaxed",
          role === "assistant" ? "text-foreground" : "text-foreground",
        ].join(" ")}
      >
        {text}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {parsedTable.before ? (
        <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{parsedTable.before}</pre>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full border border-border text-sm">
          <thead className="bg-muted/50">
            <tr>
              {parsedTable.headers.map((h, idx) => (
                <th key={`${h}-${idx}`} className="border border-border px-3 py-2 text-left font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parsedTable.rows.map((row, rIdx) => (
              <tr key={rIdx}>
                {row.map((cell, cIdx) => (
                  <td key={`${rIdx}-${cIdx}`} className="border border-border px-3 py-2 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {parsedTable.after ? (
        <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{parsedTable.after}</pre>
      ) : null}
    </div>
  );
}

export function Chatbot({ title }: { title?: string }) {
  const BOT_NAME = "Jarvis";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [conversationSummary, setConversationSummary] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const sendingRef = useRef(false);
  const pendingMessageIdRef = useRef<string | null>(null);
  const [loadingDots, setLoadingDots] = useState(0);

  const lastMessageContent = messages.length > 0 ? messages[messages.length - 1].content : "";

  const canSend = input.trim().length > 0 && !isSending;

  // Keep the latest answer visible without manual scrolling.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, isSending, lastMessageContent]);

  const normalizeErrorToUserMessage = (raw: string): string => {
    const s = raw.toLowerCase();
    if (s.includes("iteration limit") || s.includes("time limit") || s.includes("invalid format")) {
      return "Unable to find your answer right now. Please try rephrasing your question in a different way.";
    }
    if (s.includes("quota") || s.includes("429")) {
      return "The AI service is busy right now. Please try again in a few moments.";
    }
    return "Unable to find your answer. Please try again or frame the question differently.";
  };

  const normalizeAnswerToUserMessage = (raw: string): string => {
    const s = (raw || "").toLowerCase();
    // The agent sometimes returns these as a plain answer string (not as resp.error).
    if (s.includes("iteration limit") || s.includes("time limit") || s.includes("invalid format")) {
      return normalizeErrorToUserMessage(raw);
    }
    if (s.startsWith("error:") || s.includes("sql error")) {
      return normalizeErrorToUserMessage(raw);
    }
    return raw;
  };

  // ChatGPT-like loading dots while waiting for the model.
  useEffect(() => {
    if (!isSending || !pendingMessageIdRef.current) return;

    const t = window.setInterval(() => {
      setLoadingDots((d) => (d + 1) % 4);
    }, 350);

    return () => window.clearInterval(t);
  }, [isSending]);

  useEffect(() => {
    if (!isSending || !pendingMessageIdRef.current) return;
    const id = pendingMessageIdRef.current;
    const content = `Thinking${".".repeat(loadingDots)}`;
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content } : m)));
  }, [loadingDots, isSending]);

  const send = async () => {
    if (sendingRef.current) return;
    setError(null);
    const question = input.trim();
    if (!question) return;

    sendingRef.current = true;
    setInput("");
    const makeId = () =>
      // Prefer crypto.randomUUID when available (modern browsers), fallback for older runtimes.
      (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
        ? crypto.randomUUID()
        : `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const userMessage: ChatMessage = { id: makeId(), role: "user", content: question };
    const pendingMessageId = makeId();
    pendingMessageIdRef.current = pendingMessageId;
    const pendingMessage: ChatMessage = {
      id: pendingMessageId,
      role: "assistant",
      content: "Thinking",
    };
    setLoadingDots(0);

    setMessages((prev) => [...prev, userMessage, pendingMessage]);
    setIsSending(true);

    try {
      const resp = await ragApi.ask({
        question,
        conversationSummary: conversationSummary || null,
      });

      if (resp.error) {
        throw new Error(resp.error);
      }

      const answer = normalizeAnswerToUserMessage(resp.answer || "");
      const newSummary = resp.new_conversation_summary ?? conversationSummary ?? "";

      setConversationSummary(newSummary);
      setMessages((prev) =>
        prev.map((m) => (m.id === pendingMessageId ? { ...m, content: answer } : m)),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to fetch answer";
      const friendly = normalizeErrorToUserMessage(msg);
      setError(friendly);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingMessageId
            ? { ...m, content: friendly }
            : m,
        ),
      );
    } finally {
      setIsSending(false);
      sendingRef.current = false;
      pendingMessageIdRef.current = null;
    }
  };

  return (
    <div className="w-full">
      <Card className="bg-card">
        <CardHeader>
          <CardTitle>{title || "School Chatbot (Text-to-SQL)"}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-col h-[70vh] sm:h-[78vh]">
            <ScrollArea className="flex-1 px-4">
              <div className="space-y-4 py-4">
                {messages.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Ask a question about students, attendance, exams, fees, notifications, etc.
                    <div className="mt-2">
                      Example: “How many students scored above 75% in Hindi in the last exam?”
                    </div>
                  </div>
                ) : null}

                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={[
                      "rounded-lg border px-3 py-2",
                      m.role === "user" ? "bg-muted/30 border-border" : "bg-background border-border",
                    ].join(" ")}
                  >
                    <div className="text-xs font-medium text-muted-foreground mb-1">
                      {m.role === "user" ? "You" : BOT_NAME}
                    </div>
                    <MessageContent text={m.content} role={m.role} />
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            <div className="border-t border-border p-3 sm:p-4">
              <div className="flex flex-col gap-3">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your question..."
                  className="min-h-[90px] sm:min-h-[110px]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (canSend) void send();
                    }
                  }}
                />

                <div className="flex items-center justify-between gap-3">
                  <Button onClick={() => void send()} disabled={!canSend} className="sm:w-40">
                    {isSending ? "Asking..." : "Ask Questions"}
                  </Button>
                  {error ? (
                    <div className="text-sm text-destructive truncate" title={error}>
                      {error}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      Uses rolling summary + latest question for follow-ups.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

