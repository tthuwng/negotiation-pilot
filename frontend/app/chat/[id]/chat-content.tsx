"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSidebar } from "@/components/ui/sidebar";
import { MCTSNode, useMCTSWebSocket } from "@/lib/hooks/use-mcts-websocket";
import { Message } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ArrowLeft, ChevronDown, PanelLeft, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ImperativePanelHandle } from "react-resizable-panels";

interface ChatContentProps {
  chat: {
    id: string;
    visibility: string;
    goal?: string;
  };
  id: string;
  uiMessages: Message[];
  chatModel?: string;
  isReadonly: boolean;
}

interface TreeNodeProps {
  node: MCTSNode;
  nodes: MCTSNode[];
  maxDepth: number;
  totalCols: number;
  parentX?: number;
  depth: number;
}

function TreeNode({
  node,
  nodes,
  maxDepth,
  totalCols,
  parentX,
  depth,
}: TreeNodeProps) {
  const nodeWidth = 12;
  const verticalSpacing = 24;

  const x =
    parentX !== undefined
      ? parentX + (node.children_ids.length > 0 ? -nodeWidth * 2 : nodeWidth)
      : (totalCols * nodeWidth) / 2;
  const y = depth * verticalSpacing;

  let nodeClasses = "size-3 rounded-full transition-all duration-200";
  let tooltipContent = `Value: ${node.value.toFixed(2)}\nVisits: ${
    node.visits
  }\nAction: ${node.action_taken || "Root"}`;

  switch (node.status) {
    case "exploring":
      nodeClasses += " bg-blue-400 animate-pulse";
      tooltipContent += "\nExploring...";
      break;
    case "evaluating":
      nodeClasses += " bg-yellow-400";
      tooltipContent += "\nEvaluating...";
      break;
    case "complete":
      if (node.evaluation_score !== null) {
        const score = node.evaluation_score;
        nodeClasses +=
          score > 0.7
            ? " bg-green-500 scale-110"
            : score > 0.4
            ? " bg-yellow-500"
            : " bg-red-500 scale-90";
        tooltipContent += `\nScore: ${score.toFixed(2)}`;
      } else {
        nodeClasses += " bg-gray-400";
      }
      break;
    default:
      nodeClasses += " bg-gray-200";
  }

  return (
    <div
      className="absolute"
      style={{ transform: `translate(${x}px, ${y}px)` }}
    >
      {parentX !== undefined && (
        <div
          className={`absolute bg-gray-300 transition-opacity duration-200 ${
            node.status === "complete" ? "opacity-100" : "opacity-50"
          }`}
          style={{
            width: "2px",
            height: `${verticalSpacing}px`,
            transform: `translate(${nodeWidth / 2}px, -${verticalSpacing}px)`,
          }}
        />
      )}

      <div className={nodeClasses} title={tooltipContent}>
        {node.status === "evaluating" && (
          <div className="absolute inset-0 rounded-full bg-yellow-400 animate-ping opacity-75" />
        )}
      </div>

      {node.children_ids.map((childId) => {
        const childNode = nodes.find((n) => n.node_id === childId);
        if (childNode) {
          return (
            <TreeNode
              key={childId}
              node={childNode}
              nodes={nodes}
              maxDepth={maxDepth}
              totalCols={totalCols}
              parentX={x}
              depth={depth + 1}
            />
          );
        }
        return null;
      })}
    </div>
  );
}

interface MCTSVisualizationProps {
  nodes: MCTSNode[];
  stats: {
    totalNodes: number;
    maxDepth: number;
  };
}

