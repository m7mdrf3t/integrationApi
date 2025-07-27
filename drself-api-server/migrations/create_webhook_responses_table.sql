-- Create webhook_responses table to store large webhook responses
CREATE TABLE IF NOT EXISTS webhook_responses (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL,
    response_data TEXT NOT NULL,
    status INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    retrieved_at TIMESTAMP WITH TIME ZONE
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_webhook_responses_user_id ON webhook_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_responses_created_at ON webhook_responses(created_at);

-- Add RLS policy if needed
ALTER TABLE webhook_responses ENABLE ROW LEVEL SECURITY;

-- Policy to allow service role to access all records
CREATE POLICY "Service role can access all webhook responses" ON webhook_responses
    FOR ALL USING (auth.role() = 'service_role'); 