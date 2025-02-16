"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

export interface MCTSNode {
  node_id: string;
  parent_id: string | null;
  state: string;
  visits: number;
  value: number;
  action_taken: string | null;
  status: 'exploring' | 'evaluating' | 'complete';
  evaluation_score: number | null;
  depth: number;
  children_ids: string[];
}

export interface MCTSEvent {
  event_type: 'node_update' | 'selection' | 'expansion' | 'evaluation' | 'backprop' | 'complete' | 'error';
  node?: MCTSNode;
  nodes?: MCTSNode[];
  metadata?: {
    options?: string[];
    scores?: number[];
    message?: string;
    best_action?: string;
    best_value?: number;
  };
  total_nodes: number;
  max_depth: number;
  state_evaluation?: number;
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
  stats: {
    totalNodes: number;
    maxDepth: number;
  };
}

const RECONNECT_DELAY = 2000;
const MAX_RECONNECT_ATTEMPTS = 3;
const NODE_BATCH_INTERVAL = 100; // ms between node batch updates

export function useMCTSWebSocket({ goal, messages }: UseMCTSWebSocketProps): UseMCTSWebSocketReturn {
  const [nodes, setNodes] = useState<MCTSNode[]>([]);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ totalNodes: 0, maxDepth: 0 });
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const lastMessageRef = useRef({ goal, messages });
  const nodeMapRef = useRef(new Map<string, MCTSNode>());

  // Debug logging
  const debugLog = useCallback((message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[MCTS WebSocket] ${message}`, data || '');
    }
  }, []);

  // Update node in map and trigger state update
  const updateNode = useCallback((node: MCTSNode) => {
    const existingNode = nodeMapRef.current.get(node.node_id);
    
    // Merge children IDs with existing ones if present
    const mergedChildrenIds = [...new Set([
      ...(existingNode?.children_ids || []),
      ...(node.children_ids || [])
    ])];

    // Update node with merged data
    nodeMapRef.current.set(node.node_id, {
      ...node,
      children_ids: mergedChildrenIds,
      // Preserve evaluation score if not provided in update
      evaluation_score: node.evaluation_score ?? existingNode?.evaluation_score ?? null
    });

    // Update parent's children list if parent exists
    if (node.parent_id) {
      const parent = nodeMapRef.current.get(node.parent_id);
      if (parent) {
        nodeMapRef.current.set(node.parent_id, {
          ...parent,
          children_ids: [...new Set([...parent.children_ids, node.node_id])]
        });
      }
    }

    // Trigger state update with all nodes
    setNodes(Array.from(nodeMapRef.current.values()));
  }, []);

  // Handle incoming WebSocket message
  const handleMessage = useCallback((data: MCTSEvent) => {
    debugLog('Received message:', data);

    // Update stats if available
    if (data.total_nodes !== undefined && data.max_depth !== undefined) {
      setStats({
        totalNodes: data.total_nodes,
        maxDepth: data.max_depth
      });
    }

    // Handle error events
    if (data.event_type === 'error') {
      setError(data.metadata?.message || 'Unknown error');
      return;
    }

    // Process node updates
    if (data.nodes?.length) {
      // Process nodes in order (parents before children)
      const sortedNodes = [...data.nodes].sort((a, b) => 
        (a.depth || 0) - (b.depth || 0)
      );
      sortedNodes.forEach(updateNode);
    } else if (data.node) {
      updateNode(data.node);
    }

    // Handle completion with analysis results
    if (data.event_type === 'complete' && data.metadata?.options) {
      setAnalysisResults(
        data.metadata.options.map((text, i) => ({
          text,
          score: data.metadata?.scores?.[i] || 1 - (i * 0.1)
        }))
      );
    }
  }, [debugLog, updateNode]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      debugLog('Already connected');
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws/mcts';
      debugLog('Connecting to:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        debugLog('Connected successfully');
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
        
        // Clear previous state on new connection
        nodeMapRef.current.clear();
        setNodes([]);
        setAnalysisResults([]);
        
        // Send initial message
        const initialMessage = { 
          goal: lastMessageRef.current.goal, 
          messages: lastMessageRef.current.messages,
          current_turn: lastMessageRef.current.messages.length
        };
        debugLog('Sending initial message:', initialMessage);
        ws.send(JSON.stringify(initialMessage));
      };

      ws.onclose = (event) => {
        debugLog('Connection closed:', event);
        setIsConnected(false);
        
        if (!event.wasClean && reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          debugLog(`Attempting reconnect ${reconnectAttempts.current + 1}/${MAX_RECONNECT_ATTEMPTS}`);
          reconnectAttempts.current += 1;
          setTimeout(connect, RECONNECT_DELAY);
        }
      };

      ws.onerror = (event) => {
        debugLog('WebSocket error:', event);
        if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
          setError('WebSocket connection failed after multiple attempts');
        }
      };

      ws.onmessage = (event) => {
        try {
          const data: MCTSEvent = JSON.parse(event.data);
          handleMessage(data);
        } catch (err) {
          console.error('Error processing WebSocket message:', err);
          debugLog('Message processing error:', err);
          setError('Error processing message');
        }
      };
    } catch (err) {
      console.error('Error creating WebSocket:', err);
      debugLog('Connection error:', err);
      setError('Failed to create WebSocket connection');
    }
  }, [debugLog, handleMessage]);

  // Reconnect when goal or messages change
  useEffect(() => {
    debugLog('Goal or messages changed, updating connection');
    lastMessageRef.current = { goal, messages };
    
    // If connected, send new data
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      debugLog('Sending updated data');
      wsRef.current.send(JSON.stringify({ 
        goal, 
        messages,
        current_turn: messages.length
      }));
    } else {
      // If not connected, attempt to connect
      debugLog('Not connected, attempting to connect');
      connect();
    }
  }, [goal, messages, connect, debugLog]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      debugLog('Cleaning up WebSocket connection');
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [debugLog]);

  return {
    nodes,
    analysisResults,
    isConnected,
    error,
    stats
  };
} 