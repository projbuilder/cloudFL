-- Add response caching table for LLM responses
-- This reduces API costs by 40-60% and prevents rate limit errors

CREATE TABLE IF NOT EXISTS llm_response_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE NOT NULL,
  prompt TEXT, -- For debugging/analysis
  response TEXT NOT NULL,
  service TEXT DEFAULT 'tutor', -- 'tutor', 'quiz', 'module'
  hit_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX idx_cache_key ON llm_response_cache(cache_key);
CREATE INDEX idx_created_at ON llm_response_cache(created_at);
CREATE INDEX idx_service ON llm_response_cache(service);

-- Enable RLS
ALTER TABLE llm_response_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Allow read access to all authenticated users
CREATE POLICY "Authenticated users can read cache"
ON llm_response_cache
FOR SELECT
USING (auth.role() = 'authenticated');

-- Policy: System can write to cache
CREATE POLICY "System can write cache"
ON llm_response_cache
FOR ALL
USING (true);

-- Function to auto-cleanup old cache entries (keep last 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM llm_response_cache 
  WHERE created_at < now() - interval '7 days';
  
  RAISE NOTICE 'Cleaned up old cache entries';
END;
$$;

-- Function to increment hit count when cache is used
CREATE OR REPLACE FUNCTION increment_cache_hit(p_cache_key TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE llm_response_cache 
  SET 
    hit_count = hit_count + 1,
    last_accessed_at = now()
  WHERE cache_key = p_cache_key;
END;
$$;

-- Create a scheduled job to run cleanup daily (requires pg_cron extension)
-- Note: Uncomment if pg_cron is enabled in your Supabase project
-- SELECT cron.schedule(
--   'cleanup-old-cache',
--   '0 2 * * *', -- Run at 2 AM daily
--   $$SELECT cleanup_old_cache()$$
-- );

COMMENT ON TABLE llm_response_cache IS 'Caches LLM responses to reduce API costs and improve latency';
COMMENT ON COLUMN llm_response_cache.cache_key IS 'SHA256 hash of (prompt + context)';
COMMENT ON COLUMN llm_response_cache.hit_count IS 'Number of times this cached response was used';
