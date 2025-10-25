// ==========================================
// SUPABASE CLIENT INITIALIZATION
// ==========================================

(function () {
  const SUPABASE_URL = "https://slmehyigbrctxozivxkv.supabase.co"; // Replace with your URL
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsbWVoeWlnYnJjdHhveml2eGt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzMjM3OTYsImV4cCI6MjA3Njg5OTc5Nn0.Q9YVQvyzJt4qSoMMXHC-7LQMhiDURXKMwHJSbsoNrvg"; // Replace with your Anon Key

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Supabase URL and Anon Key are required in supabaseClient.js");
    alert("Application is not configured correctly. Please contact support.");
    return;
  }

  try {
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.SUPABASE = { client: () => supabase };
    console.log("? Supabase client initialized");
  } catch (error) {
    console.error("Failed to initialize Supabase:", error);
    alert("Could not connect to the backend. Please try again later.");
  }
})();