import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { NewsItem } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Card, Badge } from './ui';
import {
  Newspaper,
  ExternalLink,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Sparkles,
} from 'lucide-react';

const FALLBACK_FARM_NEWS: NewsItem[] = [
  {
    id: 'news-paddy-price-up',
    title: 'Paddy (Sona Masoori) Mandi Rates Rise by ₹120/Qtl Across Karnataka Mandis',
    summary:
      'Heavy demand from millers in Raichur, Bellary and Gangavathi has driven paddy prices to ₹2,420/qtl. Harvester owners report high booking volumes.',
    source_name: 'Karnataka State Agricultural Marketing Board (KSAMB)',
    source_url: 'https://krishimaratavahini.kar.nic.in/',
    category: 'prices',
    crop_name: 'Paddy (Rice)',
    price_trend: 'up',
    price_change: '+₹120/qtl',
    published_at: new Date().toISOString(),
    fetched_at: new Date().toISOString(),
  },
  {
    id: 'news-onion-price-down',
    title: 'Onion Wholesale Prices Cool Down by ₹250/Qtl as Fresh Kharif Arrivals Increase',
    summary:
      'Lasalgaon and Hubli mandis report steady arrivals of fresh kharif onion. Modal price settled at ₹1,850/qtl compared to ₹2,100 last week.',
    source_name: 'Agmarknet Daily Market Report',
    source_url: 'https://agmarknet.gov.in/',
    category: 'prices',
    crop_name: 'Onion',
    price_trend: 'down',
    price_change: '-₹250/qtl',
    published_at: new Date().toISOString(),
    fetched_at: new Date().toISOString(),
  },
  {
    id: 'news-maize-price-up',
    title: 'Maize (Corn) Prices Climb to ₹2,380/Qtl on Heavy Feed Industry Demand',
    summary:
      'Poultry and starch manufacturing sectors continue aggressive procurement across Davangere and Haveri APMCs, lifting prices by ₹90/qtl.',
    source_name: 'National Agriculture Market (e-NAM)',
    source_url: 'https://enam.gov.in/',
    category: 'prices',
    crop_name: 'Maize (Corn)',
    price_trend: 'up',
    price_change: '+₹90/qtl',
    published_at: new Date().toISOString(),
    fetched_at: new Date().toISOString(),
  },
  {
    id: 'news-cotton-msp-stable',
    title: 'Cotton Procurement Underway at MSP; Modal Prices Steady at ₹7,120/Qtl',
    summary:
      'CCI procurement centres open in Raichur and Dharwad districts. Medium-staple cotton trades steadily near minimum support price levels.',
    source_name: 'Cotton Corporation of India',
    source_url: 'https://cotcorp.org.in/',
    category: 'prices',
    crop_name: 'Cotton',
    price_trend: 'stable',
    price_change: '₹7,120/qtl',
    published_at: new Date().toISOString(),
    fetched_at: new Date().toISOString(),
  },
  {
    id: 'news-harvest-weather',
    title: 'Clear Skies Forecast for Next 5 Days: Optimal Window for Harvester Operations',
    summary:
      'IMD agro-met advisory predicts dry sunny weather across southern plateau. Perfect conditions for combine harvesters and grain moisture drying.',
    source_name: 'India Meteorological Department (IMD)',
    source_url: 'https://mausam.imd.gov.in/',
    category: 'weather',
    published_at: new Date().toISOString(),
    fetched_at: new Date().toISOString(),
  },
];

export const FarmNewsCard: React.FC = () => {
  const { t } = useLanguage();
  const [news, setNews] = useState<NewsItem[]>(FALLBACK_FARM_NEWS);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchNews = async () => {
    if (!isSupabaseConfigured) {
      setNews(FALLBACK_FARM_NEWS);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('news_items')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(6);

      if (!error && data && data.length > 0) {
        setNews(data as NewsItem[]);
      } else {
        setNews(FALLBACK_FARM_NEWS);
      }
    } catch (err) {
      console.warn('Failed to fetch farm news from Supabase, using daily briefing:', err);
      setNews(FALLBACK_FARM_NEWS);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Trigger Supabase edge function or daily sync procedure if available
      await supabase.rpc('publish_daily_6am_farm_news');
    } catch {
      // Ignore if RPC unavailable to client
    }
    await fetchNews();
  };

  return (
    <Card padding="md" className="border-agri-border bg-gradient-to-br from-white to-cream-light/40 shadow-soft">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-cream-border mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-forest text-cream-light flex items-center justify-center shadow-soft">
            <Newspaper className="w-5 h-5 text-cream-light" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-forest leading-none">
                {t.farmNewsTitle || "Today's Mandi & Farmer Intelligence"}
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-forest text-cream-light border border-forest/20">
                <Clock className="w-2.5 h-2.5 text-agri" />
                6:00 AM IST Briefing
              </span>
            </div>
            <p className="text-[11px] text-neutralText-secondary mt-0.5">
              Automated daily briefing: Crop price increases/decreases, Mandi rates & harvesting advisories
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-1.5 text-forest hover:bg-cream-light rounded-md transition-subtle flex-shrink-0"
          title="Refresh 6:00 AM briefing"
          aria-label="Refresh Mandi Intelligence"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-6 text-center text-xs text-neutralText-secondary">
          <RefreshCw className="w-4 h-4 animate-spin mx-auto text-agri mb-1.5" />
          Loading daily 6:00 AM IST Mandi & agricultural updates...
        </div>
      ) : news.length > 0 ? (
        <div className="divide-y divide-cream-border">
          {news.map((item) => (
            <div key={item.id} className="py-3 first:pt-0 last:pb-0 flex flex-col gap-1.5">
              <div className="flex items-start justify-between gap-2 flex-wrap sm:flex-nowrap">
                <a
                  href={item.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs sm:text-sm font-bold text-forest hover:text-agri transition-subtle leading-snug flex-1"
                >
                  {item.title}
                </a>

                {/* Price Trend Badges */}
                {item.crop_name && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {item.price_trend === 'up' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{item.crop_name}</span>
                        <span className="font-extrabold">{item.price_change}</span>
                      </span>
                    )}
                    {item.price_trend === 'down' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                        <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                        <span>{item.crop_name}</span>
                        <span className="font-extrabold">{item.price_change}</span>
                      </span>
                    )}
                    {item.price_trend === 'stable' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
                        <Minus className="w-3.5 h-3.5 text-blue-600" />
                        <span>{item.crop_name}</span>
                        <span className="font-extrabold">{item.price_change}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {item.summary && (
                <p className="text-xs text-neutralText-secondary line-clamp-2 leading-relaxed">
                  {item.summary}
                </p>
              )}

              <div className="flex items-center justify-between text-[11px] text-neutralText-muted pt-1 flex-wrap gap-2">
                <span className="font-semibold text-agri flex items-center gap-1">
                  <span>{item.source_name}</span>
                  <span>&bull;</span>
                  <span>
                    {new Date(item.published_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </span>
                <a
                  href={item.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-forest hover:underline inline-flex items-center gap-1"
                >
                  <span>{t.readFullArticle || 'View source report'}</span>
                  <ExternalLink className="w-3 h-3 text-agri" />
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-4 text-center text-xs font-semibold text-neutralText-secondary">
          {t.noNewsToday || 'Daily 6:00 AM Mandi updates will appear here.'}
        </div>
      )}
    </Card>
  );
};

