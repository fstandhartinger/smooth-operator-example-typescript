import { SmoothOperatorClient } from 'smooth-operator-agent-tools';
import * as dotenv from 'dotenv';
import * as path from 'path';
// Import the new twitter checker example, uncomment below to run it
import { runTwitterChecker } from './twitter-ai-news-checker';

// Load environment variables from .env file in the project root
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Helper function to mimic C# and Python's toJsonString() method
const toJsonString = (obj: any): string => {
  return JSON.stringify(obj, null, 2);
};

async function main() {

  // await runTwitterChecker(); // Uncomment this to run the Twitter example
  // return;

  console.log("Starting Smooth Operator TypeScript Example...");

  // Get API keys from environment variables
  const screengraspApiKey = process.env.SCREENGRASP_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!screengraspApiKey) {
    console.error("Error: SCREENGRASP_API_KEY not found in .env file. Get a free key at https://screengrasp.com/api.html");
    console.log("Please ensure you have a .env file in the example project root (client-libs/example-typescript)");
    console.log("with the line: SCREENGRASP_API_KEY=your_actual_key");
    return;
  }

  if (!openaiApiKey) {
    console.warn("Warning: OPENAI_API_KEY not found in .env file. OpenAI part will be skipped. Get a key at https://platform.openai.com/api-keys");
  }

  // Initialize the client with the ScreenGrasp API key
  const client = new SmoothOperatorClient(screengraspApiKey); // alternatively you can connect to a running server using the second parameter, e.g.: , "http://localhost:54321");

  try {
    // Start the server process in the background.
    // This handles download and extraction if it's not installed or outdated.
    // Can take a while, especially on first run.
    console.log("Starting server (can take a while, especially on first run, because it's installing the server)...");
    await client.startServer();

    // 1. Open Calculator
    // Open the Windows Calculator application.
    console.log("Opening calculator...");
    await client.system.openApplication("calc"); // Use "calc" for consistency

    // 2. Type "3+4"
    // Type the string "3+4" into the currently focused window (hopefully the calculator).
    console.log("Typing '3+4'...");
    await client.keyboard.type("3+4"); // assumes the calc app is focused

    // 3. Click the "equals" button using ScreenGrasp    
    // Click the UI element described as "the equals sign" using ScreenGrasp.
    // Alternatives:
    // - await client.keyboard.type("="); // Simpler and faster
    // - Using Windows UI Automation, e.g. client.automation.invoke() a bit more complex to implement but very robust (not affected by focus changes)
    console.log("Clicking equals sign...");
    await client.mouse.clickByDescription("the equals sign");

    // 4. Retrieve the UI overview (Automation Tree)
    // Get an overview of the current system state, including the focused window's automation tree.
    // Assumes the calculator is still the focused window. Be mindful of focus changes during debugging.
    console.log("Getting window overview...");
    const overview = await client.system.getOverview(); // assumes calc is focused

    // 5. (Optional) Use AI (e.g., OpenAI) to interpret the result from the tree
    if (openaiApiKey && overview?.focusInfo?.focusedElementParentWindow) {
      // You can use GPT-4o or other ai models for all sorts of tasks together with the Smooth Operator Agent Tools.
      // In this case we use it to read the result of the calculator from its automation tree.
      // But it can also for example be used to decide which button to click next, what text to type, etc.
      console.log("Asking OpenAI about the result...");
      try {
        const { OpenAI } = require("openai"); // Use require for conditional import
        const openai = new OpenAI({ apiKey: openaiApiKey });
        const focusedWindowJson = toJsonString(overview.focusInfo.focusedElementParentWindow); // Use helper
        const completion = await openai.chat.completions.create({
          model: "gpt-4o", // Or your preferred model
          messages: [
            // { role: "system", content: "You are an assistant that analyzes UI automation trees to find calculation results." }, // Simplified prompt like Python/C#
            { role: "user", content: `What result does the calculator display? You can read it from its automation tree: ${focusedWindowJson}` }
          ],
        });
        const resultText = completion.choices[0]?.message?.content;
        console.log("OpenAI Result:", resultText || "No result received.");
      } catch (aiError: any) { // Added type annotation
        console.error("Error during AI interpretation:", aiError.message || aiError);
      }
    } else if (openaiApiKey) { // Added condition to check if overview failed but key exists
        console.log("Could not get focused window information to send to OpenAI.");
    } else {
        console.log("OpenAI key not provided, skipping result verification.");
    }

  /*
   * --- Alternative using Screenshot ---
   * Taking a screenshot and analyzing it with AI is another option,
   * but generally less reliable and more costly than using the automation tree.
   * Prefer Automation Tree > Keyboard > Screenshot for robustness and cost-efficiency.
   */
  /*
  if (openaiApiKey) {
    console.log("Taking screenshot...");
    const screenshot = await client.screenshot.take();
    console.log("Asking OpenAI about the screenshot...");
    try {
      const { OpenAI } = require("openai");
      const openai = new OpenAI({ apiKey: openaiApiKey });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "What result does the calculator display based on the screenshot?" },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${screenshot.base64Image}`, // Property name is base64Image
                },
              },
            ],
          },
        ],
        // max_tokens: 300, // Optional: limit response length
      });
      const resultText = completion.choices[0]?.message?.content;
      console.log("OpenAI Screenshot Result:", resultText || "No result received.");
    } catch (aiError: any) {
      console.error("Error calling OpenAI with screenshot:", aiError.message || aiError);
    }
  }
  */

} catch (error) {
  console.error("\n--- An error occurred during the example execution ---");
  if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
      // console.error(`Stack: ${error.stack}`); // Stack trace can be verbose
  } else {
      console.error("Unknown error:", error);
  }
  console.error("------------------------------------------------------");
} finally {
  // Ensure the server is stopped even if errors occur
  console.log("Stopping server...");
  client.stopServer(); // Optional: Stop the server explicitly if needed, though client disposal might handle it.
  console.log("\nSmooth Operator Server stopped (if started by this client).");
}

console.log("\nExample finished."); // Add final message
  }

// Run the main function
main();