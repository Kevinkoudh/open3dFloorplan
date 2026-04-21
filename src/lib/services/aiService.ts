import { get } from 'svelte/store';
import { currentProject } from '$lib/stores/project';

export async function askAI(userMessage: string): Promise<string> {
  // Retrieve OpenAI API key from localStorage
  const apiKey = localStorage.getItem('o3d_openai_key');
  if (!apiKey) {
    return 'Geen API key gevonden. Ga naar Settings → AI om je OpenAI key in te vullen.';
  }

  // Retrieve current project data
  const project = get(currentProject);
  if (!project) {
    return 'Geen project geopend.';
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

  // 4. Send to OpenAI
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Je bent een AI-assistent voor een plattegrond-editor. Je helpt gebruikers met het ontwerpen van appartementen. Dit is het huidige project: ${projectSummary}`
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        max_tokens: 500
      })
    });

    const data = await response.json();
    
    if (data.error) {
      return `Fout: ${data.error.message}`;
    }

    return data.choices[0].message.content;
  } catch (error: any) {
    return `Verbindingsfout: ${error.message}`;
  }
}