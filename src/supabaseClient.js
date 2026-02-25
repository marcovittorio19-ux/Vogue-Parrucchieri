import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://awhcqzsmukpnjnklszrc.supabase.co";
const supabaseKey = "sb_publishable_wJ6wNvEoVdZvfbkGnpimuA_z4JQGart";

export const supabase = createClient(supabaseUrl, supabaseKey);