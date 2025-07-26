import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

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
      const userId = payload.record.id;

      console.log(`Processing record for user: ${userId}, file: ${fileUrl}`);

      if (!userId) {
        console.log('No user_id found in the medical report');
        return res.status(400).json({ success: false, error: 'No user_id found' });
      }

      const { data: profileData, error: profileError } = await supabaseClient
        .from('profiles')
        .select('buildup_user_id')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        return res.status(500).json({ success: false, error: 'Profile fetch error', details: profileError.message });
      }

      if (profileData && profileData.buildup_user_id) {
        console.log(`Valid update detected for user with buildup_user_id: ${profileData.buildup_user_id}`);
        try {
          const webhookResponse = await fetch(
            'https://n8n-railway-production-53dd.up.railway.app/webhook/buildup',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                UserID: userId,
                fileUrl: fileUrl,
                buildup_user_id: profileData.buildup_user_id
              })
            }
          );

          const webhookResult = await webhookResponse.text();
          console.log('Webhook response:', webhookResult);
          console.log('Webhook status:', webhookResponse.status);

          return res.json({
            success: true,
            url: fileUrl,
            webhook_called: true,
            webhook_response: webhookResult,
            webhook_status: webhookResponse.status
          });
        } catch (webhookError: any) {
          console.error('Error calling webhook:', webhookError);
          return res.status(500).json({
            success: false,
            url: fileUrl,
            webhook_called: false,
            webhook_error: webhookError.message
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

export default router; 