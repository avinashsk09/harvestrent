import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Card, Button } from '../components/ui';
import {
  ShieldCheck,
  Phone,
  Search,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Fuel,
  GitBranch,
  Layers,
  Truck,
  ChevronDown,
  Share2,
  MessageCircle,
  HelpCircle,
  Tractor,
} from 'lucide-react';

interface AboutPageProps {
  onNavigate?: (page: string) => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const { user } = useAuth();

  // How it works active tab: 'farmer' | 'owner'
  const [activeTab, setActiveTab] = useState<'farmer' | 'owner'>('farmer');

  // FAQ Accordion: only one open at a time (1..6 or null)
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq((prev) => (prev === index ? null : index));
  };

  // WhatsApp share link
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://harvestrentals.in';
  const shareText = encodeURIComponent(`${t.shareWhatsAppMessage}${currentOrigin}`);
  const whatsappShareUrl = `https://wa.me/?text=${shareText}`;

  // Optional support WhatsApp number from .env
  const supportWhatsappNumber = import.meta.env.VITE_SUPPORT_WHATSAPP
    ? String(import.meta.env.VITE_SUPPORT_WHATSAPP).replace(/\D/g, '')
    : '';
  const supportWhatsappUrl = supportWhatsappNumber ? `https://wa.me/${supportWhatsappNumber}` : null;

  // CTA navigation handler for "List Your Machine"
  const handleListMachineClick = () => {
    if (!user) {
      onNavigate?.('login');
    } else {
      onNavigate?.('list');
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-8 px-4 space-y-8 pb-24 text-forest">
      {/* 1. Header */}
      <div className="space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-forest tracking-tight">
          {t.aboutTitle}
        </h1>
        <p className="text-base text-neutralText-secondary">
          {t.aboutSubtitle}
        </p>
      </div>

      {/* 3. Mission Card */}
      <Card padding="lg" className="space-y-3 bg-white border border-cream-border shadow-soft">
        <div className="flex items-center gap-2.5 text-forest">
          <div className="w-9 h-9 rounded-lg bg-agri-light text-forest flex items-center justify-center font-bold text-lg">
            🌾
          </div>
          <h2 className="text-xl font-bold">{t.aboutSection1Title}</h2>
        </div>
        <p className="text-base text-neutralText-secondary leading-relaxed">
          {t.aboutSection1Text}
        </p>
      </Card>

      {/* 4. Section 1: How It Works (Accessible Tabs: Farmers & Owners) */}
      <section className="space-y-4" aria-labelledby="how-it-works-heading">
        <div className="space-y-1">
          <h2 id="how-it-works-heading" className="text-xl sm:text-2xl font-bold text-forest">
            {t.howItWorksTitle}
          </h2>
          <p className="text-sm text-neutralText-secondary">
            {t.howItWorksSubtitle}
          </p>
        </div>

        {/* Tab Navigation */}
        <div
          role="tablist"
          aria-label={t.howItWorksTitle}
          className="grid grid-cols-2 p-1.5 bg-cream-light rounded-xl border border-cream-border gap-2"
        >
          <button
            type="button"
            role="tab"
            id="tab-farmers"
            aria-selected={activeTab === 'farmer'}
            aria-controls="tabpanel-farmers"
            onClick={() => setActiveTab('farmer')}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                setActiveTab(activeTab === 'farmer' ? 'owner' : 'farmer');
              }
            }}
            className={`py-3 px-4 rounded-lg font-bold text-base transition-subtle min-h-[48px] flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-agri ${
              activeTab === 'farmer'
                ? 'bg-forest text-white shadow-soft'
                : 'text-neutralText-secondary hover:text-forest hover:bg-white/60'
            }`}
          >
            <span>🌾</span>
            <span>{t.tabForFarmers}</span>
          </button>

          <button
            type="button"
            role="tab"
            id="tab-owners"
            aria-selected={activeTab === 'owner'}
            aria-controls="tabpanel-owners"
            onClick={() => setActiveTab('owner')}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                setActiveTab(activeTab === 'farmer' ? 'owner' : 'farmer');
              }
            }}
            className={`py-3 px-4 rounded-lg font-bold text-base transition-subtle min-h-[48px] flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-agri ${
              activeTab === 'owner'
                ? 'bg-forest text-white shadow-soft'
                : 'text-neutralText-secondary hover:text-forest hover:bg-white/60'
            }`}
          >
            <span>🚜</span>
            <span>{t.tabForOwners}</span>
          </button>
        </div>

        {/* Farmers Tab Panel */}
        {activeTab === 'farmer' && (
          <div
            id="tabpanel-farmers"
            role="tabpanel"
            aria-labelledby="tab-farmers"
            className="space-y-3 pt-2"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Card padding="md" className="space-y-1.5 border border-cream-border bg-white">
                <span className="text-xs font-bold text-agri uppercase tracking-wider block">Step 1</span>
                <h3 className="font-bold text-base text-forest">{t.farmerStep1Title}</h3>
                <p className="text-sm text-neutralText-secondary">{t.farmerStep1Desc}</p>
              </Card>

              <Card padding="md" className="space-y-1.5 border border-cream-border bg-white">
                <span className="text-xs font-bold text-agri uppercase tracking-wider block">Step 2</span>
                <h3 className="font-bold text-base text-forest">{t.farmerStep2Title}</h3>
                <p className="text-sm text-neutralText-secondary">{t.farmerStep2Desc}</p>
              </Card>

              <Card padding="md" className="space-y-1.5 border border-cream-border bg-white">
                <span className="text-xs font-bold text-agri uppercase tracking-wider block">Step 3</span>
                <h3 className="font-bold text-base text-forest">{t.farmerStep3Title}</h3>
                <p className="text-sm text-neutralText-secondary">{t.farmerStep3Desc}</p>
              </Card>

              <Card padding="md" className="space-y-1.5 border border-cream-border bg-white">
                <span className="text-xs font-bold text-agri uppercase tracking-wider block">Step 4</span>
                <h3 className="font-bold text-base text-forest">{t.farmerStep4Title}</h3>
                <p className="text-sm text-neutralText-secondary">{t.farmerStep4Desc}</p>
              </Card>
            </div>

            <Card padding="md" className="border border-cream-border bg-cream-light/60">
              <span className="text-xs font-bold text-forest uppercase tracking-wider block">Step 5</span>
              <h3 className="font-bold text-base text-forest mt-0.5">{t.farmerStep5Title}</h3>
              <p className="text-sm text-neutralText-secondary mt-1">{t.farmerStep5Desc}</p>
            </Card>
          </div>
        )}

        {/* Machine Owners Tab Panel */}
        {activeTab === 'owner' && (
          <div
            id="tabpanel-owners"
            role="tabpanel"
            aria-labelledby="tab-owners"
            className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2"
          >
            <Card padding="md" className="space-y-1.5 border border-cream-border bg-white">
              <span className="text-xs font-bold text-agri uppercase tracking-wider block">Step 1</span>
              <h3 className="font-bold text-base text-forest">{t.ownerStep1Title}</h3>
              <p className="text-sm text-neutralText-secondary">{t.ownerStep1Desc}</p>
            </Card>

            <Card padding="md" className="space-y-1.5 border border-cream-border bg-white">
              <span className="text-xs font-bold text-agri uppercase tracking-wider block">Step 2</span>
              <h3 className="font-bold text-base text-forest">{t.ownerStep2Title}</h3>
              <p className="text-sm text-neutralText-secondary">{t.ownerStep2Desc}</p>
            </Card>

            <Card padding="md" className="space-y-1.5 border border-cream-border bg-white">
              <span className="text-xs font-bold text-agri uppercase tracking-wider block">Step 3</span>
              <h3 className="font-bold text-base text-forest">{t.ownerStep3Title}</h3>
              <p className="text-sm text-neutralText-secondary">{t.ownerStep3Desc}</p>
            </Card>

            <Card padding="md" className="space-y-1.5 border border-cream-border bg-white">
              <span className="text-xs font-bold text-agri uppercase tracking-wider block">Step 4</span>
              <h3 className="font-bold text-base text-forest">{t.ownerStep4Title}</h3>
              <p className="text-sm text-neutralText-secondary">{t.ownerStep4Desc}</p>
            </Card>
          </div>
        )}
      </section>

      {/* 5. Section 2: Ground Realities of Harvesting in India (4 cards + note) */}
      <section className="space-y-4" aria-labelledby="ground-realities-heading">
        <div className="space-y-1">
          <h2 id="ground-realities-heading" className="text-xl sm:text-2xl font-bold text-forest">
            {t.groundRealitiesTitle}
          </h2>
          <p className="text-sm text-neutralText-secondary">
            {t.groundRealitiesSubtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card 1: Diesel and operator bata */}
          <Card padding="md" className="space-y-2 border border-cream-border bg-white shadow-soft">
            <div className="flex items-center gap-2 text-forest">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center">
                <Fuel className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-base">{t.realityDieselTitle}</h3>
            </div>
            <p className="text-sm text-neutralText-secondary leading-relaxed">
              {t.realityDieselDesc}
            </p>
          </Card>

          {/* Card 2: Tyre vs Track */}
          <Card padding="md" className="space-y-2 border border-cream-border bg-white shadow-soft">
            <div className="flex items-center gap-2 text-forest">
              <div className="w-8 h-8 rounded-lg bg-green-100 text-green-900 flex items-center justify-center">
                <GitBranch className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-base">{t.realityTyreVsTrackTitle}</h3>
            </div>
            <p className="text-sm text-neutralText-secondary leading-relaxed">
              {t.realityTyreVsTrackDesc}
            </p>
          </Card>

          {/* Card 3: Minimum Area */}
          <Card padding="md" className="space-y-2 border border-cream-border bg-white shadow-soft">
            <div className="flex items-center gap-2 text-forest">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-900 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-base">{t.realityMinAreaTitle}</h3>
            </div>
            <p className="text-sm text-neutralText-secondary leading-relaxed">
              {t.realityMinAreaDesc}
            </p>
          </Card>

          {/* Card 4: Road Access */}
          <Card padding="md" className="space-y-2 border border-cream-border bg-white shadow-soft">
            <div className="flex items-center gap-2 text-forest">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-base">{t.realityRoadAccessTitle}</h3>
            </div>
            <p className="text-sm text-neutralText-secondary leading-relaxed">
              {t.realityRoadAccessDesc}
            </p>
          </Card>
        </div>

        {/* Short Note */}
        <div className="p-3 bg-cream-light border border-cream-border rounded-lg text-sm text-forest font-semibold flex items-center gap-2">
          <Phone className="w-4 h-4 text-agri flex-shrink-0" />
          <span>{t.confirmWithPhoneNote}</span>
        </div>
      </section>

      {/* 6. Section 3: Harvest Rentals vs Village Brokers Table (Responsive scroll) */}
      <section className="space-y-4" aria-labelledby="comparison-heading">
        <div className="space-y-1">
          <h2 id="comparison-heading" className="text-xl sm:text-2xl font-bold text-forest">
            {t.comparisonTitle}
          </h2>
          <p className="text-sm text-neutralText-secondary">
            {t.comparisonSubtitle}
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-cream-border shadow-soft bg-white">
          <table className="w-full text-left border-collapse min-w-[560px]">
            <thead>
              <tr className="bg-cream-light border-b border-cream-border text-xs sm:text-sm font-bold text-forest">
                <th scope="col" className="p-3.5 sm:p-4 w-1/4">{t.tableColFeature}</th>
                <th scope="col" className="p-3.5 sm:p-4 w-3/8 text-forest bg-agri-light/40">
                  <div className="flex items-center gap-1.5">
                    <span>🌾</span>
                    <span>{t.tableColHarvestRentals}</span>
                  </div>
                </th>
                <th scope="col" className="p-3.5 sm:p-4 w-3/8 text-neutralText-secondary">
                  {t.tableColBrokers}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-border text-xs sm:text-sm">
              <tr>
                <td className="p-3.5 sm:p-4 font-bold text-forest">{t.rowCommission}</td>
                <td className="p-3.5 sm:p-4 text-forest font-medium bg-agri-light/20">
                  {t.rowCommissionApp}
                </td>
                <td className="p-3.5 sm:p-4 text-neutralText-secondary">
                  {t.rowCommissionBrokers}
                </td>
              </tr>
              <tr>
                <td className="p-3.5 sm:p-4 font-bold text-forest">{t.rowContact}</td>
                <td className="p-3.5 sm:p-4 text-forest font-medium bg-agri-light/20">
                  {t.rowContactApp}
                </td>
                <td className="p-3.5 sm:p-4 text-neutralText-secondary">
                  {t.rowContactBrokers}
                </td>
              </tr>
              <tr>
                <td className="p-3.5 sm:p-4 font-bold text-forest">{t.rowAvailability}</td>
                <td className="p-3.5 sm:p-4 text-forest font-medium bg-agri-light/20">
                  {t.rowAvailabilityApp}
                </td>
                <td className="p-3.5 sm:p-4 text-neutralText-secondary">
                  {t.rowAvailabilityBrokers}
                </td>
              </tr>
              <tr>
                <td className="p-3.5 sm:p-4 font-bold text-forest">{t.rowPayment}</td>
                <td className="p-3.5 sm:p-4 text-forest font-medium bg-agri-light/20">
                  {t.rowPaymentApp}
                </td>
                <td className="p-3.5 sm:p-4 text-neutralText-secondary">
                  {t.rowPaymentBrokers}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 7. Section 4: FAQ Accordion (Keyboard accessible, single open) */}
      <section className="space-y-4" aria-labelledby="faq-heading">
        <div className="space-y-1">
          <h2 id="faq-heading" className="text-xl sm:text-2xl font-bold text-forest">
            {t.faqTitle}
          </h2>
          <p className="text-sm text-neutralText-secondary">
            {t.faqSubtitle}
          </p>
        </div>

        <div className="space-y-2.5">
          {[
            { id: 1, q: t.faqQ1, a: t.faqA1 },
            { id: 2, q: t.faqQ2, a: t.faqA2 },
            { id: 3, q: t.faqQ3, a: t.faqA3 },
            { id: 4, q: t.faqQ4, a: t.faqA4 },
            { id: 5, q: t.faqQ5, a: t.faqA5 },
            { id: 6, q: t.faqQ6, a: t.faqA6 },
          ].map((item) => {
            const isOpen = openFaq === item.id;
            return (
              <div
                key={item.id}
                className="border border-cream-border rounded-xl overflow-hidden bg-white shadow-soft transition-subtle"
              >
                <button
                  type="button"
                  id={`faq-btn-${item.id}`}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${item.id}`}
                  onClick={() => toggleFaq(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleFaq(item.id);
                    }
                  }}
                  className="w-full text-left p-4 sm:p-5 flex items-center justify-between gap-3 text-base font-bold text-forest hover:bg-cream-light/40 transition-subtle min-h-[48px] focus:outline-none focus:ring-2 focus:ring-agri"
                >
                  <span className="leading-snug">{item.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-agri flex-shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div
                    id={`faq-panel-${item.id}`}
                    role="region"
                    aria-labelledby={`faq-btn-${item.id}`}
                    className="px-4 pb-5 sm:px-5 text-sm sm:text-base text-neutralText-secondary leading-relaxed border-t border-cream-border/60 pt-3 bg-cream-light/20"
                  >
                    <p>{item.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 8. Section 5: Bottom Call-To-Action (Big Buttons) */}
      <section className="p-6 sm:p-8 bg-forest text-white rounded-2xl shadow-soft space-y-4 text-center sm:text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-xl sm:text-2xl font-bold text-white">
              {t.appName}
            </h3>
            <p className="text-sm text-cream-light/80 max-w-xl">
              {t.tagline}. Direct phone calls, clear rates, and zero booking commissions.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Find Harvester Button */}
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => onNavigate?.('find')}
              icon={<Search className="w-5 h-5" />}
              className="w-full sm:w-auto bg-white text-forest hover:bg-cream-light min-h-[48px]"
            >
              {t.ctaFindHarvester}
            </Button>

            {/* List Your Machine (Hidden if user is explicitly a farmer) */}
            {user?.role !== 'farmer' && (
              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={handleListMachineClick}
                icon={<Tractor className="w-5 h-5" />}
                className="w-full sm:w-auto bg-agri hover:bg-agri-hover text-white min-h-[48px]"
              >
                {t.ctaListMachine}
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* 9. Section 6: Helpline and Sharing */}
      <section className="space-y-4" aria-labelledby="helpline-heading">
        {/* Verified Kisan Call Centre Helpline Box */}
        <div className="bg-forest-dark text-white rounded-xl p-5 sm:p-6 shadow-soft flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
              <Phone className="w-5 h-5 text-cream-light" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-cream-light/80 block">
                Official National Agricultural Support
              </span>
              <a
                href="tel:18001801551"
                className="text-base sm:text-lg font-extrabold text-white hover:underline mt-0.5 inline-block"
              >
                {t.emergencyHelpline}
              </a>
              <span className="text-xs text-cream-light/70 block mt-0.5">
                Available in Kannada, Hindi, English, and all regional Indian languages
              </span>
            </div>
          </div>
        </div>

        {/* Sharing & Support WhatsApp Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
          {/* Share on WhatsApp Button */}
          <a
            href={whatsappShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-forest text-white hover:bg-forest-light font-bold text-sm sm:text-base transition-subtle shadow-soft min-h-[48px]"
          >
            <Share2 className="w-4 h-4" />
            <span>{t.shareOnWhatsApp}</span>
          </a>

          {/* Support WhatsApp (Appears ONLY if VITE_SUPPORT_WHATSAPP is set) */}
          {supportWhatsappUrl && (
            <a
              href={supportWhatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white text-forest border border-cream-border hover:bg-cream-light font-bold text-sm sm:text-base transition-subtle shadow-soft min-h-[48px]"
            >
              <MessageCircle className="w-4 h-4 text-agri" />
              <span>{t.supportWhatsApp}</span>
            </a>
          )}
        </div>
      </section>
    </div>
  );
};
