# Pixel Art Sprites - Sharp Edges

## Non-Integer Scaling Destroys Pixel Art

### **Id**
scaling-destroys-pixel-art
### **Severity**
CRITICAL
### **Description**
Scaling by 1.5x, 2.3x, etc. blurs or distorts pixels
### **Symptoms**
  - Blurry sprites in game
  - Some pixels larger than others
  - Aliasing artifacts on edges
  - Art looks "soft" or "muddy"
### **Detection Pattern**
scale|zoom|resize|canvas
### **Solution**
  Integer Scaling Only:
  
  **The Problem:**
  ```javascript
  // BAD: Non-integer scale
  sprite.setScale(1.5);  // Pixels become non-uniform
  canvas.scale(2.3, 2.3);  // Blur city
  
  // BAD: Fitting to arbitrary screen size
  const scale = window.innerWidth / gameWidth;  // Could be 2.37
  ```
  
  **The Solution:**
  ```javascript
  // GOOD: Integer scaling only
  function getIntegerScale(gameWidth, screenWidth) {
    return Math.floor(screenWidth / gameWidth);
  }
  
  // With minimum scale
  const scale = Math.max(1, Math.floor(window.innerWidth / 320));
  
  // Phaser config
  const config = {
    scale: {
      mode: Phaser.Scale.FIT,
      autoRound: true,  // Forces integer scaling
      width: 320,
      height: 240
    },
    render: {
      pixelArt: true,
      roundPixels: true,
      antialias: false
    }
  };
  ```
  
  **CSS Approach:**
  ```css
  canvas {
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    /* Never use: image-rendering: auto */
  }
  
  .game-container {
    /* Scale to integer multiple of game resolution */
    width: calc(320px * 3);
    height: calc(240px * 3);
  }
  ```
  
  **High-DPI Displays:**
  ```javascript
  // Handle devicePixelRatio for crisp pixels
  const dpr = window.devicePixelRatio;
  const scale = Math.floor(maxScale / dpr) * dpr;
  
  // Canvas with proper high-DPI handling
  canvas.width = gameWidth * scale * dpr;
  canvas.height = gameHeight * scale * dpr;
  canvas.style.width = (gameWidth * scale) + 'px';
  canvas.style.height = (gameHeight * scale) + 'px';
  ctx.scale(dpr, dpr);
  ```
  
### **References**
  - Pixel art scaling in games

## Pillow Shading Makes Sprites Look Flat

### **Id**
pillow-shading-trap
### **Severity**
HIGH
### **Description**
Shading edges uniformly creates puffy, dimensionless sprites
### **Symptoms**
  - Sprites look inflated or balloon-like
  - No clear light direction
  - Form doesn't read in silhouette
  - Everything looks like a pillow or sausage
### **Detection Pattern**
shade|shadow|light|color
### **Solution**
  Proper Light Source Shading:
  
  **The Problem: Pillow Shading**
  ```
  Every edge gets darker uniformly:
  ░░░░░░░░
  ░▒▒▒▒▒░░
  ░▒████▒░
  ░▒████▒░
  ░▒▒▒▒▒░░
  ░░░░░░░░
  
  Result: Looks like a puffy pillow, no depth
  ```
  
  **The Solution: Directional Light**
  ```
  Choose light from top-left (standard):
  ░░▒▒▒▒▒▒
  ░██████▒
  ░██████▒
  ░██████▓
  ░▒████▓▓
  ░▒▓▓▓▓▓▓
  
  Light side = highlights (top-left)
  Dark side = shadows (bottom-right)
  ```
  
  **Shading Rules:**
  ```yaml
  light_source:
    standard: "Top-left (45 degrees)"
    alternative: "Direct overhead (RPG/top-down)"
  
  shading_application:
    highlights:
      - Top surfaces
      - Surfaces facing light
      - Edges where light catches
  
    midtones:
      - Side surfaces
      - Transition areas
  
    shadows:
      - Bottom surfaces
      - Surfaces away from light
      - Under overhangs
  
    cast_shadows:
      - Ground beneath objects
      - Behind objects relative to light
  
  common_mistake:
    - Shading ALL edges dark (pillow)
    - Random dark spots (dirty shading)
    - No consistent light direction
  ```
  
  **Practice Exercise:**
  1. Draw a sphere with a clear light source
  2. Apply same logic to your sprites
  3. Check: Does it look 3D or puffy?
  
