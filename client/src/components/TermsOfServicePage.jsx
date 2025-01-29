import React from 'react';
import { Link } from 'react-router-dom';
import './TermsOfServicePage.css';

function TermsOfServicePage() {
  return (
    <div className="tos-container">
      {/* Simple top header with two links */}
      <header className="tos-header">
        <Link to="/home" className="header-link">Home</Link>
        <Link to="/login" className="header-link">Log In</Link>
      </header>
      
      <div className="tos-content">
        <h1 className="tos-title">Terms of Service</h1>
        <p className="tos-updated-date">Last Updated: January 1, 2025</p>

        <section className="tos-section">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using our website, you agree to be bound by these Terms
            of Service (“Terms”). If you do not agree to all of these Terms, you are
            prohibited from using our site. We may modify these Terms at any time, and
            such modifications will be effective immediately upon posting.
          </p>
        </section>

        <section className="tos-section">
          <h2>2. Eligibility</h2>
          <p>
            You represent and warrant that you are at least 18 years of age and
            have full legal capacity to enter into a binding agreement. If you
            are under 18, you must stop using this site immediately.
          </p>
        </section>

        <section className="tos-section">
          <h2>3. User Accounts</h2>
          <p>
            You may be required to create an account to access certain features. You
            agree to keep your account information accurate and secure, and to notify
            us immediately of any unauthorized use of your account.
          </p>
        </section>

        <section className="tos-section">
          <h2>4. User Conduct</h2>
          <p>
            You agree not to use our site for any unlawful purpose or in violation of
            these Terms. Prohibited activities include harassing other users, posting
            harmful or fraudulent content, and attempting to interfere with the site’s
            security or functionality.
          </p>
        </section>

        <section className="tos-section">
          <h2>5. Intellectual Property</h2>
          <p>
            All content, trademarks, and logos on our site are the exclusive property
            of us or our licensors. You may not copy, reproduce, or distribute any part
            of the site without our express written permission.
          </p>
        </section>

        <section className="tos-section">
          <h2>6. Disclaimers</h2>
          <p>
            Our site and its content are provided “as is.” We make no warranties, express
            or implied, regarding the site’s accuracy, reliability, or availability.
            Your use is at your own risk.
          </p>
        </section>

        <section className="tos-section">
          <h2>7. Limitation of Liability</h2>
          <p>
            In no event shall we be liable for any indirect, incidental, special,
            consequential, or punitive damages arising out of or related to your use of
            the site. Our total liability to you for any claim shall not exceed the
            amount you paid to us, if any, in the 12 months preceding the event.
          </p>
        </section>

        <section className="tos-section">
          <h2>8. Indemnification</h2>
          <p>
            You agree to indemnify and hold us harmless from any claims, damages, or
            expenses (including attorneys’ fees) arising from your breach of these Terms
            or misuse of the site.
          </p>
        </section>

        <section className="tos-section">
          <h2>9. Governing Law & Jurisdiction</h2>
          <p>
            These Terms and your use of the site are governed by the laws of the
            jurisdiction in which we operate. Any disputes shall be resolved in the
            courts located in that jurisdiction.
          </p>
        </section>

        <section className="tos-section">
          <h2>10. Termination</h2>
          <p>
            We may terminate or suspend your access to the site at any time without
            notice or liability if you breach any part of these Terms.
          </p>
        </section>

        <section className="tos-section">
          <h2>11. Additional Provisions</h2>
          <p>
            <strong>Arbitration Clause:</strong> You agree that any and all disputes or
            claims arising out of or in connection with these Terms shall be resolved
            through confidential binding arbitration. By agreeing to arbitration, you
            waive your right to a jury trial or to participate in a class action
            lawsuit. <br />
            <strong>Severability:</strong> If any provision of these Terms is held to be
            invalid or unenforceable, such provision shall be struck, and all remaining
            provisions shall remain in full force and effect.
          </p>
        </section>

        <section className="tos-section">
          <h2>12. Contact Us</h2>
          <p>
            If you have any questions or concerns about these Terms, please contact us at
            <a href="mailto:support@example.com"> support@example.com</a>.
          </p>
        </section>

        <div className="tos-footer-link">
          <Link to="/home" className="tos-home-link">Back to Home</Link>
        </div>
      </div>
    </div>
  );
}

export default TermsOfServicePage;
