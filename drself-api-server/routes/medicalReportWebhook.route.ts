import { Router } from 'express';

const router = Router();

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

    const { 
      file_url, 
      user_id, 
      title, 
      status, 
      description,
      id,
      iv_drip,
      summary,
      diet_plan,
      blood_test,
      created_at,
      life_style,
      updated_at,
      doctor_name,
      report_date,
      hospital_name,
      summary_status,
      food_supplement,
      life_recommendation,
      summary_generated_at
    } = payload.record;
    
    console.log(`Processing ${payload.type} event for user: ${user_id}, file: ${file_url}`);

    // Get OAuth token
    const accessToken = await getOAuthToken();

    // Prepare the payload for Buildup gateway
    const buildupPayload = {
      id,
      title,
      status,
      iv_drip,
      summary,
      user_id,
      file_url,
      diet_plan,
      blood_test,
      created_at,
      life_style,
      updated_at,
      description,
      doctor_name,
      report_date,
      hospital_name,
      summary_status,
      food_supplement,
      life_recommendation,
      summary_generated_at,
      event_type: payload.type,
      timestamp: new Date().toISOString()
    };

    console.log('Sending payload to Buildup gateway:', JSON.stringify(buildupPayload, null, 2));

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

    // Return response
    return res.json({
      success: true,
      event_type: payload.type,
      user_id,
      file_url,
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