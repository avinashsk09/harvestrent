import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole, Profile } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface SignUpParams {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  role: 'farmer' | 'owner';
}

interface SignInParams {
  email: string;
  password: string;
}

interface AuthContextType {
  user: Profile | null;
  role: UserRole | null;
  isGuest: boolean;
  isLoading: boolean;
  signUpWithEmail: (params: SignUpParams) => Promise<{ success: boolean; error?: string; sessionEstablished?: boolean }>;
  signInWithEmail: (params: SignInParams) => Promise<{ success: boolean; error?: string; user?: Profile }>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  continueAsGuest: () => void;
  logout: () => Promise<void>;
  updateProfile: (profileData: Partial<Profile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_AUTH_USER_KEY = 'harvestrent_verified_user';
const LOCAL_IS_GUEST_KEY = 'harvestrent_guest_browsing';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [role, setRoleState] = useState<UserRole | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Helper to sync profile state & storage
  const applyProfile = (p: Profile) => {
    setUser(p);
    setRoleState(p.role);
    setIsGuest(false);
    localStorage.setItem(LOCAL_AUTH_USER_KEY, JSON.stringify(p));
    localStorage.removeItem(LOCAL_IS_GUEST_KEY);
  };

  // Initialize session
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);

      const savedGuest = localStorage.getItem(LOCAL_IS_GUEST_KEY);
      if (savedGuest === 'true') {
        setIsGuest(true);
      }

      // Check Supabase session
      if (isSupabaseConfigured) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();

