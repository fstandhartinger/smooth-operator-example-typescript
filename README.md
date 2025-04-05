# Smooth Operator TypeScript Client Example

This project provides a simple Node.js example demonstrating how to use the [`smooth-operator-agent-tools`](https://www.npmjs.com/package/smooth-operator-agent-tools) TypeScript client library to interact with the Smooth Operator server.

## Features

This example demonstrates:

*   Initializing the `SmoothOperatorClient`.
*   Starting the Smooth Operator background server asynchronously (`startServer`). (Installation is handled by the library's `postinstall` script).
*   Opening an application (Windows Calculator) using `system.openApplication`.
*   Using the keyboard to type input (`keyboard.type`).
*   Using the mouse with ScreenGrasp to click UI elements by description (`mouse.clickByDescription`).
*   Retrieving the UI automation tree of the focused window (`system.getOverview`).
*   (Optional, commented out) Using the OpenAI API (specifically a GPT-4o model) to interpret the automation tree and determine the application's state (e.g., the result displayed in the calculator).
*   (Optional, commented out) Taking a screenshot (`screenshot.take`) and using the OpenAI API to analyze it.

## Prerequisites

*   Node.js (Version 14.0.0 or higher recommended).
*   npm or yarn.
*   A ScreenGrasp API key. Get a free key from [https://screengrasp.com/api.html](https://screengrasp.com/api.html).
*   (Optional) An OpenAI API key if you want to use the GPT-4o integration for result verification. Get a key from [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys).
*   **Windows Operating System:** The underlying Smooth Operator server (`smooth-operator-server.exe`) currently requires Windows to perform automation tasks.

## Setup

1.  **Clone the repository (if you haven't already):**
    ```bash
    # Navigate to the parent directory where you want the 'smooth-operator' folder
    git clone <repository-url> # Replace with the actual URL
    cd smooth-operator/client-libs/example-typescript
    ```

2.  **Install dependencies:**
    This will install the example's dependencies (`dotenv`) and the `smooth-operator-agent-tools` library itself. The `postinstall` script of the library will automatically handle the download and setup of the background server.
    ```bash
    npm install
    # or
    # yarn install
    ```

3.  **Configure API keys:**
    *   Rename the `.env.example` file to `.env`.
    *   Open the `.env` file and replace the placeholder value `your_screengrasp_api_key_here` with your actual ScreenGrasp API key.
    *   (Optional) If using the OpenAI integration, uncomment and replace `your_openai_api_key_here` with your OpenAI key.
    *   **Important:** The `.env` file is listed in the `.gitignore` and should not be committed to version control.

## Running the Example

You can run the compiled JavaScript code or use `ts-node` to run the TypeScript code directly.

**Option 1: Compile and Run (Standard)**

```bash
# Compile TypeScript to JavaScript (output to dist/ folder)
npm run build

# Run the compiled JavaScript
npm start
# or directly: node dist/example.js
```

**Option 2: Run TypeScript Directly (Development)**

```bash
# Uses ts-node to execute the TypeScript file
npm run dev
# or directly: npx ts-node src/example.ts
```

The application will:

1.  Start the Smooth Operator server connection (the server executable should already be installed via `npm install`).
2.  Open the Windows Calculator.
3.  Type "3+4".
4.  Click the "equals" button using ScreenGrasp.
5.  Retrieve the calculator's UI state (automation tree) and attempt to display the result.
6.  If an OpenAI key was provided and the relevant code uncommented, it will ask GPT-4o what result is displayed based on the tree.
7.  Print the result from OpenAI (if applicable).
8.  Stop the server connection and exit.

## Notes

*   This example uses a `.env` file to manage API keys. This is a common practice to keep sensitive credentials out of source control.
*   The OpenAI integration is optional and commented out by default. If you wish to use it, you'll need an OpenAI API key, uncomment the relevant sections in `src/example.ts`, and potentially install the `openai` npm package (`npm install openai`).
*   The example includes pauses (`await delay(...)`) to allow time for applications to open and UI elements to update. You might need to adjust these timings based on your system's performance.
*   The code includes commented-out sections demonstrating how to use screenshots instead of the automation tree for analysis. Screenshots are generally less reliable and potentially more costly in terms of API credits than using the automation tree.