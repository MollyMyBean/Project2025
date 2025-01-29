// client/src/components/RegisterPage.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './RegisterPage.css';

function RegisterPage() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  // Validation / error states
  const [usernameError, setUsernameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [isFormValid, setIsFormValid] = useState(false);

  // Helper function: must have uppercase & digit
  const isStrongPassword = (pw) => {
    const pattern = /^(?=.*[A-Z])(?=.*\d).+$/;
    return pattern.test(pw);
  };

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  useEffect(() => {
    // Clear server errors as user types
    setUsernameError('');
    setEmailError('');
    setPasswordError('');
    setConfirmError('');

    // 1) Check password strength
    if (formData.password && !isStrongPassword(formData.password)) {
      setPasswordError('Must contain at least 1 uppercase letter and 1 digit');
    }

    // 2) Check confirm password
    if (formData.confirmPassword && formData.password !== formData.confirmPassword) {
      setConfirmError('Passwords do not match!');
    }

    // Evaluate overall form validity
    const okUsername = formData.username.trim().length > 0;
    const okEmail = formData.email.trim().length > 0;
    const okPassword = isStrongPassword(formData.password);
    const okConfirm = formData.password === formData.confirmPassword;

    setIsFormValid(okUsername && okEmail && okPassword && okConfirm);
  }, [formData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;

    try {
      const response = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password
        })
      });

      const data = await response.json();
      if (response.ok) {
        alert(data.message);
        window.location.href = '/'; // go to login
      } else {
        // Distinguish error messages
        if (data.message && data.message.toLowerCase().includes('username')) {
          setUsernameError(data.message);
        } else if (data.message && data.message.toLowerCase().includes('email')) {
          setEmailError(data.message);
        } else {
          alert(data.message || 'Registration failed');
        }
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Something went wrong with registration.');
    }
  };

  return (
    <div className="register-container">
      {/* LEFT COLUMN */}
      <div className="left-col-reg">
        <div className="brand-wrapper-reg">
          <h1 className="brand-name-reg">MyBrand</h1>
          <p className="brand-tagline-reg">
            Join MyBrand and take <br />
            your content to the next level!
          </p>
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div className="right-col-reg">
        <div className="register-box">
          <h2 className="register-heading">Create Your Account</h2>
          <form className="register-form" onSubmit={handleSubmit}>
            {/* USERNAME */}
            <div className="form-group-reg">
              <label className="reg-label" htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                name="username"
                placeholder="Username"
                value={formData.username}
                onChange={handleChange}
                required
                className={usernameError ? 'input-error' : ''}
              />
              {usernameError && (
                <div className="reg-error-indicator">{usernameError}</div>
              )}
            </div>

            {/* EMAIL */}
            <div className="form-group-reg">
              <label className="reg-label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                name="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={handleChange}
                required
                className={emailError ? 'input-error' : ''}
              />
              {emailError && (
                <div className="reg-error-indicator">{emailError}</div>
              )}
            </div>

            {/* PASSWORD */}
            <div className="form-group-reg">
              <label className="reg-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                required
                className={passwordError ? 'input-error' : ''}
              />
              {passwordError && (
                <div className="reg-error-indicator">{passwordError}</div>
              )}
            </div>

            {/* CONFIRM PASSWORD */}
            <div className="form-group-reg">
              <label className="reg-label" htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                name="confirmPassword"
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                className={confirmError ? 'input-error' : ''}
              />
              {confirmError && (
                <div className="reg-error-indicator">{confirmError}</div>
              )}
            </div>

            {/* Terms & Services Checkbox */}
            <label className="terms-reg">
              <input type="checkbox" required />
              I accept the{' '}
              <Link to="/terms" className="reg-text-link">
                Terms &amp; Services
              </Link>

                        {' '}or{' '}
            <Link to="/" className="reg-text-link">
              Login
            </Link>
            </label>

            

            {/* Sign Up Button */}
            <button
              type="submit"
              className={`btn-reg ${isFormValid ? 'active' : ''}`}
              disabled={!isFormValid}
            >
              Sign Up
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