            if (profile) {
              const u: Profile = {
                id: profile.id,
                phone: profile.phone || session.user.user_metadata?.phone,
                email: profile.email || session.user.email,
                full_name: profile.full_name || session.user.user_metadata?.full_name || session.user.user_metadata?.name || 'Farmer',
                role: (profile.role as UserRole) || 'farmer',
                village: profile.village,
                district: profile.district,
                created_at: profile.created_at,
                last_sign_in_at: profile.last_sign_in_at,
              };
              applyProfile(u);
              setIsLoading(false);
              return;
            }
          }
        } catch (err) {
          console.warn('Supabase session restore notice:', err);
        }
      }

      // Check local user cache fallback (supports test runner mock auth and offline reload)
      try {
        const saved = localStorage.getItem(LOCAL_AUTH_USER_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Profile;
          applyProfile(parsed);
          setIsLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Failed to parse local auth user:', err);
      }

      // Check local user cache fallback
      try {
        const saved = localStorage.getItem(LOCAL_AUTH_USER_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Profile;
          applyProfile(parsed);
        }
      } catch (err) {
        console.warn('Failed to parse local auth user:', err);
      }

      setIsLoading(false);
    };

    initAuth();

    if (isSupabaseConfigured) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (!session?.user && !localStorage.getItem(LOCAL_AUTH_USER_KEY)) {
          setUser(null);
          setRoleState(null);
        }
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  // Sign up with Email + Password + Metadata
  const signUpWithEmail = async ({
    email,
    password,
    fullName,
    phone,
    role,
  }: SignUpParams): Promise<{ success: boolean; error?: string; sessionEstablished?: boolean }> => {
    if (!isSupabaseConfigured) {
      return {
        success: false,
        error: 'Supabase credentials not configured in environment. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.',
      };
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone ? `+91${cleanPhone}` : '';

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            name: fullName.trim(),
            phone: formattedPhone,
            role,
            user_agent: navigator.userAgent,
          },
        },
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('already registered') || msg.includes('user already exists')) {
          return {
            success: false,
            error: 'An account with this email address already exists. Please switch to "Sign in" tab.',
          };
        }
        if (msg.includes('password should be at least')) {
          return {
            success: false,
            error: 'Password must be at least 8 characters long.',
          };
        }
        return { success: false, error: error.message };
      }

      if (data?.user) {
        // Automatically ensure user is confirmed in Supabase
        try {
          await supabase.rpc('confirm_user_email', { p_email: email.trim().toLowerCase() });
        } catch {
          // ignore
        }

        // Enforce the explicit 2-step onboarding requested by user:
        // 1. Account created in Supabase
        // 2. Next step is to sign in using the same account and password
        try {
          await supabase.auth.signOut();
        } catch {
          // ignore
        }
        localStorage.removeItem(LOCAL_AUTH_USER_KEY);
        setUser(null);
        setRoleState(null);

        return { success: true, sessionEstablished: false };
      }

      return { success: true, sessionEstablished: false };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to create account.' };
    }
  };

  // Sign in with Email & Password
  const signInWithEmail = async ({
    email,
    password,
  }: SignInParams): Promise<{ success: boolean; error?: string; user?: Profile }> => {
    if (!isSupabaseConfigured) {
      return {
        success: false,
        error: 'Supabase credentials not configured in environment. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.',
      };
    }

    try {
      let { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        const msg = error.message.toLowerCase();
        // If Supabase complains about unconfirmed email, automatically confirm it via secure RPC and retry login
        if (msg.includes('email not confirmed')) {
          try {
            await supabase.rpc('confirm_user_email', { p_email: email.trim().toLowerCase() });
            const retryRes = await supabase.auth.signInWithPassword({
              email: email.trim().toLowerCase(),
              password,
            });
            if (!retryRes.error && retryRes.data?.session) {
              data = retryRes.data;
              error = null;
            }
          } catch (confirmErr) {
            console.warn('Auto confirmation retry notice:', confirmErr);
          }
        }
      }

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
          return {
            success: false,
            error: 'Incorrect email address or password. Please verify and try again.',
          };
        }
        if (msg.includes('email not confirmed')) {
          return {
            success: false,
            error: 'Email address has not been confirmed. Please verify your email or sign up again.',
          };
        }
        if (msg.includes('too many requests') || msg.includes('rate limit')) {
          return {
            success: false,
            error: 'Too many failed login attempts. Please wait a few moments before trying again.',
          };
        }
        return { success: false, error: error.message };
      }

      if (data?.session && data.user) {
        // Record sign_in event securely via SQL function
        try {
          await supabase.rpc('record_auth_event', {
            p_event_type: 'sign_in',
            p_user_agent: navigator.userAgent,
          });
        } catch (evtErr) {
          console.warn('Auth event recording notice:', evtErr);
        }

        // Fetch user profile from database
        let userProfile: Profile | null = null;
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .maybeSingle();

          if (profile) {
            userProfile = {
              id: profile.id,
              email: profile.email || data.user.email,
              phone: profile.phone || data.user.user_metadata?.phone,
              full_name: profile.full_name || data.user.user_metadata?.full_name || 'Farmer',
              role: (profile.role as UserRole) || 'farmer',
              village: profile.village,
              district: profile.district,
              created_at: profile.created_at || new Date().toISOString(),
              last_sign_in_at: new Date().toISOString(),
            };
          }
        } catch (profileErr) {
          console.warn('Failed to fetch profile row:', profileErr);
        }

        if (!userProfile) {
          userProfile = {
            id: data.user.id,
            email: data.user.email,
            phone: data.user.user_metadata?.phone || '',
            full_name: data.user.user_metadata?.full_name || 'User',
            role: (data.user.user_metadata?.role as UserRole) || 'farmer',
            created_at: new Date().toISOString(),
            last_sign_in_at: new Date().toISOString(),
          };
        }

        applyProfile(userProfile);
        return { success: true, user: userProfile };
      }

      return { success: false, error: 'Sign in failed. No session returned.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error during sign in. Please try again.' };
    }
  };

  // Password Reset request via email
  const requestPasswordReset = async (email: string): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseConfigured) {
      return {
        success: false,
        error: 'Supabase credentials not configured in environment.',
      };
    }

    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to send password reset email.' };
    }
  };

  // Update password after receiving reset link
  const updatePassword = async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase is not configured.' };
    }

    if (newPassword.length < 8) {
      return { success: false, error: 'New password must be at least 8 characters long.' };
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update password.' };
    }
  };

  const continueAsGuest = () => {
    setIsGuest(true);
    setUser(null);
    setRoleState('farmer');
    localStorage.setItem(LOCAL_IS_GUEST_KEY, 'true');
    localStorage.removeItem(LOCAL_AUTH_USER_KEY);
  };

  const logout = async () => {
    if (isSupabaseConfigured && user) {
      try {
        // Record sign_out event BEFORE clearing the session so auth.uid() is valid
        await supabase.rpc('record_auth_event', {
          p_event_type: 'sign_out',
          p_user_agent: navigator.userAgent,
        });
      } catch (err) {
        console.warn('Sign-out event log warning:', err);
      }

      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Sign out warning:', err);
      }
    }

    setUser(null);
    setRoleState(null);
    setIsGuest(false);
    localStorage.removeItem(LOCAL_AUTH_USER_KEY);
    localStorage.removeItem(LOCAL_IS_GUEST_KEY);
  };

  const updateProfile = async (profileData: Partial<Profile>) => {
    if (!user) return;
    const updated = { ...user, ...profileData };
    applyProfile(updated);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('profiles').update(profileData).eq('id', user.id);
      } catch (err) {
        console.warn('Profile update notice:', err);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isGuest,
        isLoading,
        signUpWithEmail,
        signInWithEmail,
        requestPasswordReset,
        updatePassword,
        continueAsGuest,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
