import 'dotenv/config'; // Load environment variables from .env file
import OpenAI from 'openai';
import { SmoothOperatorClient, ExistingChromeInstanceStrategy } from 'smooth-operator-agent-tools';

// Helper function for delays
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function runTwitterChecker() {
  console.log('Running Twitter AI News Checker Example...');

  const screengraspApiKey = process.env.SCREENGRASP_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!screengraspApiKey) {
    console.error("Error: SCREENGRASP_API_KEY not found in .env file or environment variables. Get a free key at https://screengrasp.com/api.html");
    process.exit(1); // Exit if key is missing
  }

  if (!openaiApiKey) {
    console.warn("Warning: OPENAI_API_KEY not found in .env file or environment variables. OpenAI part will be skipped. Get a key at https://platform.openai.com/api-keys");
  }

  // Initialize the Smooth Operator Client
  const client = new SmoothOperatorClient(screengraspApiKey);

  console.log("Starting server (can take a while, especially on first run, because it's installing the server)...");
  try {
    // StartServer ensures the Smooth Operator server process is running.
    await client.startServer();
    console.log("Server started successfully.");
  } catch (error) {
    console.error("Failed to start server:", error);
    return; // Exit if server fails to start
  }

  let tweetsText = "";
  let isBrowserOpen = false;
  const accounts = ["kimmonismus", "ai_for_success", "slow_developer"];

  try {
    console.log("Processing Twitter accounts...");
    for (const account of accounts) {
      const url = `https://x.com/${account}`;

      if (!isBrowserOpen) {
        console.log(`Opening browser to ${url}...`);
        // Pass arguments as an object matching the API definition
        const openResult = await client.chrome.openChrome(url);
        console.log(openResult?.message ?? "Attempted to open Chrome.");
        if (openResult?.message?.startsWith('Error')) {
            console.error("Failed to open Chrome.");
            return;
        }
        isBrowserOpen = true;
        console.log("Waiting for browser to load (7s)...");
        await delay(7000); // give the newly opened browser some time
      } else {
        console.log(`Navigating to ${url}, waiting (4s)...`);
        // Pass arguments as an object matching the API definition
        await client.chrome.navigate(url);
        await delay(4000); // give navigation some time
      }

      // Scroll down the timeline
      console.log("Scrolling down...");
      for (let i = 0; i < 3; i++) {
        // Pass arguments individually matching the API definition
        await client.mouse.scroll(200, 200, 20, 'down'); // scroll down slightly (positive clicks = down)
        await delay(1000);
      }

      console.log(`Getting text from ${url}...`);
      const response = await client.chrome.getText();
      if (response?.success && response.resultValue) {
        tweetsText += response.resultValue + "\n--------------------\n"; // separator
      } else {
        console.warn(`Warning: Could not get text from ${url}. Message: ${response?.message}`);
      }
      await delay(1000); // Small delay between accounts
    } // End of account loop

    if (!tweetsText.trim()) {
      console.error("Error: Could not retrieve any tweet text. Skipping OpenAI analysis.");
    } else if (!openaiApiKey) {
      console.warn("Skipping OpenAI analysis as API key is missing.");
    } else {
      console.log("Asking OpenAI about the collected tweets...");
      try {
        const openaiClient = new OpenAI({ apiKey: openaiApiKey });
        const chatCompletion = await openaiClient.chat.completions.create({
          model: "gpt-4o", // Use a suitable model like gpt-4o
          response_format: { type: "json_object" },
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `These are the latest tweets of some twitter accounts that are typically very up-to-date on AI news. Give me a summary on the concrete topics they write about (3 bullet points, one short sentence, each) and a rating 0-100 if you have the impression that actual very big breaking news has just occurred within the last hour.
<tweets>${tweetsText}</tweets>
Answer with a JSON in this form:
{
    "summaryBulletPoints": [
        "bullet point 1",
        "bullet point 2",
        "bullet point 3"
    ],
    "breakingNewsProbabilityInPercent": 50
}`
                }
              ]
            }
          ]
        });

        const resultText = chatCompletion.choices[0].message.content;
        console.log("--- OpenAI Result ---");
        try {
          // Try to pretty-print if it's valid JSON
          console.log(JSON.stringify(JSON.parse(resultText || '{}'), null, 4));
        } catch {
          console.log(resultText); // Print as is if not valid JSON
        }
        console.log("--------------------");

      } catch (ex: any) {
        console.error("Error calling OpenAI:", ex.message || ex);
      }
    }

  } catch (error: any) {
    console.error("An error occurred during execution:", error.message || error);
  } finally {
    // Ensure the server is stopped even if errors occur
    console.log("Stopping server...");
    client.stopServer(); // Optional: Stop the server explicitly
    console.log("Twitter example finished.");
  }
} 