const SUPABASE_URL = 'https://cydnnjsrvictwunzlvjc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5ZG5uanNydmljdHd1bnpsdmpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNTgwNzcsImV4cCI6MjA5MDgzNDA3N30.WQaeTyUuz_gJQj6g6kEfdXSr9RbwjIMklAX9eOJwPww';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);