### **References**
  - Pixel art shading techniques

## Anti-Aliasing Creates Background Halos

### **Id**
anti-alias-halos
### **Severity**
HIGH
### **Description**
Anti-aliased sprites have ugly edges on different backgrounds
### **Symptoms**
  - White or dark halos around sprites
  - Edges look correct on one background, wrong on others
  - Semi-transparent pixels cause blending issues
  - Sprites look "pasted on" rather than integrated
### **Detection Pattern**
anti.?alias|smooth|edge|transparent
### **Solution**
  Anti-Aliasing Strategy:
  
  **The Problem:**
  ```
  Sprite AA'd against white background:
  - Edge pixels are mix of sprite color + white
  - On dark background, white "halo" appears
  - On colored background, gray fringe shows
  ```
  
  **Solutions:**
  
  **1. No Anti-Aliasing (Safest)**
  ```yaml
  best_for:
    - Small sprites (16x16 or less)
    - Retro aesthetic
    - Variable backgrounds
  
  approach:
    - Hard 1-bit edges
    - No semi-transparent pixels
    - Works on any background
  ```
  
  **2. Anti-Alias to Transparent Only**
  ```yaml
  best_for:
    - Larger sprites
    - Softer look needed
  
  approach:
    - Edge pixels semi-transparent, not color-mixed
    - Alpha: 25%, 50%, 75% steps
    - Color stays pure, alpha handles softness
  ```
  
  **3. Selective Anti-Aliasing**
  ```yaml
  best_for:
    - Smooth curves needed
    - Consistent background
  
  approach:
    - Only AA internal color transitions
    - Keep hard edge to transparent
    - Curves smooth, outline sharp
  ```
  
  **Aseprite Settings:**
  ```
  For clean export:
  - Use indexed color mode
  - Export with no anti-aliasing on edges
  - If AA needed, use alpha-only method
  ```
  
  **In Code:**
  ```javascript
  // Check for halo-causing semi-transparent pixels
  function checkForHalos(imageData) {
    const data = imageData.data;
    const issues = [];
  
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      // Flag semi-transparent pixels that have color
      if (alpha > 0 && alpha < 255) {
        const hasColor = data[i] > 0 || data[i + 1] > 0 || data[i + 2] > 0;
        if (hasColor) {
          issues.push(`Pixel at ${i/4}: has color with alpha ${alpha}`);
        }
      }
    }
  
    return issues;
  }
  ```
  
### **References**
  - Pixel art anti-aliasing

## Animation Speed Doesn't Match Game Feel

### **Id**
animation-speed-mismatch
### **Severity**
HIGH
### **Description**
Walk cycles at wrong speed, attacks feel slow or instant
### **Symptoms**
  - Character slides or moonwalks
  - Attacks don't feel impactful
  - Animations feel "floaty"
  - Movement speed and animation out of sync
