export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // ✅ Support Gemini-style request format
    const userMessage = req.body.message 
      || req.body.contents?.[0]?.parts?.[0]?.text 
      || "";

    if (!userMessage) {
      return res.status(400).json({ error: "No user message provided" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing OpenAI API key in environment variables" });
    }

    // ✅ Call OpenAI API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",  // ⚡ cheapest + good
        messages: [
          { role: "system", content: "You are Alara, a helpful AI assistant." },
          { role: "user", content: userMessage }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "OpenAI API error");
    }

    const reply = data.choices?.[0]?.message?.content || "No reply";

    // ✅ Send back in Gemini-style response structure (so index.html works unchanged)
    res.status(200).json({
      candidates: [
        {
          content: {
            parts: [{ text: reply }]
          }
        }
      ]
    });

  } catch (error) {
    res.status(500).json({ error: "API request failed", details: error.message });
  }
}
