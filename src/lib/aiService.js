// src/lib/aiService.js
const logger = require('./logger');
// Ensure you have node-fetch or a compatible fetch implementation
// You might need to install it: npm install node-fetch
// If using Node 18+, fetch is available globally. For earlier versions:
// const fetch = require('node-fetch'); // Uncomment if needed

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = 'gemini-1.5-flash-001'; // Using the specified model
const BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent`;

/**
 * @function formatHistoryForGemini
 * @description Helper function to format the conversation history into a format compatible with the Gemini API.
 * @param {Array} history - The array of conversation history objects.
 * @returns {Array} The formatted conversation history array for the Gemini API.
 */
const formatHistoryForGemini = (history) => {
  // Check if the history is an array
  if (!Array.isArray(history)) {
    // Log a warning if the history is not an array
    logger.warn('History is not an array:', history);

    // Return an empty array
    return [];
  }
  // Ensure roles alternate correctly and map to Gemini's 'user'/'model'
  return history.map(entry => ({
    role: entry.role === 'ai' ? 'model' : entry.role, // Map 'ai' or other terms if needed to 'model'
    parts: entry.parts,
  }));
};

/**
 * @async
 * @function generateResponse
 * @description Generates a response from the Gemini AI model based on the provided system context, conversation history, and user message.
 * @param {string} systemContext - The system context or persona to guide the AI's responses.
 * @param {Array} history - The array of conversation history objects.
 * @param {string} userMessage - The latest message from the user.
 * @returns {Promise<string|null>} The generated response text or null if an error occurs.
 */
async function generateResponse(systemContext, history, userMessage) {
  // Check if the API key is set
  if (!API_KEY) {
    logger.error('GEMINI_API_KEY environment variable not set.');
    throw new Error('AI Service is not configured.');
  }

  const url = `${BASE_URL}?key=${API_KEY}`;

  // Format the conversation history and add the new user message
  const formattedHistory = formatHistoryForGemini(history);
  const contents = [
    ...formattedHistory,
    { role: 'user', parts: [{ text: userMessage }] }
  ];

  // Construct the request payload
  const payload = {
    // System instruction provides context for the persona
    systemInstruction: {
        parts: [{ text: systemContext }]
    },
    contents: contents,
    // Optional: Configure generation parameters (temperature, safety settings, etc.)
    // generationConfig: {
    //   temperature: 0.7,
    //   topK: 1,
    //   topP: 1,
    //   maxOutputTokens: 2048, // Adjust as needed
    // },
    // safetySettings: [ // Adjust safety settings as needed for roleplaying
    //   { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    //   { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    //   { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    //   { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    // ],
  };

  logger.debug(`Sending request to Gemini: ${JSON.stringify(payload)}`);

  // Try catch block for handling the fetch call
  try {
    // Fetch call to the Gemini API
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });    
    // Check if the response is ok
    if (!response.ok) {
        const errorBody = await response.text();
        logger.error(`Gemini API request failed with status ${response.status}: ${errorBody}`);
        // return null if the response is not ok
        return null;
      }
      // Parse the response to json
      const data = await response.json();
      logger.debug(`Received response from Gemini: ${JSON.stringify(data)}`);

      // Try catch block to handle any error that may occur during the response
      try {
        // Extract the generated text content
        // Handle potential blocks or empty responses
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
           const generatedText = data.candidates[0].content.parts[0].text;
           return generatedText;
        } else if (data.candidates && data.candidates.length > 0 && data.candidates[0].finishReason) {
            // Handle cases where generation stopped due to safety or other reasons
            const reason = data.candidates[0].finishReason;
            logger.warn(`Gemini generation finished with reason: ${reason}`);
            if (reason === 'SAFETY') {
                return "(My response was blocked due to safety filters. Let's try discussing something else!)";
            } else if (reason === 'MAX_TOKENS') {
                return "(My thoughts got cut short! Let's continue.)";
            } else {
                return `(Generation stopped unexpectedly: ${reason})`;
            }
        } else if (data.promptFeedback && data.promptFeedback.blockReason) {
            logger.warn(`Gemini prompt blocked. Reason: ${data.promptFeedback.blockReason}`);
            return `(My ability to respond was blocked due to prompt filters: ${data.promptFeedback.blockReason}. Please rephrase or try a different topic.)`;
        } else {
          logger.warn('Gemini response structure unexpected or empty:', data);
          return null;
        }
      } catch (error) {
        logger.error('Error during processing of the gemini response:', error);
        // return null if there is any error during the parsing of the response
        return null;
      }
  } catch (error) {
    // Log any errors that occur during the command execution
    logger.error('Error calling Gemini API:', error);
    return null;
    }
  }

module.exports = {
  generateResponse,
};