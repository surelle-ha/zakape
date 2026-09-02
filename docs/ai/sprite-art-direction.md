# Sprite art direction

Zakape gives every connected model a runtime art-direction contract. This instruction does not retrain or fine-tune the model. It supplies the constraints and visual context needed to turn an artist's request into bounded pixel operations.

## What the model sees

Each request identifies the canvas size, top-left coordinate origin, palette, active layer, and exact target frame IDs. Pixel grids use palette indexes; `-1` represents transparency. The `art_constraints` object also reports native resolution, current color count, available palette count, hard-edge rendering, frame durations, and practical color budgets.

For each included frame, the model receives:

- `composite_rows`: the visible result of the layer stack
- `active_layer_rows`: the pixels on the only layer it may edit
- frame name, timeline index, duration, and whether the frame is a target or read-only reference

For a current-frame edit, the previous and next frames are read-only references. For an entire-sheet edit, all frames are ordered targets.

## Craft rules

The assistant is instructed to:

- establish a readable silhouette and negative space before internal detail
- build major forms from deliberate pixel clusters
- avoid isolated noise, accidental stair-steps, banding, pillow shading, gradients, and anti-aliasing
- audit the result at native 1Ã— size
- reuse constrained color ramps, with cooler shadows and warmer highlights when that matches the existing art
- keep one directional light source instead of darkening every edge
- preserve the established outline strategy and native 1 px weight when an outline is present
- use only ordered, repeating dithering patterns; random noise is not accepted as texture
- keep small props near 4â€“6 colors and characters near 8â€“12 colors unless the existing art or artist's request requires otherwise
- make the fewest pixel changes that fully solve the request
- use coordinate lists for organic contours and rectangles only for genuinely geometric forms
- reason from the visible composite while editing only the selected layer
- keep volumes, landmarks, outline weight, lighting, and attached details coherent across animation frames
- preserve key poses and explicit frame timing instead of copying one static drawing or adding unnecessary in-betweens
- retain contact and passing poses for locomotion, and anticipation, action, impact, and recovery for actions

Before returning a response, the model is told to audit silhouette readability, cluster cleanliness, palette discipline, directional lighting, animation continuity, frame IDs, coordinates, and JSON validity.

## Runtime guidance source

The development copy of the [pixel-art sprite skill](https://www.skills.sh/omer-metin/skills-for-antigravity/pixel-art-sprites) is installed through `skills.sh` under `.agents/skills/pixel-art-sprites`. Zakape does not send that package or its prose to a connected provider. The application maintains a smaller, reviewed runtime contract in `useAiAssistant.ts`, adapted to Zakape's frame-addressed operation format and safety limits.

When the upstream skill is updated, maintainers should reinstall it with `skills.sh`, review the creation patterns, failure cases, and validations, then deliberately port relevant rules into the runtime contract. Unit assertions cover the silhouette-first workflow, ordered dithering, action phases, color budgets, hard-edge rendering, and frame timing so an update cannot silently weaken those constraints.

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
