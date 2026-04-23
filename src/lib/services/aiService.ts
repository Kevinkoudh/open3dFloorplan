import { get } from 'svelte/store';
import { currentProject } from '$lib/stores/project';
import { addWall } from '$lib/stores/project';

export async function askAI(userMessage: string) {
  // Retrieve current project data
  const project = get(currentProject);
  if (!project) {
    return 'No project loaded.';
  }

  // Create a summary of the project for the AI
  const floor = project.floors.find(f => f.id === project.activeFloorId);
  const wantsAction = userMessage.toLowerCase().includes('wall') || userMessage.toLowerCase().includes('room');
  const projectSummary = JSON.stringify({
    name: project.name,
    walls: floor?.walls.length ?? 0,
    rooms: floor?.rooms.map(r => ({ name: r.name, area: r.area })) ?? [],
    furniture: floor?.furniture.map(f => f.catalogId) ?? [],
    doors: floor?.doors.length ?? 0,
    windows: floor?.windows.length ?? 0
  });

  // Llama model running locally
  try { 
    const response = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      "model": "llama3.1",
      "messages": [{
      "role": "user",
      "content": `You're are an assistant for a 2D Floorplanner/3D model design tool. You are cabable of answering basic questions about the project.
        If the user asks questions about their project, you will answer based on the ${projectSummary}.
        Always use the project data to answer, never make assumptions. If the question cannot be answered with the given data, say you don't know and explain why. 
        Only answer the specific question, do not give any additional information that is not asked for. Here is the user's question: ${userMessage}`
        }],
      "stream": false,
      ...(wantsAction ? {"tools" : [
          {
            type: "function",
            function: {
            name: "addWall",
            description: "Place a wall or create a room in the floorplan, with the correct start and ending points. Only use the addWall tool when the user explicitly asks to place a wall or create a room. For all other questions, respond with text",
            parameters: {
              type: "object",
              required: ["start", "end"],
              properties: {
                start: { 
                  type: "object",
                  description: "The starting point of the wall",
                  properties: {
                    x: { type: "number" },
                    y: { type: "number" }
                  },
                },
                end: {
                  type: "object",
                  description: "The ending point of the wall",
                  properties: {
                    x: { type: "number" },
                    y: { type: "number" }
                }
              }
            }
          }
        }
      }]} : {})
    })
  })
  
    const data = await response.json();
  
    if (data.message.tool_calls) {
      const call = data.message.tool_calls[0];
      const args = call.function.arguments;
      
      if (call.function.name === "addWall") {
        
        if (typeof args.start?.x !== 'number' || typeof args.start?.y !== 'number' ||
          typeof args.end?.x !== 'number' || typeof args.end?.y !== 'number') {
          return "Could not place wall: the AI returned invalid coordinates.";
        }

        addWall(args.start, args.end);
        return `I've added a wall according to your request.`;
      }
        else {
          return data.message.content ||  "I can only help with floorplan questions or instructions";
        }
      }

    else {
      return data.message.content || "Something went wrong generating an repsonse";
    }

  }
    catch (error) {
      return "An error occurred while communicating with the AI service.";
    }
}