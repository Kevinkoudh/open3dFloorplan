import { get } from 'svelte/store';
import { currentProject } from '$lib/stores/project';
import { GoogleGenAI } from '@google/genai';

export async function askAI(userMessage: string) {
  // Retrieve Gemini API key from localStorage
  const apiKey = localStorage.getItem('o3d_gemini_key');
  if (!apiKey) {
    return 'No API key found. Please set your Gemini API key in the settings to use the AI assistant.';
  }

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

  // Gemini model
  const ai = new GoogleGenAI({apiKey});
  
  try {
    const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `You're are an assistant for a 2D Floorplanner/3D model design tool. You are cabable of answering basic questions about the project.
        If the user asks questions about their project, you will answer based on the ${projectSummary}. 
        Always use the project data to answer, never make assumptions. If the question cannot be answered with the given data, say you don't know and explain why. 
        Only answer the specific question, do not give any additional information that is not asked for. Here is the user's question: ${userMessage}`,
    });
    
    return response.text || 'AI assistent could not generate a response.';
  }
    catch (error) {
    return "There was a mistake generating an response. Please try again later.";
  }
}

