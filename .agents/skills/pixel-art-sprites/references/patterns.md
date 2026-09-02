# Pixel Art & Sprites

## Patterns


---
  #### **Name**
Character Sprite Structure
  #### **Description**
Standard proportions and sizing for game characters
  #### **Example**
    // Character sprite sizing guide
    
    /*
    COMMON SPRITE SIZES:
    8x8   - Small details, items, bullets
    16x16 - Classic platformer (Mario, Megaman)
    32x32 - Modern pixel art standard (Celeste, Shovel Knight)
    64x64 - Large characters, bosses
    */
    
    // Character proportion templates:
    
    // CHIBI STYLE (16x16 to 24x24)
    // Head: 50% of height
    // Body: 50% of height
    // Ideal for: platformers, action games
    const chibiProportions = {
      headHeight: 0.5,
      bodyHeight: 0.5,
      armLength: 0.3,
      legLength: 0.25
    };
    
    // REALISTIC STYLE (32x32 to 64x64)
    // Head: 1/6 to 1/8 of height
    // Body: Realistic proportions
    // Ideal for: RPGs, strategy games
    const realisticProportions = {
      headHeight: 0.15,
      torsoHeight: 0.35,
      legHeight: 0.5
    };
    
    // SPRITE STRUCTURE (32x32 character example)
    /*
      Row 0-7:   Head (8px) - Hair, face, expressions
      Row 8-15:  Torso (8px) - Arms, clothing, equipment
      Row 16-23: Upper legs (8px) - Belt, hands
      Row 24-31: Lower legs (8px) - Feet, ground contact
    
      SILHOUETTE TEST:
      1. Fill sprite with solid color
      2. Is the character still recognizable?
      3. Can you tell front from back?
      4. Does the pose read clearly?
    */
    
    // Animation frame counts by action
    const standardFrameCounts = {
      idle: 4,         // Subtle breathing/movement
      walk: 6,         // 3 per leg step
      run: 6,          // Faster version of walk
      jump: 3,         // Anticipation, air, land
      attack: 4,       // Wind-up, swing, contact, recovery
      hurt: 2,         // Recoil, recovery
      death: 5         // Impact + collapse
    };
    

---
  #### **Name**
Walk Cycle Animation
  #### **Description**
Classic 4-6 frame walk cycle construction
  #### **Example**
    // Walk cycle frame breakdown (4-frame minimal)
    
    /*
    FRAME 1: Contact (right foot forward)
      - Right leg extended forward
      - Left leg extended backward
      - Arms opposite to legs (left forward)
      - Torso at lowest point
    
    FRAME 2: Passing (right leg passing)
      - Right leg under body
      - Left leg pushing off
      - Arms at sides
      - Torso at highest point
    
    FRAME 3: Contact (left foot forward)
      - Mirror of Frame 1
      - Left leg extended forward
      - Right leg extended backward
    
    FRAME 4: Passing (left leg passing)
      - Mirror of Frame 2
      - Left leg under body
      - Right leg pushing off
    */
    
    // Sprite sheet organization
    class WalkCycleSheet {
      constructor(frameWidth, frameHeight, framesPerDirection) {
        this.frameWidth = frameWidth;
        this.frameHeight = frameHeight;
        this.framesPerDirection = framesPerDirection;
    
        // Standard 4-direction layout
        this.directions = {
          down: 0,   // Row 0: Walking toward camera
          left: 1,   // Row 1: Walking left
          right: 2,  // Row 2: Walking right
          up: 3      // Row 3: Walking away
        };
      }
    
      getFrame(direction, frameIndex) {
        const row = this.directions[direction];
        const col = frameIndex % this.framesPerDirection;
        return {
          x: col * this.frameWidth,
          y: row * this.frameHeight,
          width: this.frameWidth,
          height: this.frameHeight
        };
      }
    }
    
    // Animation timing
    const walkAnimation = {
      frames: [0, 1, 2, 3],
      frameTime: 150,  // ms per frame
    
      // For run: faster frame time
      runFrameTime: 100,
    
      // For idle: slower, maybe skip frames
      idleFrames: [0, 0, 1, 1],  // Subtle movement
      idleFrameTime: 300
    };
    
    // Sub-pixel animation for smooth movement
    function animateWalk(character, deltaTime) {
      character.animTimer += deltaTime;
    
      if (character.animTimer >= walkAnimation.frameTime) {
        character.animTimer = 0;
        character.currentFrame =
          (character.currentFrame + 1) % walkAnimation.frames.length;
      }
    
      // Sub-pixel position for smooth movement
      character.subX += character.speedX * deltaTime;
      character.subY += character.speedY * deltaTime;
    
      // Only update pixel position when crossing threshold
      character.x = Math.floor(character.subX);
      character.y = Math.floor(character.subY);
    }
    

