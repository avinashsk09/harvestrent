import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Tractor, Search, PlusCircle, PhoneCall, ShieldCheck, Clock, ArrowRight } from 'lucide-react';
import { FarmNewsCard } from '../components/FarmNewsCard';
import { Card, Button } from '../components/ui';

interface HomePageProps {
  onNavigate: (page: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const { user } = useAuth();

  return (
    <div className="space-y-6 pb-20 sm:pb-8">
      {/* Daily 6:00 AM IST Mandi & Farmer Intelligence Briefing */}
      <FarmNewsCard />

      {/* Hero Section: Deep Forest Green #0F3D26, Clean typography, No Neon */}
      <div className="rounded-xl bg-forest text-white p-6 sm:p-10 shadow-card">
        <div className="max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-md text-xs font-semibold uppercase tracking-wider text-cream-light border border-white/15">
            <span>🌾 {t.tagline}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
            {t.homeHeroTitle}
          </h1>

          <p className="text-base sm:text-lg text-cream-light/90 leading-relaxed font-normal">
            {t.homeHeroSubtitle}
          </p>

          {/* Two Big Action Buttons */}
          <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Big Button 1: Find Machine */}
            <button
              type="button"
              onClick={() => onNavigate('find')}
              className="group p-5 bg-agri hover:bg-agri-hover text-white rounded-lg font-bold text-left shadow-soft transition-subtle border border-agri-border/30 flex flex-col justify-between min-h-[130px]"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center">
                  <Search className="w-5 h-5 text-white" />
                </div>
                <ArrowRight className="w-5 h-5 text-white/80 group-hover:translate-x-1 transition-transform" />
              </div>
              <div>
                <span className="text-xl font-bold block text-white">
                  {t.btnFindMachine}
                </span>
                <span className="text-xs text-cream-light/85 block mt-0.5 font-normal">
                  {t.btnFindMachineDesc}
                </span>
              </div>
            </button>

            {/* Big Button 2: List My Machine */}
            <button
              type="button"
              onClick={() => onNavigate(user ? 'list' : 'login')}
              className="group p-5 bg-white text-forest hover:bg-cream-light rounded-lg font-bold text-left shadow-soft transition-subtle border border-cream-border flex flex-col justify-between min-h-[130px]"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-forest/10 flex items-center justify-center">
                  <PlusCircle className="w-5 h-5 text-forest" />
                </div>
                <ArrowRight className="w-5 h-5 text-forest/70 group-hover:translate-x-1 transition-transform" />
              </div>
              <div>
                <span className="text-xl font-bold block text-forest">
                  {t.btnListMachine}
                </span>
                <span className="text-xs text-neutralText-secondary block mt-0.5 font-normal">
                  {t.btnListMachineDesc}
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Trust & Direct Model Pillars */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card padding="md" className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-lg bg-agri-light text-forest flex items-center justify-center flex-shrink-0">
            <PhoneCall className="w-5 h-5 text-agri" />
          </div>
          <div>
            <h3 className="font-bold text-forest text-sm sm:text-base">{t.quickStats.stat1}</h3>
            <p className="text-xs text-neutralText-secondary mt-0.5">{t.quickStats.stat1Desc}</p>
          </div>
        </Card>

        <Card padding="md" className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-lg bg-cream-light border border-cream-border text-forest flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-forest" />
          </div>
          <div>
            <h3 className="font-bold text-forest text-sm sm:text-base">{t.quickStats.stat2}</h3>
            <p className="text-xs text-neutralText-secondary mt-0.5">{t.quickStats.stat2Desc}</p>
          </div>
        </Card>

        <Card padding="md" className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-lg bg-agri-light text-forest flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-agri" />
          </div>
          <div>
            <h3 className="font-bold text-forest text-sm sm:text-base">{t.quickStats.stat3}</h3>
            <p className="text-xs text-neutralText-secondary mt-0.5">{t.quickStats.stat3Desc}</p>
          </div>
        </Card>
      </div>

      {/* Direct Search Shortcut Banner */}
      <Card padding="lg" className="bg-cream-light/60 border-cream-border flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <h2 className="text-lg sm:text-xl font-bold text-forest">
            Ready to find or list a harvester?
          </h2>
          <p className="text-xs sm:text-sm text-neutralText-secondary">
            Filter by village, district, crop and date to see live availability.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => onNavigate('find')}
          icon={<ArrowRight className="w-4 h-4" />}
        >
          {t.btnSearch}
        </Button>
      </Card>
    </div>
  );
};