### **Detection Pattern**
animation|frame|speed|timing|duration
### **Solution**
  Animation Timing Guide:
  
  **Frame Duration Standards:**
  ```yaml
  very_fast:  50-80ms   # Combat impacts, particles
  fast:       80-120ms  # Running, quick actions
  normal:     120-180ms # Walking, idle
  slow:       180-300ms # Heavy attacks, dramatic
  very_slow:  300-500ms # Idle breathing, ambient
  
  typical_animations:
    idle:
      frames: 4
      frame_time: 200-300ms
      total: ~1 second loop
  
    walk:
      frames: 4-6
      frame_time: 100-150ms
      total: ~0.5 seconds per cycle
  
    run:
      frames: 6-8
      frame_time: 60-100ms
      total: ~0.4 seconds per cycle
  
    attack:
      windup: 100-150ms (1-2 frames)
      swing: 50-80ms (1-2 frames)
      impact: 80-120ms (1 frame, hold for feel)
      recovery: 100-150ms (1-2 frames)
  
    jump:
      anticipation: 80ms
      rise: per physics, 2-3 frame loop
      apex: 100ms hold
      fall: per physics, 2-3 frame loop
      land: 100ms
  ```
  
  **Sync Walk Speed to Movement:**
  ```javascript
  // Calculate frame time from movement speed
  function calculateWalkFrameTime(speed, strideLength, frameCount) {
    // strideLength: pixels moved per full cycle
    // frameCount: frames in full cycle
  
    const cycleTime = strideLength / speed;  // seconds per cycle
    const frameTime = (cycleTime / frameCount) * 1000;  // ms per frame
  
    return frameTime;
  }
  
  // Example:
  // Speed: 100 pixels/sec
  // Stride: 32 pixels (one step = 32px moved)
  // Frames: 6
  // = 32/100 = 0.32 sec per cycle
  // = 320ms / 6 = ~53ms per frame
  ```
  
  **Feel Adjustments:**
  ```yaml
  too_slow_feeling:
    - Reduce frame duration
    - Remove frames (especially in-betweens)
    - Add anticipation frames to attacks
  
  too_fast_feeling:
    - Increase frame duration
    - Add hold frames at key poses
    - Ensure anticipation exists
  
  floaty_feeling:
    - Add squash on land
    - Speed up fall frames
    - Add impact pause
  
  slidey_feeling:
    - Sync animation to movement speed
    - Ensure contact frames exist
    - Check for sub-pixel movement issues
  ```
  
### **References**
  - Game animation timing

## Color Count Explodes Without Constraints

### **Id**
palette-bloat
### **Severity**
MEDIUM
### **Description**
What started as 16 colors is now 64 with subtle variations
### **Symptoms**
  - Art style becomes inconsistent
  - File sizes increase unnecessarily
  - Colors look almost identical
  - Can't easily recolor or palette swap
### **Detection Pattern**
color|palette|hue|shade
### **Solution**
  Palette Discipline:
  
  **Set Hard Limits:**
  ```yaml
  palette_limits:
    very_limited: 4-8 colors (GameBoy style)
    limited: 12-16 colors (NES-like)
    standard: 24-32 colors (SNES-like)
    expanded: 48-64 colors (modern pixel art)
  
  per_sprite_limits:
    small_props: 4-6 colors
    characters: 8-12 colors
    large_enemies: 12-16 colors
    backgrounds: 8-16 colors (excluding characters)
  ```
  
  **Palette Organization:**
  ```javascript
  // Structured palette approach
  const palette = {
    // Ramps (3-5 colors each)
    skin: ['#ffe5c9', '#ddb896', '#a67c52', '#6b4423'],
    clothing: ['#4a90d9', '#2d5a87', '#1a3a5c', '#0d1f30'],
    metals: ['#ffffff', '#c0c0c0', '#808080', '#404040'],
  
    // Accent colors (1-2 each)
    highlight: '#fff7e6',
    danger: '#ff4444',
  
    // Universal
    outline: '#1a1a2e',
    pure_black: '#000000',
    pure_white: '#ffffff'
  };
  
  // Validate before adding new color
  function addColor(newColor, purpose) {
    const existing = Object.values(palette).flat();
    const similar = existing.find(c => colorDistance(c, newColor) < 30);
  
    if (similar) {
      console.warn(`Color ${newColor} is similar to ${similar}. Use existing?`);
      return false;
    }
  
    return true;
  }
  ```
  
  **Palette Swapping Benefits:**
  ```javascript
  // With organized palette, recoloring is trivial
  const enemyVariants = {
    normal: { primary: '#4a90d9', secondary: '#2d5a87' },
    fire: { primary: '#d94a4a', secondary: '#872d2d' },
    ice: { primary: '#4ad9d9', secondary: '#2d8787' }
  };
  
  // At runtime, just swap the palette index
  function recolorSprite(sprite, variant) {
    sprite.setPalette(enemyVariants[variant]);
  }
  ```
  
  **Tools:**
  - Aseprite: Indexed color mode, palette editor
  - Lospec: Curated palettes to start from
  - GraphicsGale: Palette animation support
  
### **References**
  - Pixel art color theory

## Outline Thickness Varies Across Sprites

