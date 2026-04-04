import { createClient } from "@supabase/supabase-js";

const url = process.env.REACT_APP_SUPABASE_URL;
const anon = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase =
  url && anon ? createClient(url, anon) : null;

export function isSupabaseConfigured() {
  return Boolean(url && anon);
}
