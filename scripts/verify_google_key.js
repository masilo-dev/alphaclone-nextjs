
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function verifyKey() {
    const apiKey = "AIzaSyAcT-3S-JvzncDJBFnaeyY8WxzezuYsBYI";
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    try {
        console.log("Testing Google API key...");
        const result = await model.generateContent("Hello, are you active?");
        const response = await result.response;
        const text = response.text();
        console.log("✅ Success! Response:", text);
    } catch (error) {
        console.error("❌ Verification failed:");
        console.error(error);
    }
}

verifyKey();
