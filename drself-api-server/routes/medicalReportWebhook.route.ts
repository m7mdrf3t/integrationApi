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
    console.log('DEBUG: Checking required fields...');
    console.log('DEBUG: payload.record.file_url:', payload.record.file_url);
    console.log('DEBUG: payload.record.user_id:', payload.record.user_id);
    console.log('DEBUG: payload.record keys:', Object.keys(payload.record));
    
    if (!payload.record.file_url || !payload.record.user_id) {
      console.log('DEBUG: Missing required fields detected');
      console.log('DEBUG: file_url exists:', !!payload.record.file_url);
      console.log('DEBUG: user_id exists:', !!payload.record.user_id);
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
    let userContact: { 
      email?: string; 
      phone?: string; 
      buildup_user_id?: string;
      gender?: string;
      age?: number;
      date_of_birth?: string;
      weight?: number;
      height?: number;
    } = {};
    try {
      // Fetch from 'medical_history' table (existing logic)
      console.log('=== MEDICAL HISTORY DEBUG ===');
      console.log('Querying medical_history for user_id:', record.user_id);
      const { data: userData, error: userError } = await supabase
        .from('medical_history')
        .select('blood_type')
        .eq('user_id', record.user_id)
        .single();
      console.log('Medical history query result:', { userData, userError });
      if (!userError && userData) {
        userProfile = userData;
        console.log('Medical history data assigned to userProfile:', userProfile);
      } else {
        console.log('No medical history data found or error occurred');
      }

      // Fetch from 'profiles' table for number and email
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('email, phone, buildup_user_id , gender, age, weight, height')
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
  console.log('WARNING: User does not have a buildup_user_id. Skipping Buildup gateway call.');
  return res.status(200).json({
    success: true,
    event_type: payload.type,
    user_id: record.user_id,
    file_url: record.file_url,
    message: 'Webhook processed successfully but Buildup gateway call skipped due to missing buildup_user_id',
    buildup_gateway_status: 'SKIPPED',
    buildup_gateway_response: 'User does not have buildup_user_id',
    sent_payload: null
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
      console.log('=== FOOD SUPPLEMENT PARSING DEBUG ===');
      console.log('Original food_supplement:', record.food_supplement);
      
      try {
        const parsed = JSON.parse(record.food_supplement);
        console.log('Parsed JSON:', parsed);
        
        if (Array.isArray(parsed)) {
          foodSupplementArray = parsed.map((item: any) => {
            console.log('Processing item:', item, 'Type:', typeof item);
            
            // If item is already an object with name, dosage, frequency
            if (typeof item === 'object' && item !== null) {
              const result = {
                name: item.name || item.Name || '',
                dosage: item.dosage || item.Dosage || '',
                frequency: item.frequency || item.Frequency || ''
              };
              console.log('Object result:', result);
              return result;
            }
            // If item is a string, parse it
            if (typeof item === 'string') {
              // Try to match pattern like "Glutathione 250mg Once daily"
              const match = item.match(/^(.+?)\s+(\d+\s*\w+)\s*-?\s*(.+)$/);
              if (match) {
                const result = { 
                  name: match[1].trim(), 
                  dosage: match[2].trim(), 
                  frequency: match[3].trim() 
                };
                console.log('String match result:', result);
                return result;
              }
              // If no match, treat the whole string as name
              const result = { 
                name: item.trim(), 
                dosage: '', 
                frequency: '' 
              };
              console.log('String no-match result:', result);
              return result;
            }
            return { name: '', dosage: '', frequency: '' };
          });
        } else {
          foodSupplementArray = [];
        }
      } catch (e) {
        console.error("Error parsing food_supplement:", e);
        // Fallback to comma-separated parsing
        foodSupplementArray = record.food_supplement.split(',').map((item: string) => {
          const match = item.match(/^(.+?)\s+(\d+\s*\w+)\s*-?\s*(.+)$/);
          return match
            ? { name: match[1].trim(), dosage: match[2].trim(), frequency: match[3].trim() }
            : { name: item.trim(), dosage: '', frequency: '' };
        });
      }
      
      console.log('Final foodSupplementArray:', JSON.stringify(foodSupplementArray, null, 2));
    }

    // Parse providerFindings
    let providerFindings: any[] = [];
    if (record.life_style) {
      try {
        const parsed = JSON.parse(record.life_style);
        if (Array.isArray(parsed)) {
          providerFindings = parsed.map((htmlString: string) => {
            // Extract displayTitle (text within the first <strong> tag with color red)
            const titleMatch = htmlString.match(/<strong[^>]*color:\s*rgb\(255,\s*0,\s*0\)[^>]*>([^<]+)<\/strong>/i);
            const displayTitle = titleMatch ? decodeHtmlEntities(stripHtmlAndNormalize(titleMatch[1])) : 'Title to be displayed in mobile';

            // Extract description (text between first <p> after title and before Symptoms or next strong tag)
            let shortDescription = null;
            let longDescription = null;
            
            // Find all paragraphs and extract the description from the second paragraph
            const paragraphs = htmlString.match(/<p>.*?<\/p>/g) || [];
            if (paragraphs.length > 1) {
              // Get the second paragraph (first one after title)
              const secondParagraph = paragraphs[1];
              const cleanDesc = decodeHtmlEntities(stripHtmlAndNormalize(secondParagraph.replace(/<\/?p>/g, '')));
              // Check if this paragraph contains meaningful content (not just styling or symptoms)
              if (cleanDesc && 
                  !cleanDesc.includes('<strong>') && 
                  !cleanDesc.includes('rgb') && 
                  !cleanDesc.includes('color') &&
                  cleanDesc.length > 10) {
                shortDescription = cleanDesc;
                longDescription = cleanDesc;
              }
            }

            // Extract symptoms (all list items after Symptoms heading)
            const symptoms: string[] = [];
            const symptomSectionMatch = htmlString.match(/<strong[^>]*>\s*Symptoms[^<]*<\/strong>.*?<ul[^>]*>(.*?)<\/ul>/i);
            if (symptomSectionMatch) {
              const liMatches = symptomSectionMatch[1].match(/<li>(.*?)<\/li>/g) || [];
              symptoms.push(...liMatches.map(li => 
                decodeHtmlEntities(stripHtmlAndNormalize(li.replace(/<[^>]*>/g, '')))
              ));
            }

            // Extract recommendation title (first green heading after symptoms)
            const recTitleMatch = htmlString.match(/<strong[^>]*color:\s*rgb\(51,\s*153,\s*102\)[^>]*>([^<]+)<\/strong>/i);
            const recommendationDisplayTitle = recTitleMatch 
              ? decodeHtmlEntities(stripHtmlAndNormalize(recTitleMatch[1])) 
              : displayTitle;

            // Extract all recommendations (all list items after the first green heading)
            const recommendations: string[] = [];
            const recSections = htmlString.split(/<strong[^>]*color:\s*rgb\(51,\s*153,\s*102\)[^>]*>/i);
            
            // Skip the first section (before first green heading) and process the rest
            for (let i = 1; i < recSections.length; i++) {
              const section = recSections[i];
              const listMatch = section.match(/<ul[^>]*>(.*?)<\/ul>/i);
              if (listMatch) {
                const liMatches = listMatch[1].match(/<li>(.*?)<\/li>/g) || [];
                liMatches.forEach(li => {
                  const cleanText = decodeHtmlEntities(stripHtmlAndNormalize(li.replace(/<[^>]*>/g, '')));
                  if (cleanText) {
                    recommendations.push(cleanText);
                  }
                });
              }
            }
            
            return {
              displayTitle,
              shortDescription,
              description: longDescription, // Add description field
              longDescription,
              symptoms,
              recommendationDisplayTitle,
              recommendations
            };
          });
        }
      } catch (e) {
        console.error("Error parsing life_style:", e);
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

    // Helper function to format dates to ISO 8601
    const formatToISO = (dateString: string | null | undefined): string | null => {
      if (!dateString) return null;
      try {
        return new Date(dateString).toISOString();
      } catch {
        return dateString; // Return original if parsing fails
      }
    };

    // Build patientInfo and scanInfo
    console.log('=== PATIENT INFO MAPPING DEBUG ===');
    console.log('userProfile.blood_group:', userProfile.blood_group);
    console.log('record.blood_group:', record.blood_group);
    console.log('userProfile:', userProfile);
    console.log('userContact:', userContact);
    
    const patientInfo = {
      email: userContact.email || userProfile.email || record.email || null,
      userId: userContact.buildup_user_id,
      gender: userContact.gender || userProfile.gender || record.gender || null,
      age: userContact.age || userProfile.age || record.age || null,
      dateOfBirth: formatToISO(userContact.date_of_birth || userProfile.date_of_birth || record.date_of_birth),
      dateOfTest: formatToISO(record.created_at),
      bloodGroup: userProfile.blood_type || record.blood_group || null,
      weightKg: userContact.weight || userProfile.weight_kg || record.weight_kg || null,
      heightM: userContact.height || userProfile.height_m || record.height_m || null
    };
    
    console.log('Final patientInfo.bloodGroup:', patientInfo.bloodGroup);
    
    // Debug scanInfo mapping
    console.log('=== SCAN INFO DEBUG ===');
    console.log('record.description:', record.description);
    console.log('record.title:', record.title);
    console.log('record.report_date:', record.report_date);
    console.log('record.summary_status:', record.summary_status);
    console.log('record.summary:', record.summary);
    console.log('record.doctor_name:', record.doctor_name);
    console.log('record.hospital_name:', record.hospital_name);
    console.log('record.file_url:', record.file_url);
    
    const scanInfo = {
      title: record.title,
      description: record.description,
      reportDate: formatToISO(record.report_date),
      summaryStatus: record.summary_status,
      summary: record.summary,
      summaryGeneratedAt: formatToISO(record.summary_generated_at),
      doctorName: record.doctor_name,
      hospitalName: record.hospital_name,
      fileUrl: record.file_url
    };
    
    console.log('Final scanInfo:', scanInfo);

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

    // Final safety check: Ensure user has buildup_user_id before sending to gateway
    if (!userContact.buildup_user_id) {
      console.log('FINAL CHECK: User does not have buildup_user_id. Skipping Buildup gateway call.');
      return res.json({
        success: true,
        event_type: payload.type,
        user_id: record.user_id,
        file_url: record.file_url,
        message: 'Webhook processed successfully but Buildup gateway call skipped due to missing buildup_user_id',
        buildup_gateway_status: 'SKIPPED',
        buildup_gateway_response: 'User does not have buildup_user_id',
        sent_payload: null
      });
    }

    // Check if all required parameters are present
    const requiredParameters = {
      life_style: record.life_style,
      food_supplement: record.food_supplement,
      life_recommendation: record.life_recommendation
    };

    const missingParameters = Object.entries(requiredParameters)
      .filter(([key, value]) => !value || value === null || value === undefined || value === '')
      .map(([key]) => key);

    if (missingParameters.length > 0) {
      console.log('FINAL CHECK: Missing required parameters. Skipping Buildup gateway call.');
      console.log('Missing parameters:', missingParameters);
      return res.json({
        success: true,
        event_type: payload.type,
        user_id: record.user_id,
        file_url: record.file_url,
        message: `Webhook processed successfully but Buildup gateway call skipped due to missing required parameters: ${missingParameters.join(', ')}`,
        buildup_gateway_status: 'SKIPPED',
        buildup_gateway_response: `Missing required parameters: ${missingParameters.join(', ')}`,
        sent_payload: null,
        missing_parameters: missingParameters
      });
    }

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

function stripHtmlAndNormalize(html: string): string {
  return html
      .replace(/<[^>]*>/g, '') // Remove all HTML tags
      .replace(/\s+/g, ' ')   // Replace multiple spaces/newlines with a single space
      .trim();                 // Trim leading/trailing whitespace
}

function decodeHtmlEntities(text: string): string {
  const entities: { [key: string]: string } = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'"
  };
  return text.replace(/&[#]?\w+;/g, (match) => entities[match] || match);
}

export default router;