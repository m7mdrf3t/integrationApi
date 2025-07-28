import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { ResponseHandler } from '../utils/responseHandler';

const router = Router();

router.post('/medical-report-webhook', async (req, res) => {
  console.log('Medical report webhook endpoint triggered');
  try {
    const supabaseClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const payload = req.body;
    console.log('Webhook payload received:', JSON.stringify(payload, null, 2));

    if ((payload.type === 'INSERT' || payload.type === 'UPDATE') && payload.record && payload.record.file_url) {
      const fileUrl = payload.record.file_url;
      const userId = payload.record.user_id; // Use user_id instead of id (which is the medical report ID)

      console.log(`Processing record for user: ${userId}, file: ${fileUrl}`);

      if (!userId) {
        console.log('No user_id found in the medical report');
        return res.status(400).json({ success: false, error: 'No user_id found' });
      }

      // First, let's check what we're querying for
      console.log(`Querying profiles table for id: ${userId}`);
      
      const { data: profileData, error: profileError } = await supabaseClient
        .from('profiles')
        .select('buildup_user_id, id')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        
        // Let's also check what profiles exist in the database
        const { data: allProfiles, error: listError } = await supabaseClient
          .from('profiles')
          .select('id, buildup_user_id')
          .limit(5);
        
        if (listError) {
          console.error('Error listing profiles:', listError);
        } else {
          console.log('Available profiles (first 5):', allProfiles);
        }
        
        return res.status(500).json({ 
          success: false, 
          error: 'Profile fetch error', 
          details: profileError.message,
          searched_for: userId
        });
      }

      if (profileData && profileData.buildup_user_id) {
        console.log(`Valid update detected for user with buildup_user_id: ${profileData.buildup_user_id}`);
        try {
          // Instead of building buildupPayload, send the original payload
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjlFRTcxNzY2RDJFQkI2MUQ2MEEwMDFENUFDMTkyMThFIiwidHlwIjoiYXQrand0In0.eyJpc3MiOiJodHRwczovL3N0cy54LWluaXR5LmNvbSIsIm5iZiI6MTc1MzU3NDg2MSwiaWF0IjoxNzUzNTc0ODYxLCJleHAiOjE3NTM1ODIwNjEsInNjb3BlIjpbImhlYWx0aEluc2lnaHRzLnN1Ym1pdCIsInVzZXJzLnJlZ2lzdGVyIiwidXNlcnMudmFsaWRhdGUiXSwiY2xpZW50X2lkIjoiZHJfc2VsZiIsImp0aSI6IkE5NDEwMkYzNDg4QUNENUI2M0RFNTY2OEQ0MjhBMEVEIn0.qy2aVIDDTxtrAwgiA0Rc7k-RR4jR6yE7G_AZUsGrNlWYVIBC2fEvM6NwscCq82te_PryY8b5IMLB9X7_wjgthrD1m5TznBAWYF5343l116yx9o6Gt7wAGrSh3odpuYCF97DP0G7HQLUUKl6l7k4I__j25a20nh4QLG8jaQhH4u2mp6bD3Wq-kPZhArYEN_3i_F-3-VdKwb1h5_f4U4XJkt227Q1-rTPe8GJbxT5Zh4a9wX1vpLbsZUMt0QbyfnuxJ3BFW2E8Y5hIp2aPOtPykGsuCCxhZUu01vmCYS7_QiielldC0A0mhs_w4U_hLpZPQ95yJgoWqDYP0uv8Kz5gBA'
          };

          console.log('Request headers:', headers);

          const webhookResponse = await fetch(
            'https://Buildup-gateway.x-inity.com/IntegrationAPI/v1/HealthInsights/Submit',
            {
              method: 'POST',
              headers,
              body: JSON.stringify(payload)
            }
          );
          const webhookResult = await webhookResponse.text();
          console.log('Webhook response from Buildup gateway:', webhookResult);
          console.log('=== BUILDUP GATEWAY RESPONSE ===');
          console.log('Status:', webhookResponse.status);
          console.log('Status Text:', webhookResponse.statusText);
          console.log('Headers:', Object.fromEntries(webhookResponse.headers.entries()));
          console.log('Response Body:', webhookResult);
          console.log('Response Length:', webhookResult.length);
          console.log('=== END BUILDUP GATEWAY RESPONSE ===');

          const responseHandler = new ResponseHandler({
            maxSize: 2000, // 2KB limit
            storageMethod: 'database' // or 'file' or 'both'
          });

          const responseInfo = await responseHandler.handleLargeResponse(
            webhookResult,
            userId,
            webhookResponse.status
          );

          // Fetch all previous responses for the user
          const { data: previousResponses, error: previousError } = await supabaseClient
            .from('webhook_responses')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

          if (previousError) {
            console.error('Error fetching previous responses:', previousError);
          }

          // Trigger debug endpoint internally after processing
          // const debugResponse = await triggerDebugEndpoint(userId, webhookResult, payload);

          return res.json({
            success: true,
            url: fileUrl,
            buildup_gateway_called: true,
            buildup_response_summary: responseInfo ? responseInfo.summary : undefined,
            buildup_response_id: responseInfo ? responseInfo.fullResponse : undefined,
            buildup_status: webhookResponse.status,
            response_size: webhookResult.length,
            storage_method: responseInfo ? responseInfo.storageMethod : undefined,
            sent_to: 'https://Buildup-gateway.x-inity.com/IntegrationAPI/v1/HealthInsights/Submit',
            buildup_gateway_response: webhookResult,
            //debug_triggered: debugResponse
          });
        } catch (webhookError: any) {
          console.error('Error calling Buildup gateway:', webhookError);
          return res.status(500).json({
            success: false,
            url: fileUrl,
            buildup_gateway_called: false,
            buildup_error: webhookError.message,
            sent_to: 'https://Buildup-gateway.x-inity.com/IntegrationAPI/v1/HealthInsights/Submit'
          });
        }
      } else {
        console.log('User does not have a buildup_user_id in profiles');
        return res.json({
          success: false,
          message: 'User does not have buildup_user_id'
        });
      }
    } else {
      console.log('No file_url found or invalid event type');
      return res.json({
        success: false,
        message: 'No file_url found or invalid event type'
      });
    }
  } catch (error: any) {
    console.error('Error:', error);
    return res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Helper function to trigger debug endpoint internally
async function triggerDebugEndpoint(userId: string, webhookResult: string, originalPayload: any) {
  try {
    console.log('🔍 Triggering debug endpoint for user:', userId);
    
    // Store the webhook response for debugging
    const supabaseClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const responseId = `debug_${Date.now()}_${userId}`;
    
    const { error: storeError } = await supabaseClient
      .from('webhook_responses')
      .insert({
        id: responseId,
        user_id: userId,
        response_data: webhookResult,
        status: 200,
        created_at: new Date().toISOString()
      });

    if (storeError) {
      console.error('Error storing debug response:', storeError);
      return {
        success: false,
        message: 'Failed to store debug response',
        error: storeError.message
      };
    }

    // Get the stored response for verification
    const { data: debugData, error: debugError } = await supabaseClient
      .from('webhook_responses')
      .select('*')
      .eq('id', responseId)
      .single();

    if (debugError) {
      return {
        success: false,
        message: 'Failed to retrieve debug response',
        error: debugError.message
      };
    }

    return {
      success: true,
      message: 'Debug endpoint triggered successfully',
      response_id: responseId,
      stored_data: {
        id: debugData.id,
        user_id: debugData.user_id,
        status: debugData.status,
        created_at: debugData.created_at,
        response_preview: debugData.response_data ? debugData.response_data.substring(0, 200) + '...' : 'No data'
      }
    };

  } catch (error: any) {
    console.error('Error triggering debug endpoint:', error);
    return {
      success: false,
      message: 'Debug endpoint failed',
      error: error.message
    };
  }
}

export default router; 