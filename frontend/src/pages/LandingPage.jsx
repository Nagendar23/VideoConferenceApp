import React from 'react'
import { Link } from 'react-router-dom'

const LandingPage = () => {
  return (
    <div className='landingPageContainer'>
      <nav>
        <div className='navHeader'>
          <h2>Video Meets</h2>
        </div>
        <div className='navlist'>
          <p>Join as Guest</p>
          <p>Register</p>
          <div role='button'>
            <p>Login</p>
          </div>
        </div>
      </nav>
      <div className="landingMainContainer">
        <div>
          <h1><span style={{color:"#FF9839"}}>Connect</span> with your loved ones</h1>
          <p>Cover a distance by our Video Call</p>
          <div role='button'>
            <Link to={'/auth'}>Get Started</Link>
          </div>
        </div>
        <div>
          <img src="/mobileCall.svg " alt="video call image" />
        </div>
      </div>
    </div>
  )
}

export default LandingPage