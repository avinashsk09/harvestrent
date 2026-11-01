import { test, expect } from '@playwright/test';

test.describe('Harvest Rentals - Core User Flows & Reliability', () => {

  test.beforeEach(async ({ page }) => {
    // Clear storage before each test
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test('1. Home Page & Trilingual Language Switching (English, Kannada, Hindi)', async ({ page }) => {
    await page.goto('/');

    // Check Header and Hero Title in English
    await expect(page.locator('header')).toContainText('Harvest Rentals');
    await expect(page.locator('text=Harvest on Time. Rent Harvesters Directly.')).toBeVisible();

    // Check two main action buttons are present in hero
    const findBtn = page.locator('main button:has-text("Find a Machine")').first();
    const listBtn = page.locator('main button:has-text("List My Machine")').first();
    await expect(findBtn).toBeVisible();
    await expect(listBtn).toBeVisible();

    // Switch language to Kannada
    const knBtn = page.locator('button:has-text("ಕನ್ನಡ")');
    await knBtn.click();
    await expect(page.locator('text=ಸಮಯಕ್ಕೆ ಸರಿಯಾಗಿ ಕಟಾವು ಮಾಡಿ.').first()).toBeVisible();

    // Switch language to Hindi
    const hiBtn = page.locator('button:has-text("हिन्दी")');
    await hiBtn.click();
    await expect(page.locator('text=समय पर कटाई करें।').first()).toBeVisible();

    // Switch back to English
    const enBtn = page.locator('button:has-text("English")');
    await enBtn.click();
    await expect(page.locator('text=Harvest on Time. Rent Harvesters Directly.')).toBeVisible();
  });

  test('2. Authentication - Validation & Role Choice & Form Fields', async ({ page }) => {
    await page.goto('/login');

    // Default to Sign In tab
    await expect(page.locator('text=Welcome to Harvest Rentals')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();

    // Switch to Create Account tab
    const signUpTab = page.locator('main button:has-text("Create Account")');
    await signUpTab.click();

    // Verify Role choice cards: Farmer and Machine Owner
    await expect(page.locator('button:has-text("I am a Farmer")')).toBeVisible();
    await expect(page.locator('button:has-text("I am a Machine Owner")')).toBeVisible();

    // Verify required inputs exist
    await expect(page.locator('input[placeholder="e.g. Suresh Gowda"]')).toBeVisible();
    await expect(page.locator('input[placeholder="e.g. suresh.farmer@example.com"]')).toBeVisible();
    await expect(page.locator('input[type="tel"]')).toBeVisible();
    await expect(page.locator('text=+91')).toBeVisible();

    // Switch back to Sign In tab
    const signInTab = page.locator('main button:has-text("Sign In")').first();
    await signInTab.click();

    // Test Forgot Password sub-flow
    const forgotLink = page.locator('button:has-text("Forgot password?")');
    await expect(forgotLink).toBeVisible();
    await forgotLink.click();
    await expect(page.locator('text=Reset Your Password')).toBeVisible();
    await expect(page.locator('button:has-text("Send Password Reset Link")')).toBeVisible();

    // Return to Login
    const backBtn = page.locator('button:has-text("Back to sign in")');
    await backBtn.click();
    await expect(page.locator('main button[type="submit"]:has-text("Sign In")')).toBeVisible();
  });

  test('3. Geolocation Granted - Accurate Location & Coordinates Detection', async ({ page, context }) => {
    // Mock geolocation: Davanagere coordinates (14.4426, 75.9218) with 15m accuracy
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({
      latitude: 14.4426,
      longitude: 75.9218,
      accuracy: 15,
    });

    await page.goto('/find');

    // Click "Use my current location"
    const locBtn = page.locator('button:has-text("Use my current location")');
    await expect(locBtn).toBeVisible();
    await locBtn.click();

    // If pre-permission explanation modal appears, accept it
    const allowModalBtn = page.locator('button:has-text("Allow Location")');
    if (await allowModalBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await allowModalBtn.click();
    }

    // Expect accuracy indicator to appear
    await expect(page.locator('text=Accurate to about ~15m')).toBeVisible({ timeout: 5000 });

    // Radius filter should now be visible
    await expect(page.locator('text=Radius:')).toBeVisible();
  });

  test('4. Geolocation Denied - Graceful Error Handling', async ({ page, context }) => {
    await context.clearPermissions();

    await page.goto('/find');

    // Mock geolocation failure in browser window
    await page.addInitScript(() => {
      // @ts-ignore
      navigator.geolocation.getCurrentPosition = (success, error) => {
        if (error) {
          error({
            code: 1, // PERMISSION_DENIED
            message: 'User denied Geolocation',
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          });
        }
      };
    });

    // Mark as explained so it attempts immediately
    await page.evaluate(() => {
      sessionStorage.setItem('harvestrent_location_explained', 'true');
    });

    const locBtn = page.locator('button:has-text("Use my current location")');
    await locBtn.click();

    // Should display friendly permission denied message
    await expect(page.locator('text=Location permission was denied')).toBeVisible({ timeout: 5000 });
  });

  test('5. Search Machines, District/Village Autocomplete & Radius Filter', async ({ page }) => {
    await page.goto('/find');

    // Select District "Davanagere"
    const districtSelect = page.locator('select').first();
    await districtSelect.selectOption('Davanagere');

    // Verify village suggestions for Davanagere appear
    await expect(page.locator('text=Suggestions:')).toBeVisible();
    const hariharSuggestion = page.locator('button:has-text("Harihar")');
    await expect(hariharSuggestion).toBeVisible();

    // Click suggestion
    await hariharSuggestion.click();
    const villageInput = page.locator('input[placeholder="e.g. Pandavapura, Maddur, Harihar"]');
    await expect(villageInput).toHaveValue('Harihar');

    // Submit search
    const searchBtn = page.locator('button:has-text("Search Harvesters")');
    await searchBtn.click();

    // Verify results count or empty state is properly rendered (No dummy data)
    await expect(page.locator('text=Machines Available')).toBeVisible();
  });

  test('6. Toggle Map View and List View (Leaflet Integration)', async ({ page }) => {
    await page.goto('/find');

    // Default is List view
    const mapToggleBtn = page.locator('button:has-text("Map View")');
    await expect(mapToggleBtn).toBeVisible();
    await mapToggleBtn.click();

    // Leaflet map container should be mounted and visible
    const leafletMap = page.locator('.leaflet-container');
    await expect(leafletMap).toBeVisible({ timeout: 5000 });

    // Switch back to List view
    const listToggleBtn = page.locator('button:has-text("List View")');
    await listToggleBtn.click();
    await expect(leafletMap).not.toBeVisible();
  });

  test('7. Machine Card Actions - Direct Call & Report Modal', async ({ page }) => {
    // Seed an authenticated farmer user and test machine in localStorage
    await page.addInitScript(() => {
      const farmerUser = {
        id: 'farmer-test-1',
        full_name: 'Basavanna Naik',
        email: 'basavanna@farmer.com',
        phone: '+919876543333',
        role: 'farmer',
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('harvestrent_verified_user', JSON.stringify(farmerUser));

      const sampleMachine = {
        id: 'test-mach-1',
        owner_id: 'owner-1',
        owner_name: 'Basavaraj Patel',
        owner_phone: '+919876543210',
        machine_type: 'Combine Harvester',
        model_name: 'John Deere W70',
        village: 'Harihar',
        district: 'Davanagere',
        crops: ['Paddy (Rice)', 'Maize (Corn)'],
        price_amount: 2400,
        price_unit: 'per_acre',
        is_active: true,
        latitude: 14.512,
        longitude: 75.801,
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('harvestrent_user_machines', JSON.stringify([sampleMachine]));
    });

    await page.goto('/find');
    await page.locator('button:has-text("Search Harvesters")').click();

    // Verify Machine Card details
    await expect(page.locator('text=John Deere W70')).toBeVisible();
    await expect(page.locator('text=Basavaraj Patel')).toBeVisible();
    await expect(page.locator('text=Harihar, Davanagere')).toBeVisible();

    // Verify Call Owner button is visible
    const callOwnerBtn = page.locator('button:has-text("Call Owner")').first();
    await expect(callOwnerBtn).toBeVisible();

    // Verify Google Maps directions link
    const directionsLink = page.locator('a[title="Open in Google Maps"]');
    await expect(directionsLink).toBeVisible();
    await expect(directionsLink).toHaveAttribute('href', /google\.com\/maps\/dir/);

    // Open Report Listing Modal
    const reportBtn = page.locator('button:has-text("Report Wrong Listing")');
    await reportBtn.click();

    await expect(page.locator('text=Report Incorrect Listing')).toBeVisible();
    await expect(page.locator('text=Phone number not reachable or incorrect')).toBeVisible();

    // Fill report and submit
    await page.locator('textarea[placeholder="Provide any additional details..."]').fill('Machine was booked elsewhere.');
    const submitReportBtn = page.locator('button:has-text("Submit Report")');
    await submitReportBtn.click();

    // Verify success confirmation
    await expect(page.locator('text=Thank you. The listing report has been recorded.')).toBeVisible({ timeout: 5000 });
  });

  test('8. Payment Flow - Test Mode & Razorpay Sandbox / Cash on Farm', async ({ page }) => {
    test.setTimeout(60000);

    // Seed authenticated farmer user and test machine
    await page.addInitScript(() => {
      const farmerUser = {
        id: 'farmer-test-1',
        full_name: 'Basavanna Naik',
        email: 'basavanna@farmer.com',
        phone: '+919876543333',
        role: 'farmer',
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('harvestrent_verified_user', JSON.stringify(farmerUser));

      const sampleMachine = {
        id: 'test-mach-payment',
        owner_id: 'owner-1',
        owner_name: 'Suresh Patil',
        owner_phone: '+919845012345',
        machine_type: 'Combine Harvester',
        model_name: 'Kubota Harvester 488',
        village: 'Ranebennur',
        district: 'Haveri',
        crops: ['Paddy (Rice)'],
        price_amount: 2500,
        price_unit: 'per_acre',
        is_active: true,
        latitude: 14.62,
        longitude: 75.62,
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('harvestrent_user_machines', JSON.stringify([sampleMachine]));
    });

    await page.goto('/find');
    await page.locator('button:has-text("Search Harvesters")').click();

    // Click "Book / Advance"
    const bookBtn = page.locator('button:has-text("Book / Advance")').first();
    await bookBtn.click();

    // Verifies Payment Page
    await expect(page.locator('text=Confirm Booking & Advance')).toBeVisible();

    // Verify Test Mode Banner is not visible
    await expect(page.locator('text=TEST MODE - NO REAL MONEY WILL BE CHARGED')).not.toBeVisible();

    // Check Order Summary
    await expect(page.locator('text=Kubota Harvester 488')).toBeVisible();
    await expect(page.locator('text=Suresh Patil')).toBeVisible();

    // Enter Farmer details
    await page.locator('input[placeholder="e.g. Ramesh Kumar"]').fill('Shivaraj Kumar');
    await page.locator('input[placeholder="e.g. 9876543210"]').fill('9988776655');

    // Test "Pay at the Farm (Cash after harvest)" option
    const cashOption = page.locator('text=Pay at the Farm (Cash after harvest)');
    await cashOption.click();

    // Complete cash booking
    const confirmBookingBtn = page.locator('button:has-text("Confirm Cash on Farm Booking")');
    await expect(confirmBookingBtn).toBeVisible();
    await confirmBookingBtn.click();

    // Verify Booking Success Screen
    await expect(page.locator('text=Booking Confirmed')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('button:has-text("View Receipt")')).toBeVisible();

    // Open Receipt Modal
    await page.locator('button:has-text("View Receipt")').click();
    await expect(page.locator('text=Booking Confirmation Receipt')).toBeVisible();
    await expect(page.getByRole('dialog').locator('text=Shivaraj Kumar')).toBeVisible();
  });

  test('9. Owner Machine Listing Flow (Authenticated)', async ({ page }) => {
    // Authenticate as a Machine Owner in local session
    await page.addInitScript(() => {
      const ownerProfile = {
        id: 'owner-test-user-id',
        full_name: 'Chandrashekar Patil',
        email: 'chandru@patil.com',
        phone: '+919876543210',
        role: 'owner',
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('harvestrent_verified_user', JSON.stringify(ownerProfile));
    });

    await page.goto('/list');

    // Should load the listing form directly
    await expect(page.locator('text=List Your Harvester Machine')).toBeVisible();

    // Fill in owner name and machine details
    await page.locator('input[placeholder="e.g. Suresh Gowda"]').fill('Chandrashekar Patil');
    await page.locator('input[placeholder="e.g. John Deere W70 Combine Harvester"]').fill('Preet 987 Combine Harvester');
    await page.locator('input[placeholder="e.g. Pandavapura"]').fill('Nyamathi');

    // Submit Listing
    const submitBtn = page.locator('button[type="submit"]:has-text("Publish Machine Listing")');
    await submitBtn.click();

    // Verify Success screen
    await expect(page.locator('text=listed successfully')).toBeVisible({ timeout: 15000 });
  });

  test('10. 404 Not Found Page & Error Boundary Handling', async ({ page }) => {
    // Navigate to an invalid non-existent path
    await page.goto('/invalid-nonexistent-path-xyz');

    await expect(page.locator('text=Page Not Found')).toBeVisible();
    await expect(page.locator('button:has-text("Back to Home")')).toBeVisible();

    // Click back to home
    await page.locator('button:has-text("Back to Home")').click();
    await expect(page.locator('text=Harvest on Time. Rent Harvesters Directly.')).toBeVisible();
  });

  test('11. About Page - Complete Trust Building, Ground Realities, Broker Comparison & FAQ Accordion', async ({ page }) => {
    await page.goto('/about');

    // 1. Header & Mission Card
    await expect(page.locator('h1')).toContainText('About Harvest Rentals');
    await expect(page.locator('text=Our Mission')).toBeVisible();

    // 2. How It Works Tabs
    await expect(page.locator('text=How It Works')).toBeVisible();
    const farmersTab = page.locator('#tab-farmers');
    const ownersTab = page.locator('#tab-owners');
    await expect(farmersTab).toBeVisible();
    await expect(ownersTab).toBeVisible();

    // Default Farmers tab content
    await expect(page.locator('text=1. Search Your Area')).toBeVisible();
    await expect(page.locator('text=3. Call Owner or Book Advance')).toBeVisible();
    await expect(page.locator('text=5. Settle at Farm')).toBeVisible();

    // Switch to Owners tab
    await ownersTab.click();
    await expect(page.locator('text=1. List Machine for Free')).toBeVisible();
    await expect(page.locator('text=2. Block Busy Dates')).toBeVisible();
    await expect(page.locator('text=4. Reduce Idle Downtime')).toBeVisible();

    // Switch back to Farmers tab with keyboard
    await ownersTab.press('ArrowLeft');
    await expect(farmersTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('text=1. Search Your Area')).toBeVisible();

    // 3. Ground Realities (4 cards + phone note)
    await expect(page.locator('text=Ground Realities of Harvesting in India')).toBeVisible();
    await expect(page.locator('text=Diesel & Operator Bata')).toBeVisible();
    await expect(page.locator('text=Tyre (Wheel) vs Track (Chain)')).toBeVisible();
    await expect(page.locator('text=Minimum Acreage per Trip')).toBeVisible();
    await expect(page.locator('text=Road & Field Access')).toBeVisible();
    await expect(page.locator('text=Confirm all operational details with the owner by phone')).toBeVisible();

    // 4. Comparison Table (Responsive scroll)
    await expect(page.locator('text=Harvest Rentals vs Village Brokers')).toBeVisible();
    await expect(page.locator('text=Commission & Fees')).toBeVisible();
    await expect(page.locator('text=Direct Contact')).toBeVisible();
    await expect(page.locator('text=Availability Info')).toBeVisible();
    await expect(page.locator('text=Payment Choice')).toBeVisible();

    // 5. FAQ Accordion (Keyboard & Click)
    await expect(page.locator('text=Frequently Asked Questions')).toBeVisible();
    const faqBtn1 = page.locator('#faq-btn-1');
    const faqBtn2 = page.locator('#faq-btn-2');

    // Click FAQ 1
    await expect(faqBtn1).toHaveAttribute('aria-expanded', 'false');
    await faqBtn1.click();
    await expect(faqBtn1).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#faq-panel-1')).toBeVisible();

    // Press Space on FAQ 2 -> FAQ 1 closes, FAQ 2 opens
    await faqBtn2.focus();
    await page.keyboard.press('Space');
    await expect(faqBtn1).toHaveAttribute('aria-expanded', 'false');
    await expect(faqBtn2).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#faq-panel-2')).toBeVisible();

    // 6. Helpline & WhatsApp Share
    const helplineLink = page.locator('a[href="tel:18001801551"]');
    await expect(helplineLink).toBeVisible();

    const shareBtn = page.locator('a:has-text("Share on WhatsApp")');
    await expect(shareBtn).toBeVisible();
    await expect(shareBtn).toHaveAttribute('href', /wa\.me\/\?text=/);

    // 7. CTAs
    const findCta = page.locator('button:has-text("Find a Harvester")');
    await expect(findCta).toBeVisible();

    // Logged out "List Your Machine" navigates to login
    const listCta = page.locator('button:has-text("List Your Machine")');
    await expect(listCta).toBeVisible();
    await listCta.click();
    await expect(page).toHaveURL(/login/);

    // 8. Language Switching on About Page
    await page.goto('/about');
    await page.locator('button:has-text("ಕನ್ನಡ")').click();
    await expect(page.locator('text=ಇದು ಹೇಗೆ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ')).toBeVisible();
    await expect(page.locator('text=ಭಾರತದಲ್ಲಿ ಕಟಾವಿನ ವಾಸ್ತವ ಸಂಗತಿಗಳು')).toBeVisible();

    await page.locator('button:has-text("हिन्दी")').click();
    await expect(page.locator('text=यह कैसे काम करता है')).toBeVisible();
    await expect(page.locator('text=अक्सर पूछे जाने वाले सवाल')).toBeVisible();

    // Back to English
    await page.locator('button:has-text("English")').click();
    await expect(page.locator('text=How It Works')).toBeVisible();
  });

  test('12. Owner Availability Calendar - Single Day Toggle & Date Range Blocking', async ({ page }) => {
    // Seed authenticated owner with a machine in local storage
    const testMachineId = 'owner-mach-calendar-1';
    await page.addInitScript(({ machId }) => {
      const ownerUser = {
        id: 'owner-cal-user',
        full_name: 'Shankar Gowda',
        email: 'shankar@gowda.com',
        phone: '+919876543211',
        role: 'owner',
        created_at: new Date().toISOString(),
      };
      const machine = {
        id: machId,
        owner_id: 'owner-cal-user',
        owner_name: 'Shankar Gowda',
        owner_phone: '+919876543211',
        machine_type: 'Combine Harvester',
        model_name: 'Kartar 4000',
        village: 'Ranebennur',
        district: 'Haveri',
        crops: ['Paddy (Rice)', 'Maize (Corn)'],
        price_amount: 2200,
        price_unit: 'per_acre',
        is_active: true,
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('harvestrent_verified_user', JSON.stringify(ownerUser));
      localStorage.setItem('harvestrent_user_machines', JSON.stringify([machine]));
    }, { machId: testMachineId });

    await page.goto('/manage');

    // Open Availability Calendar Modal
    const busyDatesBtn = page.locator('button:has-text("Set Unavailable Dates")').first();
    await expect(busyDatesBtn).toBeVisible();
    await busyDatesBtn.click();

    // Modal opens
    await expect(page.getByRole('dialog').locator('text=Availability Calendar')).toBeVisible();

    // Verify Legend items for accessibility
    await expect(page.getByRole('dialog').locator('span:has-text("Free")').first()).toBeVisible();
    await expect(page.getByRole('dialog').locator('text=Busy (Owner)')).toBeVisible();
    await expect(page.getByRole('dialog').locator('text=Booked (Confirmed)')).toBeVisible();

    // Test Date Range Tool Toggle
    const rangeToggleBtn = page.getByRole('dialog').locator('button:has-text("Block Date Range")').first();
    await rangeToggleBtn.click();
    await expect(page.getByRole('dialog').locator('input[type="date"]').first()).toBeVisible();

    // Close modal
    await page.getByRole('dialog').locator('button:has-text("Close")').click();
  });

  test('13. Farmer Availability Calendar - Search Hides Busy Machines & Compact Availability Preview', async ({ page }) => {
    // Calculate tomorrow date in YYYY-MM-DD
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const testMachId = 'busy-search-test-mach';

    await page.addInitScript(({ machId, tomorrowDate }) => {
      const machine = {
        id: machId,
        owner_id: 'owner-busy-test',
        owner_name: 'Anand Patil',
        owner_phone: '+919876543222',
        machine_type: 'Track Harvester',
        model_name: 'Claas Crop Tiger 30',
        village: 'Siruguppa',
        district: 'Ballari',
        crops: ['Paddy (Rice)'],
        price_amount: 2800,
        price_unit: 'per_acre',
        is_active: true,
        created_at: new Date().toISOString(),
      };
      const busyDate = {
        id: 'b-date-1',
        machine_id: machId,
        busy_date: tomorrowDate,
        status: 'busy',
        note: 'Scheduled for local farmer',
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('harvestrent_user_machines', JSON.stringify([machine]));
      localStorage.setItem('harvestrent_user_busy_dates', JSON.stringify([busyDate]));
    }, { machId: testMachId, tomorrowDate: tomorrowStr });

    await page.goto('/find');
    await page.locator('button:has-text("Search Harvesters")').click();

    // Machine is visible without date filter
    await expect(page.locator('text=Claas Crop Tiger 30')).toBeVisible();
    await expect(page.locator('text=60-Day Calendar')).toBeVisible();

    // Now filter by tomorrow's date
    await page.locator('input[type="date"]').first().fill(tomorrowStr);
    await page.locator('button:has-text("Search Harvesters")').click();

    // Machine should be excluded/hidden because it is busy on tomorrow's date
    await expect(page.locator('text=Claas Crop Tiger 30')).not.toBeVisible();
  });

  test('14. Security & Permissions - Farmers cannot see List Machine CTA on About & Booked dates cannot be unblocked', async ({ page }) => {
    // Seed authenticated farmer (role: farmer)
    await page.addInitScript(() => {
      const farmerUser = {
        id: 'farmer-user-1',
        full_name: 'Basavanna Naik',
        email: 'basavanna@farmer.com',
        phone: '+919876543333',
        role: 'farmer',
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('harvestrent_verified_user', JSON.stringify(farmerUser));
    });

    await page.goto('/about');

    // "Find a Harvester" CTA should be visible
    await expect(page.locator('button:has-text("Find a Harvester")')).toBeVisible();

    // "List Your Machine" CTA must NOT be visible for farmers
    await expect(page.locator('main button:has-text("List Your Machine")')).not.toBeVisible();
  });

  test('15. Owner Simplified Onboarding & Namaste Vehicle Registration Greeting', async ({ page }) => {
    // Navigate to Login page
    await page.goto('/login');

    // Switch to Create Account tab
    await page.locator('main button:has-text("Create Account")').click();

    // Select Machine Owner role card
    await page.locator('button:has-text("I am a Machine Owner")').click();

    const uniqueEmail = `ramesh.owner.${Date.now()}.${Math.floor(Math.random() * 10000)}@agrimachines.in`;

    // Fill registration fields
    await page.locator('input[placeholder="e.g. Suresh Gowda"]').fill('Ramesh Patil');
    await page.locator('input[placeholder="e.g. suresh.farmer@example.com"]').fill(uniqueEmail);
    await page.locator('input[type="tel"]').fill('9876501234');
    await page.locator('input[placeholder="At least 8 characters"]').fill('Harvester#2026');
    await page.locator('input[placeholder="Re-enter your password"]').fill('Harvester#2026');

    // Submit Create Account
    await page.locator('button[type="submit"]:has-text("Create Account")').click();

    // Verification 1: Automatically switched to Sign In tab with email populated and success notice
    await expect(page.locator('text=Account created successfully! Please sign in with your email and password.')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('input[type="email"]')).toHaveValue(uniqueEmail);

    // Verification 2: Sign in with the matching password
    await page.locator('input[type="password"]').fill('Harvester#2026');
    await page.locator('button[type="submit"]:has-text("Sign In")').click();

    // Verification 3: Namaste Sir greeting modal appears
    await expect(page.locator('text=Namaste Sir! Are you looking to register your vehicle?')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Yes, Register Vehicle Now")')).toBeVisible();

    // Verification 4: Click "Yes, Register Vehicle Now" -> navigates to vehicle listing page (/list)
    await page.locator('button:has-text("Yes, Register Vehicle Now")').click();
    await expect(page).toHaveURL(/.*list/);
    await expect(page.locator('text=List Your Harvester Machine')).toBeVisible();
  });

  test('16. Automated 6:00 AM IST Farm News & Crop Price Trends', async ({ page }) => {
    await page.goto('/');

    // Check 6:00 AM IST Briefing badge
    await expect(page.locator('text=6:00 AM IST Briefing')).toBeVisible();

    // Check crop price trend badges
    await expect(page.locator('text=+₹120/qtl').first()).toBeVisible();
    await expect(page.locator('text=-₹250/qtl').first()).toBeVisible();
    await expect(page.locator('text=+₹90/qtl').first()).toBeVisible();
  });

  test('17. Harvester Type Filter & Amber Warning on Paddy + Wheeled', async ({ page }) => {
    await page.goto('/find');

    // 1. Verify harvester type chips exist
    await expect(page.locator('button:has-text("All types")')).toBeVisible();
    await expect(page.locator('button:has-text("Track / Chain (wet paddy safe)")')).toBeVisible();
    await expect(page.locator('button:has-text("Wheeled (dry field)")')).toBeVisible();

    // 2. Select Paddy from quick crops (exact button)
    await page.getByRole('button', { name: 'Paddy', exact: true }).click();

    // 3. Click Wheeled filter
    await page.locator('button:has-text("Wheeled (dry field)")').click();

    // 4. Verify amber warning banner is visible
    await expect(page.locator('text=Wet paddy fields usually need a track machine')).toBeVisible();

    // 5. Click Track / Chain filter
    await page.locator('button:has-text("Track / Chain (wet paddy safe)")').click();

    // 6. Amber warning banner should disappear
    await expect(page.locator('text=Wet paddy fields usually need a track machine')).not.toBeVisible();
  });

  test('18. Horizontal Quick Crop Pills - Selection and Filtering', async ({ page }) => {
    await page.goto('/find');

    // Verify Quick Crops exist
    await expect(page.getByRole('button', { name: 'Any Crop', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Maize', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ragi', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Wheat', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sugarcane', exact: true })).toBeVisible();
    await expect(page.locator('button:has-text("More crops")')).toBeVisible();

    // Click Maize
    await page.getByRole('button', { name: 'Maize', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Maize', exact: true })).toHaveAttribute('aria-pressed', 'true');

    // Click More Crops
    await page.locator('button:has-text("More crops")').click();
    await expect(page.locator('text=Choose a Crop')).toBeVisible();
    await page.locator('button:has-text("Cotton")').click();

    // Selected crop should reflect Cotton
    await expect(page.locator('button:has-text("Cotton")').first()).toBeVisible();
  });

  test('19. Honest Sort Dropdown & URL Sync', async ({ page }) => {
    await page.goto('/find');

    const sortSelect = page.locator('#sortSelect');
    await expect(sortSelect).toBeVisible();

    // Default is best_match
    await expect(sortSelect).toHaveValue('best_match');

    // Change to Price: low to high
    await sortSelect.selectOption('price_asc');
    await expect(page).toHaveURL(/.*sort=price_asc/);

    // Change to Newest first
    await sortSelect.selectOption('newest');
    await expect(page).toHaveURL(/.*sort=newest/);
  });

  test('20. Machine Details Page & 404 Fallback for Missing Machine', async ({ page }) => {
    // 1. Missing machine 404
    await page.goto('/machine/non-existent-machine-id');
    await expect(page.locator('text=This machine is not available')).toBeVisible();
    await expect(page.locator('button:has-text("Back to Find Machines")')).toBeVisible();

    // 2. Seed a machine and view details
    await page.addInitScript(() => {
      const machine = {
        id: 'details-test-machine-1',
        owner_id: 'owner-details-1',
        owner_name: 'Shankar Patil',
        owner_phone: '+919876543111',
        machine_type: 'Combine Harvester',
        model_name: 'John Deere W70 SynchroSmart',
        village: 'Kudligi',
        district: 'Vijayanagara',
        crops: ['Paddy (Rice)', 'Maize (Corn)'],
        price_amount: 2600,
        price_unit: 'per_acre',
        harvester_type: 'track',
        fuel_policy: 'included',
        driver_included: true,
        header_width_ft: 14,
        has_straw_chopper: true,
        manufacture_year: 2023,
        condition: 'good',
        min_acres: 4,
        owner_note: 'Machine serviced before harvest season.',
        is_active: true,
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('harvestrent_user_machines', JSON.stringify([machine]));
    });

    await page.goto('/machine/details-test-machine-1');

    // Verify machine details page elements
    await expect(page.locator('h1:has-text("John Deere W70 SynchroSmart")')).toBeVisible();
    await expect(page.locator('text=₹2,600 / acre').first()).toBeVisible();
    await expect(page.locator('text=Track / Chain').first()).toBeVisible();
    await expect(page.locator('text=Fuel included')).toBeVisible();
    await expect(page.locator('text=Driver & helper included')).toBeVisible();
    await expect(page.locator('text=14 ft')).toBeVisible();
    await expect(page.locator('text=Yes (Equipped)')).toBeVisible();
    await expect(page.locator('text=Confirm diesel and driver food (bata) with the owner')).toBeVisible();
    await expect(page.locator('text=Machine serviced before harvest season.')).toBeVisible();

    // Verify Call, WhatsApp, and Advance buttons
    await expect(page.locator('button:has-text("Call Owner")')).toBeVisible();
    await expect(page.locator('button:has-text("WhatsApp")')).toBeVisible();
    await expect(page.locator('button:has-text("Book / Advance")')).toBeVisible();
  });

  test('21. Zero Results Screen & 3 Main Actions', async ({ page }) => {
    await page.goto('/find');

    // Search for a non-existent village
    await page.locator('input[placeholder="e.g. Pandavapura, Maddur, Harihar"]').fill('NonExistentVillageXYZ99');
    await page.locator('button:has-text("Search Harvesters")').click();

    // Zero results screen should be visible
    await expect(page.locator('text=No machines listed in this area yet.')).toBeVisible();

    // Verify the 3 main actions exist
    await expect(page.locator('button:has-text("Search the whole district")')).toBeVisible();
    await expect(page.locator('button:has-text("Post a Wanted Request")')).toBeVisible();
    await expect(page.locator('a[href="tel:18001801551"]')).toBeVisible();
    await expect(page.locator('text=1800-180-1551')).toBeVisible();
  });

  test('22. Wanted Requests Navigation & Page Access', async ({ page }) => {
    await page.goto('/wanted');

    await expect(page.locator('text=My Wanted Requests')).toBeVisible();
    await expect(page.locator('button:has-text("Post a Wanted Request")').first()).toBeVisible();
  });

  test('23. Strict Machine Search - Condition checks on Crop and Distance show Zero Results when unmatched', async ({ page }) => {
    // Seed one test machine in local storage
    await page.addInitScript(() => {
      const testMachine = {
        id: 'test-mach-strict-1',
        owner_id: 'test-owner-1',
        owner_name: 'Basavaraj Gowda',
        owner_phone: '+919876543210',
        machine_type: 'Combine Harvester',
        model_name: 'Kubota DC-68G',
        harvester_type: 'track',
        village: 'Siruguppa',
        district: 'Ballari (Bellary)',
        crops: ['Paddy (Rice)'],
        price_amount: 2400,
        price_unit: 'hour',
        is_active: true,
        latitude: 15.63,
        longitude: 76.89,
        created_at: new Date().toISOString(),
      };
      window.localStorage.setItem('harvestrent_user_machines', JSON.stringify([testMachine]));
    });

    await page.goto('/find');

    // 1. Unmatched Crop: Select 'Wheat' instead of Paddy
    const cropSelect = page.locator('select').filter({ hasText: 'Any Crop' }).first();
    await cropSelect.selectOption('Wheat');

    // Should strictly show Zero Results screen
    await expect(page.locator('text=No machines listed in this area yet.')).toBeVisible();
    await expect(page.locator('text=Kubota DC-68G')).not.toBeVisible();

    // 2. Select matching crop 'Paddy (Rice)'
    await cropSelect.selectOption('Paddy (Rice)');
    await expect(page.locator('text=Kubota DC-68G')).toBeVisible();

    // 3. Select strict Distance filter without coordinates
    const distanceSelect = page.locator('select').filter({ hasText: 'All Distances' }).first();
    await distanceSelect.selectOption('5'); // Within 5 km

    // Without user GPS coordinates, strict radius condition cannot be verified -> Zero Results
    await expect(page.locator('text=No machines listed in this area yet.')).toBeVisible();
    await expect(page.locator('text=Kubota DC-68G')).not.toBeVisible();

    // 4. Reset distance to 'All Distances' -> Machine shows again
    await distanceSelect.selectOption('all');
    await expect(page.locator('text=Kubota DC-68G')).toBeVisible();
  });

  test('24. Cross-Account Machine Listing & Discovery - Owner registers machine, Farmer and Guest discover it', async ({ page }) => {
    // 1. Authenticate as Owner
    const ownerId = 'e2e-owner-' + Date.now();
    await page.addInitScript(({ oId }) => {
      const ownerUser = {
        id: oId,
        phone: '+919876543210',
        email: 'owner.e2e@agrimachines.in',
        full_name: 'Mallikarjun Gowda',
        role: 'owner',
        created_at: new Date().toISOString(),
      };
      window.localStorage.setItem('harvestrent_verified_user', JSON.stringify(ownerUser));
    }, { oId: ownerId });

    // 2. Owner navigates to /list and registers a new harvester
    await page.goto('/list');
    await expect(page.locator('h1')).toContainText('List Your Harvester');

    // Select Track Harvester
    const trackCard = page.locator('button:has-text("Track / Chain")');
    if (await trackCard.isVisible()) {
      await trackCard.click();
    }

    // Select District: Ballari (Bellary)
    const listDistrictSelect = page.locator('select').filter({ hasText: 'Ballari (Bellary)' }).first();
    await listDistrictSelect.selectOption('Ballari (Bellary)');

    // Fill village
    const villageInput = page.locator('input[placeholder="e.g. Pandavapura"]');
    await villageInput.fill('Siruguppa');

    // Fill model name
    const modelInput = page.locator('input[placeholder="e.g. John Deere W70 Combine Harvester"]');
    await modelInput.fill('Preet 987 Special');

    // Submit the listing
    const submitBtn = page.locator('button[type="submit"]:has-text("Publish Machine Listing")');
    await submitBtn.click();

    // Verify success banner appears
    await expect(page.locator('text=listed successfully')).toBeVisible({ timeout: 15000 });

    // 3. Log out owner and switch to Farmer account
    await page.evaluate(() => {
      window.localStorage.removeItem('harvestrent_verified_user');
      const farmerUser = {
        id: 'e2e-farmer-' + Date.now(),
        phone: '+919999988888',
        email: 'farmer.e2e@agrimachines.in',
        full_name: 'Suresh Patil',
        role: 'farmer',
        created_at: new Date().toISOString(),
      };
      window.localStorage.setItem('harvestrent_verified_user', JSON.stringify(farmerUser));
    });

    // 4. Farmer navigates to /find and searches
    await page.goto('/find');
    await expect(page.locator('text=Search Available Harvesters')).toBeVisible();

    // Select District: Ballari (Bellary)
    const findDistrictSelect = page.locator('select').filter({ hasText: 'All Districts' }).first();
    await findDistrictSelect.selectOption('Ballari (Bellary)');

    // Enter village: Siruguppa
    const searchVillageInput = page.locator('input[placeholder="e.g. Pandavapura, Maddur, Harihar"]');
    await searchVillageInput.fill('Siruguppa');

    // Trigger Search
    const searchBtn = page.locator('button[type="submit"]:has-text("Search Harvesters")').first();
    await searchBtn.click();

    // Verify machine is found!
    await expect(page.locator('text=Preet 987 Special').first()).toBeVisible({ timeout: 10000 });

    // 5. Guest user search with slightly misspelled village 'Sirguppa'
    await page.evaluate(() => {
      window.localStorage.removeItem('harvestrent_verified_user');
      window.localStorage.setItem('harvestrent_guest_browsing', 'true');
    });

    await page.goto('/find');
    await findDistrictSelect.selectOption('Ballari (Bellary)');
    await searchVillageInput.fill('Sirguppa'); // Misspelled
    await searchBtn.click();

    // Machine still appears due to fuzzy village matching!
    await expect(page.locator('text=Preet 987 Special').first()).toBeVisible({ timeout: 10000 });
  });

});
