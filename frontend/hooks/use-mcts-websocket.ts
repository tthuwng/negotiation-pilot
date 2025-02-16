import { useEffect, useState } from 'react';

interface MCTSNode {
  node_id: string;
  parent_id: string | null;
  state: string;
  visits: number;
  value: number;
  action_taken: string | null;
  depth: number;
  children_ids: string[];
  status: "exploring" | "evaluating" | "complete";
  evaluation_score: number | null;
}

interface MCTSEvent {
  event_type: string;
  node: MCTSNode;
  best_action?: string;
  options?: string[];
  state_evaluation?: number;
  message?: string;
  total_nodes: number;
  max_depth: number;
}

interface UseMCTSWebSocketProps {
  goal: string;
  messages: string[];
}

interface UseMCTSWebSocketResult {
  nodes: MCTSNode[];
  analysisResults: Array<{ text: string; score: number }>;
  isConnected: boolean;
  error: string | null;
  totalNodes: number;
  maxDepth: number;
}

export function useMCTSWebSocket({ goal, messages }: UseMCTSWebSocketProps): UseMCTSWebSocketResult {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [nodes, setNodes] = useState<MCTSNode[]>([]);
  const [analysisResults, setAnalysisResults] = useState<Array<{ text: string; score: number }>>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalNodes, setTotalNodes] = useState(0);
  const [maxDepth, setMaxDepth] = useState(0);

  useEffect(() => {
    // Reset state when messages change
    setNodes([]);
    setAnalysisResults([]);
    setError(null);
    setTotalNodes(0);
    setMaxDepth(0);

    // Create WebSocket connection
    const ws = new WebSocket(`${process.env.NEXT_PUBLIC_API_URL?.replace('http', 'ws')}/ws/mcts`);
    setSocket(ws);

    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
      // Send initial state
      ws.send(JSON.stringify({ goal, messages }));
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    ws.onerror = (event) => {
      setError('WebSocket connection error');
      console.error('WebSocket error:', event);
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
            if (data.node) {
              setNodes(prev => {
                const nodeExists = prev.some(n => n.node_id === data.node.node_id);
                if (nodeExists) {
                  return prev.map(n => 
                    n.node_id === data.node.node_id 
                      ? { ...data.node, children_ids: [...new Set([...n.children_ids, ...data.node.children_ids])] }
                      : n
                  );
                }
                return [...prev, data.node];
              });
              setTotalNodes(data.total_nodes);
              setMaxDepth(data.max_depth);
            }
            break;

          case 'complete':
            if (data.options && data.state_evaluation !== undefined) {
              setAnalysisResults(
                data.options.map((text, i) => ({
                  text,
                  score: i === 0 ? data.state_evaluation! : data.state_evaluation! * (0.9 - i * 0.1)
                }))
              );
            }
            break;

          case 'error':
            setError(data.message || 'Unknown error');
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        setError('Error processing analysis data');
      }
    };

    // Cleanup on unmount
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [goal, messages]); // Reconnect when goal or messages change

  return {
    nodes,
    analysisResults,
    isConnected,
    error,
    totalNodes,
    maxDepth
  };
} 