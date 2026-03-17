#!/bin/bash
# Deploy All Migrations to Supabase (Bash version)

echo "🚀 Deploying migrations to Supabase..."

# Push all migrations to remote database
npx supabase db push --linked

if [ $? -eq 0 ]; then
    echo "✅ All migrations deployed successfully!"
    echo ""
    echo "🎉 Your database is now up to date with:"
    echo "   - User profiles & authentication"
    echo "   - Projects management"
    echo "   - Real-time messaging"
    echo "   - Contact form submissions"
    echo "   - Gallery & media storage"
    echo "   - Activity tracking & logs"
    echo "   - Login sessions"
    echo "   - Geo-blocking (Nigeria & India)"
    echo "   - Security alerts"
    echo ""
    echo "🌐 Test your app at: https://alphaclone-systems-ogecwgzll-borns-projects-bfe09b9f.vercel.app"
else
    echo "❌ Migration failed. Check the error above."
    echo "💡 Tip: Make sure you're linked to your Supabase project"
    echo "   Run: npx supabase link --project-ref ehekzoiogvtweugeinktn"
fi
