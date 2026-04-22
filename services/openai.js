const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateRoadmap(messages) {
    try {
        const response = await client.chat.completions.create({
            model: 'gpt-4o',
            messages: messages,
            response_format: { type: 'json_object' }
        });
        return response.choices[0].message.content;
    } catch (error) {
        if (error.status === 429) throw new Error('Rate limit hit — try again in a moment');
        throw new Error('OpenAI unavailable — please try again');
    }
}

module.exports = { generateRoadmap };