// Vercel Serverless Function: api/analyze.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { textPrompt, base64Image, langCode } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not set on the server.' });
    }

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        let parts = [];
        
        if (textPrompt) {
            parts.push({ text: `Analyze this meal: "${textPrompt}". Estimate the macronutrients. Return ONLY a valid JSON object with keys: "name" (a short string name of the food in ${langCode}), "calories" (number), "protein" (number), "fat" (number), "carbs" (number). No markdown.` });
        } else {
            parts.push({ text: `Analyze the food in this image. Estimate the macronutrients. Return ONLY a valid JSON object with keys: "name" (a short string name of the food in ${langCode}), "calories" (number), "protein" (number), "fat" (number), "carbs" (number). No markdown.` });
        }

        if (base64Image) {
            parts.push({ inline_data: { mime_type: "image/jpeg", data: base64Image } });
        }

        const requestBody = { 
            contents: [{ parts: parts }], 
            generationConfig: { temperature: 0.2, response_mime_type: "application/json" } 
        };

        const response = await fetch(url, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(requestBody) 
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const jsonText = data.candidates[0].content.parts[0].text;
        
        let cleanJson = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleanJson);
        
        const finalResult = {
            name: result.name || (langCode === 'Korean' ? '식단' : '食事'),
            calories: Math.max(0, parseInt(result.calories) || 0),
            protein: Math.max(0, parseInt(result.protein) || 0),
            fat: Math.max(0, parseInt(result.fat) || 0),
            carbs: Math.max(0, parseInt(result.carbs) || 0),
        };

        return res.status(200).json(finalResult);
    } catch (error) {
        console.error("AI Analysis Error:", error);
        return res.status(500).json({ error: error.message || "Failed to analyze meal." });
    }
}
