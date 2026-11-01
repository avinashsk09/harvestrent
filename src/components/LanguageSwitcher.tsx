import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { LanguageCode } from '../types';
import { Globe } from 'lucide-react';

export const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  const languages: { code: LanguageCode; label: string; short: string }[] = [
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'kn', label: 'ಕನ್ನಡ', short: 'ಕನ್ನ' },
    { code: 'hi', label: 'हिन्दी', short: 'हिं' },
  ];

  return (
    <div className="flex items-center gap-1 bg-white/10 p-1 rounded-lg border border-white/20">
      <Globe className="w-3.5 h-3.5 text-cream-light ml-1 hidden sm:inline" />
      {languages.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLanguage(l.code)}
          className={`px-2 py-0.5 text-xs font-semibold rounded transition-subtle ${
            language === l.code
              ? 'bg-white text-forest shadow-soft'
              : 'text-cream-light hover:bg-white/15'
          }`}
          title={l.label}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
};
