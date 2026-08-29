import React, { useState } from 'react';
import axios from 'axios';
import { X, Search, User, MessageSquare } from 'lucide-react';
import { useChat } from '../context/ChatContext';

export function NewChatModal({ isOpen, onClose }) {
  const { selectConversation, conversations } = useChat();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async (e) => {
    const q = e.target.value;
    setQuery(q);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get(`/api/users/search?q=${encodeURIComponent(q)}`);
      setResults(res.data?.users || []);
    } catch {
      // Mock search
      setResults([
        {
          id: 'user_aarav',
          username: 'aarav.sharma',
          display_name: 'Aarav Sharma',
          bio: 'Coding the future 🚀'
        },
        {
          id: 'user_rohit',
          username: 'rohit.mehta',
          display_name: 'Rohit Mehta',
          bio: 'Coffee, code, repeat ☕'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = (user) => {
    const existing = conversations.find((c) => c.otherParticipant?.id === user.id);
    if (existing) {
      selectConversation(existing);
    } else {
      const newConv = {
        id: `conv_${user.id}`,
        type: 'DIRECT',
        otherParticipant: user,
        lastMessage: null,
        unreadCount: 0
      };
      selectConversation(newConv);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs select-none animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl space-y-4 border border-[#e9edef]">
        <div className="flex items-center justify-between pb-3 border-b border-[#e9edef]">
          <h2 className="text-base font-bold text-[#111b21]">New Chat</h2>
          <button onClick={onClose} className="p-1 hover:bg-[#f0f2f5] rounded-full text-[#54656f]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center bg-[#f0f2f5] rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-[#54656f] mr-2" />
          <input
            autoFocus
            type="text"
            placeholder="Search by username or name..."
            value={query}
            onChange={handleSearch}
            className="bg-transparent text-xs text-[#111b21] focus:outline-none w-full"
          />
        </div>

        <div className="max-h-60 overflow-y-auto divide-y divide-[#f0f2f5]">
          {results.map((u) => (
            <div
              key={u.id}
              onClick={() => handleStartChat(u)}
              className="py-3 px-2 flex items-center justify-between hover:bg-[#f5f6f6] rounded-xl cursor-pointer"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-tr from-[#00a884] to-[#25d366] text-white flex items-center justify-center font-bold text-sm">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{u.display_name?.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#111b21]">{u.display_name}</h4>
                  <p className="text-[10px] text-[#00a884]">@{u.username}</p>
                </div>
              </div>

              <button className="p-2 bg-[#00a884] text-white rounded-full">
                <MessageSquare className="w-4 h-4" />
              </button>
            </div>
          ))}

          {query && results.length === 0 && !loading && (
            <p className="p-4 text-center text-xs text-[#8696a0]">No users found for "{query}".</p>
          )}
        </div>
      </div>
    </div>
  );
}