---
  #### **Name**
Color Palette Design
  #### **Description**
Creating effective limited color palettes
  #### **Example**
    // Pixel art color palette fundamentals
    
    /*
    CLASSIC PALETTE LIMITS:
      NES:    4 colors per sprite, 25 total
      SNES:   16 colors per palette, 256 total
      GB:     4 shades of green
      Modern: 16-64 colors typical
    
    HUE SHIFTING:
      - Shadows aren't just darker versions of the color
      - Shift hue toward cool (blue/purple) in shadows
      - Shift hue toward warm (yellow/orange) in highlights
      - This creates depth and visual interest
    */
    
    // Color ramp generator with hue shifting
    function generateColorRamp(baseHue, baseSat, steps = 5) {
      const ramp = [];
      const hueShift = 15;  // Degrees to shift per step
    
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);  // 0 to 1
    
        // Darker = shift toward blue (hue + shift)
        // Lighter = shift toward yellow (hue - shift)
        const hue = baseHue + (0.5 - t) * hueShift * 2;
    
        // Saturation: higher in midtones
        const sat = baseSat * (1 - Math.abs(t - 0.5) * 0.5);
    
        // Lightness: linear from dark to light
        const light = 15 + t * 70;
    
        ramp.push({ h: hue % 360, s: sat, l: light });
      }
    
      return ramp;
    }
    
    // Standard palette structure
    const characterPalette = {
      // Skin tones (5 colors)
      skin: generateColorRamp(25, 50, 5),
    
      // Hair (4 colors)
      hair: generateColorRamp(30, 40, 4),
    
      // Clothing primary (5 colors)
      clothing: generateColorRamp(210, 70, 5),
    
      // Outline/darkest (shared)
      outline: { h: 250, s: 30, l: 10 }
    };
    
    // Dithering patterns for smooth gradients
    /*
    50% DITHER (checkerboard):
    ░░░░░░░░
    ░░░░░░░░
    
    25% DITHER:
    █░█░█░█░
    ░░░░░░░░
    █░█░█░█░
    ░░░░░░░░
    
    AVOID: Random noise dithering (looks messy at pixel scale)
    PREFER: Ordered dithering patterns
    */
    
    const ditherPatterns = {
      checker: [
        [1, 0],
        [0, 1]
      ],
      quarter: [
        [1, 0, 1, 0],
        [0, 0, 0, 0],
        [1, 0, 1, 0],
        [0, 0, 0, 0]
      ],
      diagonal: [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
      ]
    };
    

---
  #### **Name**
Tileset Design
  #### **Description**
