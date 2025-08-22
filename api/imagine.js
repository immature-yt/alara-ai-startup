// api/imagine.js
import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    // Pollinations generates directly from URL
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      prompt
    )}`;

    // You could test fetch to confirm it's valid, but returning URL is enough
    res.json({ imageUrl });
  } catch (error) {
    console.error("Image generation error:", error);
    res.status(500).json({ error: "Image generation failed" });
  }
});

export default router;
