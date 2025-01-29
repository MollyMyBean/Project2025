import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

// 1. Import your logo file (adjust the path/filename as needed):
import logo from '/logo.png'; 

function LandingPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Show/hide password
  const [showPassword, setShowPassword] = useState(false);

  // Validation states
  const [emailError, setEmailError] = useState('');
  const [isEmailValid, setIsEmailValid] = useState(false);

  // Track overall form validity
  const [isFormValid, setIsFormValid] = useState(false);

  // Show success check + handle auto-redirect
  const [showSuccess, setShowSuccess] = useState(false);

  // More robust email pattern validation
  const validateEmail = useCallback((value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }, []);

  // Run validation whenever 'email' or 'password' changes
  useEffect(() => {
    if (!email) {
      setEmailError('');
      setIsEmailValid(false);
    } else if (!validateEmail(email)) {
      setEmailError('Invalid email format');
      setIsEmailValid(false);
    } else {
      setEmailError('');
      setIsEmailValid(true);
    }

    // Form is valid if email is valid & password is non-empty
    setIsFormValid(isEmailValid && password.trim().length > 0);
  }, [email, password, isEmailValid, validateEmail]);

  // Handle login form submission
  const handleLoginSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!isFormValid) return;

      try {
        const response = await fetch('http://localhost:5000/api/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Content-Type-Options': 'nosniff'
          },
          body: JSON.stringify({
            usernameOrEmail: email,
            password
          })
        });

        const data = await response.json();

        if (response.ok) {
          // Show success check & auto-redirect
          setShowSuccess(true);
          setTimeout(() => {
            window.location.href = '/home';
          }, 1500);
        } else {
          alert(data.message || 'Login failed');
        }
      } catch (err) {
        console.error('Error:', err);
        alert('Something went wrong during login.');
      }
    },
    [email, password, isFormValid]
  );

  return (
    <div className="page-container">
      {/* LEFT COLUMN: Brand (blue) area with the logo */}
      <div className="left-col">
        <div className="brand-wrapper">
          {/* 2. Your new logo placement */}
          <img src={logo} alt="My Brand Logo" className="brand-logo" />

          <h1 className="brand-name">FanPOV</h1>
          <p className="brand-tagline">
            Sign up to get exclusive <br />
            content
          </p>
        </div>
      </div>

      {/* RIGHT COLUMN: Login form (or success icon) */}
      <div className="right-col">
        <div className="login-box">
          {showSuccess ? (
            <div className="success-container">
              <div className="success-checkmark">✔</div>
              <p className="success-text">Login successful!</p>
              <p className="success-redirect">Redirecting to your home...</p>
            </div>
          ) : (
            <>
              <h2 className="login-heading">Log in</h2>

              <form onSubmit={handleLoginSubmit} className="login-form">
                {/* Email */}
                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={emailError ? 'input-error' : ''}
                  />
                  {emailError && <div className="error-indicator">{emailError}</div>}
                </div>

                {/* Password with working eye icon */}
                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <div className="password-wrapper">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    {/* 3. Eye icon toggles 'showPassword' */}
                    <span
                      className="eye-icon"
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? 'Hide password' : 'Show password'}
                      style={{ cursor: 'pointer' }}
                    >
                      {showPassword ? '🙈' : '👁'}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  className={`btn-login ${isFormValid ? 'active' : ''}`}
                  disabled={!isFormValid}
                >
                  LOG IN
                </button>
              </form>

              {/* Terms text */}
              <p className="login-terms">
                By logging in and using MyBrand, you agree to our{' '}
                <Link to="/terms" className="text-link">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-link">
                  Privacy Policy
                </Link>
                , and confirm that you are at least 18 years old.
              </p>

              {/* Forgot Password / Sign Up */}
              <div className="extra-links">
                <Link to="/forgot-password" className="text-link">
                  Forgot password?
                </Link>
                <span> · </span>
                <Link to="/register" className="text-link">
                  Sign up for MyBrand
                </Link>
              </div>

              {/* Other sign-in methods */}
              <button className="btn-alt btn-signin-x">SIGN IN WITH X</button>
              <button className="btn-alt btn-signin-google">
                SIGN IN WITH GOOGLE
              </button>
              <button className="btn-alt btn-signin-passwordless">
                PASSWORDLESS SIGN IN
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