Creating seamless, modular tiles
  #### **Example**
    // Tileset design principles
    
    /*
    TILE SIZE STANDARDS:
      8x8   - Classic NES, very limited detail
      16x16 - Common for platformers
      32x32 - Rich detail while still pixel art
      48x48 - Larger format (isometric often)
    
    TILE TYPES:
      1. Ground/Floor - Base walkable surfaces
      2. Walls - Collision surfaces
      3. Decorative - Non-collision details
      4. Transition - Edge pieces between types
      5. Animated - Water, lava, etc.
    */
    
    // Auto-tiling: 47-tile "blob" tileset
    const autoTileRules = {
      // Bitmask: N=1, E=2, S=4, W=8
      // 0 = isolated tile
      0: 'isolated',
      // 1 = wall to north only
      1: 'cap_south',
      2: 'cap_west',
      3: 'corner_sw',
      4: 'cap_north',
      5: 'vertical',
      6: 'corner_nw',
      7: 'edge_west',
      8: 'cap_east',
      9: 'corner_se',
      10: 'horizontal',
      11: 'edge_south',
      12: 'corner_ne',
      13: 'edge_east',
      14: 'edge_north',
      15: 'center'  // All sides connected
    };
    
    // Extended 47-tile set includes inner corners
    function getTileIndex(tileMap, x, y) {
      const hasN = tileMap[y - 1]?.[x] ?? false;
      const hasE = tileMap[y]?.[x + 1] ?? false;
      const hasS = tileMap[y + 1]?.[x] ?? false;
      const hasW = tileMap[y]?.[x - 1] ?? false;
      const hasNE = tileMap[y - 1]?.[x + 1] ?? false;
      const hasNW = tileMap[y - 1]?.[x - 1] ?? false;
      const hasSE = tileMap[y + 1]?.[x + 1] ?? false;
      const hasSW = tileMap[y + 1]?.[x - 1] ?? false;
    
      // Calculate 8-bit mask for 47-tile set
      let mask = 0;
      if (hasN) mask |= 1;
      if (hasNE && hasN && hasE) mask |= 2;
      if (hasE) mask |= 4;
      if (hasSE && hasS && hasE) mask |= 8;
      if (hasS) mask |= 16;
      if (hasSW && hasS && hasW) mask |= 32;
      if (hasW) mask |= 64;
      if (hasNW && hasN && hasW) mask |= 128;
    
      return mask;
    }
    
    // Tileset organization
    /*
    SPRITESHEET LAYOUT (256x256 for 16x16 tiles):
    
    Row 0: Ground variants (8 tiles)
    Row 1-3: Wall auto-tiles (16 tiles for basic set)
    Row 4-5: Platform tiles (edges, middles)
    Row 6: Props (trees, rocks, etc.)
    Row 7: Animated tiles (water, fire)
    
    VARIATION:
    - Create 3-4 variants of common tiles
    - Random selection during placement
    - Breaks up repetition
    */
    

---
  #### **Name**
Sprite Sheet Export
  #### **Description**
Exporting and integrating with game engines
  #### **Example**
    // Sprite sheet formats and export settings
    
    // Phaser 3 sprite sheet loading
    function loadSpriteSheet(scene) {
      // Simple sprite sheet (uniform frames)
      scene.load.spritesheet('player', 'sprites/player.png', {
        frameWidth: 32,
        frameHeight: 32,
        margin: 0,
        spacing: 0
      });
    
      // Atlas with JSON (variable frame sizes)
      scene.load.atlas(
        'characters',
        'sprites/characters.png',
        'sprites/characters.json'
      );
    }
    
    // Aseprite JSON format (exported with --format json-array)
    const asepriteData = {
      "frames": [
        {
          "filename": "player_idle_0",
          "frame": { "x": 0, "y": 0, "w": 32, "h": 32 },
          "duration": 150
        },
        {
          "filename": "player_idle_1",
          "frame": { "x": 32, "y": 0, "w": 32, "h": 32 },
          "duration": 150
        }
      ],
      "meta": {
        "frameTags": [
          { "name": "idle", "from": 0, "to": 3 },
          { "name": "walk", "from": 4, "to": 9 }
        ]
      }
    };
    
    // Parse Aseprite export for Phaser
    function createAnimationsFromAseprite(scene, data, atlasKey) {
      data.meta.frameTags.forEach(tag => {
        const frames = [];
        for (let i = tag.from; i <= tag.to; i++) {
          frames.push({
            key: atlasKey,
            frame: data.frames[i].filename,
            duration: data.frames[i].duration
          });
        }
    
        scene.anims.create({
          key: tag.name,
          frames: frames,
          repeat: tag.name === 'idle' || tag.name === 'walk' ? -1 : 0
        });
      });
    }
    
    // Export settings for pixel art (prevent blurring)
    const canvasSettings = {
      // Canvas/WebGL settings
      pixelArt: true,  // Phaser 3
      antialias: false,
      roundPixels: true,
    
      // CSS for canvas
      imageRendering: 'pixelated',  // Modern browsers
      // Fallback: 'crisp-edges'
    };
    
    // Scale modes
    const scaleConfig = {
      // Integer scaling only
      mode: 'FIT',
      autoRound: true,
      resolution: 1,
    
      // For high-DPI displays
      zoom: Math.floor(window.devicePixelRatio)
    };
    

