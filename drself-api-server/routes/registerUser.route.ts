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
    const response = await fetch(`${process.env.SUPABASE_URL}/functions/v1/register-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify(req.body)
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('Upstream returned non-JSON:', text);
      return res.status(500).json({ error: 'Upstream returned non-JSON: ' + text });
    }

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error || 'Failed to register user' });
    }

    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
