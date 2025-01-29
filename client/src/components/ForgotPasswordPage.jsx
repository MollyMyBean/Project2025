import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import './ForgotPasswordPage.css'; // Or replace with './LandingPage.css' if reusing the same file

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isEmailValid, setIsEmailValid] = useState(false);

  // Track overall success once user submits
  const [showSuccess, setShowSuccess] = useState(false);

  // A simple validation for email format
  const validateEmail = useCallback((value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }, []);

  // Validate email every time it changes
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
  }, [email, validateEmail]);

  // Handle form submission => pretend we send a request to /api/auth/forgot-password
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!isEmailValid) return;

    try {
      // Example request:
      const response = await fetch('http://localhost:5000/api/auth/forgot-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (response.ok) {
        // Show success checkmark
        setShowSuccess(true);
      } else {
        alert(data.message || 'Error sending reset link');
      }
    } catch (err) {
      console.error('Forgot password error:', err);
      alert('Server error sending reset link');
    }
  };

  return (
    <div className="page-container">
      {/* LEFT COLUMN => similar style as your LandingPage */}
      <div className="left-col">
        <div className="brand-wrapper">
          <h1 className="brand-name">MyBrand</h1>
          <p className="brand-tagline">
            Recover your account <br />
            and support your favorite creators
          </p>
        </div>
      </div>

      {/* RIGHT COLUMN => the forgot password form box */}
      <div className="right-col">
        <div className="login-box">
          {showSuccess ? (
            <div className="success-container">
              <div className="success-checkmark">✔</div>
              <p className="success-text">Reset link sent!</p>
              <p className="success-redirect">
                Check your inbox for further instructions.
              </p>
            </div>
          ) : (
            <>
              <h2 className="login-heading">Forgot Password</h2>

              <form onSubmit={handleForgotSubmit} className="login-form">
                <div className="form-group">
                  <label htmlFor="email">Enter your account email</label>
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

                <button
                  type="submit"
                  className={`btn-login ${isEmailValid ? 'active' : ''}`}
                  disabled={!isEmailValid}
                >
                  SEND RESET LINK
                </button>
              </form>

              <p className="login-terms" style={{ marginTop: '1rem' }}>
                Remembered your password?{' '}
                <Link to="/" className="text-link">
                  Back to Login
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