---
  #### **Name**
Attack Animation
  #### **Description**
Impact and anticipation in combat sprites
  #### **Example**
    // Attack animation principles
    
    /*
    ANIMATION PHASES:
    1. Anticipation (1-2 frames)
       - Wind-up, pull back
       - Telegraphs the attack
       - Critical for player readability
    
    2. Action (1-2 frames)
       - The swing/thrust/cast
       - Fastest part of animation
       - Often stretched/squashed sprites
    
    3. Contact (1 frame)
       - Impact moment
       - Effects trigger here
       - Briefly hold for impact feel
    
    4. Recovery (1-2 frames)
       - Return to idle
       - Can be cancelled for combos
       - Slower than action phase
    */
    
    const swordSwing = {
      frames: [
        { name: 'antic', duration: 120 },   // Pull back
        { name: 'swing1', duration: 50 },   // Fast swing
        { name: 'swing2', duration: 50 },   // Continued swing
        { name: 'impact', duration: 100 },  // Hold at extension
        { name: 'recover', duration: 80 }   // Return
      ],
    
      // Hit detection
      hitbox: {
        activeFrame: 2,  // When hitbox is active
        duration: 2,     // How many frames hitbox lasts
        offset: { x: 16, y: 0 },
        size: { width: 24, height: 16 }
      },
    
      // Effects
      effects: {
        impactFrame: 3,
        trailFrames: [1, 2],  // Motion blur frames
        screenShake: { intensity: 2, duration: 100 }
      }
    };
    
    // Sprite squash and stretch
    /*
    ANTICIPATION:
      - Slight squash (compress before spring)
      - Width: 110%, Height: 90%
    
    ACTION:
      - Stretch in direction of motion
      - Width: 90%, Height: 115%
    
    IMPACT:
      - Brief squash on contact
      - Return to normal quickly
    */
    
    function getSquashStretch(phase, intensity = 0.1) {
      switch (phase) {
        case 'anticipation':
          return { scaleX: 1 + intensity, scaleY: 1 - intensity };
        case 'action':
          return { scaleX: 1 - intensity, scaleY: 1 + intensity };
        case 'impact':
          return { scaleX: 1 + intensity * 0.5, scaleY: 1 - intensity * 0.5 };
        default:
          return { scaleX: 1, scaleY: 1 };
      }
    }
    

## Anti-Patterns


---
  #### **Name**
Too Much Detail
  #### **Description**
Adding detail that's invisible at actual size
  #### **Why Bad**
Details blur together, waste pixels, reduce readability
  #### **Instead**
Design at 1x zoom. If it's unclear at 1x, remove detail

---
  #### **Name**
Pillow Shading
  #### **Description**
Shading by just darkening edges uniformly
  #### **Why Bad**
Creates flat, 'pillow-like' appearance with no depth
  #### **Instead**
Choose a consistent light source and shade accordingly

---
  #### **Name**
Wrong Aspect Pixels
  #### **Description**
Using non-square pixels in modern context
  #### **Why Bad**
Sprites look stretched on modern displays
  #### **Instead**
Use square pixels unless specifically targeting retro hardware

---
  #### **Name**
Anti-Aliasing to Background
  #### **Description**
Anti-aliasing sprites against a specific background color
  #### **Why Bad**
Creates ugly halos when used on different backgrounds
  #### **Instead**
Keep hard edges or anti-alias only to transparent

---
  #### **Name**
Inconsistent Pixel Scale
  #### **Description**
Mixing different pixel resolutions in same art
  #### **Why Bad**
Breaks visual cohesion, looks like asset flip
  #### **Instead**
Pick one pixel size and stay consistent throughout

---
  #### **Name**
Frame Count Obsession
  #### **Description**
Adding more frames thinking it improves animation
  #### **Why Bad**
Can make animation mushy, increases work exponentially
  #### **Instead**
Focus on key poses. 4 great frames > 12 mediocre frames

---
  #### **Name**
Ignoring Silhouette
  #### **Description**
Focusing on internal detail before silhouette works
  #### **Why Bad**
Character won't read against varied backgrounds
  #### **Instead**
Establish clear silhouette first, then add internal detail