"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSidebar } from "@/components/ui/sidebar";
import { MCTSNode, useMCTSWebSocket } from "@/lib/hooks/use-mcts-websocket";
import { Message } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ArrowLeft, ChevronDown, Video } from "lucide-react";
import { useState } from "react";

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
  maxDepth: number;
  totalCols: number;
  parentX?: number;
  depth: number;
}

function TreeNode({ node, maxDepth, totalCols, parentX, depth }: TreeNodeProps) {
  const nodeWidth = 12; // Size of node in pixels
  const verticalSpacing = 24; // Vertical space between levels
  
  // Calculate x position based on tree structure
  const x = parentX !== undefined 
    ? parentX + (node.children_ids.length > 0 ? -nodeWidth * 2 : nodeWidth)
    : totalCols * nodeWidth / 2;
  const y = depth * verticalSpacing;

  // Determine node color and animation based on status
  let nodeClasses = 'size-3 rounded-full transition-all duration-200';
  let tooltipContent = `Value: ${node.value.toFixed(2)}\nVisits: ${node.visits}\nStatus: ${node.status}`;
  
  switch (node.status) {
    case 'exploring':
      nodeClasses += ' bg-blue-400 animate-pulse';
      break;
    case 'evaluating':
      nodeClasses += ' bg-yellow-400';
      tooltipContent += '\nEvaluating...';
      break;
    case 'complete':
      if (node.evaluation_score !== null) {
        const score = node.evaluation_score;
        nodeClasses += score > 0.7 
          ? ' bg-green-500 scale-110' 
          : score > 0.4 
            ? ' bg-yellow-500'
            : ' bg-red-500 scale-90';
        tooltipContent += `\nScore: ${score.toFixed(2)}`;
      } else {
        nodeClasses += ' bg-gray-400';
      }
      break;
    default:
      nodeClasses += ' bg-gray-200';
  }

  return (
    <div className="absolute" style={{ transform: `translate(${x}px, ${y}px)` }}>
      {/* Draw line to parent if exists */}
      {parentX !== undefined && (
        <div 
          className={`absolute bg-gray-300 transition-opacity duration-200 ${
            node.status === 'complete' ? 'opacity-100' : 'opacity-50'
          }`}
          style={{
            width: '2px',
            height: `${verticalSpacing}px`,
            transform: `translate(${nodeWidth/2}px, -${verticalSpacing}px)`,
          }}
        />
      )}
      
      {/* Node circle with tooltip */}
      <div 
        className={nodeClasses}
        title={tooltipContent}
      >
        {/* Inner pulse animation for evaluating nodes */}
        {node.status === 'evaluating' && (
          <div className="absolute inset-0 rounded-full bg-yellow-400 animate-ping" />
        )}
      </div>
      
      {/* Render children */}
      {node.children_ids.map((childId) => {
        const childNode = nodes.find(n => n.node_id === childId);
        if (childNode) {
          return (
            <TreeNode
              key={childId}
              node={childNode}
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

function MCTSVisualization({ nodes, maxDepth }: { nodes: MCTSNode[]; maxDepth: number }) {
  const rootNode = nodes.find(n => !n.parent_id);
  if (!rootNode) return null;

  return (
    <div className="relative w-full h-[200px] bg-background/50 rounded-lg overflow-hidden p-4">
      <div className="absolute inset-0 flex items-center justify-center">
        <TreeNode
          node={rootNode}
          maxDepth={maxDepth}
          totalCols={20}
          depth={0}
        />
      </div>
    </div>
  );
}

export function ChatContent({ chat, id, uiMessages: initialMessages, chatModel, isReadonly }: ChatContentProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [inputValue, setInputValue] = useState("");
  const [goal, setGoal] = useState(chat.goal || "");
  const [isSending, setIsSending] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<Array<{ text: string; score: number }>>([]);

  const { nodes, analysisResults: mctsResults, isConnected, error: wsError } = useMCTSWebSocket({
    goal,
    messages: messages.map(m => m.content)
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
        created_at: new Date().toISOString()
      };

      // Update local state
      setMessages(prev => [...prev, newMessage]);
      setInputValue("");

      // Send to backend
      const response = await fetch("/api/chat", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: chat.id,
          goal: goal,
          messages: [...messages.map(m => m.content), newMessage.content]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get response");
      }

      // Get boss's response
      const bossData = await response.json();
      
      if (!bossData.options?.length) {
        throw new Error("No response options received");
      }

      const assistantMessage: Message = {
        id: Date.now().toString(),
        content: bossData.options[0],
        role: "assistant",
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, assistantMessage]);

      // After getting boss's response, get negotiation analysis
      const negotiationResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/negotiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: goal,
          messages: [...messages.map(m => m.content), newMessage.content, bossData.options[0]]
        })
      });

      if (negotiationResponse.ok) {
        const negotiationData = await negotiationResponse.json();
        setAnalysisResults(
          negotiationData.options.map((text: string, i: number) => ({
            text,
            score: i === 0 ? negotiationData.state_evaluation : negotiationData.state_evaluation * (0.9 - i * 0.1)
          }))
        );
      }

    } catch (error) {
      console.error("Error in chat:", error);
      setMessages(prev => prev.slice(0, -1));
      setInputValue(inputValue);
    } finally {
      setIsSending(false);
    }
  };


  const {setOpen, open} = useSidebar()

  return (
    <div className="flex h-screen bg-background">
      {/* Chat Section */}
      <div className="flex-1 border-r">
        <div className="border-b p-4 flex items-center gap-4">
          <Button onClick={() => setOpen(!open)} variant="ghost" size="icon">
            <ArrowLeft className={cn("size-4 duration-300", open && 'rotate-180')} />
          </Button>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-muted" />
            <span className="font-medium">Bossy Manager</span>
          </div>
          <Button variant="ghost" size="icon" className="ml-auto">
            <Video className="size-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4 h-[calc(100vh-8rem)] overflow-y-auto">
          {messages.map((message, i) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`rounded-2xl px-4 py-2 max-w-[80%] ${
                  message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t p-4">
          <Input 
            placeholder={isSending ? "Sending..." : "Message..."} 
            className="w-full"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
            disabled={isReadonly || isSending}
          />
        </div>
      </div>

      {/* Analysis Section */}
      <div className="w-[400px] bg-background p-6 space-y-8">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="size-10 rounded-lg bg-muted" />
              <div>
                <h2 className="font-semibold">Negotiation Copilot</h2>
                <p className="text-sm text-muted-foreground">v0.1</p>
              </div>
            </div>
          </div>
          <span className={`text-sm ${isConnected ? "text-green-500" : "text-red-500"}`}>
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>

        <div className="space-y-4">
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
              onChange={e => setGoal(e.target.value)}
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
                  <span className="text-primary font-medium">{(item.score * 100).toFixed(0)}%</span>
                  <span className="text-sm">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">CONVERSATIONAL STATE EXPLORATION</h3>
            <DotGrid 
              color="primary" 
              rows={12} 
              cols={20} 
              activeNodes={nodes.filter(n => n.status === "complete" && (n.evaluation_score || 0) > 0.5).length}
              maxNodes={nodes.length}
              tooltip={`${nodes.filter(n => n.status === "complete" && (n.evaluation_score || 0) > 0.5).length} promising states explored out of ${nodes.length} total states`}
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">MONTE CARLO EVALUATION</h3>
            <DotGrid 
              color="warning" 
              rows={8} 
              cols={20}
              activeNodes={nodes.filter(n => n.status === "evaluating" || n.evaluation_score !== null).length}
              maxNodes={nodes.length}
              tooltip={`${nodes.filter(n => n.status === "evaluating" || n.evaluation_score !== null).length} states evaluated with max ${Math.max(...nodes.map(n => n.visits), 0)} visits`}
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">MCTS EXPLORATION</h3>
            <MCTSVisualization nodes={nodes} maxDepth={Math.max(...nodes.map(n => n.depth), 0)} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Nodes: {nodes.length}</span>
              <span>Depth: {Math.max(...nodes.map(n => n.depth), 0)}</span>
            </div>
          </div>

          {wsError && (
            <div className="p-4 text-sm text-red-500 bg-red-50 rounded-md">
              {wsError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface DotGridProps {
  color: string;
  rows: number;
  cols: number;
  activeNodes?: number;
  maxNodes?: number;
  tooltip?: string;
}

function DotGrid({ color, rows, cols, activeNodes = 0, maxNodes, tooltip }: DotGridProps) {
  const totalDots = rows * cols;
  const normalizedActive = maxNodes ? Math.floor((activeNodes / maxNodes) * totalDots) : activeNodes;
  
  return (
    <div className="relative group">
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: totalDots }).map((_, i) => (
          <div 
            key={i} 
            className={`size-1.5 rounded-full transition-colors duration-200 ${
              i < normalizedActive ? `bg-${color}` : 'bg-gray-200'
            }`} 
          />
        ))}
      </div>
      {tooltip && (
        <div className="absolute hidden group-hover:block bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/80 text-white text-xs rounded">
          {tooltip}
        </div>
      )}
    </div>
  );
} 