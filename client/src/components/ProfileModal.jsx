import React, { useState } from 'react';
import { X, Camera, LogOut, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function ProfileModal({ isOpen, onClose }) {
  const { user, updateProfile, logout } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    await updateProfile(displayName, bio, user?.avatar_url);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1000);
  };

  const handleLogout = async () => {
    if (confirm('Are you sure you want to log out of HUM–TUM?')) {
      await logout();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs select-none animate-fade-in">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-6 border border-[#e9edef]">
        <div className="flex items-center justify-between pb-2 border-b border-[#e9edef]">
          <h2 className="text-base font-bold text-[#111b21]">Settings & Profile</h2>
          <button onClick={onClose} className="p-1 hover:bg-[#f0f2f5] rounded-full text-[#54656f]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile Avatar */}
        <div className="flex flex-col items-center space-y-2">
          <div className="relative">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-tr from-[#00a884] to-[#25d366] text-white flex items-center justify-center font-bold text-2xl shadow-md">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span>{user?.display_name?.slice(0, 2).toUpperCase() || 'ME'}</span>
              )}
            </div>
            <button className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#00a884] text-white flex items-center justify-center border-2 border-white shadow-xs">
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <span className="text-[11px] text-[#00a884] font-semibold">@{user?.username}</span>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-[#54656f]">Your Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-[#f0f2f5] rounded-xl px-3.5 py-2.5 text-[#111b21] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#00a884]"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-[#54656f]">About / Bio</label>
            <input
              type="text"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-[#f0f2f5] rounded-xl px-3.5 py-2.5 text-[#111b21] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#00a884]"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-[#00a884] text-white font-bold rounded-xl shadow-xs hover:bg-[#008f6f] active:scale-95 transition-all flex items-center justify-center space-x-1.5"
          >
            {saved ? (
              <>
                <Check className="w-4 h-4" />
                <span>Saved!</span>
              </>
            ) : (
              <span>Save Changes</span>
            )}
          </button>
        </form>

        <div className="pt-2 border-t border-[#e9edef]">
          <button
            onClick={handleLogout}
            className="w-full py-2.5 bg-[#ea0038]/10 text-[#ea0038] hover:bg-[#ea0038]/20 font-bold rounded-xl transition-colors flex items-center justify-center space-x-2 text-xs"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out of HUM–TUM</span>
          </button>
        </div>
      </div>
    </div>
  );
}
