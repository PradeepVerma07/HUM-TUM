import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, Lock, User } from 'lucide-react';

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(usernameOrEmail, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
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
          <h1 className="text-xl font-bold text-[#111b21]">Sign into HUM–TUM</h1>
          <p className="text-xs text-[#667781]">Dedicated WhatsApp-style Social Messaging</p>
        </div>

        {error && (
          <div className="p-3 bg-[#ea0038]/10 border border-[#ea0038]/20 text-[#ea0038] text-xs font-semibold rounded-xl text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-[#54656f]">Username or Email</label>
            <div className="flex items-center bg-[#f0f2f5] rounded-xl px-3.5 py-2.5">
              <User className="w-4 h-4 text-[#8696a0] mr-2" />
              <input
                type="text"
                placeholder="e.g. priya.verma"
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                className="bg-transparent text-[#111b21] focus:outline-none w-full"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-[#54656f]">Password</label>
            <div className="flex items-center bg-[#f0f2f5] rounded-xl px-3.5 py-2.5">
              <Lock className="w-4 h-4 text-[#8696a0] mr-2" />
              <input
                type="password"
                placeholder="••••••••"
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
            className="w-full py-3 bg-[#00a884] text-white font-bold rounded-xl shadow-md hover:bg-[#008f6f] active:scale-95 transition-all text-xs cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="text-center text-xs text-[#667781] pt-2 border-t border-[#f0f2f5]">
          Don't have an account?{' '}
          <Link to="/register" className="text-[#00a884] font-bold hover:underline">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
