import { useState, useEffect, useCallback, useRef } from 'react';
import type { Block } from '../engine/types';

interface SessionSnapshot {
  currentBlockId: string | null;
  blocks: Block[];
  sequence: number;
  programadoPointer: number;
  overrideStack: { blockId: string; triggeredByUserId: string; triggeredAt: string }[];
}

interface SessionSocketState {
  currentBlock: Block | undefined;
  blocks: Block[];
  sequence: number;
  isOverrideActive: boolean;
  isConnected: boolean;
}

export function useSessionSocket(sessionId: string, ministryId: string): SessionSocketState {
  const [state, setState] = useState<SessionSocketState>({
    currentBlock: undefined,
    blocks: [],
    sequence: 0,
    isOverrideActive: false,
    isConnected: false,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const backoffRef = useRef(1000);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      backoffRef.current = 1000;
      setState((prev) => ({ ...prev, isConnected: true }));
      ws.send(JSON.stringify({ type: 'join', sessionId, ministryId }));
    };

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.type === 'block_changed') {
          setState((prev) => {
            const block = prev.blocks.find((b) => b.id === data.blockId);
            return {
              ...prev,
              currentBlock: block,
              sequence: data.sequence,
              isOverrideActive: data.wasOverride,
            };
          });
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      setState((prev) => ({ ...prev, isConnected: false }));
      reconnectTimeoutRef.current = setTimeout(() => {
        backoffRef.current = Math.min(backoffRef.current * 2, 30000);
        connect();
      }, backoffRef.current);
    };
  }, [sessionId, ministryId]);

  useEffect(() => {
    const fetchSnapshot = async () => {
      try {
        const res = await fetch(`/sessions/${sessionId}/state`);
        if (res.ok) {
          const snapshot: SessionSnapshot = await res.json();
          const block = snapshot.blocks.find((b) => b.id === snapshot.currentBlockId);
          setState({
            currentBlock: block,
            blocks: snapshot.blocks,
            sequence: snapshot.sequence,
            isOverrideActive: snapshot.overrideStack.length > 0,
            isConnected: false,
          });
        }
      } catch {
        // ignore
      }
    };

    fetchSnapshot();
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect, sessionId]);

  return state;
}