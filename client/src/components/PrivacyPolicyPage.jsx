import React from 'react';
import { Link } from 'react-router-dom';
import './PrivacyPolicyPage.css';

function PrivacyPolicyPage() {
  return (
    <div className="pp-container">
      {/* Simple top header with two links */}
      <header className="pp-header">
        <Link to="/home" className="header-link">Home</Link>
        <Link to="/login" className="header-link">Log In</Link>
      </header>
      
      <div className="pp-content">
        <h1 className="pp-title">Privacy Policy</h1>
        <p className="pp-updated-date">Last Updated: January 1, 2025</p>

        <section className="pp-section">
          <h2>1. Introduction</h2>
          <p>
            Welcome to our Privacy Policy. This document explains how we collect,
            use, disclose, and safeguard your information when you visit or use
            our website. Please read it carefully.
          </p>
        </section>

        <section className="pp-section">
          <h2>2. Information We Collect</h2>
          <p>
            <strong>Personal Data:</strong> We may collect information that can
            identify you, such as your name and email address, when you voluntarily
            provide it to us. <br />
            <strong>Usage Data:</strong> We may collect information about how you
            interact with our website, including IP address, browser type, and
            pages visited.
          </p>
        </section>

        <section className="pp-section">
          <h2>3. How We Use Your Information</h2>
          <p>
            We use your information to provide, maintain, and improve our services,
            as well as to respond to your inquiries. Additionally, we may use your
            information for analytics, marketing, and compliance with legal
            obligations.
          </p>
        </section>

        <section className="pp-section">
          <h2>4. Cookies and Tracking Technologies</h2>
          <p>
            We may use cookies and similar tracking technologies to enhance your
            experience on our site. You may disable cookies through your browser
            settings, but certain features may not function properly without them.
          </p>
        </section>

        <section className="pp-section">
          <h2>5. Disclosure of Your Information</h2>
          <p>
            We may share your information with service providers who assist us in
            operating our site, conducting business, or servicing you. We may also
            share your data if required by law or if we believe such action is
            necessary to protect our rights or others.
          </p>
        </section>

        <section className="pp-section">
          <h2>6. Third-Party Services</h2>
          <p>
            Our website may contain links to third-party websites or services. We
            do not control, and are not responsible for, the privacy practices of
            these third-party entities. We encourage you to review their privacy
            policies before providing any personal information.
          </p>
        </section>

        <section className="pp-section">
          <h2>7. Data Retention and Security</h2>
          <p>
            We retain your personal information for as long as necessary to fulfill
            the purposes outlined in this policy, unless a longer retention period
            is required or permitted by law. We employ reasonable security measures
            to protect your data from unauthorized access.
          </p>
        </section>

        <section className="pp-section">
          <h2>8. Your Rights</h2>
          <p>
            Depending on your location, you may have the right to access, correct,
            or delete your personal data. Please contact us at
            <a href="mailto:privacy@example.com"> privacy@example.com</a> to exercise
            your rights or request more information.
          </p>
        </section>

        <section className="pp-section">
          <h2>9. Children’s Privacy</h2>
          <p>
            Our services are not directed to individuals under the age of 18, and
            we do not knowingly collect personal data from children. If you believe
            we have unintentionally collected such data, please contact us.
          </p>
        </section>

        <section className="pp-section">
          <h2>10. International Data Transfers</h2>
          <p>
            Information we collect may be stored and processed in jurisdictions
            other than your own. By using our site, you consent to any such transfer
            of information outside your country.
          </p>
        </section>

        <section className="pp-section">
          <h2>11. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Any changes will be
            effective immediately upon posting the revised version on our website.
          </p>
        </section>

        <section className="pp-section">
          <h2>12. Contact Us</h2>
          <p>
            If you have any questions or concerns about this Privacy Policy, please
            reach out to us at
            <a href="mailto:privacy@example.com"> privacy@example.com</a>.
          </p>
        </section>

        <div className="pp-footer-link">
          <Link to="/home" className="pp-home-link">Back to Home</Link>
        </div>
      </div>
    </div>
  );
}

export default PrivacyPolicyPage;
