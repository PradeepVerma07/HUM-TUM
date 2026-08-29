import React from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';

export function StoryBar() {
  const { user } = useAuth();
  const { stories, setActiveStoryGroup } = useChat();

  return (
    <div className="bg-[#f0f2f5] border-b border-[#e9edef] px-4 py-2.5 flex items-center space-x-3 overflow-x-auto no-scrollbar select-none">
      {/* My Status */}
      <div
        onClick={() => {
          if (user) {
            setActiveStoryGroup({
              user,
              stories: [
                {
                  id: `my_story_${user.id}`,
                  caption: 'My 24-hour status on HUM–TUM! 💜✨',
                  background: 'linear-gradient(135deg, #6C4DFF, #FF6577)',
                  created_at: new Date().toISOString()
                }
              ]
            });
          }
        }}
        className="flex flex-col items-center flex-shrink-0 cursor-pointer w-14"
      >
        <div className="relative">
          <div className="w-12 h-12 rounded-full p-[2px] bg-[#00a884] flex items-center justify-center">
            <div className="w-full h-full rounded-full overflow-hidden bg-white flex items-center justify-center font-bold text-xs">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="My Status" className="w-full h-full object-cover" />
              ) : (
                <span>{user?.display_name?.slice(0, 2).toUpperCase() || 'ME'}</span>
              )}
            </div>
          </div>

          <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-[#00a884] text-white flex items-center justify-center border border-white">
            <Plus className="w-3 h-3 stroke-[3]" />
          </div>
        </div>
        <span className="text-[10px] font-medium text-[#111b21] mt-1 truncate text-center w-full">My Status</span>
      </div>

      {/* Contacts Statuses */}
      {stories.map((group) => {
        if (group.user?.id === user?.id) return null;
        return (
          <div
            key={group.user?.id}
            onClick={() => setActiveStoryGroup(group)}
            className="flex flex-col items-center flex-shrink-0 cursor-pointer w-14"
          >
            <div className="w-12 h-12 rounded-full p-[2px] bg-gradient-to-tr from-[#00a884] to-[#25d366] flex items-center justify-center">
              <div className="w-full h-full rounded-full overflow-hidden bg-white flex items-center justify-center font-bold text-xs">
                {group.user?.avatar_url ? (
                  <img src={group.user.avatar_url} alt={group.user.display_name} className="w-full h-full object-cover" />
                ) : (
                  <span>{group.user?.display_name?.slice(0, 2).toUpperCase() || 'ST'}</span>
                )}
              </div>
            </div>
            <span className="text-[10px] font-medium text-[#111b21] mt-1 truncate text-center w-full">
              {group.user?.display_name?.split(' ')[0]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
