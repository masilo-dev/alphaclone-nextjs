/**
 * Motivation Quote Service
 * Provides daily motivational quotes for users.
 */

const QUOTES = [
    { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { quote: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
    { quote: "Don't count the days, make the days count.", author: "Muhammad Ali" },
    { quote: "The future depends on what you do today.", author: "Mahatma Gandhi" },
    { quote: "Your time is limited, don't waste it living someone else's life.", author: "Steve Jobs" },
    { quote: "Whether you think you can or you think you can't, you're right.", author: "Henry Ford" },
    { quote: "Action is the foundational key to all success.", author: "Pablo Picasso" },
    { quote: "The best way to predict the future is to create it.", author: "Peter Drucker" },
];

export function getDailyMotivation(): { quote: string; author: string } {
    // Select based on day of year for consistency across users if desired, 
    // or just random. Let's do day of year.
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    
    return QUOTES[dayOfYear % QUOTES.length];
}
