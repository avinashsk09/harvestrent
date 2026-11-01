import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import {
  Tractor,
  Search,
  PlusCircle,
  CalendarCheck,
  Wrench,
  Info,
  LogIn,
  LogOut,
  User,
  Menu,
  X,
  Shield,
  Settings,
  Wheat,
} from 'lucide-react';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPage, onNavigate }) => {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isOwner = user?.role === 'owner';
  const isAdmin = user?.role === 'admin';

  const handleNav = (page: string) => {
    onNavigate(page);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Header: Deep Forest Green #0F3D26 */}
      <header className="sticky top-0 z-40 bg-forest text-white shadow-soft">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Logo & Name */}
          <button
            type="button"
            onClick={() => handleNav('home')}
            className="flex items-center gap-2.5 text-left group"
          >
            <div className="w-9 h-9 rounded-lg bg-white/10 text-white flex items-center justify-center border border-white/20 group-hover:bg-white/20 transition-subtle">
              <Tractor className="w-5 h-5 text-cream-light" />
            </div>
            <div>
              <span className="text-base sm:text-lg font-bold text-white tracking-tight leading-none block">
                Harvest Rentals
              </span>
              <span className="text-[11px] font-medium text-cream-light/80 block mt-0.5">
                ಕಟಾವು ಬಾಡಿಗೆ • फसल कटाई
              </span>
            </div>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-white/90">
            <button
              onClick={() => handleNav('find')}
              className={`px-3 py-1.5 rounded-md transition-subtle ${
                currentPage === 'find' ? 'bg-white/15 text-white font-bold' : 'hover:bg-white/10'
              }`}
            >
              {t.findMachine}
            </button>
            <button
              onClick={() => handleNav('list')}
              className={`px-3 py-1.5 rounded-md transition-subtle ${
                currentPage === 'list' ? 'bg-white/15 text-white font-bold' : 'hover:bg-white/10'
              }`}
            >
              {t.listMachine}
            </button>
            <button
              onClick={() => handleNav('bookings')}
              className={`px-3 py-1.5 rounded-md transition-subtle ${
                currentPage === 'bookings' ? 'bg-white/15 text-white font-bold' : 'hover:bg-white/10'
              }`}
            >
              {isOwner ? t.bookingRequests : t.myBookings}
            </button>
            {isOwner && (
              <button
                onClick={() => handleNav('manage')}
                className={`px-3 py-1.5 rounded-md transition-subtle ${
                  currentPage === 'manage' ? 'bg-white/15 text-white font-bold' : 'hover:bg-white/10'
                }`}
              >
                {t.manageListings}
              </button>
            )}
            <button
              onClick={() => handleNav('wanted')}
              className={`px-3 py-1.5 rounded-md transition-subtle ${
                currentPage === 'wanted' ? 'bg-white/15 text-white font-bold' : 'hover:bg-white/10'
              }`}
            >
              {t.wantedRequestsNav || 'Wanted Requests'}
            </button>
            {isAdmin && (
              <button
                onClick={() => handleNav('activity')}
                className={`px-3 py-1.5 rounded-md transition-subtle flex items-center gap-1.5 ${
                  currentPage === 'activity' ? 'bg-white/15 text-white font-bold' : 'hover:bg-white/10'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                {t.activity}
              </button>
            )}
            <button
              onClick={() => handleNav('about')}
              className={`px-3 py-1.5 rounded-md transition-subtle ${
                currentPage === 'about' ? 'bg-white/15 text-white font-bold' : 'hover:bg-white/10'
              }`}
            >
              {t.about}
            </button>
          </nav>

          {/* Right Header Area: Language Switcher + User Status / Avatar / Login */}
          <div className="flex items-center gap-2">
            <LanguageSwitcher />

            {user ? (
              <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-white/20">
                {/* User Google Avatar / Initial */}
                <div className="flex items-center gap-2">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.full_name}
                      className="w-8 h-8 rounded-full object-cover border border-white/40"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs text-white">
                      {user.full_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="text-right leading-tight">
                    <span className="text-xs font-bold text-white block truncate max-w-[120px]">
                      {user.full_name}
                    </span>
                    <span className="text-[10px] font-bold uppercase text-cream-light/80 block">
                      {user.role}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleNav('settings')}
                  className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-subtle ml-1"
                  title="Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>

                <button
                  onClick={logout}
                  className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-subtle"
                  title={t.logout}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleNav('login')}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold bg-white text-forest hover:bg-cream-light px-3.5 py-1.5 rounded-md transition-subtle"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{t.login}</span>
              </button>
            )}

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-white/90 hover:bg-white/10 rounded-md"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-forest-dark border-t border-white/10 px-4 py-3 space-y-1 shadow-card">
            {user && (
              <div className="p-2.5 bg-white/10 rounded-lg flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.full_name}
                      className="w-9 h-9 rounded-full object-cover border border-white/40"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs text-white">
                      {user.full_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <span className="text-sm font-bold text-white block leading-tight">{user.full_name}</span>
                    <span className="text-xs text-cream-light/80">{user.phone || user.email}</span>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="text-xs font-semibold text-white bg-brickRed hover:opacity-90 px-2.5 py-1 rounded flex items-center gap-1"
                >
                  <LogOut className="w-3 h-3" />
                  {t.logout}
                </button>
              </div>
            )}

            <button
              onClick={() => handleNav('find')}
              className={`w-full text-left px-3 py-2 rounded-md font-semibold flex items-center gap-2.5 text-sm ${
                currentPage === 'find' ? 'bg-white/20 text-white' : 'text-cream-light hover:bg-white/10'
              }`}
            >
              <Search className="w-4 h-4 text-cream-light" />
              {t.findMachine}
            </button>

            <button
              onClick={() => handleNav('list')}
              className={`w-full text-left px-3 py-2 rounded-md font-semibold flex items-center gap-2.5 text-sm ${
                currentPage === 'list' ? 'bg-white/20 text-white' : 'text-cream-light hover:bg-white/10'
              }`}
            >
              <PlusCircle className="w-4 h-4 text-cream-light" />
              {t.listMachine}
            </button>

            <button
              onClick={() => handleNav('bookings')}
              className={`w-full text-left px-3 py-2 rounded-md font-semibold flex items-center gap-2.5 text-sm ${
                currentPage === 'bookings' ? 'bg-white/20 text-white' : 'text-cream-light hover:bg-white/10'
              }`}
            >
              <CalendarCheck className="w-4 h-4 text-cream-light" />
              {isOwner ? t.bookingRequests : t.myBookings}
            </button>

            {isOwner && (
              <button
                onClick={() => handleNav('manage')}
                className={`w-full text-left px-3 py-2 rounded-md font-semibold flex items-center gap-2.5 text-sm ${
                  currentPage === 'manage' ? 'bg-white/20 text-white' : 'text-cream-light hover:bg-white/10'
                }`}
              >
                <Wrench className="w-4 h-4 text-cream-light" />
                {t.manageListings}
              </button>
            )}

            <button
              onClick={() => handleNav('wanted')}
              className={`w-full text-left px-3 py-2 rounded-md font-semibold flex items-center gap-2.5 text-sm ${
                currentPage === 'wanted' ? 'bg-white/20 text-white' : 'text-cream-light hover:bg-white/10'
              }`}
            >
              <Wheat className="w-4 h-4 text-cream-light" />
              {t.wantedRequestsNav || 'Wanted Requests'}
            </button>

            {isAdmin && (
              <button
                onClick={() => handleNav('activity')}
                className={`w-full text-left px-3 py-2 rounded-md font-semibold flex items-center gap-2.5 text-sm ${
                  currentPage === 'activity' ? 'bg-white/20 text-white' : 'text-cream-light hover:bg-white/10'
                }`}
              >
                <Shield className="w-4 h-4 text-cream-light" />
                {t.activity}
              </button>
            )}

            <button
              onClick={() => handleNav('about')}
              className={`w-full text-left px-3 py-2 rounded-md font-semibold flex items-center gap-2.5 text-sm ${
                currentPage === 'about' ? 'bg-white/20 text-white' : 'text-cream-light hover:bg-white/10'
              }`}
            >
              <Info className="w-4 h-4 text-cream-light" />
              {t.about}
            </button>

            {user && (
              <button
                onClick={() => handleNav('settings')}
                className={`w-full text-left px-3 py-2 rounded-md font-semibold flex items-center gap-2.5 text-sm ${
                  currentPage === 'settings' ? 'bg-white/20 text-white' : 'text-cream-light hover:bg-white/10'
                }`}
              >
                <Settings className="w-4 h-4 text-cream-light" />
                Settings
              </button>
            )}

            {!user && (
              <button
                onClick={() => handleNav('login')}
                className="w-full mt-2 py-2.5 bg-agri text-white font-bold rounded-lg flex items-center justify-center gap-2 text-sm shadow-soft"
              >
                <LogIn className="w-4 h-4" />
                {t.login}
              </button>
            )}
          </div>
        )}
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-cream-border px-3 py-2 flex items-center justify-around shadow-card">
        <button
          onClick={() => handleNav('find')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg transition-subtle ${
            currentPage === 'find' ? 'text-forest font-bold' : 'text-neutralText-muted'
          }`}
        >
          <Search className="w-5 h-5" />
          <span className="text-[11px] font-medium mt-0.5">{t.findMachine}</span>
        </button>

        <button
          onClick={() => handleNav('list')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg transition-subtle ${
            currentPage === 'list' ? 'text-forest font-bold' : 'text-neutralText-muted'
          }`}
        >
          <PlusCircle className="w-5 h-5" />
          <span className="text-[11px] font-medium mt-0.5">{t.listMachine}</span>
        </button>

        <button
          onClick={() => handleNav('bookings')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg transition-subtle ${
            currentPage === 'bookings' ? 'text-forest font-bold' : 'text-neutralText-muted'
          }`}
        >
          <CalendarCheck className="w-5 h-5" />
          <span className="text-[11px] font-medium mt-0.5">
            {isOwner ? 'Requests' : 'Bookings'}
          </span>
        </button>

        <button
          onClick={() => handleNav(user ? (isOwner ? 'manage' : 'about') : 'login')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg transition-subtle ${
            currentPage === 'login' || currentPage === 'manage' ? 'text-forest font-bold' : 'text-neutralText-muted'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[11px] font-medium mt-0.5">
            {user ? (isOwner ? 'Machines' : 'Account') : t.login}
          </span>
        </button>
      </nav>
    </>
  );
};
