# Pixel Art Sprites - Validations

## Pixel Art Rendering Mode

### **Id**
check-pixel-art-mode
### **Description**
Game should use pixelated/crisp rendering
### **Pattern**
pixelArt|antialias|roundPixels|image-rendering
### **File Glob**
**/*.{js,ts,css}
### **Match**
present
### **Context Pattern**
true|pixelated|crisp-edges
### **Message**
Enable pixel-perfect rendering (pixelArt: true, antialias: false)
### **Severity**
error
### **Autofix**


## Integer Scaling

### **Id**
check-integer-scaling
### **Description**
Sprites should use integer scale values
### **Pattern**
setScale|scale\s*\(|transform.*scale
### **File Glob**
**/*.{js,ts}
### **Match**
present
### **Context Pattern**
\b[1-9]\b|Math\.floor|Math\.round|\|\s*0
### **Message**
Use integer scaling for pixel art (1x, 2x, 3x, not 1.5x)
### **Severity**
warning
### **Autofix**


## Sprite Sheet Configuration

### **Id**
check-sprite-sheet-config
### **Description**
Sprite sheets should specify frame dimensions
### **Pattern**
spritesheet|load.*sprite|atlas
### **File Glob**
**/*.{js,ts}
### **Match**
present
### **Context Pattern**
frameWidth|frameHeight|frame.*[Ww]idth
### **Message**
Specify frameWidth and frameHeight for sprite sheets
### **Severity**
error
### **Autofix**


## Animation Timing Values

### **Id**
check-animation-timing
### **Description**
Animations should have explicit timing/duration
### **Pattern**
anims\.create|createAnimation|animation
### **File Glob**
**/*.{js,ts}
### **Match**
present
### **Context Pattern**
duration|frameRate|delay
### **Message**
Specify animation timing (duration or frameRate)
### **Severity**
warning
### **Autofix**


## PNG Format for Sprites

### **Id**
check-png-format
### **Description**
Sprite assets should be PNG format
### **Pattern**
load\.image|load\.spritesheet|load\.atlas|src.*=
### **File Glob**
**/*.{js,ts,html}
### **Match**
present
### **Context Pattern**
\.png|\.PNG
### **Message**
Use PNG format for pixel art sprites (not JPEG)
### **Severity**
warning
### **Autofix**


## No JPEG Sprites

### **Id**
check-no-jpeg-sprites
### **Description**
JPEG should not be used for pixel art
### **Pattern**
\.(jpg|jpeg|JPG|JPEG)
### **File Glob**
**/*.{js,ts,html}
### **Match**
absent
### **Message**
JPEG destroys pixel art - use PNG instead
### **Severity**
error
### **Autofix**


## Consistent Frame Sizes

### **Id**
check-consistent-frame-size
### **Description**
All frames in animation should be same size
### **Pattern**
frameWidth|frame_width|spriteWidth
### **File Glob**
**/*.{js,ts,json}
### **Match**
present
### **Message**
Ensure all animation frames have consistent dimensions
### **Severity**
info
### **Autofix**


## Animation Loop Configuration

### **Id**
check-animation-loop-config
### **Description**
Animations should specify repeat behavior
### **Pattern**
anims\.create|createAnimation
### **File Glob**
**/*.{js,ts}
### **Match**
present
### **Context Pattern**
repeat|loop|yoyo
### **Message**
Specify animation repeat behavior (loop, once, yoyo)
### **Severity**
info
### **Autofix**