### **Id**
inconsistent-outline-weight
### **Severity**
MEDIUM
### **Description**
Some sprites have 1px outline, some 2px, some none
### **Symptoms**
  - Art looks inconsistent
  - Some characters feel "heavier" than others
  - Style seems mixed
  - Professional look is lost
### **Detection Pattern**
outline|border|edge|line
### **Solution**
  Outline Consistency Rules:
  
  **Choose One Approach:**
  ```yaml
  no_outline:
    description: No black/dark outline
    style: "Softer, more painted look"
    best_for: Larger sprites, atmospheric games
    example: "Hyper Light Drifter"
  
  selective_outline:
    description: Outline only on outside edge
    style: "Clean, readable"
    best_for: Most games
    example: "Celeste"
  
  full_outline:
    description: Outline on all edges including internal
    style: "Cartoon, bold"
    best_for: Action games, visibility important
    example: "Shovel Knight"
  
  colored_outline:
    description: Outline matches nearby colors (not black)
    style: "Soft, integrated"
    best_for: Artistic games
    example: "Stardew Valley"
  ```
  
  **Implementation:**
  ```yaml
  if_using_outlines:
    weight: 1px always (at native resolution)
    color:
      option_1: Pure black (#000000)
      option_2: Near-black (#1a1a2e)
      option_3: Darkest shade of object's color
  
    apply_to:
      - All character sprites
      - All interactable objects
      - NOT: Backgrounds (usually)
      - NOT: Particle effects (usually)
  
    exceptions:
      glow_effects: No outline
      transparent_objects: Lighter outline or none
      distant_backgrounds: No outline
  ```
  
  **Checklist Before Export:**
  ```
  [ ] All characters have same outline style
  [ ] All enemies have same outline style
  [ ] All props have same outline style
  [ ] Outline weight is consistent (1px)
  [ ] Outline color is consistent or logically varied
  [ ] UI elements follow their own consistent rules
  ```
  
### **References**
  - Pixel art outline techniques

## Wrong Export Format Destroys Pixel Art

### **Id**
export-format-destroys-art
### **Severity**
MEDIUM
### **Description**
JPEG compression or wrong PNG settings ruin sprites
### **Symptoms**
  - Artifacts around edges
  - Colors shifted from original
  - File size unexpectedly large or small
  - Transparency doesn't work correctly
### **Detection Pattern**
export|save|format|png|jpeg|gif
### **Solution**
  Correct Export Settings:
  
  **Never Use:**
  ```yaml
  jpeg: Never for pixel art (lossy compression adds artifacts)
  webp_lossy: Never for pixel art (same issue)
  gif: Limited to 256 colors, no semi-transparency
  svg: Wrong format entirely (vector, not raster)
  ```
  
  **Always Use:**
  ```yaml
  png:
    color_type: "Indexed (8-bit) if < 256 colors"
    alternative: "RGBA if need semi-transparency"
    compression: "Maximum (lossless, just smaller file)"
    interlace: "None (smaller file)"
  
  aseprite_settings:
    indexed_color_mode: true
    export_as: PNG
    trim_cels: false  # Keep consistent frame size
    split_layers: false  # Unless intentional
  ```
  
  **Sprite Sheet Export:**
  ```javascript
  // Aseprite CLI export (batch script)
  const asepriteExport = `
    aseprite -b input.ase \\
      --sheet output.png \\
      --sheet-type packed \\
      --sheet-pack \\
      --data output.json \\
      --format json-array \\
      --list-tags \\
      --list-slices
  `;
  
  // Verify export integrity
  function verifyExport(originalPath, exportedPath) {
    // Load both, compare pixel-by-pixel
    // Any difference = potential corruption
  }
  ```
  
  **File Size Expectations:**
  ```yaml
  typical_sizes:
    16x16_sprite: 0.5-2 KB (indexed PNG)
    32x32_sprite: 1-4 KB
    sprite_sheet_256x256: 10-30 KB
    sprite_sheet_512x512: 30-100 KB
  
  if_much_larger:
    - Check if saving as RGBA instead of indexed
    - Check for hidden layers/frames
    - Verify PNG compression level
  ```
  
### **References**
  - Pixel art export best practices