import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

export interface ResponseHandlerOptions {
  maxSize?: number; // Max size in bytes before chunking
  storageMethod?: 'database' | 'file' | 'both';
  chunkSize?: number; // Size of chunks in bytes
}

export class ResponseHandler {
  private supabaseClient: any;
  private options: ResponseHandlerOptions;

  constructor(options: ResponseHandlerOptions = {}) {
    this.supabaseClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    this.options = {
      maxSize: 1000, // 1KB default
      storageMethod: 'database',
      chunkSize: 50000, // 50KB chunks
      ...options
    };
  }

  async handleLargeResponse(
    responseData: string,
    userId: string,
    status: number
  ): Promise<{
    summary: string;
    fullResponse: string | string[];
    responseSize: number;
    storageMethod: string;
  }> {
    const responseSize = responseData.length;

    if (responseSize <= this.options.maxSize!) {
      return {
        summary: 'Response within size limit',
        fullResponse: responseData,
        responseSize,
        storageMethod: 'direct'
      };
    }

    const responseId = `webhook_${Date.now()}_${userId}`;

    switch (this.options.storageMethod) {
      case 'database':
        return await this.storeInDatabase(responseData, userId, status, responseId);
      
      case 'file':
        return await this.storeInFile(responseData, userId, status, responseId);
      
      case 'both':
        const dbResult = await this.storeInDatabase(responseData, userId, status, responseId);
        await this.storeInFile(responseData, userId, status, responseId);
        return dbResult;
      
      default:
        return await this.storeInDatabase(responseData, userId, status, responseId);
    }
  }

  private async storeInDatabase(
    responseData: string,
    userId: string,
    status: number,
    responseId: string
  ) {
    try {
      const { error } = await this.supabaseClient
        .from('webhook_responses')
        .insert({
          id: responseId,
          user_id: userId,
          response_data: responseData,
          status,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error storing in database:', error);
        throw error;
      }

      return {
        summary: `Large response stored in database with ID: ${responseId}`,
        fullResponse: responseId,
        responseSize: responseData.length,
        storageMethod: 'database'
      };
    } catch (error) {
      console.error('Database storage failed:', error);
      // Fallback to file storage
      return await this.storeInFile(responseData, userId, status, responseId);
    }
  }

  private async storeInFile(
    responseData: string,
    userId: string,
    status: number,
    responseId: string
  ) {
    try {
      const uploadsDir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const filePath = path.join(uploadsDir, `${responseId}.json`);
      
      const fileData = {
        id: responseId,
        user_id: userId,
        response_data: responseData,
        status,
        created_at: new Date().toISOString()
      };

      fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2));

      return {
        summary: `Large response stored in file: ${responseId}.json`,
        fullResponse: responseId,
        responseSize: responseData.length,
        storageMethod: 'file'
      };
    } catch (error) {
      console.error('File storage failed:', error);
      throw error;
    }
  }

  async retrieveResponse(responseId: string): Promise<any> {
    // Try database first
    try {
      const { data, error } = await this.supabaseClient
        .from('webhook_responses')
        .select('*')
        .eq('id', responseId)
        .single();

      if (!error && data) {
        return data;
      }
    } catch (error) {
      console.log('Response not found in database, trying file...');
    }

    // Try file
    try {
      const filePath = path.join(__dirname, '../uploads', `${responseId}.json`);
      if (fs.existsSync(filePath)) {
        const fileData = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(fileData);
      }
    } catch (error) {
      console.error('Error reading file:', error);
    }

    throw new Error('Response not found');
  }
} 