import { useEffect, useMemo, useRef, useState } from "react";

import { tutorApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const start = lines.findIndex((line, idx) => {
    if (idx + 1 >= lines.length) return false;
    const l0 = line.trim();
    const l1 = lines[idx + 1].trim();
    const looksHeader = l0.startsWith("|") && l0.endsWith("|");
    const looksSep = l1.startsWith("|") && l1.endsWith("|") && /-/.test(l1) && /\|/.test(l1);
    return looksHeader && looksSep;
  });

  if (start === -1) return null;

  let end = start + 2;
  while (end < lines.length) {
    const l = lines[end].trim();
    if (!l.startsWith("|") || !l.endsWith("|")) break;
    end += 1;
  }

  const headerLine = lines[start].trim();
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
  const normalizedText = useMemo(() => normalizeTutorOutputText(text), [text]);
  const parsedTable = useMemo(
    () => parseMarkdownTable(normalizedText),
    [normalizedText],
  );

  if (!parsedTable) {
    return (
      <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
        {normalizedText}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {parsedTable.before ? (
        <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
          {parsedTable.before}
        </pre>
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
        <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
          {parsedTable.after}
        </pre>
      ) : null}
    </div>
  );
}

function normalizeTutorOutputText(raw: string): string {
  let s = raw || "";

  // Strip display-math delimiters if the model used LaTeX style outputs.
  s = s.replace(/\\\[/g, "").replace(/\\\]/g, "");
  s = s.replace(/\\\(/g, "").replace(/\\\)/g, "");

  // Strip inline math delimiters.
  s = s.replace(/\$/g, "");

  // Remove common LaTeX spacing commands.
  s = s.replace(/\\quad/g, " ");
  s = s.replace(/\\,/g, ",").replace(/\\;/g, ";");

  // Replace LaTeX text wrappers: \text{Ni} -> Ni
  s = s.replace(/\\text\s*\{([^}]*)\}/g, "$1");
  s = s.replace(/\\mathrm\s*\{([^}]*)\}/g, "$1");
  s = s.replace(/\\mathbf\s*\{([^}]*)\}/g, "$1");

  // Replace fractions: \frac{a}{b} -> (a)/(b)
  while (s.includes("\\frac")) {
    s = s.replace(/\\frac\s*\{([^}]*)\}\s*\{([^}]*)\}/g, "($1)/($2)");
    // Prevent infinite loops if the regex can't consume nested braces.
    break;
  }

  // Replace square roots: \sqrt{X} -> sqrt(X)
  s = s.replace(/\\sqrt\s*\{([^}]*)\}/g, "sqrt($1)");

  // Replace trig commands: \sin A -> sin A
  s = s.replace(/\\(sin|cos|tan|cot|sec|csc)\b/g, "$1");

  // Replace common math operators
  s = s.replace(/\\times\b/g, "*");
  s = s.replace(/\\cdot\b/g, "*");
  s = s.replace(/\\approx\b/g, "~");
  s = s.replace(/\\pi\b/g, "pi");

  // Replace common arrow notation.
  s = s.replace(/\\xrightarrow\s*\{([^}]*)\}/g, "-> $1");
  s = s.replace(/\\rightarrow/g, "->");

  return s;
}

