import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// A realtime socket server is optional. Only connect when NEXT_PUBLIC_SOCKET_URL
// is explicitly configured — otherwise the client would repeatedly fail to reach
// a same-origin server that does not exist. Dashboards fall back to REST polling,
// which is the supported configuration rather than a degraded one.
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL?.trim();

/** One connection shared by every consumer of this hook. */
let sharedSocket: Socket | null = null;

function getSocket(): Socket | null {
  if (typeof window === 'undefined' || !SOCKET_URL) return null;
  if (!sharedSocket) sharedSocket = io(SOCKET_URL);
  return sharedSocket;
}

/**
 * Subscribe to the optional realtime socket.
 *
 * **The socket is resolved during render, not in an effect.** It used to be
 * read from a module-level variable that was only assigned inside `useEffect`,
 * so consumers saw `null` on the render that ran their own effects — and
 * nothing re-rendered when the connection was later established. Any consumer
 * doing `if (!socket) return;` before attaching listeners therefore never
 * attached them at all. That went unnoticed because there is no socket server
 * in this repo and the polling fallback covered for it.
 *
 * A lazy `useState` initialiser is used rather than a plain call so the socket
 * is created exactly once per client, and never on the server.
 */
export const useSocket = () => {
  const [socket] = useState<Socket | null>(() => getSocket());
  // Seeded from the live connection rather than defaulted to false, so a
  // component mounting after the socket connected does not report "offline"
  // until the next reconnect. Reading it here also avoids setting state
  // synchronously inside the effect below.
  const [isConnected, setIsConnected] = useState(() => getSocket()?.connected ?? false);

  useEffect(() => {
    if (!socket) return;

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [socket]);

  return { socket, isConnected };
};
