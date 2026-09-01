# Sprite art direction

Zakape gives every connected model a runtime art-direction contract. This instruction does not retrain or fine-tune the model. It supplies the constraints and visual context needed to turn an artist's request into bounded pixel operations.

## What the model sees

Each request identifies the canvas size, top-left coordinate origin, palette, active layer, and exact target frame IDs. Pixel grids use palette indexes; `-1` represents transparency.

For each included frame, the model receives:

- `composite_rows`: the visible result of the layer stack
- `active_layer_rows`: the pixels on the only layer it may edit
- frame name, timeline index, duration, and whether the frame is a target or read-only reference

For a current-frame edit, the previous and next frames are read-only references. For an entire-sheet edit, all frames are ordered targets.

## Craft rules

The assistant is instructed to:

- build deliberate pixel clusters and readable negative space
- avoid isolated noise, accidental stair-steps, pillow shading, gradients, and anti-aliasing
- preserve silhouette, focal point, light direction, and the established design language unless the prompt says otherwise
- reuse the existing palette and nearby color ramps where possible
- make the fewest pixel changes that fully solve the request
- use coordinate lists for organic contours and rectangles only for genuinely geometric forms
- reason from the visible composite while editing only the selected layer
- keep volumes, landmarks, outline weight, lighting, and attached details coherent across animation frames
- preserve pose-to-pose motion instead of copying one static drawing across the sheet

Before returning a response, the model is told to audit cluster cleanliness, palette discipline, animation continuity, frame IDs, coordinates, and JSON validity.

## Response contract

The model returns JSON only:

```json
{
  "summary": "Keep the highlight attached through the run cycle.",
  "frames": [
    {
      "frame_id": "frame_1",
      "operations": [
        {
          "type": "set_pixels",
          "pixels": [{ "x": 8, "y": 7, "color": "#fff1bd" }]
        }
      ]
    }
  ]
}
```

An entire-sheet response must contain one entry for every target frame in timeline order. Entries may contain no operations when the requested art direction genuinely requires no change to that pose. Zakape rejects unexpected, duplicate, missing, or reordered frame IDs and validates every operation before showing the review card.

## Prompt recipe for artists

A useful request answers three questions:

1. What looks wrong or what should be added?
2. What visual result should replace it?
3. Which traits must not change?

For example:

> On the entire sheet, clean the leg silhouettes so each pose reads at 1× size. Remove isolated pixels, keep both feet the same volume, preserve the bounce between frames, and use only the existing dark green outline colors.

This is more actionable than “improve the animation” because it names the target, quality bar, invariants, and palette constraint.
