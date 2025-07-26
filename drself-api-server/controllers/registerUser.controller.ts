import { Request, Response } from 'express';
import { proxyToEdge } from '../services/edgeProxy.service';

export {};

export const registerUser = async (req: Request, res: Response) => {
  try {
    // Forward the request to the Supabase Edge Function (stub)
    const result = await proxyToEdge(req.body);
    res.status(200).json({ message: 'User registered (stub)', result });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed', details: error });
  }
};
