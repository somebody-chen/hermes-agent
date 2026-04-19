import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Boxes,
  ChevronDown,
  ChevronRight,
  Code2,
  Cog,
  MessageSquareQuote,
  Route,
  Sparkles,
  User,
  Wrench,
} from "lucide-react";
import { api } from "@/lib/api";
import type {
  SessionMessage,
  SessionTraceResponse,
  SessionTraceStep,
  TraceCodeRef,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/Markdown";

const FLOW_RAIL = [
  "User Input",
  "System Prompt",
  "API Request",
  "Tool Calls",
  "Python Tools",
  "Tool Results",
  "Next Round",
  "Final Response",
];

const STEP_META: Record<SessionTraceStep["kind"], {
  label: string;
  icon: typeof User;
  accent: string;
  tone: string;
}> = {
  user_input: {
    label: "User Input",
    icon: User,
    accent: "text-primary",
    tone: "border-primary/25 bg-primary/6",
  },
  system_prompt: {
    label: "System Prompt",
    icon: Sparkles,
    accent: "text-[oklch(0.74_0.16_95)]",
    tone: "border-[oklch(0.74_0.16_95/0.25)] bg-[oklch(0.74_0.16_95/0.08)]",
  },
  tool_surface: {
    label: "Tool Surface",
    icon: Boxes,
    accent: "text-[oklch(0.72_0.15_165)]",
    tone: "border-[oklch(0.72_0.15_165/0.25)] bg-[oklch(0.72_0.15_165/0.08)]",
  },
  api_request: {
    label: "API Request",
    icon: Route,
    accent: "text-[oklch(0.76_0.11_235)]",
    tone: "border-[oklch(0.76_0.11_235/0.25)] bg-[oklch(0.76_0.11_235/0.08)]",
  },
  assistant_tool_calls: {
    label: "Tool Calls",
    icon: Bot,
    accent: "text-warning",
    tone: "border-warning/25 bg-warning/8",
  },
  tool_result: {
    label: "Tool Result",
    icon: Wrench,
    accent: "text-success",
    tone: "border-success/25 bg-success/8",
  },
  assistant_response: {
    label: "Assistant Response",
    icon: MessageSquareQuote,
    accent: "text-[oklch(0.74_0.12_300)]",
    tone: "border-[oklch(0.74_0.12_300/0.25)] bg-[oklch(0.74_0.12_300/0.08)]",
  },
  final_response: {
    label: "Final Response",
    icon: MessageSquareQuote,
    accent: "text-success",
    tone: "border-success/25 bg-success/8",
  },
};

function Collapsible({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-border/80 bg-background/60">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-display uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground cursor-pointer"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <span>{title}</span>
      </button>
      {open && <div className="border-t border-border/80 px-3 py-3">{children}</div>}
    </div>
  );
}

function CodeRefs({ refs }: { refs: TraceCodeRef[] }) {
  if (!refs.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {refs.map((ref) => (
        <div
          key={`${ref.file}:${ref.start_line}:${ref.label}`}
          className="inline-flex items-center gap-2 border border-border bg-background px-2.5 py-1.5 text-[11px] text-muted-foreground"
        >
          <Code2 className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">{ref.label}</span>
          <span className="font-mono-ui">
            {ref.file}:{ref.start_line}{ref.end_line && ref.end_line !== ref.start_line ? `-${ref.end_line}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

function MessageStack({ messages }: { messages: SessionMessage[] }) {
  return (
    <div className="flex flex-col gap-2">
      {messages.map((msg, index) => (
        <div key={`${msg.role}-${index}`} className="border border-border/80 bg-background px-3 py-2">
          <div className="mb-1 flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
              {msg.role}
            </Badge>
            {msg.tool_name && (
              <Badge variant="warning" className="text-[10px]">
                {msg.tool_name}
              </Badge>
            )}
          </div>
          {msg.content ? (
            <div className="text-sm leading-relaxed">
              <Markdown content={msg.content} />
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">No visible content</div>
          )}
        </div>
      ))}
    </div>
  );
}

function ToolCallList({
  toolCalls,
}: {
  toolCalls: NonNullable<SessionTraceStep["tool_calls"]>;
}) {
  return (
    <div className="flex flex-col gap-2">
      {toolCalls.map((call) => (
        <div key={call.id} className="border border-border/80 bg-background px-3 py-2">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="warning" className="text-[10px] uppercase tracking-[0.12em]">
              {call.function.name}
            </Badge>
            <span className="font-mono-ui text-[11px] text-muted-foreground">{call.id}</span>
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-relaxed text-foreground/85 font-mono">
            {(() => {
              try {
                return JSON.stringify(JSON.parse(call.function.arguments), null, 2);
              } catch {
                return call.function.arguments;
              }
            })()}
          </pre>
        </div>
      ))}
    </div>
  );
}

function PromptSegments({ step }: { step: SessionTraceStep }) {
  if (!step.segments?.length) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {step.segments.map((segment) => (
        <div key={`${segment.kind}-${segment.title}`} className="border border-border/80 bg-background px-3 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-display text-xs uppercase tracking-[0.12em] text-foreground">
              {segment.title}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {segment.kind}
            </Badge>
          </div>
          <div className="max-h-52 overflow-y-auto pr-1 text-sm leading-relaxed text-foreground/85 whitespace-pre-wrap">
            {segment.content}
          </div>
        </div>
      ))}
    </div>
  );
}

function StepCard({ step }: { step: SessionTraceStep }) {
  const meta = STEP_META[step.kind];
  const Icon = meta.icon;
  const [showContent, setShowContent] = useState(
    step.kind === "system_prompt" || step.kind === "final_response",
  );

  return (
    <div className="relative pl-10">
      <div className="absolute left-4 top-12 bottom-[-1rem] w-px bg-border last:hidden" />
      <div className={`absolute left-0 top-4 flex h-8 w-8 items-center justify-center border ${meta.tone}`}>
        <Icon className={`h-4 w-4 ${meta.accent}`} />
      </div>
      <div className={`border ${meta.tone} px-4 py-4`}>
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`font-display text-xs uppercase tracking-[0.14em] ${meta.accent}`}>
                {meta.label}
              </span>
              {typeof step.iteration === "number" && (
                <Badge variant="outline" className="text-[10px]">
                  Iteration {step.iteration}
                </Badge>
              )}
              {step.tool_name && (
                <Badge variant="success" className="text-[10px]">
                  {step.tool_name}
                </Badge>
              )}
            </div>
            <h4 className="mt-2 text-base font-semibold text-foreground">{step.title}</h4>
            {step.summary && (
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.summary}</p>
            )}
          </div>
          {(step.content || step.request || step.tool_calls?.length || step.tools?.length || step.segments?.length) && (
            <button
              type="button"
              onClick={() => setShowContent((value) => !value)}
              className="inline-flex items-center gap-1 border border-border bg-background px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {showContent ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              Details
            </button>
          )}
        </div>

        {step.notes?.length ? (
          <div className="mt-3 flex flex-col gap-2">
            {step.notes.map((note) => (
              <div key={note} className="border border-border/80 bg-background px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                {note}
              </div>
            ))}
          </div>
        ) : null}

        {showContent && (
          <div className="mt-4 flex flex-col gap-3">
            {step.segments?.length ? <PromptSegments step={step} /> : null}

            {step.tools?.length ? (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {step.tools.map((tool) => (
                  <div key={tool.name} className="border border-border/80 bg-background px-3 py-3">
                    <div className="font-mono-ui text-sm text-foreground">{tool.name}</div>
                    {tool.description ? (
                      <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{tool.description}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {step.request ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {step.request.message_count} messages
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {step.request.tool_count} tools
                  </Badge>
                </div>
                <Collapsible title="Request Message Stack">
                  <MessageStack messages={step.request.messages} />
                </Collapsible>
                <Collapsible title="Request Tool Names">
                  <div className="flex flex-wrap gap-2">
                    {step.request.tool_names.map((toolName) => (
                      <Badge key={toolName} variant="outline" className="text-[10px] font-mono-ui">
                        {toolName}
                      </Badge>
                    ))}
                  </div>
                </Collapsible>
              </>
            ) : null}

            {step.tool_calls?.length ? (
              <Collapsible title="Returned Tool Calls" defaultOpen>
                <ToolCallList toolCalls={step.tool_calls} />
              </Collapsible>
            ) : null}

            {step.content ? (
              <Collapsible
                title={step.kind === "system_prompt" ? "Prompt Snapshot" : "Content"}
                defaultOpen={step.kind === "final_response"}
              >
                <div className="max-h-80 overflow-y-auto pr-1">
                  {step.kind === "system_prompt" ? (
                    <pre className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90 font-mono">
                      {step.content}
                    </pre>
                  ) : (
                    <div className="text-sm leading-relaxed">
                      <Markdown content={step.content} />
                    </div>
                  )}
                </div>
              </Collapsible>
            ) : null}
          </div>
        )}

        <div className="mt-4">
          <CodeRefs refs={step.code_refs} />
        </div>
      </div>
    </div>
  );
}

export default function SessionTraceView({ sessionId }: { sessionId: string }) {
  const [trace, setTrace] = useState<SessionTraceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.getSessionTrace(sessionId)
      .then((data) => {
        if (!cancelled) setTrace(data);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const stats = useMemo(() => {
    if (!trace) return null;
    return {
      requests: trace.steps.filter((step) => step.kind === "api_request").length,
      toolCalls: trace.steps
        .filter((step) => step.kind === "assistant_tool_calls")
        .reduce((sum, step) => sum + (step.tool_calls?.length ?? 0), 0),
      toolResults: trace.steps.filter((step) => step.kind === "tool_result").length,
    };
  }, [trace]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return <div className="py-6 text-sm text-destructive">{error}</div>;
  }

  if (!trace) {
    return <div className="py-6 text-sm text-muted-foreground">No trace data available.</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="border border-border bg-background/70 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-xs uppercase tracking-[0.14em] text-foreground">
            Agent Chain View
          </span>
          <Badge variant={trace.source === "session_log" ? "success" : "outline"} className="text-[10px]">
            {trace.source === "session_log" ? "session log" : "sqlite fallback"}
          </Badge>
          {stats ? (
            <>
              <Badge variant="outline" className="text-[10px]">{stats.requests} requests</Badge>
              <Badge variant="outline" className="text-[10px]">{stats.toolCalls} tool calls</Badge>
              <Badge variant="outline" className="text-[10px]">{stats.toolResults} tool results</Badge>
            </>
          ) : null}
        </div>

        <div className="mt-4 overflow-x-auto">
          <div className="flex min-w-max items-center gap-2">
            {FLOW_RAIL.map((label, index) => (
              <div key={label} className="flex items-center gap-2">
                <div className="border border-border bg-background px-3 py-2 font-display text-[11px] uppercase tracking-[0.12em] text-foreground/85">
                  {label}
                </div>
                {index < FLOW_RAIL.length - 1 ? (
                  <div className="h-px w-6 bg-border" />
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {trace.notes.length ? (
          <div className="mt-4 grid gap-2">
            {trace.notes.map((note) => (
              <div key={note} className="border border-border bg-background px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                {note}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        {trace.steps.map((step) => (
          <StepCard key={step.id} step={step} />
        ))}
      </div>
    </div>
  );
}
