import React, { useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { ChatArea } from '../components/ChatArea';
import { StoryViewer } from '../components/StoryViewer';
import { CallModal } from '../components/CallModal';
import { NewChatModal } from '../components/NewChatModal';
import { ProfileModal } from '../components/ProfileModal';

export function ChatApp() {
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <div className="h-screen w-screen bg-[#d1d7db] flex items-center justify-center overflow-hidden p-0 md:p-4">
      {/* WhatsApp Desktop Container */}
      <div className="flex h-full w-full max-w-[1600px] bg-white md:rounded-2xl overflow-hidden shadow-2xl relative">
        <Sidebar
          onOpenNewChat={() => setIsNewChatOpen(true)}
          onOpenProfile={() => setIsProfileOpen(true)}
        />
        <ChatArea />
      </div>

      {/* Global Overlays */}
      <StoryViewer />
      <CallModal />
      <NewChatModal isOpen={isNewChatOpen} onClose={() => setIsNewChatOpen(false)} />
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </div>
  );
}
