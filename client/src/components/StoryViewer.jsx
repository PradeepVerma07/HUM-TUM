import React, { useState, useEffect } from 'react';
import { X, Heart } from 'lucide-react';
import { useChat } from '../context/ChatContext';

export function StoryViewer() {
  const { activeStoryGroup, setActiveStoryGroup } = useChat();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!activeStoryGroup) return;
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setActiveStoryGroup(null);
          return 100;
        }
        return prev + 2;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [activeStoryGroup]);

  if (!activeStoryGroup) return null;

  const story = activeStoryGroup.stories[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 select-none animate-fade-in">
      <div
        className="relative w-full max-w-md h-full max-h-[90vh] md:rounded-2xl overflow-hidden flex flex-col justify-between p-4 shadow-2xl"
        style={{ background: story.background || 'linear-gradient(135deg, #00a884, #128c7e)' }}
      >
        {/* Progress Bar & Header */}
        <div className="space-y-3 z-10">
          <div className="w-full h-1 bg-white/30 rounded-full overflow-hidden">
            <div className="h-full bg-white transition-all duration-100" style={{ width: `${progress}%` }} />
          </div>

          <div className="flex items-center justify-between text-white">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-full overflow-hidden bg-white/20 flex items-center justify-center font-bold text-xs">
                {activeStoryGroup.user?.avatar_url ? (
                  <img src={activeStoryGroup.user.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span>{activeStoryGroup.user?.display_name?.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div>
                <h3 className="text-xs font-bold leading-tight">{activeStoryGroup.user?.display_name}</h3>
                <span className="text-[10px] text-white/80">Today at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>

            <button
              onClick={() => setActiveStoryGroup(null)}
              className="p-1 text-white hover:bg-black/20 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Center Content */}
        <div className="flex items-center justify-center text-center p-6 my-auto z-10">
          <h2 className="text-2xl md:text-3xl font-bold text-white drop-shadow-md leading-relaxed">
            {story.caption}
          </h2>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-white z-10">
          <span className="text-xs text-white/80">Status updates disappear after 24h</span>
          <button className="p-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white">
            <Heart className="w-5 h-5 fill-current" />
          </button>
        </div>
      </div>
    </div>
  );
}
