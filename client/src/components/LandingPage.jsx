// client/src/components/LandingPage.jsx

import React from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

function LandingPage() {
  return (
    <div className="landing-page">
      {/* Background Video */}
      <video
        id="bg-video"
        autoPlay
        muted
        loop
        src="phone.mp4"
        playsInline
      />

      {/* Dark Overlay for readability */}
      <div className="overlay"></div>

      {/* Header */}
      <header>
        <div className="logo">MyBrand</div>
        <nav>
          <ul>
            <li><a href="#home">Home</a></li>
            <li><a href="#features">Features</a></li>
            <li><a href="#contact">Contact</a></li>
          </ul>
        </nav>
      </header>

      {/* Hero / Main Content */}
      <div className="hero">
        <div className="content-wrapper">
          <h1 className="hero-title">Welcome to My Awesome App</h1>
          <p className="hero-subtitle">
            Explore the best platform to connect with friends, follow
            interesting creators, and do so much more.
          </p>

          {/* Login Box */}
          <div className="login-box">
            <form>
              <div>
                <label htmlFor="username">Username</label>
                <input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                />
              </div>
              <div>
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                />
              </div>
              <button type="submit" className="btn btn-primary">Login</button>
            </form>
          </div>

          {/* Sign-up Link */}
          <div className="signup-link">
            Don’t have an account?{" "}
            <Link to="/register" style={{ color: '#fff', textDecoration: 'underline' }}>
              Sign Up
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer>
        <p>© 2025 MyApp. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default LandingPage;
