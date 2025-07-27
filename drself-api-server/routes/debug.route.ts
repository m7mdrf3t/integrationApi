import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// Get the latest webhook response for debugging
router.get('/debug/latest-webhook-response', async (req, res) => {
  try {
    const supabaseClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Get the latest webhook response
    const { data, error } = await supabaseClient
      .from('webhook_responses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return res.json({
        success: false,
        message: 'No webhook responses found',
        error: error.message
      });
    }

    return res.json({
      success: true,
      data: {
        id: data.id,
        user_id: data.user_id,
        response_data: data.response_data,
        status: data.status,
        created_at: data.created_at
      }
    });

  } catch (error: any) {
    console.error('Error retrieving webhook response:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all webhook responses for a specific user
router.get('/debug/webhook-responses/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const supabaseClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const { data, error } = await supabaseClient
      .from('webhook_responses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Error fetching webhook responses',
        details: error.message
      });
    }

    return res.json({
      success: true,
      count: data.length,
      responses: data.map(item => ({
        id: item.id,
        user_id: item.user_id,
        status: item.status,
        created_at: item.created_at,
        response_preview: item.response_data ? item.response_data.substring(0, 200) + '...' : 'No data'
      }))
    });

  } catch (error: any) {
    console.error('Error listing webhook responses:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router; 