import { Router } from 'express';

const router = Router();

// --- Supabase client for user profile lookup ---
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

// OAuth token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

// Function to get OAuth token
async function getOAuthToken(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  try {
    console.log('Getting new OAuth token...');
    
    const tokenResponse = await fetch('https://sts.x-inity.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'client_id=dr_self&client_secret=]SKI8NAJaGrc1ai&grant_type=client_credentials'
    });

    if (!tokenResponse.ok) {
      throw new Error(`Token request failed: ${tokenResponse.status} ${tokenResponse.statusText}`);
    }

    const tokenData = await tokenResponse.json();
    
    // Cache the token (expires in 1 hour, but we'll refresh after 50 minutes)
    const expiresAt = Date.now() + (50 * 60 * 1000); // 50 minutes
    cachedToken = {
      token: tokenData.access_token,
      expiresAt
    };

    console.log('OAuth token obtained successfully');
    return tokenData.access_token;
  } catch (error) {
    console.error('Error getting OAuth token:', error);
    throw error;
  }
}

router.post('/medical-report-webhook', async (req, res) => {
  console.log('V2.1 - MAPPING BUILDUP_USER_ID - Webhook triggered.'); // <-- Version-specific log
  console.log('Medical report webhook endpoint triggered');
  
  // Require custom auth header (same as other routes)
  const customKey = req.headers['x-drself-auth'];
  const expectedKey = process.env.DRSELF_API_KEY;
  if (!customKey || customKey !== expectedKey) {
    return res.status(401).json({ error: 'Authorization header required' });
  }
  
  try {
    const payload = req.body;
    console.log('Webhook payload received:', JSON.stringify(payload, null, 2));

    // Validate payload structure
    if (!payload.type || !payload.record) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid payload structure' 
      });
    }

    // Only process INSERT and UPDATE events
    if (payload.type !== 'INSERT' && payload.type !== 'UPDATE') {
      return res.json({ 
        success: false, 
        message: 'Event type not supported' 
      });
    }

    // Check if we have the required fields
    if (!payload.record.file_url || !payload.record.user_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: file_url or user_id' 
      });
    }

    const record = payload.record;
    
    console.log(`Processing ${payload.type} event for user: ${record.user_id}, file: ${record.file_url}`);

    // Get OAuth token
    const accessToken = await getOAuthToken();

    // --- Start of Enhanced Mapping Logic ---
    // 1. Get user profile from Supabase (if needed)
    let userProfile: any = {};
    let userContact: { email?: string; phone?: string; buildup_user_id?: string } = {};
    try {
      // Fetch from 'users' table (existing logic)
      const { data: userData, error: userError } = await supabase
        .from('medical_history')
        .select('blood_type')
        .eq('id', record.user_id)
        .single();
      if (!userError && userData) userProfile = userData;

      // Fetch from 'profiles' table for number and email
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('email, phone, buildup_user_id')
        .eq('id', record.user_id)
        .single();
      console.log('[DEBUG] Supabase profiles query result:', { profileData, profileError });

      // --- NEW: Hard failure if profile is not found ---
      if (profileError || !profileData) {
        console.error('CRITICAL: Could not find user profile in `profiles` table for user_id:', record.user_id);
        return res.status(404).json({
          success: false,
          error: `User profile not found for user_id: ${record.user_id}`
        });
      }

      userContact = profileData;

// --- CRUCIAL: Check for buildup_user_id before proceeding ---
if (!profileError && profileData && !profileData.buildup_user_id) {
  return res.status(400).json({
    success: false,
    error: 'User does not have a buildup_user_id in profiles table. Buildup Health Finding endpoint will not be called.'
  });
}
    } catch (err) {
      console.warn('Could not fetch user profile or contact:', err);
    }

    // Parse ivDrip as array of objects { name, dosage, frequency }
    let ivDripArray: any[] = [];
    if (record.iv_drip) {
      try {
        const parsed = JSON.parse(record.iv_drip);
        if (Array.isArray(parsed)) {
          ivDripArray = parsed.map((item: any) => ({
            name: item.name || item.Name || '',
            dosage: item.dosage || item.Dosage || '',
            frequency: item.frequency || item.Frequency || ''
          }));
        } else {
          ivDripArray = [];
        }
      } catch {
        ivDripArray = record.iv_drip.split(',').map((item: string) => {
          const parts = item.trim().split(' ');
          return {
            name: parts.slice(0, -2).join(' '),
            dosage: parts[parts.length - 2] || '',
            frequency: parts[parts.length - 1] || 'Once'
          };
        });
      }
    }

    // Parse foodSupplement as array of objects { name, dosage, frequency }
    let foodSupplementArray: any[] = [];
    if (record.food_supplement) {
      try {
        const parsed = JSON.parse(record.food_supplement);
        if (Array.isArray(parsed)) {
          foodSupplementArray = parsed.map((item: any) => ({
            name: item.name || item.Name || '',
            dosage: item.dosage || item.Dosage || '',
            frequency: item.frequency || item.Frequency || ''
          }));
        } else {
          foodSupplementArray = [];
        }
      } catch {
        foodSupplementArray = record.food_supplement.split(',').map((item: string) => {
          const match = item.match(/^(.+?)\s+(\d+\s*\w+)\s*-?\s*(.+)$/);
          return match
            ? { name: match[1].trim(), dosage: match[2].trim(), frequency: match[3].trim() }
            : { name: item.trim(), dosage: '', frequency: '' };
        });
      }
    }

    // Parse providerFindings
    let providerFindings: any[] = [];
    if (record.life_style) {
      try {
        const parsed = JSON.parse(record.life_style);
        providerFindings = parsed.map((item: any) => ({
          displayTitle: item.displayTitle || item.title || 'Title to be displayed in mobile',
          shortDescription: item.shortDescription || item.description || null,
          longDescription: item.longDescription || item.description || null,
          symptoms: item.symptoms || [],
          recommendationDisplayTitle: item.recommendationDisplayTitle || item.displayTitle || 'Title to be displayed in mobile',
          recommendations: item.recommendations || []
        }));
      } catch {
        providerFindings = [];
      }
    }

    // Parse providerRecommendations
    let providerRecommendationsArray: any[] = [];
    if (record.life_recommendation) {
      try {
        const parsed = JSON.parse(record.life_recommendation);
        providerRecommendationsArray = parsed.map((category: any) => ({
          title: category.title || '',
          recommendation: Array.isArray(category.recommendation)
            ? category.recommendation.map((rec: string) =>
                rec.replace(/<\/?p>/g, '').replace(/<\/?strong>/g, '').replace(/<br>/g, '\n').trim()
              )
            : []
        }));
      } catch {
        providerRecommendationsArray = [];
      }
    }

    // Build patientInfo and scanInfo
    const patientInfo = {
      email: userContact.email || record.email || userProfile.email || null,
      number: userContact.phone || null,
      userId: userContact.buildup_user_id,
      gender: record.gender || userProfile.gender || null,
      age: record.age || userProfile.age || null,
      date_of_birth: record.date_of_birth || userProfile.date_of_birth || null,
      date_of_test: record.date_of_test || null,
      blood_group: record.blood_group || userProfile.blood_group || null,
      weight_kg: record.weight_kg || userProfile.weight_kg || null,
      height_m: record.height_m || userProfile.height_m || null
    };
    const scanInfo = {
      title: record.title,
      description: record.description,
      report_date: record.report_date,
      summary_status: record.summary_status,
      summary: record.summary,
      summary_generated_at: record.summary_generated_at,
      doctor_name: record.doctor_name,
      hospital_name: record.hospital_name,
      file_url: record.file_url
    };

    // Compose the final nested payload

    const buildupPayload = {
      id: record.id,
      patientInfo,
      scanInfo,
      ivDrip: ivDripArray,
      foodSupplement: foodSupplementArray,
      providerFindings,
      providerRecommendations: providerRecommendationsArray
    };

    // --- End of Unified Mapping Logic ---

    console.log('Sending mapped payload to Buildup gateway:', JSON.stringify(buildupPayload, null, 2));

    // Send to Buildup gateway
    const webhookResponse = await fetch(
      'https://buildup-gateway.x-inity.com/IntegrationAPI/v1/HealthInsights/Submit',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(buildupPayload)
      }
    );

    const webhookResult = await webhookResponse.text();
    
    console.log('Buildup gateway response:', {
      status: webhookResponse.status,
      statusText: webhookResponse.statusText,
      body: webhookResult
    });

    // Return response with nested payload
    return res.json({
      success: true,
      event_type: payload.type,
      user_id: record.user_id,
      file_url: record.file_url,
      buildup_gateway_status: webhookResponse.status,
      buildup_gateway_response: webhookResult,
      sent_payload: buildupPayload
    });

  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;