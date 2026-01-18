import { supabase } from '../lib/supabase';

/**
 * Diagnostic utility to check if activity tracking tables exist
 */
export const diagnostics = {
    async checkActivityTables() {
        console.log("🔍 Running Activity Tracking Diagnostics...");

        const tables = ['activity_logs', 'login_sessions', 'security_alerts', 'blocked_countries'];
        const results: Record<string, boolean> = {};

        for (const table of tables) {
            try {
                const { error } = await supabase
                    .from(table)
                    .select('id', { count: 'exact', head: true })
                    .limit(1);

                if (error) {
                    console.error(`❌ Table '${table}' error:`, error.message);
                    results[table] = false;
                } else {
                    console.log(`✅ Table '${table}' exists`);
                    results[table] = true;
                }
            } catch (err) {
                console.error(`❌ Table '${table}' check failed:`, err);
                results[table] = false;
            }
        }

        const allExist = Object.values(results).every(v => v);

        if (!allExist) {
            console.error("\n❌ MIGRATION REQUIRED!");
            console.error("Please run this SQL file in your Supabase SQL Editor:");
            console.error("📄 supabase/migrations/20251209_activity_tracking.sql\n");
        } else {
            console.log("\n✅ All activity tracking tables exist!");
        }

        return results;
    }
};
