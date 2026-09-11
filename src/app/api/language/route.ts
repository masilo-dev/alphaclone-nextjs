import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Get the Accept-Language header from the request
    const acceptLanguage = request.headers.get('accept-language') || 'en';
    
    // Parse the language (get the primary language)
    const primaryLanguage = acceptLanguage.split(',')[0].split('-')[0];
    
    // List of supported languages
    const supportedLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar', 'hi'];
    
    // Validate the language
    const detectedLanguage = supportedLanguages.includes(primaryLanguage) ? primaryLanguage : 'en';
    
    // Return the detected language
    return NextResponse.json({
      language: detectedLanguage,
      primary: primaryLanguage,
      full: acceptLanguage,
      supported: supportedLanguages.includes(primaryLanguage)
    });
    
  } catch (error) {
    console.error('Language detection error:', error);
    return NextResponse.json({ 
      language: 'en', 
      error: 'Failed to detect language' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { language } = await request.json();
    
    // Validate the language
    const supportedLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar', 'hi'];
    const validatedLanguage = supportedLanguages.includes(language) ? language : 'en';
    
    // Create response with language cookie
    const response = NextResponse.json({ 
      language: validatedLanguage,
      message: 'Language set successfully'
    });
    
    // Set a cookie for language preference
    response.cookies.set('preferred-language', validatedLanguage, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    });
    
    return response;
    
  } catch (error) {
    console.error('Language setting error:', error);
    return NextResponse.json({ 
      error: 'Failed to set language' 
    }, { status: 500 });
  }
}