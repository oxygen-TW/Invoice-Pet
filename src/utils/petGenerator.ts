import seedrandom from 'seedrandom';

export type PixelData = (string | null)[][];

export interface PetAttributes {
  species: 'Slime' | 'Cat' | 'Robot' | 'Ghost' | 'Dino';
  primaryColor: string;
  secondaryColor: string;
  eyeType: 'Normal' | 'Large' | 'Wink' | 'Angry' | 'Cute';
  pattern: 'None' | 'Spots' | 'Stripes' | 'Heart';
  accessory: 'None' | 'Hat' | 'Bowtie' | 'Glasses';
}

export function generatePetAttributes(code: string): PetAttributes {
  const rng = seedrandom(code);
  
  const speciesList: PetAttributes['species'][] = ['Slime', 'Cat', 'Robot', 'Ghost', 'Dino'];
  const eyesList: PetAttributes['eyeType'][] = ['Normal', 'Large', 'Wink', 'Angry', 'Cute'];
  const patternList: PetAttributes['pattern'][] = ['None', 'Spots', 'Stripes', 'Heart'];
  const accessoryList: PetAttributes['accessory'][] = ['None', 'Hat', 'Bowtie', 'Glasses'];
  
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', 
    '#F7DC6F', '#BB8FCE', '#82E0AA', '#F1948A', '#85C1E9'
  ];

  return {
    species: speciesList[Math.floor(rng() * speciesList.length)],
    primaryColor: colors[Math.floor(rng() * colors.length)],
    secondaryColor: colors[Math.floor(rng() * colors.length)],
    eyeType: eyesList[Math.floor(rng() * eyesList.length)],
    pattern: patternList[Math.floor(rng() * patternList.length)],
    accessory: accessoryList[Math.floor(rng() * accessoryList.length)],
  };
}

export function generatePixelMap(attrs: PetAttributes): PixelData {
  const grid: PixelData = Array(16).fill(null).map(() => Array(16).fill(null));
  
  // Basic body shapes
  const drawBody = () => {
    const p = attrs.primaryColor;
    const s = attrs.secondaryColor;
    
    if (attrs.species === 'Slime') {
      for (let y = 6; y <= 12; y++) {
        for (let x = 4; x <= 11; x++) {
          if (y === 6 && (x === 4 || x === 11)) continue;
          grid[y][x] = p;
        }
      }
    } else if (attrs.species === 'Cat') {
      // Body
      for (let y = 7; y <= 13; y++) {
        for (let x = 4; x <= 11; x++) grid[y][x] = p;
      }
      // Ears
      grid[6][4] = p; grid[5][4] = p;
      grid[6][11] = p; grid[5][11] = p;
    } else if (attrs.species === 'Robot') {
      for (let y = 5; y <= 12; y++) {
        for (let x = 4; x <= 11; x++) grid[y][x] = p;
      }
      // Antennas
      grid[4][7] = s; grid[3][7] = s;
    } else if (attrs.species === 'Ghost') {
      for (let y = 5; y <= 11; y++) {
        for (let x = 5; x <= 10; x++) grid[y][x] = p;
      }
      grid[12][5] = p; grid[12][7] = p; grid[12][10] = p;
    } else if (attrs.species === 'Dino') {
      for (let y = 6; y <= 12; y++) {
        for (let x = 4; x <= 12; x++) {
            if (x > 10 && y > 9) continue;
            grid[y][x] = p;
        }
      }
      // Tail
      grid[11][3] = p; grid[12][3] = p;
    }
  };

  const drawEyes = () => {
    const e = '#000000';
    const w = '#FFFFFF';
    
    // Default eye positions
    let ly = 8, lx = 6, ry = 8, rx = 9;
    if (attrs.species === 'Robot') { ly = 7; ry = 7; }
    if (attrs.species === 'Ghost') { ly = 7; ry = 7; }

    if (attrs.eyeType === 'Normal') {
      grid[ly][lx] = e; grid[ry][rx] = e;
    } else if (attrs.eyeType === 'Large') {
      grid[ly][lx] = e; grid[ly-1][lx] = e;
      grid[ry][rx] = e; grid[ry-1][rx] = e;
    } else if (attrs.eyeType === 'Wink') {
      grid[ly][lx] = e;
      grid[ry][rx] = e; grid[ry][rx-1] = e; grid[ry][rx+1] = e;
    } else if (attrs.eyeType === 'Angry') {
      grid[ly][lx] = e; grid[ry][rx] = e;
      grid[ly-1][lx-1] = e; grid[ry-1][rx+1] = e;
    } else if (attrs.eyeType === 'Cute') {
        grid[ly][lx] = e; grid[ry][rx] = e;
        grid[ly+1][lx] = e; grid[ry+1][rx] = e;
        grid[ly][lx+1] = e; grid[ry][rx-1] = e;
    }
  };

  const drawPatterns = () => {
      const s = attrs.secondaryColor;
      if (attrs.pattern === 'Spots') {
          grid[10][5] = s; grid[7][10] = s; grid[12][8] = s;
      } else if (attrs.pattern === 'Stripes') {
          grid[9][4] = s; grid[9][5] = s; grid[9][10] = s; grid[9][11] = s;
      } else if (attrs.pattern === 'Heart') {
          grid[10][7] = '#FF0000';
          grid[10][8] = '#FF0000';
          grid[11][7.5] = '#FF0000'; // Approximate
          // Let's do a simple 2x2
          grid[10][7] = '#FF4444'; grid[10][8] = '#FF4444';
          grid[11][7] = '#FF4444'; grid[11][8] = '#FF4444';
      }
  };

  const drawAccessory = () => {
      if (attrs.accessory === 'Hat') {
          for (let x = 5; x <= 10; x++) grid[4][x] = '#333333';
          grid[3][7] = '#333333'; grid[3][8] = '#333333';
      } else if (attrs.accessory === 'Bowtie') {
          grid[13][7] = '#FF00FF'; grid[13][8] = '#FF00FF';
          grid[13][6] = '#FF00FF'; grid[13][9] = '#FF00FF';
      } else if (attrs.accessory === 'Glasses') {
          grid[8][5] = '#000000'; grid[8][6] = '#000000'; grid[8][7] = '#000000';
          grid[8][8] = '#000000'; grid[8][9] = '#000000'; grid[8][10] = '#000000';
      }
  }

  drawBody();
  drawPatterns();
  drawEyes();
  drawAccessory();

  return grid;
}
