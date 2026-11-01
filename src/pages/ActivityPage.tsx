import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Profile, AuthEvent } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Card, Button, Input, Toast } from '../components/ui';
import {
  ShieldAlert,
  Download,
  Search,
  RefreshCw,
  Users,
  History,
  LogIn,
  LogOut,
  UserPlus,
  Calendar,
  Phone,
  Mail,
  Shield,
} from 'lucide-react';

interface ActivityPageProps {
  onNavigate: (page: string) => void;
}

export const ActivityPage: React.FC<ActivityPageProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'events' | 'users'>('events');
  const [searchQuery, setSearchQuery] = useState('');
  const [usersList, setUsersList] = useState<Profile[]>([]);
  const [eventsList, setEventsList] = useState<AuthEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Admin access gate
  const isAdmin = user?.role === 'admin';

  const fetchActivity = async () => {
    if (!isSupabaseConfigured || !isAdmin) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch via secure admin RPC
      const { data, error: rpcError } = await supabase.rpc('get_admin_activity');

      if (rpcError) {
        // Fallback: direct select if RPC not installed yet
        console.warn('RPC notice, trying direct table select:', rpcError);
        const { data: pData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        const { data: eData } = await supabase.from('auth_events').select('*').order('created_at', { ascending: false }).limit(200);

        setUsersList((pData as Profile[]) || []);
        setEventsList((eData as AuthEvent[]) || []);
      } else if (data) {
        setUsersList((data.users as Profile[]) || []);
        setEventsList((data.events as AuthEvent[]) || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load activity logs.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchActivity();
    } else {
      setIsLoading(false);
    }
  }, [isAdmin]);

  // CSV Exporter
  const handleDownloadCsv = () => {
    const isEvents = activeTab === 'events';
    let headers: string[];
    let rows: string[][];

    if (isEvents) {
      headers = ['ID', 'User Name', 'Email', 'Event Type', 'Role', 'Date & Time (UTC)', 'User Agent'];
      rows = filteredEvents.map((e) => [
        `"${e.id}"`,
        `"${e.user_name || 'N/A'}"`,
        `"${e.user_email || 'N/A'}"`,
        `"${e.event_type}"`,
        `"${e.role || 'farmer'}"`,
        `"${e.created_at}"`,
        `"${(e.user_agent || '').replace(/"/g, '""')}"`,
      ]);
    } else {
      headers = ['User ID', 'Full Name', 'Email', 'Phone', 'Role', 'Created At', 'Last Sign In At'];
      rows = filteredUsers.map((u) => [
        `"${u.id}"`,
        `"${u.full_name}"`,
        `"${u.email || ''}"`,
        `"${u.phone || ''}"`,
        `"${u.role}"`,
        `"${u.created_at}"`,
        `"${u.last_sign_in_at || ''}"`,
      ]);
    }

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `harvest_rentals_${activeTab}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter lists based on search query
  const query = searchQuery.trim().toLowerCase();

  const filteredEvents = eventsList.filter((e) => {
    if (!query) return true;
    return (
      e.event_type.toLowerCase().includes(query) ||
      (e.user_name && e.user_name.toLowerCase().includes(query)) ||
      (e.user_email && e.user_email.toLowerCase().includes(query)) ||
      (e.role && e.role.toLowerCase().includes(query))
    );
  });

  const filteredUsers = usersList.filter((u) => {
    if (!query) return true;
    return (
      u.full_name.toLowerCase().includes(query) ||
      (u.email && u.email.toLowerCase().includes(query)) ||
      (u.phone && u.phone.includes(query)) ||
      u.role.toLowerCase().includes(query)
    );
  });

  // Guard: Admin privilege only
  if (!user || !isAdmin) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center space-y-4">
        <div className="w-14 h-14 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold text-forest">Administrator Access Only</h2>
        <p className="text-sm text-neutralText-secondary leading-relaxed">
          The Activity dashboard is restricted to system administrators. To access this view, set{' '}
          <code className="bg-cream-light px-1.5 py-0.5 rounded text-forest font-mono text-xs">
            role = 'admin'
          </code>{' '}
          for your account row in the Supabase <code className="text-xs font-mono">public.profiles</code> table.
        </p>
        <div className="pt-2">
          <Button variant="primary" onClick={() => onNavigate('home')}>
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-6 sm:py-8 px-4 space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-forest text-cream-light">
              <Shield className="w-3.5 h-3.5" />
              {t.adminBadge || 'Admin'}
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-forest tracking-tight">
              {t.activityTitle || 'User Activity & Auth Log'}
            </h1>
          </div>
          <p className="text-sm text-neutralText-secondary mt-1">
            {t.activitySubtitle || 'Audit log of user registrations, logins, and logouts'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="md"
            icon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
            onClick={fetchActivity}
            disabled={isLoading}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="md"
            icon={<Download className="w-4 h-4" />}
            onClick={handleDownloadCsv}
            disabled={isLoading || (activeTab === 'events' ? filteredEvents.length === 0 : filteredUsers.length === 0)}
          >
            {t.exportCsv || 'Download CSV'}
          </Button>
        </div>
      </div>

      {error && <Toast type="error" message={error} onClose={() => setError(null)} />}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card padding="md" className="border-cream-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-neutralText-secondary uppercase">
                {t.totalUsers || 'Total Users'}
              </p>
              <p className="text-2xl font-bold text-forest mt-1">{usersList.length}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-agri-light/40 text-forest flex items-center justify-center">
              <Users className="w-5 h-5 text-forest" />
            </div>
          </div>
        </Card>

        <Card padding="md" className="border-cream-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-neutralText-secondary uppercase">
                {t.totalEvents || 'Total Auth Events'}
              </p>
              <p className="text-2xl font-bold text-forest mt-1">{eventsList.length}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-agri-light/40 text-forest flex items-center justify-center">
              <History className="w-5 h-5 text-forest" />
            </div>
          </div>
        </Card>

        <Card padding="md" className="border-cream-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-neutralText-secondary uppercase">
                Harvester Owners
              </p>
              <p className="text-2xl font-bold text-forest mt-1">
                {usersList.filter((u) => u.role === 'owner').length}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-agri-light/40 text-forest flex items-center justify-center">
              <Calendar className="w-5 h-5 text-forest" />
            </div>
          </div>
        </Card>
      </div>

      {/* Table Card */}
      <Card padding="none" className="border-cream-border overflow-hidden">
        {/* Controls Bar */}
        <div className="p-4 border-b border-cream-border flex flex-col sm:flex-row items-center justify-between gap-3 bg-cream-light/30">
          {/* Tab Selector */}
          <div className="flex items-center bg-white border border-cream-border rounded-lg p-1 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('events')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-subtle flex items-center gap-1.5 ${
                activeTab === 'events'
                  ? 'bg-forest text-white shadow-soft'
                  : 'text-neutralText-secondary hover:text-forest'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>{t.eventsTab || 'Auth Events'} ({filteredEvents.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-subtle flex items-center gap-1.5 ${
                activeTab === 'users'
                  ? 'bg-forest text-white shadow-soft'
                  : 'text-neutralText-secondary hover:text-forest'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{t.usersTab || 'Users'} ({filteredUsers.length})</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="w-full sm:w-72">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchUsersPlaceholder || 'Search by name, email, role...'}
              leftIcon={<Search className="w-4 h-4 text-agri" />}
            />
          </div>
        </div>

        {/* TAB 1: AUTH EVENTS TABLE */}
        {activeTab === 'events' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-cream-light/60 text-forest text-xs font-bold uppercase tracking-wider border-b border-cream-border">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">{t.eventType || 'Event Type'}</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Device / User Agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-neutralText-secondary">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-forest mb-2" />
                      Loading authentication logs...
                    </td>
                  </tr>
                ) : filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-neutralText-secondary">
                      No authentication events match your filter.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((evt) => (
                    <tr key={evt.id} className="hover:bg-cream-light/20 transition-subtle">
                      <td className="py-3 px-4">
                        <span className="font-bold text-forest block leading-tight">
                          {evt.user_name || 'User'}
                        </span>
                        <span className="text-xs text-neutralText-muted block mt-0.5">
                          {evt.user_email || evt.user_id}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {evt.event_type === 'sign_up' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                            <UserPlus className="w-3 h-3" />
                            Sign Up
                          </span>
                        )}
                        {evt.event_type === 'sign_in' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            <LogIn className="w-3 h-3" />
                            Sign In
                          </span>
                        )}
                        {evt.event_type === 'sign_out' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <LogOut className="w-3 h-3" />
                            Sign Out
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="capitalize text-xs font-semibold px-2 py-0.5 rounded bg-cream-light text-forest border border-cream-border">
                          {evt.role || 'farmer'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-xs text-neutralText-secondary whitespace-nowrap">
                        {new Date(evt.created_at).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>

                      <td className="py-3 px-4 text-xs text-neutralText-muted max-w-xs truncate" title={evt.user_agent}>
                        {evt.user_agent || 'Harvest Rentals Web'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: USERS DIRECTORY TABLE */}
        {activeTab === 'users' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-cream-light/60 text-forest text-xs font-bold uppercase tracking-wider border-b border-cream-border">
                <tr>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Mobile Phone</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">{t.registeredOn || 'Registered'}</th>
                  <th className="py-3 px-4">{t.lastSignIn || 'Last Sign In'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-neutralText-secondary">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-forest mb-2" />
                      Loading user directory...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-neutralText-secondary">
                      No registered users found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-cream-light/20 transition-subtle">
                      <td className="py-3 px-4 font-bold text-forest">
                        {u.full_name}
                      </td>

                      <td className="py-3 px-4 text-xs text-neutralText-secondary">
                        {u.email ? (
                          <span className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-agri" />
                            {u.email}
                          </span>
                        ) : (
                          <span className="text-neutralText-muted">N/A</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-xs text-neutralText-secondary font-mono">
                        {u.phone ? (
                          <span className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-agri" />
                            {u.phone}
                          </span>
                        ) : (
                          <span className="text-neutralText-muted">N/A</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`capitalize text-xs font-bold px-2 py-0.5 rounded border ${
                            u.role === 'admin'
                              ? 'bg-purple-100 text-purple-800 border-purple-200'
                              : u.role === 'owner'
                              ? 'bg-amber-50 text-amber-900 border-amber-200'
                              : 'bg-green-50 text-green-900 border-green-200'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-xs text-neutralText-secondary whitespace-nowrap">
                        {new Date(u.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      <td className="py-3 px-4 text-xs text-neutralText-secondary whitespace-nowrap">
                        {u.last_sign_in_at
                          ? new Date(u.last_sign_in_at).toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })
                          : 'Never'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

