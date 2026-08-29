import React from 'react';
import { Check, CheckCheck, Clock, FileText, Play } from 'lucide-react';

export function MessageBubble({ message, currentUserId }) {
  const isMe = message.sender_id === currentUserId || message.senderId === currentUserId;

  const formatTime = (iso) => {
    return new Date(iso || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`flex flex-col select-none ${isMe ? 'items-end' : 'items-start'}`}>
      <div
        className={`relative max-w-[85%] md:max-w-[65%] px-3 py-1.5 ${
          isMe ? 'bubble-sent mr-1' : 'bubble-received ml-1'
        }`}
      >
        {/* Media / Attachments */}
        {message.type === 'IMAGE' && message.mediaUrl && (
          <div className="mb-1 rounded-lg overflow-hidden max-h-64">
            <img src={message.mediaUrl} alt="Media" className="w-full h-full object-cover" />
          </div>
        )}

        {message.type === 'VOICE' ? (
          <div className="flex items-center space-x-3 py-1 min-w-[200px]">
            <button className="w-9 h-9 rounded-full bg-[#00a884] text-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <Play className="w-4 h-4 ml-0.5" />
            </button>
            <div className="flex-1 space-y-1">
              <div className="h-1.5 bg-[#00a884]/30 rounded-full overflow-hidden">
                <div className="h-full bg-[#00a884] w-1/3" />
              </div>
              <span className="text-[10px] text-[#667781]">0:08</span>
            </div>
          </div>
        ) : message.type === 'DOCUMENT' ? (
          <div className="flex items-center space-x-2 bg-black/5 p-2 rounded-lg">
            <FileText className="w-5 h-5 text-[#00a884]" />
            <span className="text-xs font-medium truncate">{message.content}</span>
          </div>
        ) : (
          <p className="text-sm font-normal text-[#111b21] leading-relaxed break-words whitespace-pre-wrap">
            {message.content}
          </p>
        )}

        {/* Timestamp & Double Blue Ticks */}
        <div className="flex items-center justify-end space-x-1 text-[10px] text-[#667781] float-right ml-2 -mb-0.5 select-none mt-0.5">
          <span>{formatTime(message.created_at)}</span>
          {isMe && (
            message.status === 'READ' ? (
              <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
            ) : message.status === 'DELIVERED' ? (
              <CheckCheck className="w-3.5 h-3.5 text-[#8696a0]" />
            ) : message.status === 'SENT' ? (
              <Check className="w-3.5 h-3.5 text-[#8696a0]" />
            ) : (
              <Clock className="w-3.5 h-3.5 text-[#8696a0]" />
            )
          )}
        </div>
      </div>
    </div>
  );
}
