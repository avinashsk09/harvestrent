import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Card, Button } from '../components/ui';
import { Compass, ArrowLeft } from 'lucide-react';

interface NotFoundPageProps {
  onNavigate: (page: string) => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onNavigate }) => {
  const { t } = useLanguage();

  return (
    <div className="max-w-md mx-auto py-16 px-4 text-center space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-cream-light text-forest flex items-center justify-center mx-auto border border-cream-border">
        <Compass className="w-8 h-8 text-agri" />
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-forest">
          Page Not Found (404)
        </h1>
        <p className="text-xs text-neutralText-muted">
          ಪುಟ ಕಂಡುಬಂದಿಲ್ಲ &bull; पृष्ठ नहीं मिला
        </p>
        <p className="text-sm text-neutralText-secondary pt-1">
          The page you requested could not be located.
        </p>
      </div>

      <div className="pt-2">
        <Button
          variant="primary"
          size="lg"
          onClick={() => onNavigate('home')}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          {t.backToHome}
        </Button>
      </div>
    </div>
  );
};
