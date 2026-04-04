import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

// Client-friendly error messages
const CLIENT_ERRORS = {
  NETWORK_ERROR: {
    title: 'Connection Issue',
    message: 'We cannot reach the website right now.',
    suggestion: 'Please check if the website URL is correct and try again in a few minutes.',
    type: 'warning'
  },
  TIMEOUT_ERROR: {
    title: 'Website Slow to Respond',
    message: 'The website is taking too long to load.',
    suggestion: 'Try again later or contact support if this continues.',
    type: 'warning'
  },
  NOT_FOUND: {
    title: 'Website Not Found',
    message: 'The website address does not exist.',
    suggestion: 'Please double-check the URL and try again.',
    type: 'error'
  },
  FORBIDDEN: {
    title: 'Access Restricted',
    message: 'The website does not allow automated access.',
    suggestion: 'This website may have anti-scraping protection. Try a different source.',
    type: 'warning'
  },
  CAPTCHA_ERROR: {
    title: 'Security Check Detected',
    message: 'The website has security measures in place.',
    suggestion: 'Please try a different website or contact support for assistance.',
    type: 'warning'
  },
  NO_LEADS_FOUND: {
    title: 'No Leads Found',
    message: 'We could not find any business leads on this page.',
    suggestion: 'Try a different page or check if this website contains business information.',
    type: 'info'
  },
  TECHNICAL_ERROR: {
    title: 'Scraping System Error',
    message: 'Our lead discovery system encountered an issue.',
    suggestion: 'Please try again. If the problem continues, our team will investigate.',
    type: 'error'
  },
  UNKNOWN_ERROR: {
    title: 'Something Went Wrong',
    message: 'We encountered an unexpected issue while finding leads.',
    suggestion: 'Please try again. If this continues, contact our support team.',
    type: 'error'
  }
};

function translateErrorToClient(error: any): typeof CLIENT_ERRORS[keyof typeof CLIENT_ERRORS] {
  const errorMessage = error?.message || error?.toString() || 'Unknown error';
  
  // Network and connection errors
  if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('network') || errorMessage.includes('ENOTFOUND')) {
    return CLIENT_ERRORS.NETWORK_ERROR;
  }
  
  // Timeout errors
  if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT') || errorMessage.includes('ETIMEDOUT')) {
    return CLIENT_ERRORS.TIMEOUT_ERROR;
  }
  
  // HTTP status errors
  if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
    return CLIENT_ERRORS.NOT_FOUND;
  }
  
  if (errorMessage.includes('403') || errorMessage.includes('Forbidden') || errorMessage.includes('401')) {
    return CLIENT_ERRORS.FORBIDDEN;
  }
  
  // CAPTCHA and security errors
  if (errorMessage.includes('captcha') || errorMessage.includes('CAPTCHA') || errorMessage.includes('challenge')) {
    return CLIENT_ERRORS.CAPTCHA_ERROR;
  }
  
  // No leads found
  if (errorMessage.includes('No leads found') || errorMessage.includes('empty') || errorMessage.includes('no data')) {
    return CLIENT_ERRORS.NO_LEADS_FOUND;
  }
  
  // Puppeteer/Playwright specific errors
  if (errorMessage.includes('puppeteer') || errorMessage.includes('playwright') || errorMessage.includes('browser')) {
    return CLIENT_ERRORS.TECHNICAL_ERROR;
  }
  
  // Default to unknown error
  return CLIENT_ERRORS.UNKNOWN_ERROR;
}

export async function POST(request: NextRequest) {
  try {
    const { tenant_id, url } = await request.json();

    if (!tenant_id || !url) {
      return NextResponse.json(
        { error: 'Missing tenant_id or url' },
        { status: 400 }
      );
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      const clientError = CLIENT_ERRORS.NOT_FOUND;
      return NextResponse.json({
        error: clientError,
        clientFriendly: true
      }, { status: 400 });
    }

    // Create a scraping job record
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: job, error: jobError } = await supabase
      .from('scraping_jobs')
      .insert({
        tenant_id,
        url,
        status: 'pending',
        leads_found: 0,
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError) {
      const clientError = CLIENT_ERRORS.TECHNICAL_ERROR;
      return NextResponse.json({
        error: clientError,
        clientFriendly: true
      }, { status: 500 });
    }

    // Start the scraping process in the background
    // In a real implementation, you would use a queue system like Bull or Redis
    // For now, we'll simulate the scraping process
    
    try {
      // Simulate scraping attempt
      const scrapingResult = await simulateScraping(url);
      
      // Update job with results
      await supabase
        .from('scraping_jobs')
        .update({
          status: 'completed',
          leads_found: scrapingResult.leadsFound,
          completed_at: new Date().toISOString()
        })
        .eq('id', job.id);

      // If leads were found, save them to the leads table
      if (scrapingResult.leadsFound > 0 && scrapingResult.leads) {
        for (const lead of scrapingResult.leads) {
          await supabase
            .from('leads')
            .insert({
              tenant_id,
              business_name: lead.businessName,
              website: lead.website,
              email: lead.email,
              phone: lead.phone,
              address: lead.address,
              category: lead.category,
              source: 'playwright_scraping',
              created_at: new Date().toISOString()
            });
        }
      }

      return NextResponse.json({
        success: true,
        jobId: job.id,
        leadsFound: scrapingResult.leadsFound,
        message: `Successfully found ${scrapingResult.leadsFound} leads`
      });

    } catch (scrapingError) {
      // Update job with error
      const clientError = translateErrorToClient(scrapingError);
      
      await supabase
        .from('scraping_jobs')
        .update({
          status: 'failed',
          error_message: clientError.message,
          completed_at: new Date().toISOString()
        })
        .eq('id', job.id);

      return NextResponse.json({
        error: clientError,
        clientFriendly: true,
        jobId: job.id
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Playwright scraping error:', error);
    const clientError = translateErrorToClient(error);
    
    return NextResponse.json({
      error: clientError,
      clientFriendly: true
    }, { status: 500 });
  }
}

// Simulate scraping process - replace with actual Playwright implementation
async function simulateScraping(url: string): Promise<{ leadsFound: number; leads?: any[] }> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Simulate different outcomes based on URL
  if (url.includes('example.com') || url.includes('test.com')) {
    return { leadsFound: 0 };
  }
  
  // Simulate finding some leads
  if (Math.random() > 0.3) {
    const mockLeads = [
      {
        businessName: 'Sample Company',
        website: url,
        email: 'contact@sample.com',
        phone: '+1-555-0123',
        address: '123 Main St, City, State',
        category: 'Technology'
      }
    ];
    
    return { 
      leadsFound: mockLeads.length, 
      leads: mockLeads 
    };
  }
  
  // Simulate random errors
  const random = Math.random();
  if (random < 0.1) {
    throw new Error('ECONNREFUSED: Connection refused');
  } else if (random < 0.2) {
    throw new Error('timeout: Request timeout');
  } else if (random < 0.3) {
    throw new Error('404: Not Found');
  } else if (random < 0.4) {
    throw new Error('403: Forbidden');
  }
  
  return { leadsFound: 0 };
}