function MCTSVisualization({ nodes, stats }: MCTSVisualizationProps) {
  const maxDepth = stats.maxDepth || 3;
  const maxBranching = 3; // Maximum branching factor
  const rows = maxDepth + 1; // +1 for root
  const cols = Math.pow(maxBranching, maxDepth);

  // Find root node
  const rootNode = nodes.find((n) => !n.parent_id);

  // Show loading state when no nodes
  if (nodes.length === 0) {
    return (
      <div className="relative w-full h-[200px] bg-background/50 rounded-lg overflow-hidden p-4 flex items-center justify-center">
        <div className="text-sm text-muted-foreground animate-pulse">
          Waiting for exploration data...
        </div>
      </div>
    );
  }

  // Show error if no root node found but nodes exist
  if (!rootNode && nodes.length > 0) {
    return (
      <div className="relative w-full h-[200px] bg-background/50 rounded-lg overflow-hidden p-4 flex items-center justify-center">
        <div className="text-sm text-red-500">
          Error: Invalid tree structure
        </div>
      </div>
    );
  }

  // Build node hierarchy
  const nodeMap = new Map(nodes.map((n) => [n.node_id, n]));
  const getChildren = (nodeId: string) =>
    nodes.filter((n) => n.parent_id === nodeId);

  // Calculate node positions
  const nodePositions = new Map<string, { x: number; y: number }>();
  const calculatePositions = (
    node: MCTSNode,
    depth: number,
    totalWidth: number,
    offset: number
  ) => {
    const children = getChildren(node.node_id);
    const spacing = totalWidth / (children.length + 1);

    children.forEach((child, index) => {
      const x = offset + spacing * (index + 1);
      const y = depth * 40; // Vertical spacing
      nodePositions.set(child.node_id, { x, y });
      calculatePositions(child, depth + 1, spacing, offset + spacing * index);
    });
  };

  if (rootNode) {
    nodePositions.set(rootNode.node_id, { x: (cols * 10) / 2, y: 20 });
    calculatePositions(rootNode, 1, cols * 10, 0);
  }

  return (
    <div className="relative w-full h-[200px] bg-background/50 rounded-lg overflow-hidden p-4">
      <div className="absolute inset-0 flex items-center justify-center">
        <svg className="size-full" style={{ overflow: "visible" }}>
          {/* Draw edges */}
          {nodes.map((node) => {
            if (node.parent_id) {
              const parent = nodeMap.get(node.parent_id);
              const parentPos = parent && nodePositions.get(parent.node_id);
              const nodePos = nodePositions.get(node.node_id);

              if (parentPos && nodePos) {
                return (
                  <line
                    key={`${node.parent_id}-${node.node_id}`}
                    x1={parentPos.x}
                    y1={parentPos.y}
                    x2={nodePos.x}
                    y2={nodePos.y}
                    className={`stroke-gray-300 transition-opacity duration-200 ${
                      node.status === "complete" ? "opacity-100" : "opacity-50"
                    }`}
                    strokeWidth={1}
                  />
                );
              }
            }
            return null;
          })}

          {/* Draw nodes */}
          {nodes.map((node) => {
            const pos = nodePositions.get(node.node_id);
            if (!pos) return null;

            let nodeClass = "transition-all duration-200 ";
            let tooltipContent = `Value: ${node.value.toFixed(2)}\nVisits: ${
              node.visits
            }\nAction: ${node.action_taken || "Root"}`;

            switch (node.status) {
              case "exploring":
                nodeClass += "fill-blue-400";
                tooltipContent += "\nExploring...";
                break;
              case "evaluating":
                nodeClass += "fill-yellow-400";
                tooltipContent += "\nEvaluating...";
                break;
              case "complete":
                if (node.evaluation_score !== null) {
                  const score = node.evaluation_score;
                  nodeClass +=
                    score > 0.7
                      ? "fill-green-500"
                      : score > 0.4
                      ? "fill-yellow-500"
                      : "fill-red-500";
                  tooltipContent += `\nScore: ${score.toFixed(2)}`;
                } else {
                  nodeClass += "fill-gray-400";
                }
                break;
              default:
                nodeClass += "fill-gray-200";
            }

            return (
              <g
                key={node.node_id}
                transform={`translate(${pos.x},${pos.y})`}
                className="group"
              >
                <circle
                  r={4}
                  className={nodeClass}
                  stroke={node.status === "evaluating" ? "#FCD34D" : "#666"}
                  strokeWidth={1}
                >
                  <title>{tooltipContent}</title>
                </circle>
                {node.status === "evaluating" && (
                  <circle
                    r={6}
                    className="fill-yellow-400 animate-ping opacity-75"
                  />
                )}
                {node.action_taken && (
                  <text
                    y={-8}
                    className="text-[8px] fill-muted-foreground text-center"
                    textAnchor="middle"
                  >
                    {node.action_taken.slice(0, 20)}...
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="absolute bottom-2 right-2 flex gap-2 text-xs text-muted-foreground">
        <span>Nodes: {stats.totalNodes}</span>
        <span>Depth: {stats.maxDepth}</span>
      </div>
    </div>
  );
}

export function ChatContent({
  chat,
  id,
  uiMessages: initialMessages,
  chatModel,
  isReadonly,
}: ChatContentProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [inputValue, setInputValue] = useState("");
  const [goal, setGoal] = useState(chat.goal || "");
  const [isSending, setIsSending] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<
    Array<{ text: string; score: number }>
  >([]);

  const {
    nodes,
    analysisResults: mctsResults,
    isConnected,
    error: wsError,
    stats,
  } = useMCTSWebSocket({
    goal,
    messages: messages.map((m) => m.content),
  });

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isSending) return;

    try {
      setIsSending(true);

      // Create the new message
      const newMessage: Message = {
        id: Date.now().toString(),
        content: inputValue.trim(),
        role: "user",
        created_at: new Date().toISOString(),
      };

      // Update local state
      setMessages((prev) => [...prev, newMessage]);
      setInputValue("");

      // Send to backend
      const response = await fetch("/api/chat", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: chat.id,
          goal: goal,
          messages: [...messages.map((m) => m.content), newMessage.content],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get response");
      }

      const data = await response.json();

      if (!data.options?.length) {
        throw new Error("No response options received");
      }

      const assistantMessage: Message = {
        id: Date.now().toString(),
        content: data.options[0],
        role: "assistant",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Update analysis results if available
      if (data.negotiation_options) {
        setAnalysisResults(
          data.negotiation_options.map((text: string, i: number) => ({
            text,
            score:
              i === 0
                ? data.state_evaluation
                : data.state_evaluation * (0.9 - i * 0.1),
          }))
        );
      }
    } catch (error) {
      console.error("Error in chat:", error);
      setMessages((prev) => prev.slice(0, -1));
      setInputValue(inputValue);
    } finally {
      setIsSending(false);
    }
  };

  const { setOpen, open, setOpenMobile, openMobile, isMobile } = useSidebar();
  const negotiationRef = useRef<ImperativePanelHandle>(null);
  const chatRef = useRef<ImperativePanelHandle>(null);
  const [isNegotitationCopilotOpen, setIsNegotiationCopilotOpen] =
    useState(false);
  useEffect(() => {
    const negotiationPanel = negotiationRef.current;

    const chatPanel = chatRef.current;
    console.log(isMobile);
    if (isMobile) {
      if (isNegotitationCopilotOpen) {
        negotiationPanel?.expand();
      } else {
        negotiationPanel?.collapse();
      }
      chatPanel?.expand();
    } else {
      if (isNegotitationCopilotOpen) {
        negotiationPanel?.expand();
      }
      chatPanel?.expand();
    }
  }, [isMobile, isNegotitationCopilotOpen]);

  // Add connection status indicator
  const connectionStatus = isConnected ? (
    <span className="text-xs text-green-500 flex items-center gap-1">
      <div className="size-2 rounded-full bg-green-500 animate-pulse" />
      Connected
    </span>
  ) : (
    <span className="text-xs text-yellow-500 flex items-center gap-1">
      <div className="size-2 rounded-full bg-yellow-500" />
      Connecting...
    </span>
  );

  return (
    <div className="flex h-screen bg-background w-full">
      {/* Chat Section */}
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel
          minSize={isMobile && isNegotitationCopilotOpen ? 0 : 25}
          defaultSize={79}
          ref={chatRef}
        >
          <div className="flex flex-col h-full bg-background">
            <div className="border-b p-4 flex items-center gap-4">
              <Button
                onClick={() => {
                  if (isMobile) {
                    setOpenMobile(!openMobile);
                  } else {
                    setOpen(!open);
                  }
                }}
                variant="ghost"
                size="icon"
              >
                <ArrowLeft
                  className={cn("size-4 duration-300", open && "rotate-180")}
                />
              </Button>
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-full bg-muted" />
                <span className="font-medium">Bossy Manager</span>
              </div>
              <Button
                onClick={() => {
                  if (isNegotitationCopilotOpen) {
                    setIsNegotiationCopilotOpen(false);
                    const negotiationPanel = negotiationRef.current;
                    negotiationPanel?.collapse();
                  } else {
                    setIsNegotiationCopilotOpen(true);
                    const negotiationPanel = negotiationRef.current;
                    negotiationPanel?.expand();
                  }
                }}
                variant="ghost"
                size="icon"
                className="ml-auto"
              >
                <PanelLeft />
              </Button>
            </div>

            <ScrollArea className="h-full">
              <div className="p-4 space-y-4 h-full overflow-y-auto">
                {messages.map((message, i) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`rounded-2xl px-4 py-2 max-w-[80%] ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="border-t p-4">
              <div className="flex items-center gap-4">
                <Input
                  placeholder={isSending ? "Sending..." : "Message..."}
                  className="w-full"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && !e.shiftKey && handleSendMessage()
                  }
                  disabled={isReadonly || isSending}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={isReadonly || isSending}
                >
                  Send
                </Button>
              </div>
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />

        <ResizablePanel
          ref={negotiationRef}
          collapsible={true}
          collapsedSize={0}
          minSize={isMobile && isNegotitationCopilotOpen ? 100 : 21}
          defaultSize={21}
        >
          <div className="flex flex-col size-full bg-background space-y-8 overflow-auto">
            <div className="sticky top-0 border-b bg-background flex items-start justify-between p-3.5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="size-10 rounded-lg bg-muted" />
                  <div>
                    <h2 className="font-semibold">Negotiation Copilot</h2>
                    <p className="text-sm text-muted-foreground">v0.1</p>
                  </div>
                </div>
              </div>
              {connectionStatus}
            </div>

            <div className="sm:w-[400px] size-full space-y-4 p-4 py-0">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <span>CONVERSATION GOAL</span>
                    <ChevronDown className="size-4" />
                  </h3>
                </div>
                <Input
                  placeholder="Enter your goal..."
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  disabled={isReadonly}
                />
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium">SUGGESTED RESPONSES</h3>
                <div className="space-y-2">
                  {analysisResults.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 bg-muted/50 rounded-md p-2 cursor-pointer hover:bg-muted/70 transition-colors"
                      onClick={() => setInputValue(item.text)}
                    >
                      <span className="text-primary font-medium">
                        {(item.score * 100).toFixed(0)}%
                      </span>
                      <span className="text-sm">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium">MCTS EXPLORATION</h3>
                <MCTSVisualization nodes={nodes} stats={stats} />
              </div>

              {wsError && (
                <div className="p-4 text-sm text-red-500 bg-red-50 rounded-md">
                  {wsError}
                </div>
              )}
            </div>
            <div className="p-4 w-full border-t sticky bottom-0 bg-background">
              <Button
                onClick={() => {
                  setIsNegotiationCopilotOpen(false);
                  const negotiationPanel = negotiationRef.current;
                  negotiationPanel?.collapse();
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Analysis Section */}
    </div>
  );
}
