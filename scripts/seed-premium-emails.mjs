<<<<<<< HEAD
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
=======
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
>>>>>>> origin/main

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
<<<<<<< HEAD
  console.error("Missing Supabase credentials in environment");
  process.exit(1);
=======
    console.error('Missing Supabase credentials in environment');
    process.exit(1);
>>>>>>> origin/main
}

const supabase = createClient(supabaseUrl, supabaseKey);

<<<<<<< HEAD
const TEMPLATE_DIR = path.join(process.cwd(), "src/assets/email-templates");

const BASE_HTML = fs.readFileSync(
  path.join(TEMPLATE_DIR, "premium_base.html"),
  "utf-8",
);

const templates = [
  {
    name: "Welcome Email",
    subject: "Welcome to the Command Center",
    contentFile: "welcome.html",
    title: "PROVISIONING COMPLETE",
  },
  {
    name: "Morning Briefing",
    subject: "AlphaClone: Your Strategic Briefing",
    content: `
=======
const TEMPLATE_DIR = path.join(process.cwd(), 'src/assets/email-templates');

const BASE_HTML = fs.readFileSync(path.join(TEMPLATE_DIR, 'premium_base.html'), 'utf-8');

const templates = [
    {
        name: 'Welcome Email',
        subject: 'Welcome to the Command Center',
        contentFile: 'welcome.html',
        title: 'PROVISIONING COMPLETE'
    },
    {
        name: 'Morning Briefing',
        subject: 'AlphaClone: Your Strategic Briefing',
        content: `
>>>>>>> origin/main
            <p>Good morning, {{name}}.</p>
            <p>Your business operating system has processed the overnight data. Here is your strategic outlook for today.</p>
            <div class="card">
                <h3 style="color: #ffffff; margin-top: 0;">Market Sentiment: <span class="accent-text">BULLISH</span></h3>
                <p style="margin-bottom: 0;">We have identified 12 new high-intent leads in your target sector. AI prioritization is complete.</p>
            </div>
            <p>Your team huddle is scheduled for 09:00 UTC. The war room is prepared.</p>
        `,
<<<<<<< HEAD
    title: "MORNING BRIEFING",
    buttonText: "View Dashboard",
    buttonUrl: "{{dashboardUrl}}",
  },
  {
    name: "Daily Summary",
    subject: "AlphaClone: Operational Summary",
    content: `
=======
        title: 'MORNING BRIEFING',
        buttonText: 'View Dashboard',
        buttonUrl: '{{dashboardUrl}}'
    },
    {
        name: 'Daily Summary',
        subject: 'AlphaClone: Operational Summary',
        content: `
>>>>>>> origin/main
            <p>Operational summary for today's performance.</p>
            <div class="card">
                <p style="margin: 0;">Pipeline Movement: <span class="accent-text">+14%</span></p>
                <p style="margin: 8px 0 0;">Closed Revenue: <span class="accent-text">$42,500</span></p>
            </div>
            <p>Systems are running at optimal capacity.</p>
        `,
<<<<<<< HEAD
    title: "DAILY SUMMARY",
    buttonText: "Full Report",
    buttonUrl: "{{dashboardUrl}}",
  },
];

async function seed() {
  console.log("🚀 Seeding Premium Email Templates...");

  for (const t of templates) {
    let content = t.content;
    if (t.contentFile) {
      content = fs.readFileSync(
        path.join(TEMPLATE_DIR, t.contentFile),
        "utf-8",
      );
    }

    // Wrap in base
    let html = BASE_HTML.replace("{{title}}", t.title)
      .replace("{{content}}", content)
      .replace("{{subject}}", t.subject);

    if (t.buttonUrl) {
      html = html
        .replace("{{buttonUrl}}", t.buttonUrl)
        .replace("{{buttonText}}", t.buttonText);
    } else {
      // Check if welcome email button logic
      if (t.name === "Welcome Email") {
        html = html
          .replace("{{buttonUrl}}", "{{dashboardUrl}}")
          .replace("{{buttonText}}", "Enter Command Center");
      } else {
        // Remove button placeholder if not used
        html = html
          .replace("{{#buttonUrl}}", "<!--")
          .replace("{{/buttonUrl}}", "-->");
      }
    }

    const { error } = await supabase.from("email_templates").upsert(
      {
        name: t.name,
        subject: t.subject,
        body_html: html,
        body_text: t.subject, // Basic fallback
        tenant_id: null, // Global template
      },
      { onConflict: "name" },
    );

    if (error) {
      console.error(`❌ Failed to seed ${t.name}:`, error);
    } else {
      console.log(`✅ Seeded ${t.name}`);
    }
  }

  console.log("✨ All templates updated to Premium design.");
=======
        title: 'DAILY SUMMARY',
        buttonText: 'Full Report',
        buttonUrl: '{{dashboardUrl}}'
    }
];

async function seed() {
    console.log('🚀 Seeding Premium Email Templates...');

    for (const t of templates) {
        let content = t.content;
        if (t.contentFile) {
            content = fs.readFileSync(path.join(TEMPLATE_DIR, t.contentFile), 'utf-8');
        }

        // Wrap in base
        let html = BASE_HTML
            .replace('{{title}}', t.title)
            .replace('{{content}}', content)
            .replace('{{subject}}', t.subject);

        if (t.buttonUrl) {
            html = html.replace('{{buttonUrl}}', t.buttonUrl).replace('{{buttonText}}', t.buttonText);
        } else {
            // Check if welcome email button logic
            if (t.name === 'Welcome Email') {
                html = html.replace('{{buttonUrl}}', '{{dashboardUrl}}').replace('{{buttonText}}', 'Enter Command Center');
            } else {
                // Remove button placeholder if not used
                html = html.replace('{{#buttonUrl}}', '<!--').replace('{{/buttonUrl}}', '-->');
            }
        }

        const { error } = await supabase
            .from('email_templates')
            .upsert({
                name: t.name,
                subject: t.subject,
                body_html: html,
                body_text: t.subject, // Basic fallback
                tenant_id: null // Global template
            }, { onConflict: 'name' });

        if (error) {
            console.error(`❌ Failed to seed ${t.name}:`, error);
        } else {
            console.log(`✅ Seeded ${t.name}`);
        }
    }

    console.log('✨ All templates updated to Premium design.');
>>>>>>> origin/main
}

seed();