export function TutorChatbot({ title }: { title?: string }) {
  const BOT_NAME = "Jarvis";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [conversationSummary, setConversationSummary] = useState<string>("");
  const [isSending, setIsSending] = useState(false);

  const [selectedClass, setSelectedClass] = useState<string>("9");
  const [selectedSubject, setSelectedSubject] = useState<string>("Mathematics");
  const [topic, setTopic] = useState<string>("");

  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const sendingRef = useRef(false);
  const pendingMessageIdRef = useRef<string | null>(null);
  const [loadingDots, setLoadingDots] = useState(0);

  const lastMessageContent = messages.length > 0 ? messages[messages.length - 1].content : "";
  const canSend = input.trim().length > 0 && !isSending;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, isSending, lastMessageContent]);

  useEffect(() => {
    if (!isSending || !pendingMessageIdRef.current) return;
    const t = window.setInterval(() => setLoadingDots((d) => (d + 1) % 4), 350);
    return () => window.clearInterval(t);
  }, [isSending]);

  useEffect(() => {
    if (!isSending || !pendingMessageIdRef.current) return;
    const id = pendingMessageIdRef.current;
    const content = `Thinking${".".repeat(loadingDots)}`;
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content } : m)));
  }, [loadingDots, isSending]);

  const normalizeErrorToUserMessage = (raw: string): string => {
    const s = raw.toLowerCase();
    // If backend included troubleshooting/path details, show them as-is.
    if (s.includes("tutor_faiss_index") || s.includes("index.faiss") || s.includes("index_dir")) {
      return raw;
    }
    // Do NOT match the substring "index" alone — Python errors like "list index out of range"
    // were incorrectly mapped to "KB not configured". Only match explicit tutor/KB phrases.
    if (
      s.includes("knowledge base is not configured") ||
      s.includes("tutor knowledge base") ||
      s.includes("upload syllabus pdf") ||
      s.includes("syllabus knowledge base")
    ) {
      return "Tutor syllabus knowledge base is not configured yet. Please try again later.";
    }
    if (s.includes("iteration limit") || s.includes("time limit") || s.includes("invalid format")) {
      return "Unable to find your answer right now. Please try rephrasing your question in a different way.";
    }
    return "Unable to find your answer. Please try again or frame the question differently.";
  };

  const normalizeAnswerToUserMessage = (raw: string): string => {
    // If the service returns raw agent error text, normalize it.
    const s = (raw || "").toLowerCase();
    if (s.includes("iteration limit") || s.includes("time limit") || s.includes("invalid format")) {
      return normalizeErrorToUserMessage(raw);
    }
    return raw;
  };

  const makeId = () =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const send = async () => {
    if (sendingRef.current) return;
    setError(null);

    const question = input.trim();
    if (!question) return;

    sendingRef.current = true;
    setInput("");

    const userMessage: ChatMessage = { id: makeId(), role: "user", content: question };
    const pendingMessageId = makeId();
    pendingMessageIdRef.current = pendingMessageId;
    const pendingMessage: ChatMessage = { id: pendingMessageId, role: "assistant", content: "Thinking" };

    setMessages((prev) => [...prev, userMessage, pendingMessage]);
    setIsSending(true);
    setLoadingDots(0);

    try {
      const resp = await tutorApi.ask({
        question,
        classLevel: selectedClass,
        subject: selectedSubject,
        topic: topic ?? "",
        conversationSummary: conversationSummary || null,
      });

      // FastAPI may return HTTP 200 with both `answer` (user-facing) and `error` (debug).
      // Prefer showing `answer`; only throw when there is no usable answer.
      const hasAnswer = !!(resp.answer || "").trim();
      if (resp.error && !hasAnswer) throw new Error(resp.error);

      const answer = normalizeAnswerToUserMessage(resp.answer || "");
      const newSummary = resp.new_conversation_summary ?? conversationSummary ?? "";

      setConversationSummary(newSummary);
      setMessages((prev) => prev.map((m) => (m.id === pendingMessageId ? { ...m, content: answer } : m)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to fetch answer";
      const friendly = normalizeErrorToUserMessage(msg);
      setError(friendly);
      setMessages((prev) => prev.map((m) => (m.id === pendingMessageId ? { ...m, content: friendly } : m)));
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
          <CardTitle>{title || "Tutor"}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-col h-[78vh] sm:h-[82vh]">
            <div className="border-b border-border p-3 sm:p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Class</div>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="8">8</SelectItem>
                      <SelectItem value="9">9</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Subject</div>
                  <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mathematics">Mathematics</SelectItem>
                      <SelectItem value="Physics">Physics</SelectItem>
                      <SelectItem value="Biology">Biology</SelectItem>
                      <SelectItem value="Social Studies">Social Studies</SelectItem>
                      <SelectItem value="English">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Topic</div>
                  <Input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Motion, Gravitation, Ecosystem... (optional)"
                  />
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1 px-4">
              <div className="space-y-4 py-4">
                {messages.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Ask a question about the selected topic. Example: “Explain Newton's laws with a real-world example.”
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
                    <div className="text-xs text-muted-foreground">Tutor will use syllabus context + math helper.</div>
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

