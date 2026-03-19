const {
  conceptExplainPrompt,
  questionAnswerPrompt,
} = require("../../backend/utils/prompts");

const callGroqAPI = async (prompt) => {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Groq API Error:", error);
      throw new Error(`Groq API failed: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    console.log("Groq API Response:", JSON.stringify(data, null, 2));
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error("Unexpected response format from Groq API");
    }
    
    return data.choices[0].message.content;
  } catch (error) {
    console.error("callGroqAPI Error:", error);
    throw error;
  }
};

const generateInterviewQuestions = async (req, res) => {
  try {
    const { role, experience, topicsToFocus, numberOfQuestions } = req.body;
    if (!role || !experience || !topicsToFocus || !numberOfQuestions) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    console.log("Generating questions for:", { role, experience, topicsToFocus, numberOfQuestions });
    
    const prompt = questionAnswerPrompt(
      role,
      experience,
      topicsToFocus,
      numberOfQuestions
    );

    const rawText = await callGroqAPI(prompt);
    console.log("Raw API response length:", rawText.length);
    console.log("Raw API response:", rawText);

    // Clean the response - remove markdown code blocks if present
    let cleanedText = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    console.log("Cleaned text length:", cleanedText.length);
    console.log("Cleaned text:", cleanedText);

    // Parse JSON
    let data;
    try {
      data = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError.message);
      console.error("Failed to parse:", cleanedText.substring(0, 200));
      throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
    }

    // Ensure it's an array
    if (!Array.isArray(data)) {
      console.error("Data is not an array:", data);
      throw new Error("AI response is not an array of questions");
    }

    console.log("Successfully parsed questions count:", data.length);
    res.status(200).json(data);
  } catch (error) {
    console.error("GENERATION ERROR:", error.message);
    console.error("Full error:", error);
    res.status(500).json({
      message: "Failed to generate questions",
      error: error.message,
    });
  }
};

const generateConceptExplanation = async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ message: "Question is required" });
    }

    const prompt = `Provide the explanation as valid JSON like this:\n\`\`\`json\n{\n  "explanation": "Your answer here"\n}\n\`\`\`\n\nQuestion: ${question}`;

    const rawText = await callGroqAPI(prompt);
    console.log("Raw explanation response:", rawText);

    const cleanedText = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    console.log("Cleaned explanation text:", cleanedText);
    
    let data;
    try {
      data = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Explanation JSON Parse Error:", parseError.message);
      throw new Error(`Failed to parse explanation as JSON: ${parseError.message}`);
    }

    res.status(200).json(data);
  } catch (error) {
    console.error("Explanation generation error:", error.message);
    res.status(500).json({
      message: "Failed to generate explanation",
      error: error.message,
    });
  }
};


module.exports = { generateInterviewQuestions, generateConceptExplanation };
