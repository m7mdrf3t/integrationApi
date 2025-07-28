import { Router } from 'express';

const router = Router();

router.post('/update-buildup-user-id', async (req, res) => {
  // Require custom auth header
  const customKey = req.headers['x-drself-auth'];
  const expectedKey = process.env.DRSELF_API_KEY;
  if (!customKey || customKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
  }

  try {
    // Validate required fields
    const { email, phoneNumber, buildUp_user_id } = req.body;
    
    if (!email || !phoneNumber || !buildUp_user_id) {
      return res.status(400).json({ 
        error: 'Missing required fields: email, phoneNumber, and buildUp_user_id are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Call the Supabase edge function
    const response = await fetch(`${process.env.SUPABASE_URL}/functions/v1/update-buildup-user-id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify({
        email,
        phoneNumber,
        buildUp_user_id
      })
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('Edge function returned non-JSON:', text);
      return res.status(500).json({ error: 'Edge function returned non-JSON: ' + text });
    }

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: data.error || 'Failed to update Buildup user ID' 
      });
    }

    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Error updating Buildup user ID:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router; 