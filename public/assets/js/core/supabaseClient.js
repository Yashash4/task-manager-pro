// ==========================================
// SUPABASE CLIENT INITIALIZATION
// ==========================================

(function () {
  const SUPABASE_URL = "https://slmehyigbrctxozivxkv.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsbWVoeWlnYnJjdHhveml2eGt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzMjM3OTYsImV4cCI6MjA3Njg5OTc5Nn0.Q9YVQvyzJt4qSoMMXHC-7LQMhiDURXKMwHJSbsoNrvg";

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Supabase URL and Anon Key are required");
    return;
  }

  try {
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.SUPABASE = { client: () => supabase };
    console.log("? Supabase client initialized");
  } catch (error) {
    console.error("Failed to initialize Supabase:", error);
  }
})();