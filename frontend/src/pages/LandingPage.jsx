import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = React.useState("");

  const handleJoinGuest = () => {
    // Generate simple 6-char random code
    const randomCode = Math.random().toString(36).substring(2, 8);
    navigate(`/${randomCode}`);
  };

  const handleJoinByCode = () => {
    if (!joinCode.trim()) return;
    // Extract code if full URL is pasted
    const code = joinCode.includes('/')
      ? joinCode.split('/').filter(Boolean).pop()
      : joinCode;
    navigate(`/${code}`);
  };

  return (
    <div className='min-h-screen w-full bg-zinc-950 font-sans text-gray-100 flex flex-col overflow-x-hidden selection:bg-orange-500 selection:text-white'>

      {/* BACKGROUND TEXTURE */}
      <div className="absolute inset-0 max-w-full z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-sky-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/20 rounded-full blur-[120px]" />
      </div>

      {/* NAVIGATION */}
      <nav className='relative z-10 w-full px-6 md:px-12 py-6 flex justify-between items-center'>
        <div className='flex items-center gap-2'>
          {/* Simple Logo Icon */}
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/20">
            <span className="font-bold text-white text-lg"><img src="/images/video-conference2.png" alt="" /></span>
          </div>
          <h2 className='text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400'>
            VideoMeetZ
          </h2>
        </div>

        <div className='flex items-center gap-4 md:gap-8'>
          <button
            onClick={handleJoinGuest}
            className='hidden md:block text-gray-300 hover:text-white transition-colors font-medium cursor-pointer'
          >
            Join as Guest
          </button>

          <Link
            to="/auth"
            state={{ formState: 1 }}
            className='hidden md:block text-gray-300 hover:text-white transition-colors font-medium cursor-pointer'
          >
            Register
          </Link>

          <Link
            to="/auth"
            state={{ formState: 0 }}
            className='px-5 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-full font-semibold hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 cursor-pointer'
          >
            Login
          </Link>
        </div>
      </nav>

      {/* HERO SECTION */}
      <div className="relative z-10 flex-1 flex flex-col md:flex-row items-center justify-center w-full max-w-7xl mx-auto px-6 md:px-12 py-12 md:py-0 gap-12 md:gap-8">

        {/* LEFT CONTENT */}
        <div className='flex-1 flex flex-col items-center md:items-start text-center md:text-left space-y-8'>
          <div className="space-y-4">
            <div className="inline-block px-4 py-1.5 rounded-full bg-zinc-800/50 border border-zinc-700/50 backdrop-blur-md">
              <span className="text-orange-400 text-sm font-semibold tracking-wide uppercase">New Features Available</span>
            </div>
            <h1 className='text-2xl md:text-4xl font-extrabold tracking-tight leading-tight'>
              <span className="block">Connect instantly,</span>
              <span className='bg-clip-text text-transparent bg-gradient-to-r from-sky-300 to-blue-500 block'>
                collaborate effortlessly.
              </span>
            </h1>
            <p className='text-lg md:text-xl text-gray-400 max-w-xl mx-auto md:mx-0 leading-relaxed font-light'>
              Experience crystal-clear video calls with zero lag. Share your screen, collaborate in real-time, and stay connected with the world's most advanced platform.
            </p>
          </div>

          <div className='flex flex-col sm:flex-row gap-4 w-full sm:w-auto'>
            <button
              onClick={handleJoinGuest}
              className='px-8 py-4 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl font-bold text-lg hover:opacity-90 transition-all shadow-lg shadow-sky-500/25 hover:translate-y-[-2px] active:translate-y-[0px]'
            >
              Start Instant Meeting
            </button>
            <div className='flex items-center gap-2 bg-zinc-800/50 rounded-xl p-2 border border-zinc-700/50 backdrop-blur-sm'>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Enter meeting code"
                className='bg-transparent border-none text-white placeholder:text-gray-500 focus:outline-none px-4 py-2 w-40 md:w-48'
                onKeyDown={(e) => e.key === 'Enter' && handleJoinByCode()}
              />
              <button
                onClick={handleJoinByCode}
                className={`p-3 rounded-lg transition-all ${joinCode.trim() ? 'bg-zinc-700 text-white hover:bg-zinc-600 shadow-lg' : 'bg-zinc-800/50 text-gray-500 cursor-not-allowed'}`}
                disabled={!joinCode.trim()}
              >
                <span className="font-bold text-sm">Join</span>
              </button>
            </div>
          </div>

          <div className="py-4">
            <p className="text-lg md:text-xl text-gray-400 font-light leading-relaxed">
              Share your{" "}
              <span className="font-medium text-gray-100">screen</span>,{" "}
              <span className="font-medium text-gray-100">voice</span>, and{" "}
              <span className="font-medium text-gray-100">ideas</span>
              <span className="text-gray-500"> — </span>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-300 to-blue-500 font-semibold">
                seamlessly
              </span>
              .
            </p>
          </div>

        </div>

        {/* RIGHT IMAGE / VISUAL */}
        <div className='flex-1 w-full max-w-lg md:max-w-none relative perspective-1000'>
          {/* Decorative background elements behind image */}
          <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/10 to-pink-500/10 rounded-3xl transform rotate-3 scale-105 blur-xl"></div>

          <div className='relative bg-zinc-900/40 border border-white/10 backdrop-blur-xl rounded-2xl p-4 shadow-2xl overflow-hidden group hover:scale-[1.02] transition-transform duration-500 ease-out'>

            {/* Fake Browser Header */}
            <div className="flex items-center gap-2 mb-4 px-2 opacity-50">
              <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
              <div className="ml-2 h-6 w-full max-w-[200px] bg-white/5 rounded-full"></div>
            </div>

            {/* Main Image */}
            <div className="relative rounded-lg overflow-hidden aspect-[4/3] bg-zinc-800/50">
              <img
                src="/mobileCall.svg"
                alt="Video Conference Interface"
                className='w-full h-full object-contain p-8 group-hover:scale-110 transition-transform duration-700'
              />

              {/* Floating Elements (Simulating UI) */}
              <div className="absolute bottom-4 left-4 right-4 h-16 bg-zinc-950/80 backdrop-blur-md rounded-xl border border-white/5 flex items-center justify-center gap-4 animate-slide-up">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-red-500"><i className="w-4 h-4 bg-current rounded-full"></i></div>
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white"><i className="w-4 h-4 bg-current rounded-full"></i></div>
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white"><i className="w-4 h-4 bg-current rounded-full"></i></div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* FOOTER-ish */}
      <div className="w-full text-center py-6 text-zinc-600 text-sm">
        &copy; {new Date().getFullYear()} VideoMeetZ. All rights reserved.
      </div>

      <style>
        {`
                .perspective-1000 { perspective: 1000px; }
                @keyframes slide-up {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-slide-up { animation: slide-up 0.8s ease-out forwards; }
                `}
      </style>
    </div>
  )
}

export default LandingPage;
