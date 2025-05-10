import { createServer } from 'net';
import { v3 } from 'node-hue-api';

interface MCPCommand {
  type: string;
  lightId?: string;
  color?: [number, number, number];
  times?: number; // Number of times to flash
  brightness?: number; // 0-100
  effectType?: string; // colorloop, none
  transitionTime?: number; // in milliseconds
  alert?: 'none' | 'select' | 'lselect'; // none = no alert, select = single flash, lselect = flash for 15s
  temperature?: number; // color temperature in Kelvin (2000-6500)
  scene?: string; // scene identifier
  group?: string; // group identifier
  duration?: number; // Duration in seconds for effects like disco
  speed?: number; // Speed of effect (milliseconds between changes)
}

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
        capabilities: [
          'lights',
          'colors',
          'flash',
          'brightness',
          'effects',
          'temperature',
          'scenes',
          'groups',
          'disco'
        ]
      }) + '\n'
    );
  });

  // Initialize Hue bridge connection
  try {
    console.log('Initializing Hue bridge connection...');
    await initializeHueBridge();
    console.log('Hue bridge initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Hue bridge:', error);
    throw error;
  }

  server.listen(port, () => {
    console.log('=================================');
    console.log(`MCP server listening on port ${port}`);
    console.log(`Connected to Hue bridge at ${process.env.HUE_BRIDGE_IP}`);
    console.log(`Found ${state.lights.length} lights`);
    console.log('=================================');
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

interface MCPResponse {
  type: string;
  error?: string;
  success?: boolean;
  lights?: Array<{
    id: string;
    name: string;
    state: any;
  }>;
  groups?: Array<{
    id: string;
    name: string;
    lights: string[];
    state: any;
  }>;
  scenes?: Array<{
    id: string;
    name: string;
    lights: string[];
  }>;
  schedules?: Array<{
    id: string;
    name: string;
    description: string;
    localtime: string;
    status: string;
  }>;
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

    case 'get_groups':
      const groups = await state.bridge.groups.getAll();
      return {
        type: 'groups_list',
        groups: groups.map((group: any) => ({
          id: group.id,
          name: group.name,
          lights: group.lights,
          state: group.state
        }))
      };

    case 'get_scenes':
      const scenes = await state.bridge.scenes.getAll();
      return {
        type: 'scenes_list',
        scenes: scenes.map((scene: any) => ({
          id: scene.id,
          name: scene.name,
          lights: scene.lights
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
        await state.bridge.lights.setLightState(command.lightId, {
          on: true,
          bri: 254,
          rgb: command.color
        });
        return { type: 'success', success: true };
      } catch (error: any) {
        return {
          type: 'error',
          error: error.message || 'Failed to flash light'
        };
      }

    case 'set_brightness':
      if (!command.lightId || command.brightness === undefined) {
        return { type: 'error', error: 'Missing lightId or brightness' };
      }
      try {
        const bri = Math.round((command.brightness / 100) * 254);
        await state.bridge.lights.setLightState(command.lightId, {
          on: true,
          bri
        });
        return { type: 'success', success: true };
      } catch (error: any) {
        return {
          type: 'error',
          error: error.message || 'Failed to set brightness'
        };
      }

    case 'set_effect':
      if (!command.lightId || !command.effectType) {
        return { type: 'error', error: 'Missing lightId or effectType' };
      }
      try {
        await state.bridge.lights.setLightState(command.lightId, {
          effect: command.effectType
        });
        return { type: 'success', success: true };
      } catch (error: any) {
        return {
          type: 'error',
          error: error.message || 'Failed to set effect'
        };
      }

    case 'set_temperature':
      if (!command.lightId || !command.temperature) {
        return { type: 'error', error: 'Missing lightId or temperature' };
      }
      try {
        // Convert Kelvin to Mired (what Hue uses)
        const ct = Math.round(1000000 / command.temperature);
        await state.bridge.lights.setLightState(command.lightId, {
          on: true,
          ct
        });
        return { type: 'success', success: true };
      } catch (error: any) {
        return {
          type: 'error',
          error: error.message || 'Failed to set color temperature'
        };
      }

    case 'activate_scene':
      if (!command.scene) {
        return { type: 'error', error: 'Missing scene identifier' };
      }
      try {
        await state.bridge.scenes.activateScene(command.scene);
        return { type: 'success', success: true };
      } catch (error: any) {
        return {
          type: 'error',
          error: error.message || 'Failed to activate scene'
        };
      }

    case 'set_group_state':
      if (!command.group) {
        return { type: 'error', error: 'Missing group identifier' };
      }
      try {
        const state: any = {};
        if (command.color) state.rgb = command.color;
        if (command.brightness !== undefined)
          state.bri = Math.round((command.brightness / 100) * 254);
        if (command.temperature)
          state.ct = Math.round(1000000 / command.temperature);
        if (command.effectType) state.effect = command.effectType;

        await state.bridge.groups.setGroupState(command.group, state);
        return { type: 'success', success: true };
      } catch (error: any) {
        return {
          type: 'error',
          error: error.message || 'Failed to set group state'
        };
      }

    case 'disco':
      if (!command.lightId) {
        return { type: 'error', error: 'Missing lightId' };
      }
      try {
        const duration = command.duration || 30; // Default 30 seconds
        const speed = command.speed || 500; // Default 500ms between changes
        const colors: [number, number, number][] = [
          [255, 0, 0], // Red
          [255, 0, 255], // Purple
          [0, 0, 255], // Blue
          [0, 255, 255], // Cyan
          [0, 255, 0], // Green
          [255, 255, 0] // Yellow
        ];

        let colorIndex = 0;
        const startTime = Date.now();

        // Start an interval that will run for the specified duration
        const interval = setInterval(async () => {
          try {
            // Set next color in sequence
            await state.bridge.lights.setLightState(command.lightId, {
              on: true,
              bri: 254,
              rgb: colors[colorIndex],
              transitiontime: 0 // Instant transition for disco effect
            });

            // Move to next color
            colorIndex = (colorIndex + 1) % colors.length;

            // Check if we've reached the duration
            if (Date.now() - startTime >= duration * 1000) {
              clearInterval(interval);
            }
          } catch (error) {
            console.error('Error in disco interval:', error);
          }
        }, speed);

        return { type: 'success', success: true };
      } catch (error: any) {
        return {
          type: 'error',
          error: error.message || 'Failed to start disco effect'
        };
      }

    case 'turn_off':
      if (!command.lightId) {
        return { type: 'error', error: 'Missing lightId' };
      }
      try {
        await state.bridge.lights.setLightState(command.lightId, {
          on: false
        });
        return { type: 'success', success: true };
      } catch (error: any) {
        return {
          type: 'error',
          error: error.message || 'Failed to turn off light'
        };
      }

    default:
      return {
        type: 'error',
        error: 'Unknown command'
      };
  }
}
