# 🌾 Harvest Rentals (ಕಟಾವು ಬಾಡಿಗೆ • फसल कटाई किराया)

**Harvest Rentals** is a clean, trustworthy, mobile-first marketplace web application connecting farmers directly with combine harvester owners. During the critical 4 to 7-day harvest window, farmers can find nearby available machines, verify rates, call owners directly on their phones, or reserve a harvester with an advance payment.

Built with **React 18, TypeScript, Vite, Tailwind CSS, Supabase (PostgreSQL, Auth, Storage), and Razorpay Test Sandbox**.

---

## 🎨 Visual Design System & Accessibility

- **Color Palette (Strictly No Neon, No Bright Glows)**:
  - Deep Forest Green (`#0F3D26`): Headings, app header, and brand identity
  - Muted Green (`#2E7D4F`): Primary action buttons and confirmations
  - Warm Cream (`#F5F0E1`): Soft, natural background
  - White Cards: Soft thin borders (`#DED7C4`) and subtle elevation
  - Muted Amber (`#C98B2B`): Small highlights and pending indicators
  - Muted Brick Red (`#A63D2F`): Error states and alerts
  - Neutral Greys: Highly legible secondary text
- **Typography**: Inter / system font with comfortable 16px minimum body size, clear visual hierarchy, and full WCAG AA contrast compliance.
- **Shared Components**: Shared `Button`, `Input`, `Card`, `Badge`, `Modal`, `Toast`, and `Skeleton` loader components.

---

## 📱 Core Features

1. **Zero Fake or Generated Data**:
   - The platform displays **only real listings** created by real users.
   - When no machines are registered in an area, the app displays a clean, friendly empty state encouraging owners to list their machines.
   - Photos are uploaded directly from device cameras/files to Supabase Storage (`machine-photos`).

2. **Simple Email + Password Authentication**:
   - **Two Tabs**: "Sign in" and "Create account".
   - **Create Account**: Full name, email, mobile number (+91, 10 digits for direct calling; NOT OTP-verified), password (min 8 chars), confirm password, and role selection (**Farmer** or **Machine Owner**).
   - **Sign In**: Email and password with show/hide password toggle and "Forgot password" flow.
   - **Password Reset**: Self-service email reset with a dedicated reset page (`/reset-password`).
   - **Automatic Profiles**: Created automatically via database trigger on `auth.users` insert, reading name, phone, and role from user metadata.
   - **Security**: Row Level Security (RLS) restricts users to read and update only their own profile.
   - **Guest Browsing**: Farmers can freely search and call owners without logging in. Authentication is required only for listing machines, managing listings, booking, and paying.

3. **Authentication Event Auditing & Admin Activity Dashboard**:
   - Every `sign_up` is recorded automatically by a database trigger.
   - `sign_in` and `sign_out` events are recorded securely through a SQL function (`record_auth_event`) that enforces `auth.uid()`.
   - `last_sign_in_at` timestamp is updated on `profiles` upon each login.
   - **Admin Activity Page** (`/activity`): Visible only when `role = 'admin'` in `profiles`. Displays:
     - Real-time audit log of all registrations, logins, and logouts with timestamps, roles, and device user agents.
     - Complete directory of registered users with search and filter capabilities.
     - One-click **Download CSV** export.

4. **Rule-Based Search (Zero AI/ML)**:
   - Uses PostgreSQL `pg_trgm` trigram similarity function `search_machines(crop, village, district, needed_date)` with automatic district fallback.
   - **Unavailable Date Exclusion**: Machines marked busy on a farmer's required date are automatically hidden.
   - **Voice Search (Browser Web Speech API)**: Tap the microphone to speak *"village, crop, acres"* in English, Kannada, or Hindi (`en-IN`, `kn-IN`, `hi-IN`).

5. **Honest Price Estimation**:
   - **Per-acre rates**: Accurately computes `acres × rate`.
   - **Per-hour / Per-day rates**: Shows unit rate and explains that the final amount is determined by actual runtime hours or work days.

6. **Payment System (Razorpay Test Mode + Cash on Farm)**:
   - Prominent **"TEST MODE - NO REAL MONEY WILL BE CHARGED"** badge.
   - Supports Razorpay test checkout (UPI, Card, Netbanking) and **"Pay at the farm" (Cash after harvest)**.
   - Server-side cryptographic HMAC SHA256 signature verification in Supabase Edge Function (`verify-razorpay-payment`).
   - Printable booking receipts saved to database and viewable under "My Bookings".

7. **Trilingual Support**:
   - Complete translations for **English**, **Kannada (ಕನ್ನಡ)**, and **Hindi (हिन्दी)**.
   - Translations stored in `src/locales/en.ts`, `src/locales/kn.ts`, and `src/locales/hi.ts`. Choice persisted in `localStorage`.

---

## ⚙️ Supabase Configuration Settings

### Step 1: Authentication Settings
1. Open your [Supabase Project Dashboard](https://supabase.com/dashboard).
2. Go to **Authentication** > **Providers** > **Email**:
   - Confirm that **Email** is **Enabled**.
   - **For Development / Demo**: Turn **"Confirm email" OFF** so newly registered accounts can sign in immediately without waiting for an email confirmation link.
   - *(Turn "Confirm email" back ON before launching in production)*.
3. Phone and Google providers can remain **disabled** (no SMS or OAuth provider is needed).

### Step 2: URL Configuration (Redirects)
1. Go to **Authentication** > **URL Configuration**:
2. Set **Site URL** to:
   ```text
   http://localhost:3000
   ```
3. Under **Redirect URLs**, add:
   ```text
   http://localhost:3000/**
   ```
   *(This wildcard allows password recovery links to redirect cleanly to `/reset-password`)*.
4. Click **Save**.

### Step 3: Run Database Migrations
In your Supabase project dashboard, open the **SQL Editor** and run the following in order:
1. `supabase/migrations/20261031_init_schema.sql` (Creates tables, indexes, pg_trgm extension, and `search_machines` RPC)
2. `supabase/migrations/20261031_cleanup_demo_data.sql` (Cleans legacy data and sets up the `machine-photos` storage bucket)
3. `supabase/migrations/20261031_email_auth_and_activity.sql` (Adds `auth_events` table, triggers, `record_auth_event`, `get_admin_activity`, and RLS policies)

---

## 👑 Granting Administrator Access

To view the **Activity** page and audit logs:
1. Create an account through the app (e.g. `admin@harvestrentals.com`).
2. In your Supabase Dashboard, open the **SQL Editor** and execute:
   ```sql
   UPDATE public.profiles
   SET role = 'admin'
   WHERE email = 'admin@harvestrentals.com';
   ```
3. Refresh the app. The **"Activity"** tab will appear in the navigation bar.

---

## 💻 Running the App

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables in .env
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key

# 3. Start development server
npm run dev

# 4. Production build check
npm run build
```

---

## 🌐 Deploying to Vercel

1. Push your repository to GitHub.
2. In Vercel, import your project.
3. Configure the environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_RAZORPAY_KEY_ID`
4. The included `vercel.json` ensures single-page routing rewrites to `/index.html`. Click **Deploy**.
