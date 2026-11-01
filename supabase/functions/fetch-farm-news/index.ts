// Supabase Edge Function: fetch-farm-news
// Fetches genuine farming news from official & verified agricultural RSS feeds,
// stores them in news_items, logs the run in news_runs, and dispatches a 6 AM email digest via Resend.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Verified agricultural RSS feeds
const RSS_FEEDS = [
  { name: 'Krishi Jagran', url: 'https://krishijagran.com/feeds/rss/' },
  { name: 'The Hindu Agriculture', url: 'https://www.thehindu.com/sci-tech/agriculture/feeder/default.rss' },
  { name: 'Down To Earth', url: 'https://www.downtoearth.org.in/rss/agriculture' },
  { name: 'ICAR', url: 'https://icar.org.in/rss.xml' },
];

const FARMING_KEYWORDS = [
  'crop', 'harvest', 'paddy', 'rice', 'ragi', 'wheat', 'sugarcane', 'cotton',
  'millet', 'weather', 'rain', 'monsoon', 'mandi', 'price', 'msp', 'kisan',
  'farmer', 'farming', 'agriculture', 'tractor', 'harvester', 'machinery',
  'fertilizer', 'subsidy', 'scheme', 'pest', 'soil', 'irrigation', 'karnataka',
];

interface ParsedItem {
  title: string;
  source_name: string;
  source_url: string;
  summary: string;
  image_url?: string;
  published_at: string;
}

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!match) return '';
  return match[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function extractImageUrl(itemXml: string): string | undefined {
  const mediaMatch = itemXml.match(/<media:content[^>]+url=["']([^"']+)["']/i);
  if (mediaMatch) return mediaMatch[1];

  const encMatch = itemXml.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image/i);
  if (encMatch) return encMatch[1];

  const imgTagMatch = itemXml.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgTagMatch) return imgTagMatch[1];

  return undefined;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const resendApiKey = Deno.env.get('RESEND_API_KEY') || '';

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const now = Date.now();
  const fortyEightHoursAgo = now - 48 * 60 * 60 * 1000;

  const collectedItems: ParsedItem[] = [];
  const errors: string[] = [];

  // 1. Fetch and parse each RSS feed
  for (const feed of RSS_FEEDS) {
    try {
      const resp = await fetch(feed.url, {
        headers: {
          'User-Agent': 'HarvestRentals-NewsFetcher/1.0 (contact@harvestrentals.in)',
          'Accept': 'application/rss+xml, application/xml, text/xml',
        },
      });

      if (!resp.ok) {
        errors.push(`${feed.name}: HTTP ${resp.status}`);
        continue;
      }

      const xmlText = await resp.text();
      const itemBlocks = xmlText.match(/<item[\s\S]*?<\/item>/gi) || [];

      for (const itemXml of itemBlocks) {
        const title = extractTag(itemXml, 'title');
        const link = extractTag(itemXml, 'link') || extractTag(itemXml, 'guid');
        const summary = extractTag(itemXml, 'description');
        const pubDateStr = extractTag(itemXml, 'pubDate');
        const imageUrl = extractImageUrl(itemXml);

        if (!title || !link) continue;

        // Parse date
        const pubTimestamp = pubDateStr ? new Date(pubDateStr).getTime() : now;
        if (isNaN(pubTimestamp) || pubTimestamp < fortyEightHoursAgo) {
          continue; // skip older than 48 hours
        }

        // Validate agricultural relevance
        const fullContent = `${title} ${summary}`.toLowerCase();
        const isAgri = FARMING_KEYWORDS.some((kw) => fullContent.includes(kw));
        if (!isAgri) continue;

        collectedItems.push({
          title,
          source_name: feed.name,
          source_url: link,
          summary: summary.slice(0, 300),
          image_url: imageUrl,
          published_at: new Date(pubTimestamp).toISOString(),
        });
      }
    } catch (err: any) {
      errors.push(`${feed.name}: ${err.message}`);
    }
  }

  // 2. Deduplicate items by source_url
  const uniqueItemsMap = new Map<string, ParsedItem>();
  for (const item of collectedItems) {
    if (!uniqueItemsMap.has(item.source_url)) {
      uniqueItemsMap.set(item.source_url, item);
    }
  }
  const uniqueItems = Array.from(uniqueItemsMap.values());

  // 3. Insert genuine items into news_items table
  let insertedCount = 0;
  for (const item of uniqueItems) {
    const { error: insErr } = await supabase.from('news_items').upsert(
      {
        title: item.title,
        source_name: item.source_name,
        source_url: item.source_url,
        summary: item.summary,
        image_url: item.image_url,
        published_at: item.published_at,
        state: 'Karnataka',
        category: 'agriculture',
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'source_url', ignoreDuplicates: true }
    );

    if (!insErr) {
      insertedCount++;
    }
  }

  // 4. Send daily email via Resend to subscribed users
  let emailsSent = 0;
  if (resendApiKey && uniqueItems.length > 0) {
    try {
      const { data: subscribers } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('email_news_subscribed', true)
        .not('email', 'is', null);

      const top5Headlines = uniqueItems.slice(0, 5);
      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1A211D; background: #F5F0E1; padding: 24px; border-radius: 8px;">
          <div style="background: #0F3D26; color: white; padding: 16px; border-radius: 6px; text-align: center;">
            <h1 style="margin: 0; font-size: 20px;">🌾 Harvest Rentals Farm News</h1>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #F5F0E1;">Daily 6:00 AM Agricultural Briefing</p>
          </div>
          <div style="margin-top: 20px; background: white; padding: 20px; border-radius: 6px; border: 1px solid #DED7C4;">
            <h2 style="font-size: 16px; color: #0F3D26; margin-top: 0;">Top Headlines for Farmers</h2>
            <ul style="padding-left: 18px; line-height: 1.6; font-size: 14px;">
              ${top5Headlines
                .map(
                  (h) => `
                <li style="margin-bottom: 12px;">
                  <strong style="color: #0F3D26;">${h.title}</strong>
                  <br />
                  <span style="font-size: 12px; color: #526359;">Source: ${h.source_name}</span> &bull; 
                  <a href="${h.source_url}" target="_blank" style="color: #2E7D4F; font-size: 12px; font-weight: bold;">Read article &rarr;</a>
                </li>
              `
                )
                .join('')}
            </ul>
          </div>
          <div style="margin-top: 16px; text-align: center; font-size: 11px; color: #738077;">
            Harvest Rentals &bull; Connect directly with local harvester owners &bull; No middleman fees
          </div>
        </div>
      `;

      for (const sub of subscribers || []) {
        if (!sub.email) continue;
        const resendResp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Harvest Rentals <onboarding@resend.dev>',
            to: sub.email,
            subject: "🌾 Today's 6:00 AM Farm News - Harvest Rentals",
            html: emailHtml,
          }),
        });

        if (resendResp.ok) {
          emailsSent++;
        }
      }
    } catch (mailErr: any) {
      errors.push(`Email delivery notice: ${mailErr.message}`);
    }
  }

  // 5. Log run to news_runs
  await supabase.from('news_runs').insert({
    run_at: new Date().toISOString(),
    items_fetched: insertedCount,
    emails_sent: emailsSent,
    error_log: errors.length > 0 ? errors.join('; ') : null,
  });

  return new Response(
    JSON.stringify({
      success: true,
      items_collected: uniqueItems.length,
      items_saved: insertedCount,
      emails_sent: emailsSent,
      errors,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    }
  );
});

