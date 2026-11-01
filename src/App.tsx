import React, { useState } from 'react';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Navbar } from './components/Navbar';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { FindMachinePage } from './pages/FindMachinePage';
import { ListMachinePage } from './pages/ListMachinePage';
import { PaymentPage } from './pages/PaymentPage';
import { MyBookingsPage } from './pages/MyBookingsPage';
import { ManageListingsPage } from './pages/ManageListingsPage';
import { AboutPage } from './pages/AboutPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { ActivityPage } from './pages/ActivityPage';
import { SettingsPage } from './pages/SettingsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { MachineDetailsPage } from './pages/MachineDetailsPage';
import { WantedRequestsPage } from './pages/WantedRequestsPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { isSupabaseConfigured } from './lib/supabase';
import { AlertCircle } from 'lucide-react';
import { Machine } from './types';

const getPageFromPath = (path: string): string => {
  const clean = path.replace(/^\/+|\/+$/g, '').toLowerCase();
  if (!clean || clean === 'home') return 'home';
  if (clean === 'login' || clean === 'signin' || clean === 'signup') return 'login';
  if (
    clean.startsWith('reset-password') ||
    window.location.hash.includes('type=recovery') ||
    window.location.search.includes('type=recovery')
  ) {
    return 'reset-password';
  }
  if (clean === 'find' || clean === 'search') return 'find';
  if (clean === 'list' || clean === 'list-machine') return 'list';
  if (clean === 'payment' || clean === 'pay') return 'payment';
  if (clean === 'bookings' || clean === 'my-bookings') return 'bookings';
  if (clean === 'manage' || clean === 'my-machines') return 'manage';
  if (clean === 'wanted' || clean === 'wanted-requests') return 'wanted';
  if (clean.startsWith('machine/')) return clean;
  if (clean === 'activity' || clean === 'audit') return 'activity';
  if (clean === 'settings') return 'settings';
  if (clean === 'about' || clean === 'terms') return 'about';
  return clean;
};

const MainApp: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState<string>(() => {
    return getPageFromPath(window.location.pathname);
  });

  React.useEffect(() => {
    const handlePopState = () => {
      setCurrentPage(getPageFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Payment navigation state
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [selectedAcres, setSelectedAcres] = useState<number>(3);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedCrop, setSelectedCrop] = useState<string>('Paddy (Rice)');

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
    const targetPath = page === 'home' ? '/' : `/${page}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectMachineForPayment = (
    machine: Machine,
    acres: number,
    date: string,
    crop: string
  ) => {
    setSelectedMachine(machine);
    setSelectedAcres(acres);
    setSelectedDate(date);
    setSelectedCrop(crop);
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col font-sans text-neutralText-primary selection:bg-agri-light selection:text-forest">
      {/* Navigation Header */}
      <Navbar currentPage={currentPage} onNavigate={handleNavigate} />

      {/* Friendly Supabase Configuration Alert */}
      {!isSupabaseConfigured && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs sm:text-sm text-center flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0" />
          <span>
            <strong>Supabase Setup Notice:</strong> Please configure <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">VITE_SUPABASE_URL</code> and <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">VITE_SUPABASE_ANON_KEY</code> in your <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">.env</code> file.
          </span>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-5">
        {currentPage === 'home' && <HomePage onNavigate={handleNavigate} />}
        {currentPage === 'login' && <LoginPage onNavigate={handleNavigate} />}
        {currentPage === 'reset-password' && <ResetPasswordPage onNavigate={handleNavigate} />}
        {currentPage === 'activity' && <ActivityPage onNavigate={handleNavigate} />}
        {currentPage === 'settings' && <SettingsPage onNavigate={handleNavigate} />}
        {currentPage === 'find' && (
          <FindMachinePage
            onNavigate={handleNavigate}
            onSelectMachineForPayment={handleSelectMachineForPayment}
          />
        )}
        {currentPage === 'list' && <ListMachinePage onNavigate={handleNavigate} />}
        {currentPage === 'payment' && (
          <PaymentPage
            machine={selectedMachine}
            acres={selectedAcres}
            date={selectedDate}
            crop={selectedCrop}
            onNavigate={handleNavigate}
          />
        )}
        {currentPage === 'bookings' && <MyBookingsPage onNavigate={handleNavigate} />}
        {currentPage === 'manage' && <ManageListingsPage onNavigate={handleNavigate} />}
        {currentPage === 'wanted' && <WantedRequestsPage onNavigate={handleNavigate} />}
        {currentPage.startsWith('machine/') && (
          <MachineDetailsPage
            machineId={currentPage.replace('machine/', '')}
            onNavigate={handleNavigate}
            onSelectMachineForPayment={handleSelectMachineForPayment}
          />
        )}
        {currentPage === 'about' && <AboutPage onNavigate={handleNavigate} />}

        {/* 404 Fallback */}
        {![
          'home',
          'login',
          'reset-password',
          'activity',
          'settings',
          'find',
          'list',
          'payment',
          'bookings',
          'manage',
          'wanted',
          'about',
        ].includes(currentPage) && !currentPage.startsWith('machine/') && (
          <NotFoundPage onNavigate={handleNavigate} />
        )}
      </main>

      {/* Footer: Deep Forest Green #0F3D26 */}
      <footer className="bg-forest-dark text-cream-light/80 py-8 px-4 border-t border-forest text-xs mt-12 hidden md:block">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <span className="font-bold text-white text-sm block">Harvest Rentals</span>
            <p className="text-cream-light/70 text-xs">
              Direct combine harvester machine matching for farmers. No middlemen commissions.
            </p>
          </div>
          <div className="flex items-center gap-5 text-xs font-medium">
            <button
              onClick={() => handleNavigate('home')}
              className="text-cream-light hover:text-white transition-subtle"
            >
              {t.home}
            </button>
            <button
              onClick={() => handleNavigate('find')}
              className="text-cream-light hover:text-white transition-subtle"
            >
              {t.findMachine}
            </button>
            <button
              onClick={() => handleNavigate('list')}
              className="text-cream-light hover:text-white transition-subtle"
            >
              {t.listMachine}
            </button>
            {user?.role === 'admin' && (
              <button
                onClick={() => handleNavigate('activity')}
                className="text-cream-light hover:text-white transition-subtle"
              >
                {t.activity}
              </button>
            )}
            <button
              onClick={() => handleNavigate('about')}
              className="text-cream-light hover:text-white transition-subtle"
            >
              {t.about}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <MainApp />
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
};

export default App;
