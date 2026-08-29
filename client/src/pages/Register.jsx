import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, User, Mail, AtSign } from 'lucide-react';

export function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(username, displayName, email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-[#f0f2f5] flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-xl border border-[#e9edef] space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#00a884] to-[#25d366] text-white flex items-center justify-center font-bold text-2xl mx-auto shadow-md shadow-[#00a884]/30">
            HT
          </div>
          <h1 className="text-xl font-bold text-[#111b21]">Join HUM–TUM</h1>
          <p className="text-xs text-[#667781]">Create your WhatsApp account</p>
        </div>

        {error && (
          <div className="p-3 bg-[#ea0038]/10 border border-[#ea0038]/20 text-[#ea0038] text-xs font-semibold rounded-xl text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-[#54656f]">Username</label>
            <div className="flex items-center bg-[#f0f2f5] rounded-xl px-3.5 py-2.5">
              <AtSign className="w-4 h-4 text-[#8696a0] mr-2" />
              <input
                type="text"
                placeholder="e.g. rohit.mehta"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                className="bg-transparent text-[#111b21] focus:outline-none w-full"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-[#54656f]">Display Name</label>
            <div className="flex items-center bg-[#f0f2f5] rounded-xl px-3.5 py-2.5">
              <User className="w-4 h-4 text-[#8696a0] mr-2" />
              <input
                type="text"
                placeholder="e.g. Rohit Mehta"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-transparent text-[#111b21] focus:outline-none w-full"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-[#54656f]">Email (Optional)</label>
            <div className="flex items-center bg-[#f0f2f5] rounded-xl px-3.5 py-2.5">
              <Mail className="w-4 h-4 text-[#8696a0] mr-2" />
              <input
                type="email"
                placeholder="rohit@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-transparent text-[#111b21] focus:outline-none w-full"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-[#54656f]">Password</label>
            <div className="flex items-center bg-[#f0f2f5] rounded-xl px-3.5 py-2.5">
              <Lock className="w-4 h-4 text-[#8696a0] mr-2" />
              <input
                type="password"
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-transparent text-[#111b21] focus:outline-none w-full"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#00a884] text-white font-bold rounded-xl shadow-md hover:bg-[#008f6f] active:scale-95 transition-all text-xs cursor-pointer disabled:opacity-50 mt-2"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="text-center text-xs text-[#667781] pt-2 border-t border-[#f0f2f5]">
          Already have an account?{' '}
          <Link to="/login" className="text-[#00a884] font-bold hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
