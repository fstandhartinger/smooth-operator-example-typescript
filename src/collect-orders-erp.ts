import 'dotenv/config';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as https from 'https';
import { SmoothOperatorClient, ExistingChromeInstanceStrategy } from 'smooth-operator-agent-tools';
import OpenAI from 'openai';

// Helper function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Interface for order data
interface OrderedArticle {
  articleName: string;
  quantity: number;
  pricePerUnit: number;
}

interface Order {
  customerName: string;
  orderedArticles: OrderedArticle[];
}

// Interface for ERP element IDs
interface ErpElementIds {
  elementIdCustomerName: string;
  elementIdArticleName: string;
  elementIdQuantity: string;
  elementIdPricePerUnit: string;
  elementIdAddItemButton: string;
  elementIdSaveOrderButton: string;
}

/**
 * Get a screenshot of an order email from Gmail
 */
async function getOrderScreenshotFromGmail(client: SmoothOperatorClient) {
  /*
   * Example Email Content to send to your Gmail for testing:
   *
   * Subject: New Computerstuff.com Order
   * Text:
   * Dear you,
   *
   * I just visited our customer Smith & Co. Ltd.
   * They want to order:
   *
   * - Product Name: High-Speed Router X200
   *   Quantity: 5 units
   *   Price per unit: 120.00
   *
   * - Product Name: Cat6 Ethernet Cable (10m)
   *   Quantity: 10 units
   *   Price per unit: 15.00
   *
   * Best regards,
   * John Doe
   * Sales Representative
   */
  console.log("Opening Gmail in Chrome...");
  // ForceClose strategy might be disruptive, consider alternatives if needed
  const openResult = await client.chrome.openChrome("https://mail.google.com/", ExistingChromeInstanceStrategy.ForceClose);
  console.log(openResult?.message ?? "Attempted to open Chrome.");
  
  if (openResult?.message?.startsWith('Error')) {
    console.error("Failed to open Chrome.");
    return null;
  }
  
  // Generous delay for Gmail load and potential login
  await delay(10000);

  // Basic navigation - might need adjustments based on Gmail's UI state
  console.log("Searching for 'order' in Gmail...");
  // Use description-based click for search bar
  await client.mouse.clickByDescription("the search mail input field");
  await delay(1000);
  await client.keyboard.type("New Computerstuff.com Order");
  await delay(500);
  await client.keyboard.press("Enter");
  await delay(5000); // Wait for search results

  console.log("Clicking the first email in the search results...");
  // This description might need refinement
  await client.mouse.clickByDescription("the first email result in the list");
  await delay(5000); // Wait for email to load

  console.log("Taking screenshot of the email...");
  const screenshot = await client.screenshot.take();
  return screenshot;
}

/**
 * Get a screenshot of an order email from Outlook
 */
async function getOrderScreenshotFromOutlook(client: SmoothOperatorClient) {
  console.log("Opening Outlook...");
  try {
    await client.system.openApplication("outlook");
    await delay(10000); // Generous delay for Outlook to load
  } catch (ex) {
    console.error(`Failed to open Outlook: ${ex}. Make sure Outlook is installed.`);
    return null;
  }

  console.log("Searching for 'order' in Outlook...");
  // Using keyboard shortcuts for search
  await client.keyboard.press("Ctrl+E"); // Focus search bar shortcut
  await delay(2000);
  await client.keyboard.type("New Computerstuff.com Order");
  await delay(5000);
  await client.keyboard.press("Enter");
  await delay(5000); // Wait for search results

  console.log("Clicking the first email in the Outlook search results...");
  // Using description-based click - might need adjustment
  await client.mouse.clickByDescription("the first email shown in the list pane");
  await delay(5000); // Wait for email to load

  console.log("Taking screenshot of Outlook...");
  const screenshot = await client.screenshot.take();
  return screenshot;
}

/**
 * Download the mock ERP application
 */
async function downloadMockErp(): Promise<string | null> {
  const downloadUrl = "https://www.dropbox.com/scl/fi/4qc9w57zrmmisyqu3ojnp/mini-erp-mock.exe?rlkey=x5m3ob810zt1scf0mpfn15l4v&dl=1";
  const tempPath = os.tmpdir();
  const fileName = "mini-erp-mock.exe";
  const destinationPath = path.join(tempPath, fileName);

  // Check if file already exists
  if (fs.existsSync(destinationPath)) {
    console.log("Mock ERP already exists, skipping download.");
    return destinationPath;
  }

  return new Promise<string | null>((resolve) => {
    console.log(`Downloading mock ERP application to ${destinationPath}...`);
    const file = fs.createWriteStream(destinationPath);
    
    https.get(downloadUrl, (response) => {
      if (response.statusCode !== 200) {
        console.error(`Failed to download: HTTP ${response.statusCode}`);
        file.close();
        fs.unlinkSync(destinationPath);
        resolve(null);
        return;
      }

      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log("Download completed.");
        resolve(destinationPath);
      });
      
    }).on('error', (err) => {
      fs.unlinkSync(destinationPath);
      console.error(`Error downloading mock ERP: ${err.message}`);
      resolve(null);
    });
  });
}

