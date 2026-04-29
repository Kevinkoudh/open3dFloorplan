import { get } from 'svelte/store';
import { currentProject, loadProject, detectedRoomsStore } from '$lib/stores/project';

export async function askAI(userMessage: string) {
  // Retrieve current project data
  const project = get(currentProject);
  if (!project) {
    return 'No project loaded.';
  }

  // Prepare data for AI
  const floor = project.floors.find(f => f.id === project.activeFloorId);
  const wallsWithDescriptions = floor?.walls.map(w => {

    // if y starts and ends are the same, it's horizontal, otherwise vertical
    const isHorizontal = w.start.y === w.end.y;

    // Calculate mid points for potential use in room description
    return { ...w, isHorizontal, midX: (w.start.x + w.end.x) / 2, midY: (w.start.y + w.end.y) / 2 };
  });

  const detectedRooms = get(detectedRoomsStore);
  const allRooms = detectedRooms.length > 0 ? detectedRooms : (floor?.rooms ?? []);

  // For each room (r) in the list, do the following:
  const roomDescriptions = allRooms.map(r => {

    // Find the full wall objects for each wall ID in this room
    const roomWalls = r.walls.map(wId => wallsWithDescriptions?.find(w => w.id === wId)).filter(Boolean);

    // Keep only the horizontal walls (top and bottom)
    const horizontalWalls = roomWalls.filter(w => w!.isHorizontal);
    // Keep only the vertical walls (left and right)
    const verticalWalls = roomWalls.filter(w => !w!.isHorizontal);

    //create empty variables for wall position
    let topWall = '';
    let bottomWall = '';
    let leftWall = '';
    let rightWall = '';

    // If there are at least 2 horizontal walls, sort them to find top and bottom
    if (horizontalWalls.length >= 2) {
      horizontalWalls.sort((a, b) => a!.midY - b!.midY);
      topWall = horizontalWalls[0]!.id;
      bottomWall = horizontalWalls[horizontalWalls.length - 1]!.id;
    }

    // If there are at least 2 vertical walls, sort them to find left and right
    if (verticalWalls.length >= 2) {
      verticalWalls.sort((a, b) => a!.midX - b!.midX);
      leftWall = verticalWalls[0]!.id;
      rightWall = verticalWalls[verticalWalls.length - 1]!.id;
    }

    // Return a simple object with room info and which wall is on which side
    return { id: r.id, name: r.name, topWall, bottomWall, leftWall, rightWall };
  });

  // Convert rooms and doors to JSON text to send to the AI
  const projectData = JSON.stringify({
    rooms: roomDescriptions,
    doors: floor?.doors
  });

  // Example structures so the AI knows the correct format and doens't make up the format
  const structures = `
  An example Door looks like: {"id": "door-1", "wallId": "id-of-wall", "position": 0.5, "width": 90, "height": 210, "type": "single", "swingDirection": "left", "flipSide": false}
  An example Wall looks like: {"id": "wall-1", "start": {"x": 0, "y": 0}, "end": {"x": 500, "y": 0}, "thickness": 15, "height": 280, "color": "#444444"}
  An example Room looks like: {"id": "room-1", "name": "Bedroom", "walls": ["wall-1", "wall-2"], "floorTexture": "hardwood", "area": 12}
  `;

  // Send the project data to AI running locally
  try { 
    const response = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Stringify for fetch
    body: JSON.stringify({
      "model": "qwen2.5-coder:7b",
      "messages": [{
      "role": "user",
      "content": `You're are an assistant for a 2D Floorplanner/3D model design tool.
      You will handle accoarding to the instructions based on ${userMessage} and the structure of objects: ${projectData}.
      When making changes, always respond with the complete JSON object containing walls, rooms, and doors arrays. Never return only a partial update. 
      Always check that the JSON structure is correct and if changes are needed, return the full updated JSON with all elements.
      When adding doors or windows, never create new walls. Keep the walls and rooms arrays exactly as they are. Only modify the doors array.
      When needed, edit the JSON based on the structure defined by: ${structures}.`
}],
      "stream": false,
    })
  })
  
    // Turning the string response into JSON
    const data = await response.json();

    // Getting text response from AI
    const content = data.message.content;
    console.log("AI Response:", content);

    // Check if the response contains json, filtered with { and }
    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}');

    // if JSON is found in the response, extract it out
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      const jsonString = content.substring(jsonStart, jsonEnd + 1);

      // Parse jsonString to object
      const object = JSON.parse(jsonString)
      
      //copy the current project 
      const updatedProject = { ...project };
      // Find the active floor in the copy
      const activeFloor = updatedProject.floors.find(f => f.id === updatedProject.activeFloorId);

      // Replace only the changed parts
      if (activeFloor) {
      if (object.walls) activeFloor.walls = object.walls;
      if (object.rooms) activeFloor.rooms = object.rooms;
      if (object.doors) activeFloor.doors = object.doors;
    }
    
    // Load the new updated project 
    loadProject(updatedProject);

      return "I've adjusted the floorplan accoarding to your input"
    }

    // If no JSON was found, return the AI's text response
    return data.message.content || "Sorry, I couldn't generate a response at this time."

  }
    catch (error) {
      return "An error occurred while communicating with the AI service.";
    }
}