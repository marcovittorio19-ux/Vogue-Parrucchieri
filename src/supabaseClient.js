import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://txdripelnlwjtpdvhuyw.supabase.co";
const supabaseKey = "sb_publishable_KRnSHwwKE-x6hK1V8urnwg_lWZUjmbb";

export const supabase = createClient(supabaseUrl, supabaseKey);