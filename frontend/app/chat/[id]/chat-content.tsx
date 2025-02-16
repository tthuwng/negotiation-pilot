"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSidebar } from "@/components/ui/sidebar";
import { useMCTSWebSocket } from "@/lib/hooks/use-mcts-websocket";
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

export function ChatContent({ chat, id, uiMessages: initialMessages, chatModel, isReadonly }: ChatContentProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [inputValue, setInputValue] = useState("");
  const [goal, setGoal] = useState(chat.goal || "");
  const [isSending, setIsSending] = useState(false);

  const { nodes, analysisResults, isConnected, error: wsError } = useMCTSWebSocket({
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
        createdAt: new Date().toISOString()
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
          messages: [newMessage] // Send only the new message
        })
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      // Get response from backend
      const data = await response.json();

      // Add assistant's response if provided
      if (data.assistantMessage) {
        const assistantMessage: Message = {
          id: data.assistantMessage.id,
          content: data.assistantMessage.content,
          role: "assistant",
          createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      // Optionally revert the message on error
      setMessages(prev => prev.slice(0, -1));
      setInputValue(inputValue); // Restore input
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
            <span className="font-medium">Negotiation Assistant</span>
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
            <h3 className="text-sm font-medium">ANALYSIS RESULTS</h3>
            <div className="space-y-2">
              {analysisResults.map((item, i) => (
                <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                  <span className="text-primary font-medium">{item.score.toFixed(2)}</span>
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
              activeNodes={nodes.filter(n => n.value > 0.5).length}
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">MONTE CARLO EVALUATION</h3>
            <DotGrid 
              color="warning" 
              rows={8} 
              cols={20}
              activeNodes={nodes.filter(n => n.visits > 0).length}
            />
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
}

function DotGrid({ color, rows, cols, activeNodes = 0 }: DotGridProps) {
  const totalDots = rows * cols;
  return (
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
            i < activeNodes ? `bg-${color}` : 'bg-gray-200'
          }`} 
        />
      ))}
    </div>
  );
} 