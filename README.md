# Evolve - Creative Prompt Evolution

A web application that evolves creative prompts using AI, with support for text, image, and P5.js outputs.

## Features

- 🧬 **Prompt Evolution**: Uses genetic algorithms to evolve and combine creative prompts
- 🎨 **Multiple Output Modes**:
  - Text prompts
  - AI-generated images
  - P5.js visualizations
- 💾 **Project Management**: Save and manage multiple evolution projects
- 🎯 **Smart Scoring**: AI-driven evaluation of prompt quality and relevance

## How It Works

1. Start with a seed prompt
2. The system generates variations using AI
3. Each prompt is scored based on relevance, creativity, coherence, and quality
4. The best prompts are selected as parents for the next generation
5. The process repeats for multiple generations
6. Optional: Generate images from the evolved prompts

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn
- OpenAI API compatible api/key
- Replicate API key

### Environment Setup

1. Clone the repository
2. Install dependencies for both frontend and server:

```bash
# Install frontend dependencies
npm install

# Install server dependencies
cd server
npm install
```

3. Create two `.env` files:

Frontend `.env` (in root directory):

```env
VITE_OPENAI_API_KEY=your_openai_api_key
VITE_OPENAI_API_BASE_URL=https://api.openai.com/v1
```

Server `.env` (in server directory):

```env
PORT=3001
REPLICATE_API_TOKEN=your_replicate_api_token
```

### Running the Application

1. Start the server:

```bash
cd server
npm start
```

2. In a new terminal, start the frontend:

```bash
# From the root directory
npm run dev
```

The application will be available at:

- Frontend: http://localhost:5173
- Server: http://localhost:3001

### API Services Used

- **OpenAI API**: Used for prompt evolution and scoring
- **Replicate API**: Used for image generation
  - Model: black-forest-labs/flux-schnell

## Tech Stack

- React
- TypeScript
- OpenAI API
- Immer
- React Tiny Popover
- Local Storage for persistence

## License

MIT
