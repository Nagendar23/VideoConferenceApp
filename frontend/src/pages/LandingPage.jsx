import React from 'react'
import { Link } from 'react-router-dom'

const LandingPage = () => {
  return (
    <div className='min-h-screen w-screen flex flex-col text-gray-100 bg-cover bg-center bg-[image:linear-gradient(rgba(20,20,20,0.7),rgba(20,20,20,0.7)),url("/background.png")]'>
      <nav className='px-8 md:px-12 py-8 flex justify-between items-center bg-zinc-900/70 border-b border-zinc-800 shadow-md backdrop-blur-sm'>
        <div className='navHeader'>
          <h2 className='text-2xl font-bold tracking-wider text-orange-300'>VideoMeetZ</h2>
        </div>

        <div className='navlist flex gap-8 items-center'>
          <p className='cursor-pointer text-lg px-4 py-2 rounded-md hover:bg-zinc-800 transition-colors'>Join as Guest</p>
          <p className='cursor-pointer text-lg px-4 py-2 rounded-md hover:bg-zinc-800 transition-colors'>Register</p>
          <div role='button' className='cursor-pointer text-lg px-4 py-2 rounded-md hover:bg-zinc-800 transition-colors'>
            <p>Login</p>
          </div>
        </div>
      </nav>

      <div className="landingMainContainer flex-1 flex flex-col md:flex-row justify-between items-center px-[5vw] py-8 md:py-0">
        {/* LEFT SECTION */}
        <div className='flex flex-col items-start max-w-[90vw] md:max-w-[40vw]'>
          <h1 className='whitespace-nowrap text-3xl md:text-5xl font-bold leading-tight text-white drop-shadow-md'>
            <span className='text-orange-400'>
              Share your screen, your voice, your ideas—seamlessly.
            </span>
          </h1>
          <br />

          <p className='text-xl md:text-2xl text-gray-200'>Connect instantly, collaborate effortlessly.</p>

          <div role="button" className='mt-10 px-8 py-4 rounded-xl shadow-lg transition-transform transform hover:-translate-y-1 hover:scale-105 cursor-pointer bg-gradient-to-r from-orange-600 to-orange-400 hover:from-orange-400 hover:to-orange-600'>
            <Link to="/auth" className='text-white text-lg font-semibold tracking-wide no-underline'>Get Started</Link>
          </div>
        </div>

        {/* RIGHT SECTION */}
        <div className='mt-8 md:mt-0 h-[30vh] md:h-[70vh] w-full md:w-[45vw] flex items-center justify-center bg-zinc-800/30 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-sm border border-zinc-700/50'>
          <img src="/mobileCall.svg" alt="video call image" className='object-contain h-full w-full' />
        </div>
      </div>
    </div>
  )
}

export default LandingPage
