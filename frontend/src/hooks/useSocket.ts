import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// A realtime socket server is optional. Only connect when NEXT_PUBLIC_SOCKET_URL
// is explicitly configured — otherwise the client would repeatedly fail to reach
// a same-origin server that does not exist. Dashboards fall back to REST polling.
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL?.trim();

let socket: Socket | null = null;

export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !SOCKET_URL) return;

    if (!socket) {
      socket = io(SOCKET_URL);
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsConnected(socket.connected);

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket?.off('connect', onConnect);
      socket?.off('disconnect', onDisconnect);
    };
  }, []);

  return { socket, isConnected };
};
