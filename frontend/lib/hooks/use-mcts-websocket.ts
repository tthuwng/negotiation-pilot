"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

export interface MCTSNode {
  node_id: string;
  parent_id: string | null;
  state: string;
  visits: number;
  value: number;
  action_taken: string | null;
}

export interface MCTSEvent {
  event_type: 'node_update' | 'selection' | 'expansion' | 'evaluation' | 'backprop' | 'complete' | 'error';
  node: MCTSNode;
  metadata?: {
    options?: string[];
    scores?: number[];
    message?: string;
  };
}

export interface AnalysisResult {
  score: number;
  text: string;
}

interface UseMCTSWebSocketProps {
  goal: string;
  messages: string[];
}

interface UseMCTSWebSocketReturn {
  nodes: MCTSNode[];
  analysisResults: AnalysisResult[];
  isConnected: boolean;
  error: string | null;
}

const RECONNECT_DELAY = 2000; // 2 seconds
const MAX_RECONNECT_ATTEMPTS = 3;

export function useMCTSWebSocket({ goal, messages }: UseMCTSWebSocketProps): UseMCTSWebSocketReturn {
  const [nodes, setNodes] = useState<MCTSNode[]>([]);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const lastMessageRef = useRef({ goal, messages });

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(`${process.env.NEXT_PUBLIC_API_URL || 'ws://localhost:8000'}/ws/mcts`);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
        
        // Send initial message
        ws.send(JSON.stringify({ 
          goal: lastMessageRef.current.goal, 
          messages: lastMessageRef.current.messages,
          current_turn: lastMessageRef.current.messages.length
        }));
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        
        // Only attempt to reconnect if it wasn't a clean close
        if (!event.wasClean && reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts.current += 1;
          setTimeout(connect, RECONNECT_DELAY);
        }
      };

      ws.onerror = (event) => {
        // Only set error if we've exceeded max reconnect attempts
        if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
          setError('WebSocket connection failed after multiple attempts');
        }
      };

      ws.onmessage = (event) => {
        try {
          const data: MCTSEvent = JSON.parse(event.data);

          switch (data.event_type) {
            case 'node_update':
            case 'selection':
            case 'expansion':
            case 'evaluation':
            case 'backprop':
              setNodes(prevNodes => {
                const nodeIndex = prevNodes.findIndex(n => n.node_id === data.node.node_id);
                if (nodeIndex === -1) {
                  return [...prevNodes, data.node];
                }
                const newNodes = [...prevNodes];
                newNodes[nodeIndex] = data.node;
                return newNodes;
              });
              break;

            case 'complete':
              if (data.metadata?.options && data.metadata?.scores) {
                setAnalysisResults(
                  data.metadata.options.map((option, index) => ({
                    text: option,
                    score: data.metadata?.scores?.[index] ?? 0.5
                  }))
                );
              }
              break;

            case 'error':
              setError(data.metadata?.message ?? 'Unknown error');
              break;
          }
        } catch (err) {
          console.error('Error processing WebSocket message:', err);
          setError('Error processing message');
        }
      };
    } catch (err) {
      console.error('Error creating WebSocket:', err);
      setError('Failed to create WebSocket connection');
    }
  }, []);

  useEffect(() => {
    // Only update lastMessageRef if the data has changed
    if (goal !== lastMessageRef.current.goal || 
        JSON.stringify(messages) !== JSON.stringify(lastMessageRef.current.messages)) {
      lastMessageRef.current = { goal, messages };
      
      // If connected, send the new data
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ 
          goal, 
          messages,
          current_turn: messages.length
        }));
      }
    }
  }, [goal, messages]);

  // Initial connection
  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return {
    nodes,
    analysisResults,
    isConnected,
    error
  };
} 