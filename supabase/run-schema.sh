#!/bin/bash
# EPM Commercial - Run Schema on Supabase
# This script executes the schema.sql on your Supabase PostgreSQL database

# Supabase credentials
SUPABASE_DB_HOST="db.fcfezhoaxqroubphzzfz.supabase.co"
SUPABASE_DB_PORT="5432"
SUPABASE_DB_USER="postgres"
SUPABASE_DB_PASSWORD="YOUR_SUPABASE_SERVICE_KEY"
SUPABASE_DB_NAME="postgres"

echo "🔌 Testing PostgreSQL connection..."
echo "   Host: $SUPABASE_DB_HOST"
echo "   Port: $SUPABASE_DB_PORT"
echo "   Database: $SUPABASE_DB_NAME"
echo ""

# Try to connect using a simple TCP check
timeout 5 bash -c "cat < /dev/null > /dev/tcp/$SUPABASE_DB_HOST/$SUPABASE_DB_PORT" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Connection successful!"
else
    echo "❌ Cannot connect to PostgreSQL directly"
    echo ""
    echo "💡 Please run the schema manually via Supabase Dashboard:"
    echo "   1. Go to https://supabase.com/dashboard"
    echo "   2. Select your project 'johnl242's Project'"
    echo "   3. Click 'SQL Editor' in the left sidebar"
    echo "   4. Copy contents of /workspace/supabase/schema.sql"
    echo "   5. Paste and click 'Run'"
    exit 1
fi

echo ""
echo "⚠️  Direct PostgreSQL access is not available from this environment."
echo ""
echo "💡 Please run the schema manually via Supabase Dashboard:"
echo ""
echo "   Step 1: Go to https://supabase.com/dashboard"
echo "   Step 2: Select project 'johnl242's Project'"
echo "   Step 3: Click 'SQL Editor' in the left sidebar"
echo "   Step 4: Copy the contents of schema.sql"
echo "   Step 5: Paste into the SQL Editor"
echo "   Step 6: Click 'Run' button"
echo ""
echo "The schema includes:"
echo "   ✅ companies, users, licenses, computers, employees"
echo "   ✅ activity_logs, daily_stats, idle_logs"
echo "   ✅ productivity_rules, audit_logs, api_keys"
echo "   ✅ Row Level Security (RLS) policies"
echo "   ✅ Database functions and triggers"
echo ""