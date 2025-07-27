import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// Get webhook response by ID
router.get('/webhook-response/:responseId', async (req, res) => {
  try {
    const { responseId } = req.params;
    
    const supabaseClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const { data, error } = await supabaseClient
      .from('webhook_responses')
      .select('*')
      .eq('id', responseId)
      .single();

    if (error) {
      return res.status(404).json({
        success: false,
        error: 'Webhook response not found',
        details: error.message
      });
    }

    // Mark as retrieved
    await supabaseClient
      .from('webhook_responses')
      .update({ retrieved_at: new Date().toISOString() })
      .eq('id', responseId);

    return res.json({
      success: true,
      data: {
        id: data.id,
        user_id: data.user_id,
        response_data: data.response_data,
        status: data.status,
        created_at: data.created_at,
        retrieved_at: new Date().toISOString()
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

// List webhook responses for a user
router.get('/webhook-responses/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10, offset = 0 } = req.query;
    
    const supabaseClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const { data, error } = await supabaseClient
      .from('webhook_responses')
      .select('id, user_id, status, created_at, retrieved_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Error fetching webhook responses',
        details: error.message
      });
    }

    return res.json({
      success: true,
      data: data,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        count: data.length
      }
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