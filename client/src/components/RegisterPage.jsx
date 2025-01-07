// client/src/components/RegisterPage.jsx
import React from 'react';
import './RegisterPage.css'; // We'll put your CSS here

function RegisterPage() {
  return (
    <div className="register-page">
      {/* Background Video */}
      <video autoPlay muted loop playsInline id="bg-video">
        <source src="/phone.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      {/* Dark Overlay */}
      <div className="overlay"></div>

      {/* Header */}
      <header>
        <div className="logo">FutureCreator</div>
        <nav>
          <ul>
            <li>Our Mission</li>
            <li>Support</li>
            <li>
              {/* Make "Login" link back to homepage for now */}
              <a href="/">Login</a>
            </li>
            <li>
              {/* We’re already on "Sign Up" so you can do # or /register */}
              <a href="/register">Sign Up</a>
            </li>
          </ul>
        </nav>
      </header>

      {/* Main Sign-Up Section */}
      <div className="hero">
        <div className="content-wrapper">
          <h1 className="signup-title">Create Your Account</h1>
          <p className="signup-subtitle">
            Join FutureCreator and take your content to the next level.
          </p>

          {/* Signup Box */}
          <div className="signup-box">
            <form className="signup-form">
              <input type="text" placeholder="Username" required />
              <input type="email" placeholder="Email Address" required />
              <input type="password" placeholder="Password" required />
              <input type="password" placeholder="Confirm Password" required />

              {/* Terms & Services Checkbox */}
              <label className="terms">
                <input type="checkbox" required />
                I accept the{" "}
                <a href="#" style={{ color: "#1da1f2" }}>
                  Terms &amp; Services
                </a>
              </label>

              {/* Sign Up Button */}
              <button type="submit" className="btn btn-primary">
                Sign Up
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer>
        &copy; 2025 FutureCreator. All rights reserved.
      </footer>
    </div>
  );
}

export default RegisterPage;
