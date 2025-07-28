import React from 'react';
import { Outlet, Link } from 'react-router-dom';

/**
 * Authentication Layout Component
 * 
 * Provides a consistent layout for authentication pages (login, register, etc.)
 * with branding, responsive design, and decorative elements.
 */
const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800">
      {/* Header with logo */}
      <header className="w-full p-4 sm:p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-lg bg-hedera-700 flex items-center justify-center">
              <svg 
                viewBox="0 0 24 24" 
                fill="none" 
                className="w-6 h-6 text-white"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  d="M3 3v18h18V3H3zm16 16H5V5h14v14z" 
                  fill="currentColor"
                />
                <path 
                  d="M7 7h2v10H7V7zm4 0h2v10h-2V7zm4 0h2v10h-2V7z" 
                  fill="currentColor"
                />
              </svg>
            </div>
            <span className="text-xl font-semibold text-neutral-900 dark:text-white">Hedera ID Wallet</span>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-grow flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row shadow-lg rounded-2xl overflow-hidden">
          {/* Decorative side panel (hidden on mobile) */}
          <div className="hidden lg:block lg:w-1/2 bg-hedera-700 p-12 text-white relative overflow-hidden">
            <div className="relative z-10">
              <h1 className="text-3xl font-bold mb-6">Secure Identity Wallet</h1>
              <p className="text-lg mb-8">
                Store and manage your digital identity and credentials with security and privacy.
              </p>
              <ul className="space-y-4">
                <li className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Passwordless authentication
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Decentralized identity (DID)
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Verifiable credentials
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Biometric security
                </li>
              </ul>
            </div>

            {/* Decorative background elements */}
            <div className="absolute top-0 right-0 w-full h-full">
              <svg className="absolute right-0 top-0 h-full w-full text-hedera-600 opacity-20" 
                   viewBox="0 0 100 100" preserveAspectRatio="none" fill="currentColor">
                <polygon points="0,0 100,0 100,100" />
              </svg>
              <svg className="absolute left-0 bottom-0 h-full w-full text-hedera-800 opacity-20" 
                   viewBox="0 0 100 100" preserveAspectRatio="none" fill="currentColor">
                <polygon points="0,100 100,100 0,0" />
              </svg>
              <div className="absolute inset-0 bg-gradient-to-br from-hedera-600 to-hedera-800 opacity-30"></div>
            </div>
          </div>

          {/* Auth content area */}
          <div className="w-full lg:w-1/2 bg-white dark:bg-neutral-800 p-8 sm:p-12">
            <Outlet />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full p-4 sm:p-6 text-center text-sm text-neutral-600 dark:text-neutral-400">
        <div className="max-w-7xl mx-auto">
          <div className="mb-2">
            <a href="https://hedera.com" target="_blank" rel="noopener noreferrer" className="hover:text-hedera-700 transition-colors mx-2">
              About Hedera
            </a>
            <span className="mx-2">•</span>
            <a href="#" className="hover:text-hedera-700 transition-colors mx-2">
              Privacy Policy
            </a>
            <span className="mx-2">•</span>
            <a href="#" className="hover:text-hedera-700 transition-colors mx-2">
              Terms of Service
            </a>
          </div>
          <p>© {new Date().getFullYear()} Hedera ID Wallet. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default AuthLayout;
