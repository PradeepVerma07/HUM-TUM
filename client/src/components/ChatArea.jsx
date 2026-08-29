import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Smile,
  Mic,
  Send,
  Lock,
  Image as ImageIcon,
  FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useSocket } from '../context/SocketContext';
import { MessageBubble } from './MessageBubble';

export function ChatArea() {
  const { user } = useAuth();
  const { activeConversation, selectConversation, messages, sendMessage } = useChat();
  const { onlineUsers, typingMap, socket, startCall } = useSocket();

  const [input, setInput] = useState('');
  const [showAttach, setShowAttach] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const conv = activeConversation;
  const isGroup = conv?.type === 'GROUP';
  const name = isGroup ? conv?.name || 'Group' : conv?.otherParticipant?.display_name || 'Chat';
  const avatar = isGroup ? conv?.avatar_url : conv?.otherParticipant?.avatar_url;
  const isOnline = !isGroup && onlineUsers.has(conv?.otherParticipant?.id);
  const typer = conv ? typingMap[conv.id] : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, typer]);

  const handleSend = (e) => {
    e?.preventDefault();
    if (!input.trim()) return;
    sendMessage(input, 'TEXT');
    setInput('');
    socket?.emit('typing:stop', { conversationId: conv.id, username: user.username });
  };

  const handleTyping = (e) => {
    setInput(e.target.value);
    if (!socket || !conv) return;
    if (e.target.value.length > 0) {
      socket.emit('typing:start', { conversationId: conv.id, username: user.display_name });
    } else {
      socket.emit('typing:stop', { conversationId: conv.id, username: user.display_name });
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fakeUrl = URL.createObjectURL(file);
    const isImg = file.type.startsWith('image/');
    sendMessage(isImg ? '📷 Photo' : `📄 ${file.name}`, isImg ? 'IMAGE' : 'DOCUMENT', fakeUrl);
    setShowAttach(false);
  };

  // Welcome / Empty State Screen
  if (!conv) {
    return (
      <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-[#f0f2f5] p-8 text-center select-none border-b-[6px] border-[#00a884]">
        <div className="max-w-md space-y-4">
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#00a884] to-[#25d366] text-white flex items-center justify-center font-black text-3xl mx-auto shadow-lg shadow-[#00a884]/20">
            HT
          </div>

          <h2 className="text-2xl font-light text-[#41525d]">HUM–TUM Web</h2>
          <p className="text-xs text-[#667781] leading-relaxed">
            Send and receive messages without keeping your phone online. Use HUM–TUM on all your devices with real-time sync.
          </p>

          <div className="flex items-center justify-center space-x-2 text-xs text-[#8696a0] pt-6">
            <Lock className="w-3.5 h-3.5" />
            <span>End-to-end encrypted</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full bg-[#efeae2] select-none overflow-hidden relative">
      {/* 1. WhatsApp Right Header */}
      <header className="h-16 px-4 bg-[#f0f2f5] flex items-center justify-between border-b border-[#e9edef] z-20 shadow-xs">
        <div className="flex items-center space-x-3 min-w-0">
          <button
            onClick={() => selectConversation(null)}
            className="p-1 text-[#54656f] hover:bg-[#e9edef] rounded-full md:hidden"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-tr from-[#00a884] to-[#25d366] text-white flex items-center justify-center font-bold text-sm">
              {avatar ? (
                <img src={avatar} alt={name} className="w-full h-full object-cover" />
              ) : (
                <span>{name.slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            {isOnline && (
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#25d366] border-2 border-white" />
            )}
          </div>

          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[#111b21] truncate leading-tight">{name}</h2>
            <span className="text-[11px] text-[#00a884] block truncate mt-0.5">
              {typer ? `${typer} is typing...` : isOnline ? 'online' : 'offline'}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3 text-[#54656f]">
          {!isGroup && conv.otherParticipant && (
            <>
              <button
                onClick={() => startCall(conv.otherParticipant, 'video', conv.id)}
                className="p-2 hover:bg-[#e9edef] rounded-full transition-colors"
                title="Video call"
              >
                <Video className="w-5 h-5" />
              </button>

              <button
                onClick={() => startCall(conv.otherParticipant, 'audio', conv.id)}
                className="p-2 hover:bg-[#e9edef] rounded-full transition-colors"
                title="Voice call"
              >
                <Phone className="w-4 h-4" />
              </button>
            </>
          )}

          <button className="p-2 hover:bg-[#e9edef] rounded-full transition-colors">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 2. Messages Feed (WhatsApp Wallpaper) */}
      <div className="flex-1 overflow-y-auto px-4 py-3 whatsapp-chat-bg space-y-2">
        {/* Encryption Banner */}
        <div className="flex justify-center my-2 select-none">
          <div className="flex items-center space-x-1.5 bg-[#ffeecd] text-[#54656f] text-[11px] font-normal px-3 py-1.5 rounded-lg shadow-xs text-center max-w-sm border border-[#ffd279]/40">
            <Lock className="w-3.5 h-3.5 text-[#e07b22] flex-shrink-0" />
            <span>Messages are end-to-end encrypted. No one outside this chat can read them.</span>
          </div>
        </div>

        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} currentUserId={user.id} />
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Attachment Popup Menu */}
      {showAttach && (
        <div className="absolute bottom-20 left-4 bg-white rounded-2xl p-4 shadow-2xl border border-[#e9edef] z-30 flex items-center space-x-6 animate-fade-in">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center space-y-1.5 text-xs text-[#54656f] hover:text-[#00a884]"
          >
            <div className="w-12 h-12 rounded-full bg-[#ac44cf] text-white flex items-center justify-center shadow-md">
              <ImageIcon className="w-6 h-6" />
            </div>
            <span>Photos & Videos</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center space-y-1.5 text-xs text-[#54656f] hover:text-[#00a884]"
          >
            <div className="w-12 h-12 rounded-full bg-[#5f66cd] text-white flex items-center justify-center shadow-md">
              <FileText className="w-6 h-6" />
            </div>
            <span>Document</span>
          </button>
        </div>
      )}

      {/* 4. WhatsApp Composer Bottom Bar */}
      <footer className="p-2 bg-[#f0f2f5] flex items-center space-x-2 z-20">
        <button
          type="button"
          onClick={() => setShowAttach(!showAttach)}
          className="p-2 text-[#54656f] hover:bg-[#e9edef] rounded-full transition-colors"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        <form onSubmit={handleSend} className="flex-1 flex items-center">
          <div className="flex-1 bg-white rounded-lg px-4 py-2 flex items-center space-x-2 shadow-2xs">
            <button type="button" className="text-[#54656f]">
              <Smile className="w-5 h-5" />
            </button>

            <input
              type="text"
              placeholder="Type a message"
              value={input}
              onChange={handleTyping}
              className="flex-1 bg-transparent text-sm text-[#111b21] placeholder:text-[#8696a0] focus:outline-none"
            />
          </div>
        </form>

        {input.trim() ? (
          <button
            onClick={handleSend}
            className="w-11 h-11 rounded-full bg-[#00a884] text-white flex items-center justify-center shadow-md hover:bg-[#008f6f] active:scale-95 transition-all flex-shrink-0"
          >
            <Send className="w-5 h-5 ml-0.5" />
          </button>
        ) : (
          <button
            onClick={() => sendMessage('🎙️ Voice note (0:08)', 'VOICE')}
            className="w-11 h-11 rounded-full bg-[#00a884] text-white flex items-center justify-center shadow-md hover:bg-[#008f6f] active:scale-95 transition-all flex-shrink-0"
            title="Record Voice Note"
          >
            <Mic className="w-5 h-5" />
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />
      </footer>
    </div>
  );
}
