/**
 * EPM Commercial - Supabase Client Configuration
 * Web Portal - Direct connection to Supabase
 */

import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const SUPABASE_URL = 'https://fcfezhoaxqroubphzzfz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZmV6aG9heHFyb3VicGh6emZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDc1NzAsImV4cCI6MjA5MzYyMzU3MH0.GXjaEpjuRCM39qMkpSCPHyhEoC1nxRg-1BpQ_39q4pc';

// Create Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

// Auth helpers
export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
};

// Company helpers
export const getCompany = async (companyId: string) => {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single();
  return { data, error };
};

export const getCompanyEmployees = async (companyId: string) => {
  const { data, error } = await supabase
    .from('employees')
    .select(`
      *,
      computers (*)
    `)
    .eq('company_id', companyId);
  return { data, error };
};

export const getCompanyComputers = async (companyId: string) => {
  const { data, error } = await supabase
    .from('computers')
    .select('*')
    .eq('company_id', companyId);
  return { data, error };
};

// Activity helpers
export const getActivityLogs = async (computerId: string, days: number = 7) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('computer_id', computerId)
    .gte('timestamp', startDate.toISOString())
    .order('timestamp', { ascending: false });
  return { data, error };
};

export const getAggregatedStats = async (companyId: string, days: number = 7) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('daily_stats')
    .select(`
      *,
      computers (
        employees (
          company_id
        )
      )
    `)
    .gte('date', startDate.toISOString().split('T')[0])
    .order('date', { ascending: false });

  // Filter by company
  const filtered = data?.filter(d =>
    d.computers?.employees?.company_id === companyId
  ) || [];

  return { data: filtered, error };
};

export const getTopApps = async (companyId: string, days: number = 7) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('activity_logs')
    .select('app_name, duration_seconds, category')
    .gte('timestamp', startDate.toISOString())
    .order('timestamp', { ascending: false });

  // Aggregate by app name
  const aggregated = data?.reduce((acc, log) => {
    if (!acc[log.app_name]) {
      acc[log.app_name] = {
        name: log.app_name,
        minutes: 0,
        category: log.category
      };
    }
    acc[log.app_name].minutes += Math.floor(log.duration_seconds / 60);
    return acc;
  }, {} as Record<string, { name: string; minutes: number; category: string }>);

  const sorted = Object.values(aggregated || {})
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 10);

  return { data: sorted, error };
};

// Productivity rules
export const getProductivityRules = async (companyId: string) => {
  const { data, error } = await supabase
    .from('productivity_rules')
    .select('*')
    .eq('company_id', companyId);
  return { data, error };
};

export const createProductivityRule = async (rule: any) => {
  const { data, error } = await supabase
    .from('productivity_rules')
    .insert([rule])
    .select()
    .single();
  return { data, error };
};

export const deleteProductivityRule = async (ruleId: string) => {
  const { error } = await supabase
    .from('productivity_rules')
    .delete()
    .eq('id', ruleId);
  return { error };
};

export default supabase;
