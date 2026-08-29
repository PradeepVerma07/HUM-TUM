import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

const ChatContext = createContext();

export function ChatProvider({ children }) {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [stories, setStories] = useState([]);
  const [activeStoryGroup, setActiveStoryGroup] = useState(null);
  const [loadingConv, setLoadingConv] = useState(false);

  useEffect(() => {
    if (user) {
      loadConversations();
      loadStories();
    }
  }, [user]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg) => {
      if (activeConversation && msg.conversation_id === activeConversation.id) {
        setMessages((prev) => [...prev, msg]);
      }

      setConversations((prev) =>
        prev.map((c) => (c.id === msg.conversation_id ? { ...c, lastMessage: msg } : c))
      );
    };

    socket.on('message:receive', handleNewMessage);

    return () => {
      socket.off('message:receive', handleNewMessage);
    };
  }, [socket, activeConversation]);

  const loadConversations = async () => {
    setLoadingConv(true);
    try {
      const res = await axios.get('/api/conversations');
      setConversations(res.data?.conversations || []);
    } catch {
      // Offline mock fallback
      setConversations([
        {
          id: 'conv_priya',
          type: 'DIRECT',
          otherParticipant: {
            id: 'user_priya',
            username: 'priya.verma',
            display_name: 'Priya Verma',
            avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
            bio: 'Hey there! I am using HUM–TUM ✨',
            is_online: true
          },
          lastMessage: {
            id: 'msg_1',
            content: 'Welcome to HUM–TUM WhatsApp Clone! Pure Node.js & React 💜✨',
            created_at: new Date().toISOString()
          }
        }
      ]);
    } finally {
      setLoadingConv(false);
    }
  };

  const loadMessages = async (convId) => {
    try {
      const res = await axios.get(`/api/messages/${convId}`);
      setMessages(res.data?.messages || []);
      socket?.emit('conversation:join', convId);
    } catch {
      setMessages([
        {
          id: 'msg_1',
          conversation_id: convId,
          sender_id: 'user_priya',
          type: 'TEXT',
          content: 'Welcome to HUM–TUM WhatsApp Clone! Pure Node.js & React 💜✨',
          status: 'READ',
          created_at: new Date().toISOString()
        }
      ]);
    }
  };

  const selectConversation = (conv) => {
    setActiveConversation(conv);
    loadMessages(conv.id);
  };

  const sendMessage = (content, type = 'TEXT', mediaUrl = null) => {
    if (!activeConversation || !user) return;

    const newMsg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      conversationId: activeConversation.id,
      senderId: user.id,
      type,
      content,
      mediaUrl,
      created_at: new Date().toISOString()
    };

    setMessages((prev) => [...prev, newMsg]);

    socket?.emit('message:send', newMsg);
  };

  const loadStories = async () => {
    try {
      const res = await axios.get('/api/stories');
      setStories(res.data?.feed || []);
    } catch {
      setStories([
        {
          user: {
            id: 'user_priya',
            display_name: 'Priya Verma',
            avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'
          },
          stories: [
            {
              id: 'story_1',
              caption: 'HUM–TUM pure JS WhatsApp clone is running! 💜✨',
              background: 'linear-gradient(135deg, #25D366, #128C7E)',
              created_at: new Date().toISOString()
            }
          ]
        }
      ]);
    }
  };

  return (
    <ChatContext.Provider
      value={{
        conversations,
        activeConversation,
        selectConversation,
        messages,
        sendMessage,
        stories,
        activeStoryGroup,
        setActiveStoryGroup,
        loadingConv
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => useContext(ChatContext);
