import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Card, Button, Input, Toast } from '../components/ui';
import { Lock, Eye, EyeOff, CheckCircle2, ArrowLeft } from 'lucide-react';

interface ResetPasswordPageProps {
  onNavigate: (page: string) => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const { updatePassword } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < 8) {
      setErrorMessage(t.passwordTooShort || 'Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(t.passwordsDoNotMatch || 'Passwords do not match. Please re-enter.');
      return;
    }

    setIsLoading(true);
    const res = await updatePassword(password);
    setIsLoading(false);

    if (res.success) {
      setSuccess(true);
    } else {
      setErrorMessage(res.error || 'Failed to update password.');
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 sm:py-12 px-4 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-forest tracking-tight">
          {t.resetPasswordTitle || 'Set New Password'}
        </h1>
        <p className="text-sm text-neutralText-secondary">
          {t.resetPasswordSubtitle || 'Enter a strong new password for your Harvest Rentals account.'}
        </p>
      </div>

      <Card padding="lg">
        {success ? (
          <div className="text-center space-y-4 py-4">
            <div className="w-12 h-12 bg-agri-light text-forest rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6 text-agri" />
            </div>
            <h2 className="text-lg font-bold text-forest">
              {t.passwordResetSuccess || 'Password Updated Successfully'}
            </h2>
            <p className="text-sm text-neutralText-secondary">
              {t.passwordResetSuccessDesc || 'Your password has been changed. You can now sign in with your new credentials.'}
            </p>
            <Button
              variant="primary"
              fullWidth
              size="lg"
              onClick={() => onNavigate('login')}
            >
              {t.signInBtn || 'Sign In'} →
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && <Toast type="error" message={errorMessage} onClose={() => setErrorMessage(null)} />}

            {/* New Password */}
            <div>
              <label className="block text-sm font-semibold text-forest mb-1.5">
                {t.newPassword || 'New Password'}
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
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
                {t.confirmPassword || 'Confirm New Password'}
              </label>
              <Input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                leftIcon={<Lock className="w-4 h-4 text-agri" />}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isLoading}
            >
              {t.updatePasswordBtn || 'Save New Password'}
            </Button>

            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="w-full text-center text-xs font-semibold text-forest hover:underline flex items-center justify-center gap-1.5 pt-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t.backToLogin || 'Back to sign in'}</span>
            </button>
          </form>
        )}
      </Card>
    </div>
  );
};
