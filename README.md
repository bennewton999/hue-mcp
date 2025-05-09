# Hue MCP Server

A Model Context Protocol (MCP) server for controlling Philips Hue lights. This package provides a simple way to control your Hue lights through MCP, making it easy to integrate with AI assistants and other tools.

## Prerequisites

- Node.js 16 or higher
- A Philips Hue Bridge
- One or more Philips Hue lights

## Installation

You can install the package globally:

```bash
npm install -g @mcpcontrol/hue
```

Or run it directly with npx:

```bash
npx @mcpcontrol/hue
```

## Getting Started

### 1. Find Your Hue Bridge IP

There are several ways to find your Hue Bridge IP:

a) Using the official Hue discovery endpoint:
```bash
curl https://discovery.meethue.com
```

b) Using the Hue mobile app:
1. Open the Hue app
2. Go to Settings > Hue Bridges
3. Tap on the "i" icon next to your bridge
4. Note down the IP address

c) Check your router's DHCP client list for a device named "Philips-hue"

### 2. Create a Hue Username/Token

You'll need to create a new user/token to control your Hue bridge. Here's how:

1. Press the link button on your Hue Bridge (the large circular button)
2. Within 30 seconds, run this command (replace YOUR_BRIDGE_IP with your bridge's IP):

```bash
curl -X POST http://YOUR_BRIDGE_IP/api -H "Content-Type: application/json" -d '{"devicetype":"mcp_hue_server"}'
```

The response will contain your username/token in the format:
```json
[{"success":{"username":"your-username-here"}}]
```

### 3. Configure Environment Variables

Create a .env file or set these environment variables:

```bash
# For macOS/Linux
export HUE_BRIDGE_IP="YOUR_BRIDGE_IP"
export HUE_USERNAME="YOUR_USERNAME"

# For Windows (PowerShell)
$env:HUE_BRIDGE_IP="YOUR_BRIDGE_IP"
$env:HUE_USERNAME="YOUR_USERNAME"
```

## Running the Server

Start the server:

```bash
hue-mcp
```

The server will start on port 3000 by default.

## Using with Different Tools

### VS Code

#### Development in VS Code

1. Open the project in VS Code:
```bash
code .
```

2. Install recommended extensions:
   - [ESLint](vscode:extension/dbaeumer.vscode-eslint)
   - [TypeScript and JavaScript Language Features](vscode:extension/vscode.typescript-language-features)
   - [Model Context Protocol](vscode:extension/github.copilot-chat)

3. Available Tasks:
   - Build: `⇧⌘B` (Shift+Cmd+B) or run "Run Build Task" from Command Palette
   - Start Server: Use the integrated terminal and run `npm run dev`
   - Debug: Press F5 or use the Run and Debug view

#### Using with VS Code as a Client

1. Install the MCP extension for VS Code
2. Open VS Code settings (Cmd/Ctrl + ,)
3. Search for "MCP"
4. Add a new MCP server with:
   - Name: Hue Lights
   - URL: tcp://localhost:3000

5. Test the connection:
   - Open VS Code Command Palette (Cmd/Ctrl + Shift + P)
   - Type "MCP: Connect to Server"
   - Select "Hue Lights"
   - The status bar should show "MCP: Connected"

#### Debugging in VS Code

Launch configurations are included for debugging the server:

1. Set breakpoints in your TypeScript files
2. Press F5 to start debugging
3. The Debug Console will show server output
4. Use the Debug toolbar to:
   - Step through code
   - Inspect variables
   - View call stack
   - Set conditional breakpoints

#### VS Code Tasks

The following tasks are available:
- `npm: build` - Compiles TypeScript to JavaScript
- `npm: dev` - Runs the server in development mode
- `npm: start` - Runs the compiled server

### Using with Other MCP Tools

The server accepts JSON messages over TCP. Each message should be terminated with a newline character.

Available commands:

1. Get all lights:
```json
{"type": "get_lights"}
```

2. Set light color:
```json
{
    "type": "set_color",
    "lightId": "1",
    "color": [255, 0, 0]
}
```

## Development

To run the server locally during development:

1. Clone the repository:
```bash
git clone https://github.com/bennewton999/hue-mcp.git
cd hue-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Start in development mode:
```bash
npm run dev
```

## Troubleshooting

### Common Issues

1. "Cannot connect to bridge"
   - Verify your bridge IP is correct
   - Check if your bridge is powered on and connected to the network
   - Try pinging your bridge: `ping YOUR_BRIDGE_IP`

2. "Unauthorized"
   - Make sure you've created a username/token
   - Verify the username in your environment variables
   - Try recreating the username by following step 2 again

3. "Cannot find lights"
   - Ensure your Hue lights are powered on
   - Check if lights appear in the Hue mobile app
   - Try resetting your bridge

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
