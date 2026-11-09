# Stylized Alpine 3D: asset conventions

How new world assets are made so they belong to the same world as the lodge, the sled and the patroller.
Tools: `art/3d/scripts/alpine_kit.py` (the shared kit) inside the existing MeshCraft scripts, built with
`python3 art/pipeline/8_build_models.py <script> <asset> --ship`. The art bible (edition 2.5) stays canonical.

## Using the kit

```python
# at the top of a MeshCraft script, after the palette and roles are set up
exec(open(os.path.join(os.path.dirname(A["palette"]), "3d", "scripts", "alpine_kit.py")).read())
AK = AlpineKit(K, paint=lambda o, role: K.assign(o, M(role)))

roof = AK.snow_roof(span, length, pitch, seed=7)                 # roof planes + snow load + icicles
walls += AK.fieldstone(length, 0.7, (x, foot_y, z), True, 1)     # a stone socle on a wall facing +z
walls += AK.woodpile(1.4, 0.9, (x, foot_y, z), True, 1)          # working detail
```

| Piece | Use it for |
| --- | --- |
| `snow_roof`, `snow_shed`, `snow_slope` | Every pitched or lean-to roof. Drop-in for the old `snow_roof()` slabs |
| `icicles` | Eaves, sills, gutters; clustered and uneven |
| `drift` | Snow banked against walls, plinths, vehicles |
| `fieldstone`, `stone` | Socles, chimneys, retaining walls |
| `woodpile`, `log_end` | Firewood; anything seen end-on |
| `skis_against_wall`, `patrol_sign`, `wall_lamp` | Signs that people live and work here |

## Rules

1. **Shape and role colour only.** No textures, normal maps or extra materials. Paint by palette role; new
   roles go into the script's role table with a palette colour, and the game grades them.
2. **Snow is a soft load, never a slab.** It bulges, rolls over edges, sags past eaves, rounds off at ends.
3. **Buildings are built**: a stone socle or concrete footing, a frame, cladding, trim, an overhang, purlins.
   Every opening has a frame and a sill.
4. **Lived-in**: at least one sign of work on the side the player sees most (wood, skis, a lamp, the plaque).
5. **Lit glass is one role** (`window`), so every lamp and window glows together at dusk.
6. **Smooth where soft**: shade smooth with a crease angle (40° for buildings, 50° for vehicles) so snow and
   cowls are soft while boards, stones and seven-sided logs keep their edges.
7. **Draw calls are the budget, triangles second.** Every role on a skinned or dressed mesh (the patroller,
   Koda, the sled) is one more draw call, twice with shadows: put new parts in roles that mesh already has.
   Static buildings are baked to vertex colour per cut-away node, so new roles there are free.
8. **Contracts are fixed**: node names, pivots, bones, footprints and colliders. A new obstacle the player can
   touch gets a collider in `src/world/station.ts` (or the place's own collider list).
9. **Deterministic**: every random piece takes a seed.
10. **Budgets live in tests** (`tests/models.test.ts`); raise one only with its reason written next to it.
11. **Prove it in the game**: capture before and after (`docs/art-direction-a/capture.mjs`), at 1440 x 900 and
    on a 390 x 844 phone, and record draw calls and triangles.
