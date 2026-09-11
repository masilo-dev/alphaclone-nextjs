const { GoogleGenerativeAI } = require("@google/generative-ai");

async function verifyKey() {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_KEY || "";
  if (!apiKey) {
    console.error("Missing GOOGLE_API_KEY (or GOOGLE_GENERATIVE_AI_KEY).");
    process.exit(1);
  }
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
