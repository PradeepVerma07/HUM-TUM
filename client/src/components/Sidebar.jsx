import React, { useState } from 'react';
import {
  MessageSquarePlus,
  MoreVertical,
  Search,
  Users,
  CheckCheck,
  CircleDot,
  Filter
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useSocket } from '../context/SocketContext';
import { StoryBar } from './StoryBar';

export function Sidebar({ onOpenNewChat, onOpenProfile }) {
  const { user } = useAuth();
  const { conversations, activeConversation, selectConversation } = useChat();
  const { onlineUsers } = useSocket();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [showMenu, setShowMenu] = useState(false);

  const filteredConversations = conversations.filter((c) => {
    const name = c.type === 'GROUP' ? c.name || 'Group' : c.otherParticipant?.display_name || '';
    const matchSearch = name.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filter === 'UNREAD') return c.unreadCount > 0;
    if (filter === 'GROUPS') return c.type === 'GROUP';
    return true;
  });

  return (
    <div
      className={`flex flex-col h-full bg-white border-r border-[#e9edef] ${
        activeConversation ? 'hidden md:flex md:w-[380px] lg:w-[420px]' : 'w-full md:w-[380px] lg:w-[420px]'
      } flex-shrink-0 select-none`}
    >
      {/* 1. WhatsApp Left Header */}
      <header className="h-16 px-4 bg-[#f0f2f5] flex items-center justify-between border-b border-[#e9edef]">
        <div
          onClick={onOpenProfile}
          className="flex items-center space-x-3 cursor-pointer group"
          title="Profile settings"
        >
          <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-tr from-[#00a884] to-[#25d366] text-white flex items-center justify-center font-bold text-sm shadow-xs group-hover:opacity-90">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.display_name} className="w-full h-full object-cover" />
            ) : (
              <span>{user?.display_name?.slice(0, 2).toUpperCase() || 'ME'}</span>
            )}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#111b21] leading-none">{user?.display_name || 'My Chat'}</h2>
            <span className="text-[11px] text-[#00a884] font-medium">@{user?.username || 'user'}</span>
          </div>
        </div>

        {/* Header Action Icons */}
        <div className="flex items-center space-x-3 text-[#54656f] relative">
          <button
            onClick={onOpenNewChat}
            className="p-2 hover:bg-[#e9edef] rounded-full transition-colors"
            title="New Chat"
          >
            <MessageSquarePlus className="w-5 h-5" />
          </button>

          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-[#e9edef] rounded-full transition-colors"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-12 bg-white rounded-xl shadow-xl py-2 w-48 border border-[#e9edef] z-50 text-xs text-[#111b21]">
              <button
                onClick={() => {
                  setShowMenu(false);
                  onOpenNewChat();
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-[#f5f6f6]"
              >
                New Chat
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  onOpenProfile();
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-[#f5f6f6]"
              >
                Settings & Profile
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 2. 24-Hour Status Story Bar */}
      <StoryBar />

      {/* 3. Search & Filter Tabs */}
      <div className="p-2.5 bg-white border-b border-[#f0f2f5] space-y-2">
        <div className="flex items-center bg-[#f0f2f5] rounded-lg px-3 py-1.5 focus-within:bg-white focus-within:ring-1 focus-within:ring-[#00a884] transition-all">
          <Search className="w-4 h-4 text-[#54656f] mr-3 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search or start new chat"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-xs text-[#111b21] placeholder:text-[#8696a0] focus:outline-none w-full"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1.5">
          {['ALL', 'UNREAD', 'GROUPS'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === tab
                  ? 'bg-[#00a884] text-white'
                  : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
              }`}
            >
              {tab === 'ALL' ? 'All' : tab === 'UNREAD' ? 'Unread' : 'Groups'}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Conversations List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#f0f2f5]">
        {filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-[#8696a0] text-xs space-y-2">
            <CircleDot className="w-8 h-8 mx-auto text-[#00a884]/40" />
            <p className="font-semibold text-[#111b21]">No chats yet</p>
            <p>Tap the + icon above to start chatting with anyone on HUM–TUM.</p>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isGroup = conv.type === 'GROUP';
            const name = isGroup ? conv.name || 'Group' : conv.otherParticipant?.display_name || 'Chat';
            const avatar = isGroup ? conv.avatar_url : conv.otherParticipant?.avatar_url;
            const isOnline = !isGroup && onlineUsers.has(conv.otherParticipant?.id);
            const isSelected = activeConversation?.id === conv.id;

            return (
              <div
                key={conv.id}
                onClick={() => selectConversation(conv)}
                className={`px-3.5 py-3 flex items-center space-x-3 cursor-pointer transition-colors ${
                  isSelected ? 'bg-[#f0f2f5]' : 'hover:bg-[#f5f6f6] active:bg-[#ebebeb]'
                }`}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-tr from-[#00a884] to-[#25d366] text-white flex items-center justify-center font-bold text-sm">
                    {avatar ? (
                      <img src={avatar} alt={name} className="w-full h-full object-cover" />
                    ) : (
                      <span>{name.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  {isOnline && (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#25d366] border-2 border-white" />
                  )}
                </div>

                {/* Conversation Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold text-[#111b21] truncate">{name}</h3>
                    <span className="text-[11px] text-[#8696a0] flex-shrink-0 ml-2">
                      {conv.lastMessage
                        ? new Date(conv.lastMessage.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : ''}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1 text-xs text-[#667781] truncate">
                      {conv.lastMessage && (
                        <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] flex-shrink-0 inline" />
                      )}
                      <span className="truncate">{conv.lastMessage?.content || 'Tap to chat'}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
