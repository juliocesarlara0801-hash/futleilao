import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? '';

let sharedSocket: Socket | null = null;

export function getSocket(): Socket {
  if (!sharedSocket) {
    sharedSocket = io(SERVER_URL, { autoConnect: true, transports: ['websocket', 'polling'] });
  }
  return sharedSocket;
}

export function useSocket(onConnectChange?: (connected: boolean) => void) {
  const socketRef = useRef<Socket>(getSocket());

  useEffect(() => {
    const socket = socketRef.current;
    const handleConnect = () => onConnectChange?.(true);
    const handleDisconnect = () => onConnectChange?.(false);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    if (socket.connected) onConnectChange?.(true);
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [onConnectChange]);

  return socketRef.current;
}
