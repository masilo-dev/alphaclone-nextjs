
import { routeAIChat } from '../src/services/aiRouter';
import * as dotenv from 'dotenv';

dotenv.config();

async function testAI() {
    console.log("Testing AI Router...");
    try {
        const response = await routeAIChat(
            [{ role: 'user', content: 'Hello, are you working?' }],
            'Hello, are you working?',
            'You are a helpful assistant.'
        );
        console.log("Response:", response);
    } catch (error) {
        console.error("Test Failed:", error);
    }
}

testAI();
