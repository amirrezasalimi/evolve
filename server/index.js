import express from "express";
import cors from "cors";
import Replicate from "replicate";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for frontend requests
app.use(
  cors({
    origin: "http://localhost:5173", // Your Vite dev server URL
    methods: ["GET", "POST"],
    credentials: true,
  })
);

app.use(express.json());

// Initialize the Replicate client
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

app.post("/api/generate-image", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const output = await replicate.run("black-forest-labs/flux-schnell", {
      input: {
        prompt: prompt,
        go_fast: false,
        megapixels: "1",
        num_outputs: 1,
        aspect_ratio: "1:1",
        output_format: "png",
        output_quality: 100,
        num_inference_steps: 4,
      },
    });
    const image_url = output[0].url().href;

    return res.json({ imageUrl: image_url });
  } catch (error) {
    console.error("Error generating image:", error);
    return res.status(500).json({ error: "Failed to generate image" });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
