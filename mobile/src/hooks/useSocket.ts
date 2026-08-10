import { useEffect, useState } from 'react';

type SocketInstance = {
  on: (event: string, listener: (...args: any[]) => void) => void;
  off: (event: string, listener?: (...args: any[]) => void) => void;
  disconnect: () => void;
};

// A realtime socket server is optional and this repo does not contain one.
// Only connect when EXPO_PUBLIC_SOCKET_URL is explicitly set -- pointing this at
// API_URL would make the rider app retry a handshake against the Django server
// forever, since it speaks no socket.io. The dashboard refreshes over REST.
const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL?.trim();

export const useSocket = () => {
  // State, not a ref. Consumers subscribe in an effect keyed on the socket, and
  // a ref mutation triggers no re-render -- so with a ref they saw null on the
  // first render and were never re-run once the socket existed, silently
  // attaching no listeners at all. Storing it in state re-renders the consumer
  // exactly once, when the socket becomes available.
  const [socket, setSocket] = useState<SocketInstance | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!SOCKET_URL) {
      return;
    }

    const { io } = require('socket.io-client');
    const instance: SocketInstance = io(SOCKET_URL, {
      transports: ['websocket'],
    });

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    instance.on('connect', onConnect);
    instance.on('disconnect', onDisconnect);
    setSocket(instance);

    return () => {
      instance.off('connect', onConnect);
      instance.off('disconnect', onDisconnect);
      // Actually close the transport. Without this the socket outlives the
      // component and keeps reconnecting in the background forever.
      instance.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, []);

  return { socket, isConnected };
};
