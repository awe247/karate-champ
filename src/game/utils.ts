import { PlayerBattle } from "./types";

export function getMatchupBgColor(
  r: number,
  cr: number,
  b: number,
  cb: number
): number {
  if (r == cr && b == cb) {
    return 0xff00ff;
  }
  if (r < cr || (r == cr && b < cb)) {
    return 0xa1a1a1;
  }
  return 0xffffff;
}

export function getMatchupBgColorAsText(
  r: number,
  cr: number,
  b: number,
  cb: number
): string {
  if (r == cr && b == cb) {
    return "#ff00ff";
  }
  if (r < cr || (r == cr && b < cb)) {
    return "#a1a1a1";
  }
  return "#ffffff";
}

function hexToColor(hex: string): number[] {
  // Remove '#' if present
  hex = hex.replace("#", "");

  // Parse the hexadecimal color components
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);

  return [r, g, b];
}

export function createPlayerTexture(
  scene: Phaser.Scene,
  player?: PlayerBattle
) {
  // CPU colors;
  let { hairColor, eyeColor, skinColor, giColor } = player ?? {
    hairColor: "#464d56",
    eyeColor: "#ff0000",
    skinColor: "#81c2e4",
    giColor: "#1b4478",
  };

  const h = hexToColor(hairColor);
  const e = hexToColor(eyeColor);
  const s = hexToColor(skinColor);
  const g = hexToColor(giColor);

  // Create a canvas and get its 2D context
  let canvas = document.createElement("canvas");
  let ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  if (scene.textures.exists(`${player?.id ?? "cpu"}-texture`)) {
    return;
  }

  let texture = scene.textures.get("player").getSourceImage();
  canvas.width = texture.width;
  canvas.height = texture.height;

  ctx.drawImage(texture as CanvasImageSource, 0, 0);

  // Get the pixel data of the canvas
  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let data = imageData.data;

  // Iterate over each pixel
  for (let i = 0; i < data.length; i += 4) {
    // Ignore any transparency
    if (data[i + 3] !== 255) continue;

    // Check if the pixel color matches the color to replace
    if (data[i] === 255) {
      // gi, skin or eye
      if (data[i + 1] === 0 && data[i + 2] === 0) {
        // eye
        data[i] = e[0];
        data[i + 1] = e[1];
        data[i + 2] = e[2];
      } else if (data[i + 1] === 0 && data[i + 2] === 255) {
        // gi
        data[i] = g[0];
        data[i + 1] = g[1];
        data[i + 2] = g[2];
      } else if (data[i + 1] === 255 && data[i + 2] === 0) {
        // skin
        data[i] = s[0];
        data[i + 1] = s[1];
        data[i + 2] = s[2];
      }
    } else if (data[i] === 0) {
      if (data[i + 1] === 255 && data[i + 2] === 255) {
        // hair
        data[i] = h[0];
        data[i + 1] = h[1];
        data[i + 2] = h[2];
      } else if (data[i + 1] === 0 && data[i + 2] === 0 && !player) {
        // outline
        data[i] = 189;
        data[i + 1] = 253;
        data[i + 2] = 255;
      }
    }
  }

  // Draw the modified pixel data back onto the canvas
  ctx.putImageData(imageData, 0, 0);

  // Create a new texture from the modified canvas
  const canvasTexture = scene.textures
    .addCanvas(`${player?.id ?? "cpu"}-texture`, canvas)
    ?.getSourceImage();

  if (canvasTexture) {
    scene.textures.addSpriteSheet(
      player?.id ?? "cpu",
      canvasTexture as HTMLImageElement,
      { frameWidth: 56, frameHeight: 56 }
    );
  }
}
