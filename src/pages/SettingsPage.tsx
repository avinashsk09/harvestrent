import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Card, Button, Input, Toast } from '../components/ui';
import { Settings, Mail, Bell, ArrowLeft, CheckCircle2, User, Phone } from 'lucide-react';

interface SettingsPageProps {
  onNavigate: (page: string) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const { user, updateProfile } = useAuth();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone ? user.phone.replace('+91', '') : '');
  const [emailNews, setEmailNews] = useState(user?.email_news_subscribed ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccess(false);

    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone ? `+91${cleanPhone}` : user?.phone;

    await updateProfile({
      full_name: fullName.trim() || user?.full_name,
      phone: formattedPhone,
      email_news_subscribed: emailNews,
    });

    setIsSaving(false);
    setSuccess(true);
  };

  return (
    <div className="max-w-xl mx-auto py-6 sm:py-8 px-4 space-y-6 pb-24">
      {/* Back button */}
      <button
        type="button"
        onClick={() => onNavigate('home')}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-forest hover:underline"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Home</span>
      </button>

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-forest tracking-tight">
          {t.settingsTitle || 'Account Settings'}
        </h1>
        <p className="text-sm text-neutralText-secondary mt-1">
          Manage your notifications, daily 6 AM farm news, and contact details
        </p>
      </div>

      <Card padding="lg">
        <form onSubmit={handleSubmit} className="space-y-5">
          {success && (
            <Toast
              type="success"
              message={t.settingsSaved || 'Settings saved successfully!'}
              onClose={() => setSuccess(false)}
            />
          )}

          {/* User Details */}
          <Input
            label={t.fullNameLabel}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your Name"
            leftIcon={<User className="w-4 h-4 text-agri" />}
          />

          <div>
            <label className="block text-sm font-semibold text-forest mb-1.5">
              {t.phoneLabel}
            </label>
            <div className="flex">
              <span className="inline-flex items-center px-3 text-sm font-bold text-forest bg-cream-light border border-r-0 border-cream-border rounded-l-lg select-none">
                +91
              </span>
              <input
                type="tel"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="flex-1 px-3.5 py-2.5 text-base rounded-r-lg border border-cream-border bg-white text-neutralText-primary focus:ring-2 focus:ring-agri focus:border-agri min-h-[44px]"
              />
            </div>
          </div>

          {/* Email News Subscription Toggle */}
          <div className="pt-4 border-t border-cream-border space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <label htmlFor="emailNewsToggle" className="text-sm font-bold text-forest block cursor-pointer">
                  {t.emailNewsSubscription || 'Daily 6 AM Farm News Email'}
                </label>
                <p className="text-xs text-neutralText-secondary leading-relaxed">
                  {t.emailNewsSubscribedDesc || 'Receive top 5 farming headlines, weather and mandi rates every morning.'}
                </p>
              </div>

              <input
                id="emailNewsToggle"
                type="checkbox"
                checked={emailNews}
                onChange={(e) => setEmailNews(e.target.checked)}
                className="w-5 h-5 text-agri rounded border-cream-border focus:ring-agri mt-1 cursor-pointer"
              />
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isSaving}
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              {t.saveSettingsBtn || 'Save Preferences'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

