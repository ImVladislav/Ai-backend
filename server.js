const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const bot1Prompt = JSON.parse(fs.readFileSync('prompts/Eva.json', 'utf8'));

const app = express();
const PORT = 4000;
const TOKEN = process.env.TOKEN;

const allowedOrigins = ['https://cto-one.vercel.app', 'https://moldy.lol'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin.startsWith('http://localhost') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.use(bodyParser.json());

app.use('/chat', rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many requests from this IP, try again later.',
}));

app.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    const cleanedMessages = messages.map((msg) => {
      const text = typeof msg === 'string' ? msg : msg.message;
      return text.replace(/<.*?>/g, '').replace(/^You:\s*/i, '').trim();
    });

    const chatHistory = cleanedMessages.map((text, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: text,
    })).slice(-10);

    const promptMessages = [
      {
        role: 'system',
        content: `
Character Overview:
- Name: ${bot1Prompt.name || 'No name'}
- Description: ${bot1Prompt.description?.details?.join(' ') || 'No description'}

Personality:
- Traits: ${bot1Prompt.personality?.traits?.join(', ') || 'None'}
- Values: ${bot1Prompt.personality?.values?.join(', ') || 'None'}
- Culture: ${bot1Prompt.personality?.culture?.join(', ') || 'None'}
- Unexpected Scenarios: ${bot1Prompt.personality?.unexpected_scenarios || 'None'}

Instructions:
- Do:
${bot1Prompt.instruction?.do_donts?.do?.map((d) => `- ${d}`).join('\n') || 'None'}
- Don’t: ${bot1Prompt.instruction?.do_donts?.dont || 'None'}
- Message Length: ${bot1Prompt.instruction?.message_length || 'Any'}
- Emoji Use: ${bot1Prompt.instruction?.emoji_use || 'Any'}
- Catchphrases: ${bot1Prompt.instruction?.catchphrases?.join(', ') || 'None'}
- Criticism Response:
${bot1Prompt.instruction?.criticism_response?.join('\n') || 'None'}

Example Messages:
${bot1Prompt.example_dialogues?.map(e => `User: ${e.user}\nBot: ${e.response}`).join('\n') || 'No examples'}
        `.trim(),
      },
      ...chatHistory,
    ];

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: promptMessages,
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const botReply = response.data.choices[0].message.content.trim();
    res.json({ reply: botReply });
  } catch (err) {
    console.error('❌ Chat error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'OpenAI request failed' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});