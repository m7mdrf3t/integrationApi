import { Router } from 'express';

const router = Router();

router.post('/register', async (req, res) => {
  // Require custom auth header
  const customKey = req.headers['x-drself-auth'];
  const expectedKey = process.env.DRSELF_API_KEY;
  if (!customKey || customKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
  }

  try {
    console.log('Calling edge function with payload:', JSON.stringify(req.body, null, 2));
    
    const response = await fetch(`${process.env.SUPABASE_URL}/functions/v1/register-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify(req.body)
    });

    console.log('Edge function response status:', response.status);
    console.log('Edge function response headers:', Object.fromEntries(response.headers.entries()));

    const text = await response.text();
    console.log('Edge function response body:', text);
    
    let data;
    try {
      data = JSON.parse(text);
      console.log('Parsed response data:', JSON.stringify(data, null, 2));
    } catch (e) {
      console.log('Edge function returned plain text, converting to JSON format');
      // Handle plain text responses by converting them to JSON format
      data = { 
        error: text,
        message: text,
        status: response.status
      };
    }

    console.log('Forwarding status:', response.status);

    // Forward the exact status code and response from the edge function
    return res.status(response.status).json(data);
  } catch (error: any) {
    console.error('Error calling register-user edge function:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
