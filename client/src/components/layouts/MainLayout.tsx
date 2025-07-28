import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  HomeIcon,
  IdentificationIcon,
  UserCircleIcon,
  ArrowLeftOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  SunIcon,
  MoonIcon,
  QrCodeIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

interface MainLayoutProps {
  toggleTheme: () => void;
  theme: string;
}

/**
 * Main Layout Component
 * 
 * Provides the main application layout with:
 * - Responsive sidebar navigation
 * - Header with user profile and theme toggle
 * - Main content area
 */
const MainLayout: React.FC<MainLayoutProps> = ({ toggleTheme, theme }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Navigation items
  const navigation = [
    { name: 'Dashboard', path: '/wallet', icon: HomeIcon },
    { name: 'Credentials', path: '/wallet/credentials', icon: IdentificationIcon },
    { name: 'Profile', path: '/wallet/profile', icon: UserCircleIcon },
  ];

  // Toggle sidebar on mobile
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Close sidebar when navigating on mobile
  const closeSidebarOnMobile = () => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  // Handle logout
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user || !user.name) return '?';
    
    const nameParts = user.name.split(' ');
    if (nameParts.length === 1) return nameParts[0].charAt(0).toUpperCase();
    
    return (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase();
  };

  // Get user display name
  const getUserDisplayName = () => {
    if (!user || !user.name) return 'User';
    
    const nameParts = user.name.split(' ');
    return nameParts[0]; // Return first name
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-neutral-800 shadow-md transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:z-0
        `}
      >
        {/* Sidebar header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-hedera-700 flex items-center justify-center">
              <ShieldCheckIcon className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-semibold text-neutral-900 dark:text-white">ID Wallet</span>
          </div>
          <button 
            className="lg:hidden p-1 rounded-md text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-white"
            onClick={toggleSidebar}
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Sidebar navigation */}
        <nav className="mt-4 px-2 space-y-1">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) => `
                flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${isActive 
                  ? 'bg-hedera-50 text-hedera-700 dark:bg-hedera-900 dark:text-hedera-300' 
                  : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700'}
              `}
              onClick={closeSidebarOnMobile}
            >
              <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        {/* User DID section */}
        {user?.did && (
          <div className="mt-6 px-4">
            <h3 className="px-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Your DID
            </h3>
            <div className="mt-2 p-2 bg-neutral-100 dark:bg-neutral-700 rounded-lg">
              <p className="text-xs font-mono text-neutral-700 dark:text-neutral-300 truncate">
                {user.did}
              </p>
              <button 
                className="mt-1 text-xs text-hedera-600 dark:text-hedera-400 hover:text-hedera-800 dark:hover:text-hedera-300 flex items-center"
                onClick={() => {
                  navigator.clipboard.writeText(user.did || '');
                  // You could add a toast notification here
                }}
              >
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
                  <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z" />
                </svg>
                Copy
              </button>
            </div>
          </div>
        )}

        {/* Sidebar footer with logout */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-neutral-200 dark:border-neutral-700">
          <button
            className="w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            onClick={handleLogout}
          >
            <ArrowLeftOnRectangleIcon className="mr-3 h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="bg-white dark:bg-neutral-800 shadow-sm z-10">
          <div className="h-16 px-4 flex items-center justify-between">
            {/* Mobile menu button */}
            <button
              className="lg:hidden p-2 rounded-md text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-white"
              onClick={toggleSidebar}
            >
              <Bars3Icon className="h-6 w-6" />
            </button>

            {/* Page title - dynamically set based on current route */}
            <h1 className="text-lg font-semibold text-neutral-900 dark:text-white hidden sm:block">
              {location.pathname === '/wallet' && 'Dashboard'}
              {location.pathname === '/wallet/credentials' && 'Credentials'}
              {location.pathname.includes('/wallet/credentials/') && 'Credential Details'}
              {location.pathname === '/wallet/profile' && 'Profile'}
            </h1>

            {/* Right side actions */}
            <div className="flex items-center space-x-4">
              {/* Theme toggle */}
              <button
                className="p-2 rounded-full bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
                onClick={toggleTheme}
                aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? (
                  <MoonIcon className="h-5 w-5" />
                ) : (
                  <SunIcon className="h-5 w-5" />
                )}
              </button>

              {/* QR code button */}
              <button
                className="p-2 rounded-full bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
                aria-label="Show QR code"
                onClick={() => navigate('/wallet/profile')}
              >
                <QrCodeIcon className="h-5 w-5" />
              </button>

              {/* User profile */}
              <div className="flex items-center">
                <div 
                  className="h-9 w-9 rounded-full bg-hedera-600 text-white flex items-center justify-center text-sm font-medium cursor-pointer"
                  onClick={() => navigate('/wallet/profile')}
                >
                  {getUserInitials()}
                </div>
                <div className="ml-2 hidden md:block">
                  <div className="text-sm font-medium text-neutral-900 dark:text-white">
                    {getUserDisplayName()}
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    {user?.email || user?.phone || ''}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-neutral-50 dark:bg-neutral-900">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
