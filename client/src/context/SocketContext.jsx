import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingMap, setTypingMap] = useState({});
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const s = io('/', {
      transports: ['websocket', 'polling']
    });

    s.on('connect', () => {
      console.log('⚡ WhatsApp Socket connected:', s.id);
      s.emit('user:join', user.id);
    });

    s.on('presence:update', ({ userId, isOnline }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (isOnline) next.add(userId);
        else next.delete(userId);
        return next;
      });
    });

    s.on('typing:status', ({ conversationId, username, isTyping }) => {
      setTypingMap((prev) => ({
        ...prev,
        [conversationId]: isTyping ? username : null
      }));
    });

    s.on('call:incoming', (data) => {
      setIncomingCall(data);
    });

    s.on('call:accepted', (data) => {
      setActiveCall(data);
      setIncomingCall(null);
    });

    s.on('call:rejected', () => {
      setActiveCall(null);
      setIncomingCall(null);
    });

    s.on('call:ended', () => {
      setActiveCall(null);
      setIncomingCall(null);
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [user?.id]);

  const startCall = (targetUser, type = 'audio', conversationId) => {
    const callData = {
      id: `call_${Date.now()}`,
      callerId: user.id,
      callerName: user.display_name,
      callerAvatar: user.avatar_url,
      targetUserId: targetUser.id,
      targetUserName: targetUser.display_name,
      targetUserAvatar: targetUser.avatar_url,
      type,
      conversationId
    };
    setActiveCall(callData);
    socket?.emit('call:start', callData);
  };

  const acceptCall = () => {
    if (incomingCall) {
      setActiveCall(incomingCall);
      socket?.emit('call:accept', incomingCall);
      setIncomingCall(null);
    }
  };

  const rejectCall = () => {
    if (incomingCall) {
      socket?.emit('call:reject', incomingCall);
      setIncomingCall(null);
    }
  };

  const endCall = () => {
    if (activeCall) {
      socket?.emit('call:end', activeCall);
      setActiveCall(null);
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        onlineUsers,
        typingMap,
        incomingCall,
        activeCall,
        startCall,
        acceptCall,
        rejectCall,
        endCall
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
