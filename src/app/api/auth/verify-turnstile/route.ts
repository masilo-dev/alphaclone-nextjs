import { NextRequest, NextResponse } from 'next/server';
import { checkBotId } from 'botid/server';

export async function POST(request: NextRequest) {
    try {
        const verification = await checkBotId();
        
        if (verification.isBot) {
            return NextResponse.json({ 
                success: false, 
                error: 'Security verification failed' 
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('BotId verification error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
