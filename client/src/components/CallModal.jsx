import React, { useState, useEffect } from 'react';
import { Phone, PhoneOff, Video, Mic, MicOff, VideoOff } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export function CallModal() {
  const { incomingCall, activeCall, acceptCall, rejectCall, endCall } = useSocket();
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!activeCall) {
      setSeconds(0);
      return;
    }
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [activeCall]);

  const formatTime = (s) => {
    const mins = Math.floor(s / 60);
    const sec = s % 60;
    return `${mins.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // 1. Incoming Call Dialog
  if (incomingCall) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none animate-fade-in">
        <div className="w-full max-w-sm bg-[#111b21] text-white rounded-3xl p-8 flex flex-col items-center text-center space-y-6 shadow-2xl border border-white/10">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-tr from-[#00a884] to-[#25d366] flex items-center justify-center font-bold text-2xl animate-pulse">
            {incomingCall.callerAvatar ? (
              <img src={incomingCall.callerAvatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <span>{incomingCall.callerName?.slice(0, 2).toUpperCase()}</span>
            )}
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-bold">{incomingCall.callerName}</h3>
            <p className="text-xs text-[#25d366]">Incoming WhatsApp {incomingCall.type} call...</p>
          </div>

          <div className="flex items-center space-x-8 pt-4">
            <button
              onClick={rejectCall}
              className="w-14 h-14 rounded-full bg-[#ea0038] text-white flex items-center justify-center shadow-lg active:scale-95"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
            <button
              onClick={acceptCall}
              className="w-14 h-14 rounded-full bg-[#25d366] text-white flex items-center justify-center shadow-lg active:scale-95 animate-bounce"
            >
              {incomingCall.type === 'video' ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Active Call In-Progress Dialog
  if (activeCall) {
    const isVideo = activeCall.type === 'video';

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md select-none animate-fade-in">
        <div className="w-full max-w-md h-[500px] bg-[#111b21] text-white rounded-3xl p-6 flex flex-col justify-between items-center text-center shadow-2xl border border-white/10 relative">
          <span className="px-3 py-1 rounded-full bg-white/10 text-[11px] text-[#25d366] font-medium">
            End-to-End Encrypted
          </span>

          <div className="flex flex-col items-center space-y-4 my-auto">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-tr from-[#00a884] to-[#25d366] flex items-center justify-center font-bold text-3xl shadow-xl">
              {activeCall.targetUserAvatar ? (
                <img src={activeCall.targetUserAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span>{activeCall.targetUserName?.slice(0, 2).toUpperCase()}</span>
              )}
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold">{activeCall.targetUserName}</h2>
              <p className="text-xs font-mono text-[#25d366] font-semibold">{formatTime(seconds)}</p>
            </div>
          </div>

          <div className="flex items-center space-x-6">
            <button
              onClick={() => setMuted(!muted)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                muted ? 'bg-white text-[#111b21]' : 'bg-white/20 text-white'
              }`}
            >
              {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {isVideo && (
              <button
                onClick={() => setVideoOff(!videoOff)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                  videoOff ? 'bg-white text-[#111b21]' : 'bg-white/20 text-white'
                }`}
              >
                {videoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </button>
            )}

            <button
              onClick={endCall}
              className="w-14 h-14 rounded-full bg-[#ea0038] text-white flex items-center justify-center shadow-lg active:scale-95"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
