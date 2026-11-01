import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';
import { Card, Button, Input, Toast, Modal } from '../components/ui';
import {
  Tractor,
  Wheat,
  Lock,
  Mail,
  User,
  Phone,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';

interface LoginPageProps {
  onNavigate: (page: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const { user, role, signUpWithEmail, signInWithEmail, requestPasswordReset, resetPasswordDirect, continueAsGuest } = useAuth();

  // Active Tab: 'signin' | 'signup'
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');

  // Role selection for Create Account
  const [selectedRole, setSelectedRole] = useState<'farmer' | 'owner'>(
    role === 'owner' ? 'owner' : 'farmer'
  );

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Forgot password sub-state
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  // Status & loading
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [showOwnerWelcomeModal, setShowOwnerWelcomeModal] = useState(false);

  // If already logged in, redirect to appropriate dashboard
  useEffect(() => {
    if (user && !showOwnerWelcomeModal) {
      if (user.role === 'admin') {
        onNavigate('activity');
      } else if (user.role === 'owner') {
        setShowOwnerWelcomeModal(true);
      } else {
        onNavigate('find');
      }
    }
  }, [user, showOwnerWelcomeModal, onNavigate]);

  const validateEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  // Handle Sign In submission
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);

    if (!validateEmail(email)) {
      setErrorMessage(t.invalidEmail);
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);
    const res = await signInWithEmail({ email: email.trim().toLowerCase(), password });
    setIsLoading(false);

    if (res.success) {
      const signedInRole = res.user?.role || role;
      if (signedInRole === 'owner') {
        setShowOwnerWelcomeModal(true);
      } else if (signedInRole === 'admin') {
        onNavigate('activity');
      } else {
        onNavigate('find');
      }
    } else {
      setErrorMessage(res.error || 'Failed to sign in.');
    }
  };

  // Handle Sign Up submission
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);

    if (!fullName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    if (!validateEmail(email)) {
      setErrorMessage(t.invalidEmail);
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).');
      return;
    }

    if (password.length < 8) {
      setErrorMessage(t.passwordTooShort);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(t.passwordsDoNotMatch);
      return;
    }

    setIsLoading(true);
    const res = await signUpWithEmail({
      email,
      password,
      fullName,
      phone: cleanPhone,
      role: selectedRole,
    });
    setIsLoading(false);

    if (res.success) {
      // 1. Keep email filled
      // 2. Clear passwords
      setPassword('');
      setConfirmPassword('');
      // 3. Switch to Sign In tab
      setActiveTab('signin');
      // 4. Show friendly instruction to sign in
      setSuccessNotice('Account created successfully! Please sign in with your email and password.');
    } else {
      setErrorMessage(res.error || 'Failed to create account.');
    }
  };

  // Handle Forgot Password submission
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validateEmail(forgotEmail)) {
      setErrorMessage(t.invalidEmail);
      return;
    }

    setIsLoading(true);

    // If new password is provided, reset directly via secure RPC
    if (forgotNewPassword.trim()) {
      if (forgotNewPassword.length < 8) {
        setIsLoading(false);
        setErrorMessage('Password must be at least 8 characters long.');
        return;
      }
      const res = await resetPasswordDirect(forgotEmail, forgotNewPassword);
      setIsLoading(false);

      if (res.success) {
        setEmail(forgotEmail.trim().toLowerCase());
        setPassword('');
        setIsForgotPassword(false);
        setSuccessNotice('Password updated successfully! Please sign in with your new password.');
        return;
      } else {
        setErrorMessage(res.error || 'Failed to update password.');
        return;
      }
    }

    // Otherwise send reset link via Supabase auth
    const res = await requestPasswordReset(forgotEmail);
    setIsLoading(false);

    if (res.success) {
      setForgotSubmitted(true);
    } else {
      setErrorMessage(res.error || 'Failed to send reset link.');
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 sm:py-12 px-4 space-y-6 pb-20">
      {/* Page Heading */}
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-xl bg-forest text-cream-light flex items-center justify-center mx-auto shadow-soft">
          <Tractor className="w-6 h-6" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-forest tracking-tight">
          {t.authTitle}
        </h1>
        <p className="text-sm text-neutralText-secondary max-w-xs mx-auto">
          {t.authSubtitle}
        </p>
      </div>

      <Card padding="lg">
        {/* Forgot Password View */}
        {isForgotPassword ? (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold text-forest">{t.forgotPasswordTitle}</h2>
              <p className="text-xs text-neutralText-secondary">
                {t.forgotPasswordSubtitle}
              </p>
            </div>

            {forgotSubmitted ? (
              <div className="text-center space-y-3 py-3">
                <CheckCircle2 className="w-10 h-10 text-agri mx-auto" />
                <p className="text-sm font-semibold text-forest">{t.resetLinkSent}</p>
                <Button
                  variant="outline"
                  size="md"
                  fullWidth
                  onClick={() => {
                    setIsForgotPassword(false);
                    setForgotSubmitted(false);
                  }}
                >
                  {t.backToLogin}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                {errorMessage && <Toast type="error" message={errorMessage} onClose={() => setErrorMessage(null)} />}

                <Input
                  label={t.emailLabel}
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  leftIcon={<Mail className="w-4 h-4 text-agri" />}
                />

                <div>
                  <label className="block text-sm font-semibold text-forest mb-1.5">
                    New Password (Optional direct reset)
                  </label>
                  <div className="relative">
                    <Input
                      type={showForgotNewPassword ? 'text' : 'password'}
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      placeholder="Enter at least 8 characters to reset instantly"
                      leftIcon={<Lock className="w-4 h-4 text-agri" />}
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                      className="absolute right-3.5 top-3.5 text-neutralText-muted hover:text-forest transition-subtle"
                      aria-label="Toggle password visibility"
                    >
                      {showForgotNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-neutralText-muted mt-1">
                    Tip: Enter a new password to reset and sign in immediately without waiting for an email.
                  </p>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  isLoading={isLoading}
                >
                  {forgotNewPassword.trim() ? 'Reset Password & Switch to Sign In' : t.sendResetLinkBtn}
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setErrorMessage(null);
                  }}
                  className="w-full text-center text-xs font-semibold text-forest hover:underline pt-1 block"
                >
                  {t.backToLogin}
                </button>
              </form>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {/* Tabs: Sign In / Create Account */}
            <div className="flex border-b border-cream-border">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('signin');
                  setErrorMessage(null);
                  setSuccessNotice(null);
                }}
                className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-subtle ${
                  activeTab === 'signin'
                    ? 'border-forest text-forest bg-cream-light/30'
                    : 'border-transparent text-neutralText-secondary hover:text-forest'
                }`}
              >
                {t.signInTab}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('signup');
                  setErrorMessage(null);
                  setSuccessNotice(null);
                }}
                className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-subtle ${
                  activeTab === 'signup'
                    ? 'border-forest text-forest bg-cream-light/30'
                    : 'border-transparent text-neutralText-secondary hover:text-forest'
                }`}
              >
                {t.signUpTab}
              </button>
            </div>

            {errorMessage && (
              <div className="space-y-2">
                <Toast type="error" message={errorMessage} onClose={() => setErrorMessage(null)} />
                {errorMessage.includes('Incorrect email address or password') && (
                  <div className="p-3 bg-cream-light/80 border border-cream-border rounded-lg text-xs space-y-2">
                    <p className="text-forest font-semibold">
                      Don't have an account with <strong>{email || 'this email'}</strong> yet?
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('signup');
                        setErrorMessage(null);
                      }}
                      className="text-xs font-bold text-agri hover:text-forest underline inline-flex items-center gap-1"
                    >
                      Click here to create a new account with this email →
                    </button>
                  </div>
                )}
              </div>
            )}
            {successNotice && <Toast type="success" message={successNotice} onClose={() => setSuccessNotice(null)} />}

            {/* TAB 1: SIGN IN */}
            {activeTab === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <Input
                  label={t.emailLabel}
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  leftIcon={<Mail className="w-4 h-4 text-agri" />}
                />

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-semibold text-forest">
                      {t.passwordLabel}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(true);
                        setForgotEmail(email);
                        setErrorMessage(null);
                      }}
                      className="text-xs font-semibold text-agri hover:text-forest hover:underline"
                    >
                      {t.forgotPassword}
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t.passwordPlaceholder}
                      leftIcon={<Lock className="w-4 h-4 text-agri" />}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3.5 text-neutralText-muted hover:text-forest transition-subtle"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  isLoading={isLoading}
                  icon={<ArrowRight className="w-4 h-4" />}
                >
                  {t.signInBtn}
                </Button>
              </form>
            )}

            {/* TAB 2: CREATE ACCOUNT */}
            {activeTab === 'signup' && (
              <form onSubmit={handleSignUp} className="space-y-4">
                {/* Role Choice Cards */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-forest">
                    {t.roleSelection}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedRole('farmer')}
                      className={`p-3 rounded-lg text-left transition-subtle border flex flex-col justify-between ${
                        selectedRole === 'farmer'
                          ? 'border-forest bg-agri-light/20 shadow-soft'
                          : 'border-cream-border bg-white hover:bg-cream-light/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Wheat className="w-5 h-5 text-forest" />
                        <span
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                            selectedRole === 'farmer'
                              ? 'border-forest bg-forest'
                              : 'border-cream-border'
                          }`}
                        >
                          {selectedRole === 'farmer' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-forest block">
                        {t.roleFarmer}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedRole('owner')}
                      className={`p-3 rounded-lg text-left transition-subtle border flex flex-col justify-between ${
                        selectedRole === 'owner'
                          ? 'border-forest bg-agri-light/20 shadow-soft'
                          : 'border-cream-border bg-white hover:bg-cream-light/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Tractor className="w-5 h-5 text-forest" />
                        <span
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                            selectedRole === 'owner'
                              ? 'border-forest bg-forest'
                              : 'border-cream-border'
                          }`}
                        >
                          {selectedRole === 'owner' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-forest block">
                        {t.roleOwner}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Full Name */}
                <Input
                  label={t.fullNameLabel}
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t.fullNamePlaceholder}
                  leftIcon={<User className="w-4 h-4 text-agri" />}
                />

                {/* Email */}
                <Input
                  label={t.emailLabel}
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  leftIcon={<Mail className="w-4 h-4 text-agri" />}
                />

                {/* Mobile Number (+91, 10 digits) */}
                <div>
                  <label className="block text-sm font-semibold text-forest mb-1.5">
                    {t.phoneLabel}
                  </label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 text-sm font-bold text-forest bg-cream-light border border-r-0 border-cream-border rounded-l-lg select-none">
                      {t.countryCode}
                    </span>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder={t.phonePlaceholder}
                      className="flex-1 px-3.5 py-2.5 text-base rounded-r-lg border border-cream-border bg-white text-neutralText-primary focus:ring-2 focus:ring-agri focus:border-agri min-h-[44px]"
                    />
                  </div>
                  <p className="text-xs text-neutralText-muted mt-1">
                    {t.phoneNotVerifiedNotice}
                  </p>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-semibold text-forest mb-1.5">
                    {t.passwordLabel}
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t.passwordPlaceholder}
                      leftIcon={<Lock className="w-4 h-4 text-agri" />}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3.5 text-neutralText-muted hover:text-forest transition-subtle"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-semibold text-forest mb-1.5">
                    {t.confirmPasswordLabel}
                  </label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={t.confirmPasswordPlaceholder}
                      leftIcon={<Lock className="w-4 h-4 text-agri" />}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-3.5 text-neutralText-muted hover:text-forest transition-subtle"
                      aria-label="Toggle confirm password visibility"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  isLoading={isLoading}
                  icon={<ArrowRight className="w-4 h-4" />}
                >
                  {t.createAccountBtn}
                </Button>
              </form>
            )}

            {/* Guest Browsing Option */}
            <div className="pt-4 border-t border-cream-border">
              <Button
                variant="outline"
                size="md"
                fullWidth
                onClick={() => {
                  continueAsGuest();
                  onNavigate('find');
                }}
              >
                {t.guestBrowse} →
              </Button>
              <p className="text-[11px] text-neutralText-muted text-center mt-2 leading-relaxed">
                {t.guestNotice}
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Namaste Sir Owner Welcome Modal */}
      <Modal
        isOpen={showOwnerWelcomeModal}
        onClose={() => {
          setShowOwnerWelcomeModal(false);
          onNavigate('manage');
        }}
        title="Namaste Sir! 🙏"
        maxWidth="md"
      >
        <div className="text-center space-y-4 py-2">
          <div className="w-16 h-16 rounded-2xl bg-agri/10 border border-agri-border text-agri flex items-center justify-center mx-auto shadow-soft">
            <Tractor className="w-9 h-9 text-forest" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold text-forest leading-snug">
              Namaste Sir! Are you looking to register your vehicle?
            </h2>
            <p className="text-xs text-neutralText-secondary italic">
              ನಮಸ್ತೆ ಸರ್! ನಿಮ್ಮ ವಾಹನ/ಯಂತ್ರವನ್ನು ನೋಂದಾಯಿಸಲು ಬಯಸುವಿರಾ? &bull; नमस्ते सर! क्या आप अपने वाहन को पंजीकृत करना चाहते हैं?
            </p>
            <p className="text-sm text-neutralText-secondary max-w-sm mx-auto leading-relaxed pt-1">
              Welcome to Harvest Rentals. You can register your harvester or tractor right now so farmers in your district can find and book your machine.
            </p>
          </div>

          <div className="space-y-2.5 pt-3">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => {
                setShowOwnerWelcomeModal(false);
                onNavigate('list');
              }}
              icon={<Tractor className="w-4 h-4" />}
            >
              Yes, Register Vehicle Now
            </Button>

            <Button
              variant="outline"
              size="md"
              fullWidth
              onClick={() => {
                setShowOwnerWelcomeModal(false);
                onNavigate('manage');
              }}
            >
              Go to Owner Dashboard
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
