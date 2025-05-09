import { createServer } from 'net';
import * as nodeHueApi from 'node-hue-api';
const { v3 } = nodeHueApi;

interface HueState {
  bridge: any;
  lights: any[];
}

const state: HueState = {
  bridge: null,
  lights: []
};

export async function startMCPServer(port: number = 3000) {
  const server = createServer(socket => {
    let buffer = '';

    socket.on('data', data => {
      buffer += data.toString();

      // Process complete messages
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const message = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        handleMessage(message, socket).catch(error => {
          console.error('Error handling message:', error);
          socket.write(
            JSON.stringify({
              type: 'error',
              error: 'Internal server error'
            }) + '\n'
          );
        });
      }
    });

    // Send hello message when client connects
    socket.write(
      JSON.stringify({
        type: 'hello',
        version: '1.0.0',
        capabilities: ['lights', 'colors', 'flash']
      }) + '\n'
    );
  });

  // Initialize Hue bridge connection
  try {
    await initializeHueBridge();
  } catch (error) {
    console.error('Failed to initialize Hue bridge:', error);
    throw error;
  }

  server.listen(port, () => {
    console.log(`MCP server listening on port ${port}`);
  });
}

async function initializeHueBridge() {
  try {
    // This is a simplified version - in a real implementation,
    // we'd need to handle bridge discovery and user creation
    const host = process.env.HUE_BRIDGE_IP;
    const username = process.env.HUE_USERNAME;

    if (!host || !username) {
      throw new Error(
        'HUE_BRIDGE_IP and HUE_USERNAME environment variables must be set'
      );
    }
    state.bridge = await v3.api.createLocal(host).connect(username);
    state.lights = await state.bridge.lights.getAll();

    console.log('Connected to Hue bridge successfully');
  } catch (error) {
    console.error('Failed to connect to Hue bridge:', error);
    throw error;
  }
}

interface MCPCommand {
  type: string;
  lightId?: string;
  color?: [number, number, number];
  times?: number; // Number of times to flash
}

interface MCPResponse {
  type: string;
  error?: string;
  lights?: Array<{
    id: string;
    name: string;
    state: any;
  }>;
  success?: boolean;
}

async function handleMessage(message: string, socket: any): Promise<void> {
  try {
    const command: MCPCommand = JSON.parse(message);
    const response = await handleCommand(command);
    socket.write(JSON.stringify(response) + '\n');
  } catch (error: any) {
    socket.write(
      JSON.stringify({
        type: 'error',
        error: error.message || 'Invalid command format'
      }) + '\n'
    );
  }
}

async function handleCommand(command: MCPCommand): Promise<MCPResponse> {
  switch (command.type) {
    case 'get_lights':
      return {
        type: 'lights_list',
        lights: state.lights.map(light => ({
          id: light.id,
          name: light.name,
          state: light.state
        }))
      };

    case 'set_color':
      if (!command.lightId || !command.color) {
        return {
          type: 'error',
          error: 'Missing lightId or color'
        };
      }
      try {
        await state.bridge.lights.setLightState(command.lightId, {
          on: true,
          bri: 254, // Set to maximum brightness
          rgb: command.color
        });
        return {
          type: 'success',
          success: true
        };
      } catch (error: any) {
        return {
          type: 'error',
          error: error.message || 'Failed to set light color'
        };
      }

    case 'flash':
      if (!command.lightId || !command.color) {
        return {
          type: 'error',
          error: 'Missing lightId or color'
        };
      }
      try {
        const times = command.times || 3;
        for (let i = 0; i < times; i++) {
          await state.bridge.lights.setLightState(command.lightId, {
            on: true,
            bri: 254,
            rgb: command.color
          });
          await new Promise(resolve => setTimeout(resolve, 500));
          await state.bridge.lights.setLightState(command.lightId, {
            on: false
          });
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        // End with the light on and the color set
        await state.bridge.lights.setLightState(command.lightId, {
          on: true,
          bri: 254,
          rgb: command.color
        });
        return {
          type: 'success',
          success: true
        };
      } catch (error: any) {
        return {
          type: 'error',
          error: error.message || 'Failed to flash light'
        };
      }

    default:
      return {
        type: 'error',
        error: 'Unknown command'
      };
  }
}