/**
 * Extract order data from screenshot using OpenAI
 */
async function parseOrderDataFromScreenshot(
  screenshot: any, 
  openaiApiKey: string
): Promise<Order | null> {
  if (!openaiApiKey) {
    console.log("No OpenAI API key provided, skipping order extraction.");
    return null;
  }
    
  console.log("Asking OpenAI to extract order data from screenshot...");
  try {
    const openai = new OpenAI({ apiKey: openaiApiKey });
    
    const prompt = `Extract the order details from the email in the screenshot. Provide the output strictly in the following JSON format:
{
  "customerName": "name of the customer",
  "orderedArticles": [
    {
      "articleName": "name of the article",
      "quantity": quantity_as_number,
      "pricePerUnit": price_as_number
    }
    // ... more articles if present
  ]
}`;

    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${screenshot.imageBase64}`
              }
            }
          ]
        }
      ]
    });
    
    const jsonResponse = chatCompletion.choices[0].message.content;
    console.log(`OpenAI Order Extraction Response: ${jsonResponse}`);
    
    if (!jsonResponse) {
      console.error("Error: Empty response from OpenAI");
      return null;
    }
    
    // Parse the JSON response
    const orderData = JSON.parse(jsonResponse);
    console.log(`Successfully extracted order for customer: ${orderData.customerName}`);
    
    return orderData as Order;
    
  } catch (ex) {
    console.error(`Error calling OpenAI for order extraction: ${ex}`);
    return null;
  }
}

/**
 * Use OpenAI to identify the element IDs in the ERP UI
 */
async function identifyErpElementIds(
  windowDetailsJson: string,
  openaiApiKey: string
): Promise<ErpElementIds | null> {
  if (!openaiApiKey) {
    console.log("No OpenAI API key provided, skipping element ID identification.");
    return null;
  }
    
  console.log("Asking OpenAI to identify ERP element IDs...");
  try {
    const openai = new OpenAI({ apiKey: openaiApiKey });
    
    const prompt = `Based on the following UI automation tree JSON for the 'Mini ERP Mock' application, identify the element IDs for the specified controls. Provide the output strictly in the following JSON format:
{
  "elementIdCustomerName": "ID_for_customer_name_input",
  "elementIdArticleName": "ID_for_article_name_input",
  "elementIdQuantity": "ID_for_quantity_input",
  "elementIdPricePerUnit": "ID_for_price_input",
  "elementIdAddItemButton": "ID_for_add_item_button",
  "elementIdSaveOrderButton": "ID_for_save_order_button"
}

UI Automation Tree JSON:
${windowDetailsJson}`;

    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });
    
    const jsonResponse = chatCompletion.choices[0].message.content;
    console.log(`OpenAI Element ID Response: ${jsonResponse}`);
    
    // Parse the JSON response
    if (!jsonResponse) {
      console.error("Error: Empty response from OpenAI");
      return null;
    }
    
    const elementIds = JSON.parse(jsonResponse) as ErpElementIds;
    
    // Basic validation
    if (!elementIds.elementIdCustomerName) {
      console.error("Error: Could not find necessary element IDs");
      return null;
    }
    
    console.log("Successfully identified ERP element IDs.");
    return elementIds;
    
  } catch (ex) {
    console.error(`Error calling OpenAI for element ID extraction: ${ex}`);
    return null;
  }
}

/**
 * Main function to run the Email-to-ERP example
 */
export async function runCollectOrdersErp() {
  console.log("Starting Email-to-ERP Example...");
  
  // Get API keys from environment variables
  const screengraspApiKey = process.env.SCREENGRASP_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!screengraspApiKey) {
    console.error("Error: SCREENGRASP_API_KEY not found in .env file. Get a free key at https://screengrasp.com/api.html");
    return;
  }
  
  if (!openaiApiKey) {
    console.warn("Warning: OPENAI_API_KEY not found in .env file. OpenAI part will be skipped. Get a key at https://platform.openai.com/api-keys");
  }
  
  // Initialize the Smooth Operator Client
  const client = new SmoothOperatorClient(screengraspApiKey);
  
  console.log("Starting server (can take a while, especially on first run, because it's installing the server)...");
  try {
    await client.startServer();
  } catch (error) {
    console.error("Failed to start server:", error);
    return;
  }
  
  let emailScreenshot = null;
  try {
    // --- Get Order Email Screenshot ---
    // By default, uses Gmail via Chrome.
    // To use local Outlook instead (if installed), comment the Gmail line and uncomment the Outlook line.
    console.log("Attempting to get order email screenshot via Gmail...");
    emailScreenshot = await getOrderScreenshotFromGmail(client);
    // console.log("Attempting to get order email screenshot via Outlook...");
    // emailScreenshot = await getOrderScreenshotFromOutlook(client);
    
    if (!emailScreenshot || !emailScreenshot.success) {
      console.error("Error: Could not get email screenshot.");
      return;
    }
    console.log("Successfully captured email screenshot.");
    
  } catch (ex) {
    console.error(`Error getting email screenshot: ${ex}`);
    return;
  }
  
  // --- Download and Run Mock ERP ---
  let erpExePath = null;
  try {
    console.log("Downloading mock ERP application...");
    erpExePath = await downloadMockErp();
    if (!erpExePath) {
      console.error("Failed to download mock ERP application.");
    } else {
      console.log(`Mock ERP downloaded to: ${erpExePath}`);
      
      console.log("Launching mock ERP application...");
      await client.system.openApplication(erpExePath);
      await delay(5000); // Give the app time to start
      console.log("Mock ERP application launched.");
    }
  } catch (ex) {
    console.error(`Error with mock ERP application: ${ex}`);
    // Continue even if ERP fails
  }
  
  // --- Extract Order Data using AI ---
  let orderData = null;
  if (openaiApiKey && emailScreenshot && emailScreenshot.success) {
    orderData = await parseOrderDataFromScreenshot(emailScreenshot, openaiApiKey);
  } else {
    console.log("Skipping AI order extraction (OpenAI key missing or screenshot failed).");
  }
  
  // --- Automate ERP Data Entry ---
  if (openaiApiKey && orderData && erpExePath) {
    console.log("Attempting to automate data entry into mock ERP...");
    try {
      // 1. Get Overview and Find ERP Window
      console.log("Getting system overview...");
      const overview = await client.system.getOverview();
      
      let windowDetailsJson = null;
      
      if (overview.focusInfo && 
          overview.focusInfo.focusedElementParentWindow && 
          overview.focusInfo.focusedElementParentWindow.title === "ERP system") {
        // If ERP window is already focused, use it
        windowDetailsJson = JSON.stringify(overview.focusInfo.focusedElementParentWindow, null, 2);
      } else {
        // Otherwise, find the ERP window by title
        const erpWindow = overview.windows?.find(w => 
          w.title && w.title.toLowerCase().includes("erp system"));
        
        if (!erpWindow) {
          console.error("Error: Could not find the Mock ERP window.");
          return;
        }
        
        console.log(`Found Mock ERP window: ${erpWindow.id} - ${erpWindow.title}`);
        
        console.log("Getting ERP window details...");
        const windowDetails = await client.system.getWindowDetails(erpWindow.id);
        if (!windowDetails || !windowDetails.userInterfaceElements) {
          console.error("Error: Could not get details for the Mock ERP window.");
          return;
        }
        
        windowDetailsJson = JSON.stringify(windowDetails, null, 2);
      }
      
      // 2. Get Element IDs using AI
      const erpElementIds = await identifyErpElementIds(windowDetailsJson, openaiApiKey);
      if (!erpElementIds) {
        console.error("Error: Could not identify ERP element IDs.");
        return;
      }
      
      // 3. Enter Data using Automation
      console.log(`Entering customer name: ${orderData.customerName} into element ${erpElementIds.elementIdCustomerName}`);
      await client.automation.setValue(erpElementIds.elementIdCustomerName, orderData.customerName);
      await delay(500); // Small delay between actions
      
      for (const article of orderData.orderedArticles) {
        console.log(`Entering article: ${article.articleName}`);
        await client.automation.setValue(erpElementIds.elementIdArticleName, article.articleName);
        await delay(200);
        await client.automation.setValue(erpElementIds.elementIdQuantity, article.quantity.toString());
        await delay(200);
        await client.automation.setValue(erpElementIds.elementIdPricePerUnit, article.pricePerUnit.toFixed(2));
        await delay(200);
        
        console.log("Clicking 'Add Item' button...");
        await client.automation.invoke(erpElementIds.elementIdAddItemButton);
        await delay(1000); // Delay after adding item
      }
      
      console.log("Clicking 'Save Order' button...");
      await client.automation.invoke(erpElementIds.elementIdSaveOrderButton);
      await delay(500);
      
      console.log("Data entry automation complete.");
      
    } catch (ex) {
      console.error(`Error during ERP data entry automation: ${ex}`);
    }
  } else {
    console.log("Skipping ERP data entry (AI steps failed or ERP not running).");
  }
  
  // Ensure the server is stopped even if errors occur
  console.log("Stopping server...");
  client.stopServer();
  
  console.log("\nEmail-to-ERP Example finished.");
} 