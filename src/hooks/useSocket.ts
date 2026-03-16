import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!socket) {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      socket = io(apiUrl);
    }

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
