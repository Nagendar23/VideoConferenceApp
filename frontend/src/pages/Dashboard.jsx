import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

export default function Dashboard() {
    const navigate = useNavigate();
    const { handleLogout, userData } = useContext(AuthContext);
    const [meetingCode, setMeetingCode] = useState("");

    const handleStartNewMeeting = () => {
        const randomCode = Math.random().toString(36).substring(2, 8);
        navigate(`/${randomCode}`);
    };

    const handleJoinMeeting = () => {
        if (!meetingCode.trim()) return;
        // Clean up code if it contains the full URL
        const code = meetingCode.includes('/')
            ? meetingCode.split('/').filter(Boolean).pop()
            : meetingCode;
        navigate(`/${code}`);
    };

    return (
        <div className='h-screen w-full bg-zinc-950 font-sans text-gray-100 flex flex-col overflow-hidden selection:bg-orange-500 selection:text-white'>

            {/* BACKGROUND TEXTURE */}
            <div className="absolute inset-0 max-w-full z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-sky-900/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/20 rounded-full blur-[120px]" />
            </div>

            {/* NAVIGATION */}
            <nav className='relative z-10 w-full px-6 md:px-12 py-4 flex justify-between items-center border-b border-white/5 bg-zinc-950/50 backdrop-blur-md'>
                <div className='flex items-center gap-2'>
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/20">
                        <span className="font-bold text-white text-lg"><img src="/images/video-conference2.png" alt="" /></span>
                    </div>
                    <h2 className='text-xl md:text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400'>
                        VideoMeetZ
                    </h2>
                </div>

                {userData && (
                    <div className='flex items-center gap-6'>
                        <div className="hidden md:flex flex-col items-end">
                            <span className="text-sm font-semibold text-white">{userData.name}</span>
                            <span className="text-xs text-gray-400">@{userData.username}</span>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white font-bold shadow-lg ring-2 ring-white/10">
                            {userData.username ? userData.username[0].toUpperCase() : "U"}
                        </div>
                        <button
                            onClick={handleLogout}
                            className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                )}
            </nav>

            {/* MAIN CONTENT */}
            <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-6 md:px-12 py-8 flex flex-col items-center justify-center">

                <div className="w-full max-w-4xl flex flex-col items-center text-center space-y-4 mb-8">
                    <h1 className='text-3xl md:text-4xl font-extrabold tracking-tight leading-tight animate-slide-up'>
                        <span className="block text-gray-400 text-xl md:text-2xl font-medium mb-1">Welcome back,</span>
                        <span className='bg-clip-text text-transparent bg-gradient-to-r from-sky-300 via-blue-400 to-indigo-500'>
                            {userData?.name || "User"}
                        </span>
                    </h1>
                    <p className='text-base md:text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed font-light animate-slide-up' style={{ animationDelay: '0.1s' }}>
                        Ready to connect? Start a new meeting or join an existing one with your team.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl animate-slide-up" style={{ animationDelay: '0.2s' }}>

                    {/* NEW MEETING CARD */}
                    <div className="group relative bg-zinc-900/40 border border-white/10 backdrop-blur-sm rounded-3xl p-6 hover:bg-zinc-800/40 transition-all duration-300 hover:scale-[1.02] shadow-2xl overflow-hidden">
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                            <svg className="w-20 h-20 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <div className="bg-sky-500/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 text-sky-500">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">Start Instant Meeting</h3>
                        <p className="text-gray-400 mb-6 text-sm h-10">Create a new meeting room instantly and invite others to join you.</p>
                        <button
                            onClick={handleStartNewMeeting}
                            className="w-full py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl font-bold shadow-lg shadow-sky-500/20 hover:shadow-sky-500/40 hover:opacity-90 transition-all active:scale-[0.98]"
                        >
                            Start Meeting
                        </button>
                    </div>

                    {/* JOIN MEETING CARD */}
                    <div className="group relative bg-zinc-900/40 border border-white/10 backdrop-blur-sm rounded-3xl p-6 hover:bg-zinc-800/40 transition-all duration-300 hover:scale-[1.02] shadow-2xl">
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                            <svg className="w-20 h-20 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                        <div className="bg-purple-500/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 text-purple-400">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">Join a Meeting</h3>
                        <p className="text-gray-400 mb-6 text-sm h-10">Enter a meeting code or link to join an existing video call.</p>

                        <div className="space-y-3">
                            <input
                                type="text"
                                placeholder="Enter meeting code"
                                value={meetingCode}
                                onChange={(e) => setMeetingCode(e.target.value)}
                                className="w-full bg-zinc-950/50 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                                onKeyDown={(e) => e.key === 'Enter' && handleJoinMeeting()}
                            />
                            <button
                                onClick={handleJoinMeeting}
                                disabled={!meetingCode.trim()}
                                className={`w-full py-3 rounded-xl font-bold transition-all ${meetingCode.trim()
                                    ? 'bg-zinc-100 text-zinc-900 hover:bg-white shadow-lg shadow-white/10'
                                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                    }`}
                            >
                                Join Now
                            </button>
                        </div>
                    </div>

                </div>

            </main>

            <footer className="w-full text-center py-4 text-zinc-600 text-xs">
                &copy; {new Date().getFullYear()} VideoMeetZ. All rights reserved.
            </footer>

            <style>{`
                @keyframes slide-up {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-slide-up { animation: slide-up 0.8s ease-out forwards; }
            `}</style>
        </div>
    );
}
