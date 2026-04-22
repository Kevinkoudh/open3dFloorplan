import { get } from 'svelte/store';
import { currentProject } from '$lib/stores/project';

export async function askAI(userMessage: string) {
  // Retrieve current project data
  const project = get(currentProject);
  if (!project) {
    return 'No project loaded.';
  }

  // Create a summary of the project for the AI
  const floor = project.floors.find(f => f.id === project.activeFloorId);
  const projectSummary = JSON.stringify({
    name: project.name,
    walls: floor?.walls.length ?? 0,
    rooms: floor?.rooms.map(r => ({ name: r.name, area: r.area })) ?? [],
    furniture: floor?.furniture.map(f => f.catalogId) ?? [],
    doors: floor?.doors.length ?? 0,
    windows: floor?.windows.length ?? 0
  });

  // Llama  model
  try { 
    const response = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      "model": "llama3.2",
      "messages": [{
      "role": "user",
      "content": `You're are an assistant for a 2D Floorplanner/3D model design tool. You are cabable of answering basic questions about the project.
        If the user asks questions about their project, you will answer based on the ${projectSummary}. 
        Always use the project data to answer, never make assumptions. If the question cannot be answered with the given data, say you don't know and explain why. 
        Only answer the specific question, do not give any additional information that is not asked for. Here is the user's question: ${userMessage}`
        }],
      "stream": false
    })
  })
  const data = await response.json();
  return data.message.content || "Something went wrong generating an answer.";
  }
  catch (error) {
    return "An error occurred while communicating with the AI service.";
  }
}