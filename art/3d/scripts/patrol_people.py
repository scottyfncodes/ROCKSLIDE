"""ROCKSLIDE: the patroller and Koda as rigged models (MeshCraft run_script).

Run inside MeshCraft's Blender (globals: bpy, kit, args, Palette):
  run_script {"path": ".../patrol_people.py", "args": {"asset": "rs_patroller", "palette": ".../rockslide-palette.json", "out": ".../rs_patroller.blend"}}

The game animates both characters in code (src/render/characterMesh.ts, huskyMesh.ts, gait.ts): a two-
bone leg solver, damped springs on every joint, jiggles on the soft things. These models give that code
a skeleton to drive instead of nested groups, so the movement does not change at all:

  * one bone per joint the code animates, with the code's own names, at the code's pivots, with zero
    rest rotation (every bone points straight up, roll 0, so its glTF node rotation is identity: the
    same frame as the code's THREE.Group, and the code's rotation/position/scale values mean the same);
  * every piece is rigidly bound (weight 1) to the joint that carries it in the code, modelled where the
    code puts it with all joints at rest;
  * things the game shows and hides (hats, skis, poles, the patrol gear; Koda's harness, bandana, eyes,
    tongue) are their own skinned meshes, so the code can keep toggling them.

Everything is modelled in three.js space (metres, +Y up, forward -Z) and turned into Blender's Z-up at the
end. Materials are palette roles; the game maps each role back onto its own materials (paint, hats,
gear colours and the storybook grade keep working), and COLOR_0 keeps the file right on its own.
"""
import math
import bpy, bmesh
from mathutils import Matrix, Vector

A = args  # noqa: F821
pal = Palette.from_file(A["palette"])  # noqa: F821
asset = A["asset"]
K = kit  # noqa: F821
K.reset()
TO_BLENDER = Matrix.Rotation(math.pi / 2, 4, "X")  # three.js (x, y, z) -> Blender (x, -z, y)
UP = 0.06  # bone length (only for display: bones are pivots)


def v3(a, b=(0, 0, 0)):
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


class Rig:
    """Bones (absolute rest positions in three.js space) and the parts bound to them.

    `keep`: when set, only these roles stay their own material; every other role is baked into the
    vertex colours and drawn with the one "baked" material (one draw call per mesh instead of one per
    colour). The roles kept are the ones the game repaints (jacket, hats, lens, skis, hair)."""

    def __init__(self, mats, keep=None):
        self.mats, self.bones, self.parts, self.keep = mats, {}, {}, keep

    def bone(self, name, parent, offset):
        base = self.bones[parent][0] if parent else (0, 0, 0)
        self.bones[name] = (v3(base, offset), parent)
        return name

    def at(self, bone, local):
        return v3(self.bones[bone][0], local)

    def add(self, obj, bone, o, role=None):
        """Bind object `o` (already in three.js space) rigidly to `bone`, in output mesh `obj`."""
        if role: K.assign(o, self.mats[role])
        o.vertex_groups.new(name=bone).add(list(range(len(o.data.vertices))), 1.0, "REPLACE")
        self.parts.setdefault(obj, []).append(o)
        return o


def place(o, pos, rot=(0, 0, 0), scale=(1, 1, 1)):
    o.rotation_mode = "ZYX"  # Blender ZYX == three.js 'XYZ'
    o.location = pos; o.rotation_euler = rot; o.scale = scale
    return o


def B(n, w, h, d, pos, rot=(0, 0, 0), scale=(1, 1, 1), bevel=0.0):
    return place(K.box(n, (w, h, d), (0, 0, 0), None, bevel=bevel), pos, rot, scale)


def C(n, rt, rb, h, seg, pos, rot=(0, 0, 0), scale=(1, 1, 1)):
    seg = seg if seg <= 4 else round(seg * SOFT_SIDES)
    return place(K.cylinder(n, rt, h, (0, 0, 0), axis="Y", verts=seg, r2=rb), pos, rot, scale)


# Art Direction 2.0 Phase B, "soft carved figures": the people and Koda were cut gems (20 and 80 facet
# icosahedra, flat shaded) beside a smooth-shaded world. They are now rounded wood-toy forms: gems are
# subdivided once more, drums and limbs get more sides, and the mesh is smooth shaded with hard edges
# kept only where two faces meet sharply (gear, straps, the goggles), so they take the world's light.
SOFT_SIDES = 1.35


def G(n, r, pos, detail=1, scale=(1, 1, 1), rot=(0, 0, 0)):
    """A rounded form: an 80-face icosphere, smooth shaded; the big masses (the head, the barrel) get
    one more subdivision so their silhouette stays round at close range; the smallest (eyes, glints,
    buttons) stay at 20 faces, which smooth shading already rounds at their size."""
    size = r * max(scale)
    return place(K.ico(n, r, (0, 0, 0), None, sub=3 if size >= 0.26 else 2 if size >= 0.05 else 1), pos, rot, scale)


def P(n, outline, depth, pos, rot=(0, 0, 0)):
    """An outline [(x, y), ...] in the xy plane, extruded along z (depth)."""
    return place(K.prism(n, outline, depth, (0, 0, 0), axis="Z"), pos, rot)


def S(n, r, pos, seg=9, scale=(1, 1, 1), floor=None):
    """three's SphereGeometry(r, seg, round(seg * 0.7)), poles on y. `floor` (in the sphere's own
    units, before scaling) flattens everything below it: a dome with no underside."""
    o = K.sphere(n, r, (0, 0, 0), None, segs=seg, rings=max(4, round(seg * 0.7)))
    K.deform(o, lambda v: Vector((v.x, v.z if floor is None else max(v.z, floor), -v.y)))
    return place(o, pos, (0, 0, 0), scale)


def cone(n, r, h, seg, pos, rot=(0, 0, 0), scale=(1, 1, 1)):
    """three's ConeGeometry(r, h, seg): along y, point up, centred."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=0, depth=h)
    bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(-math.pi / 2, 3, "X"), verts=bm.verts)
    me = bpy.data.meshes.new(n); bm.to_mesh(me); bm.free()
    return place(K.link(bpy.data.objects.new(n, me)), pos, rot, scale)


def limb(n, r0, r1, length, pos, sides=10):
    """A soft, tapered capsule hanging down from its joint (the code's limb()): rounded at both ends."""
    rings = [(0.0, 0.42 * r0), (-0.2 * r0, 0.86 * r0), (-0.5 * r0, r0), (-length * 0.5, (r0 + r1) * 0.53),
             (-length + 0.5 * r1, r1), (-length + 0.2 * r1, 0.86 * r1), (-length, 0.42 * r1)]
    bm = bmesh.new(); loops = []
    for y, r in rings:
        loops.append([bm.verts.new((math.cos(a) * r, y, math.sin(a) * r)) for a in (math.tau * i / sides for i in range(sides))])
    for a, b in zip(loops, loops[1:]):
        for i in range(sides):
            j = (i + 1) % sides
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(loops[0]); bm.faces.new(loops[-1][::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(n); bm.to_mesh(me); bm.free()
    return place(K.link(bpy.data.objects.new(n, me)), pos)


def ribbon(n, w0, w1, length, pos, y=0.0):
    """The scarf tails: a flat four-sided taper hanging from its pivot."""
    o = C(n, w0, w1, length, 4, (0, 0, 0))
    K.deform(o, lambda v: Vector((v.x, v.y - length / 2 + y, v.z)))
    o.rotation_mode = "ZYX"; o.rotation_euler = (0, math.pi / 4, 0)
    bpy.context.view_layer.update()
    o.data.transform(o.matrix_basis); o.matrix_basis = Matrix()
    K.deform(o, lambda v: Vector((v.x, v.y, v.z * 0.28)))
    return place(o, pos)


def collapse_baked(o, rig):
    """Every face whose role the game does not repaint moves onto the one "baked" material: its colour is
    already in the vertex colours (bake_vertex_colors above), and the game draws it with one material."""
    me = o.data
    used = sorted({p.material_index for p in me.polygons})
    role = lambda i: me.materials[i].get("gitcraft_role", "")  # noqa: E731
    kept = [me.materials[i] for i in used if role(i) in rig.keep]
    slots = kept + ([rig.mats["baked"]] if any(role(i) not in rig.keep for i in used) else [])
    remap = {i: (kept.index(me.materials[i]) if role(i) in rig.keep else len(slots) - 1) for i in used}
    idx = [remap[p.material_index] for p in me.polygons]
    me.materials.clear()
    for m in slots:
        me.materials.append(m)
    for p, i in zip(me.polygons, idx):
        p.material_index = i
    me.update()


def build(rig, name):
    """Armature + one skinned mesh per output object, all turned into Blender space."""
    bones = []
    for bn, (head, parent) in rig.bones.items():
        h = TO_BLENDER @ Vector(head)
        bones.append((bn, tuple(h), tuple(h + Vector((0, 0, UP))), parent))
    arm = K.armature(f"{name}_rig", bones)
    out = []
    for obj, parts in rig.parts.items():
        o = K.join(parts, obj)
        o.data.transform(o.matrix_world); o.matrix_world = Matrix()
        o.data.transform(TO_BLENDER)
        # Smooth shading, hard only where faces meet at more than 55 degrees (box gear, caps, the
        # goggles): the game's figure materials shade with these normals (no flatShading), so a figure
        # takes the sun, the sky and the snow light the way the terrain does. One colour per role.
        K.shade(o, smooth_angle=55)
        K.bake_vertex_colors(o, rig.mats, jitter=0.0)
        if rig.keep is not None:
            collapse_baked(o, rig)
        K.skin_rigid(o, arm, {})
        o["gitcraft_asset"] = asset
        out.append(o)
    return arm, out


# ====================================================================== the patroller
THIGH, SHIN, ANKLE = 0.48, 0.46, 0.08  # src/render/gait.ts
LEG = THIGH + SHIN + ANKLE
H = 0.195  # hat radius


def patroller(civilian=False):
    """The patroller; civilian=True is the villagers' outfit on the same skeleton (rs_villager): a
    knitted cardigan with a Fair Isle yoke, elbow patches and wooden buttons, fur-cuffed snow boots, no
    gaiters, pockets, patrol shell or gear. Same bones, same paint roles (jacket and trim still take each
    villager's colours), so the same code drives it."""
    mats = K.Materials(pal, {
        "jacket": "Patrol Red", "trim": "Cross White", "trousers": "#3B3550", "boot": "#6A2E2A", "sole": "#2A1D1A",
        "gaiter": "#2C2840", "glove": "#33303C", "strap": "#2B2F38", "dark": "Aubergine", "skin": "#F2C9A8",
        "hair": "#5A3A26", "scarf": "#5F9C86", "lens": "#F2A33A", "ski": "#C79A62", "hatMain": "Patrol Red",
        "hatSecond": "Cross White", "patchWhite": "Paper", "patchRed": "Patrol Red", "pack": "#56606C",
        "packDark": "#434B56", "nose": "#E3A283", "eye": "#1D1D1D", "cheek": "#EEA295", "smile": "Painted Timber Dark",
        "metal": "Steel",
    }, prefix="RS")
    r = Rig(mats)
    # ---- the skeleton: the code's joints, at its pivots (all rotations zero)
    r.bone("body", None, (0, 0, 0))
    r.bone("pelvis", "body", (0, LEG - 0.03, 0))
    for s, x in (("L", -0.11), ("R", 0.11)):
        r.bone(f"hip_{s}", "pelvis", (x, 0, 0))
        r.bone(f"knee_{s}", f"hip_{s}", (0, -THIGH, 0))
        r.bone(f"ankle_{s}", f"knee_{s}", (0, -SHIN, 0))
    r.bone("spine", "pelvis", (0, 0.12, 0))
    r.bone("chest", "spine", (0, 0.18, 0))
    r.bone("pack", "chest", (0, 0, 0))
    for s, x in (("L", -0.27), ("R", 0.27)):
        r.bone(f"shoulder_{s}", "chest", (x, 0.31, 0))
        r.bone(f"elbow_{s}", f"shoulder_{s}", (0, -0.29, 0))
    r.bone("neck", "chest", (0, 0.4, 0))
    r.bone("head", "neck", (0, 0.13, 0))
    # the eyes sit lower than the code-built figure's (out from under the hat band); they blink about
    # their own centres, so the bones move with them
    r.bone("eye_L", "head", (-0.062, 0.127, -0.17))
    r.bone("eye_R", "head", (0.062, 0.127, -0.17))
    r.bone("pom_beanie", "head", (0, 0.21 + H * 0.88, 0.01))
    r.bone("pom_bobble", "head", (0, 0.225 + H * 1.08, 0.01))
    tails = ((0, -0.03, 0.2), (1, 0.035, 0.17))
    for i, x, ln in tails:
        r.bone(f"scarf_a_{i}", "chest", (x, 0.46, 0.13))
        r.bone(f"scarf_b_{i}", f"scarf_a_{i}", (0, -ln, 0))
    J = r.at
    body = "pat_body"

    # ---- legs: thigh, shin, a cargo pocket, a chunky boot under a gaiter, a toe cap
    # (budget: the code-built figure draws ~2,560 triangles; this one stays about there)
    for s, sx in (("L", -1), ("R", 1)):
        hp, kn, an = f"hip_{s}", f"knee_{s}", f"ankle_{s}"
        r.add(body, hp, limb(f"thigh{s}", 0.11, 0.088, THIGH + 0.04, J(hp, (0, 0, 0))), "trousers")
        if not civilian:
            r.add(body, hp, G(f"pocket{s}", 0.06, J(hp, (sx * 0.095, -0.24, 0)), 0, (0.45, 1.2, 0.9)), "gaiter")
        r.add(body, kn, limb(f"shin{s}", 0.086, 0.072, SHIN, J(kn, (0, 0, 0))), "trousers")
        if civilian:
            # snow boots with a sheepskin cuff
            r.add(body, kn, C(f"fur{s}", 0.105, 0.098, 0.075, 7, J(kn, (0, -SHIN + 0.2, 0))), "patchWhite")
        else:
            r.add(body, kn, C(f"gaiter{s}", 0.097, 0.094, 0.07, 7, J(kn, (0, -SHIN + 0.2, 0))), "gaiter")
        r.add(body, kn, C(f"boot{s}", 0.09, 0.08, 0.2, 7, J(kn, (0, -SHIN + 0.09, 0))), "boot")
        r.add(body, an, G(f"foot{s}", 0.088, J(an, (0, -ANKLE + 0.05, -0.075)), 0, (0.92, 0.62, 1.85)), "boot")
        r.add(body, an, G(f"toecap{s}", 0.06, J(an, (0, -ANKLE + 0.045, -0.2)), 0, (1.15, 0.7, 0.9)), "boot")
        r.add(body, an, G(f"tread{s}", 0.09, J(an, (0, -ANKLE + 0.022, -0.075)), 0, (0.96, 0.3, 1.9)), "sole")

    if civilian:
        # ---- a knitted cardigan: ribbed waistband, a Fair Isle yoke, a button band, a shawl collar
        r.add(body, "pelvis", C("seat", 0.2, 0.215, 0.2, 8, J("pelvis", (0, 0.02, 0)), scale=(1, 1, 0.78)), "trousers")
        r.add(body, "pelvis", C("hem", 0.218, 0.232, 0.13, 8, J("pelvis", (0, 0.02, 0)), scale=(1, 1, 0.8)), "jacket")
        r.add(body, "pelvis", C("rib", 0.236, 0.236, 0.05, 8, J("pelvis", (0, -0.055, 0)), scale=(1, 1, 0.8)), "trim")
        r.add(body, "spine", C("waist", 0.205, 0.225, 0.2, 8, J("spine", (0, 0.08, 0)), scale=(1, 1, 0.78)), "jacket")
        r.add(body, "chest", C("torso", 0.26, 0.205, 0.38, 8, J("chest", (0, 0.17, 0)), scale=(1, 1, 0.76)), "jacket")
        r.add(body, "chest", G("shoulders", 0.27, J("chest", (0, 0.33, 0)), 1, (1, 0.36, 0.78)), "trim")
        # the yoke's pattern: a ring of diamonds in the body colour, knitted into the band
        for i in range(12):
            a = math.tau * (i + 0.5) / 12
            x, z = math.sin(a) * 0.272, -math.cos(a) * 0.213
            r.add(body, "chest", B(f"fair{i}", 0.045, 0.045, 0.02, J("chest", (x, 0.31, z)), (0, -a, math.pi / 4)), "jacket")
        r.add(body, "chest", B("band", 0.05, 0.42, 0.014, J("chest", (0, 0.13, -0.195)), (0.1, 0, 0)), "trim")
        for i in range(4):
            r.add(body, "chest", C(f"btn{i}", 0.014, 0.014, 0.012, 6, J("chest", (0, 0.27 - i * 0.1, -0.205 + i * 0.01)), (math.pi / 2 + 0.1, 0, 0)), "dark")
        r.add(body, "chest", C("collar", 0.14, 0.17, 0.08, 8, J("chest", (0, 0.4, 0.01)), scale=(1, 1, 0.92)), "trim")
    else:
        # ---- the patrol shell over insulated trousers
        r.add(body, "pelvis", C("seat", 0.2, 0.215, 0.2, 8, J("pelvis", (0, 0.02, 0)), scale=(1, 1, 0.78)), "trousers")
        r.add(body, "pelvis", C("hem", 0.225, 0.242, 0.17, 8, J("pelvis", (0, 0, 0)), scale=(1, 1, 0.8)), "jacket")
        r.add(body, "pelvis", C("hemBand", 0.245, 0.245, 0.035, 8, J("pelvis", (0, -0.08, 0)), scale=(1, 1, 0.8)), "trim")
        r.add(body, "spine", C("waist", 0.205, 0.225, 0.2, 8, J("spine", (0, 0.08, 0)), scale=(1, 1, 0.78)), "jacket")
        r.add(body, "chest", C("torso", 0.26, 0.205, 0.38, 8, J("chest", (0, 0.17, 0)), scale=(1, 1, 0.76)), "jacket")
        r.add(body, "chest", G("shoulders", 0.27, J("chest", (0, 0.33, 0)), 1, (1, 0.36, 0.78)), "trim")
        r.add(body, "chest", B("zip", 0.022, 0.4, 0.012, J("chest", (0, 0.16, -0.19)), (0.1, 0, 0)), "trim")
        r.add(body, "chest", C("collar", 0.13, 0.155, 0.1, 8, J("chest", (0, 0.41, 0))), "jacket")
        r.add(body, "chest", G("hood", 0.12, J("chest", (0, 0.43, 0.13)), 0, (1.3, 0.6, 0.8)), "jacket")
        # Art Direction A, layered winter clothing: the shell is insulated, so it carries two quilted
        # baffles (a ring proud of the jacket at the chest and the waist), a storm flap over the zip and
        # a fleece edge to the collar; all inside the figure's outline
        r.add(body, "chest", C("baffle", 0.265, 0.25, 0.05, 8, J("chest", (0, 0.06, 0)), scale=(1, 1, 0.77)), "jacket")
        r.add(body, "spine", C("baffle2", 0.228, 0.232, 0.045, 8, J("spine", (0, 0.1, 0)), scale=(1, 1, 0.79)), "jacket")
        r.add(body, "chest", B("flap", 0.05, 0.36, 0.016, J("chest", (0.03, 0.17, -0.197)), (0.1, 0, 0)), "jacket")
        r.add(body, "chest", C("fleece", 0.138, 0.14, 0.03, 8, J("chest", (0, 0.465, 0))), "patchWhite")
    # the scarf, wound twice, and its two tails on their own joints
    r.add(body, "chest", C("wrap", 0.135, 0.165, 0.075, 8, J("chest", (0, 0.425, 0.005))), "scarf")
    r.add(body, "chest", C("wrap2", 0.125, 0.145, 0.06, 8, J("chest", (0, 0.475, 0.01)), (0, 0, 0.12)), "scarf")
    for i, x, ln in tails:
        a, b = f"scarf_a_{i}", f"scarf_b_{i}"
        r.add(body, a, ribbon(f"tailA{i}", 0.04, 0.036, ln, J(a, (0, 0, 0))), "scarf")
        r.add(body, b, ribbon(f"tailB{i}", 0.036, 0.032, ln * 0.85, J(b, (0, 0, 0))), "scarf")
        r.add(body, b, ribbon(f"fringe{i}", 0.034, 0.042, 0.035, J(b, (0, 0, 0)), -ln * 0.85), "trim")

    # ---- arms: upper arm, forearm with a cuff, a big mitten with a thumb
    for s, sx in (("L", -1), ("R", 1)):
        sh, el = f"shoulder_{s}", f"elbow_{s}"
        r.add(body, sh, limb(f"upper{s}", 0.08, 0.066, 0.3, J(sh, (0, 0, 0))), "jacket")
        r.add(body, el, limb(f"fore{s}", 0.068, 0.058, 0.26, J(el, (0, 0, 0))), "jacket")
        r.add(body, el, C(f"cuff{s}", 0.07, 0.07, 0.05, 7, J(el, (0, -0.24, 0))), "trim")
        if not civilian:
            # the mittens' gauntlets come up over the cuffs (a second layer at the wrist)
            r.add(body, el, C(f"gauntlet{s}", 0.078, 0.07, 0.07, 8, J(el, (0, -0.275, -0.005))), "glove")
            if s == "L":
                # the patrol cross on the left sleeve: a cream disc with the red cross, facing out
                r.add(body, sh, C("sleeveDisc", 0.042, 0.042, 0.012, 9, J(sh, (-0.074, -0.09, 0)), (0, 0, math.pi / 2)), "patchWhite")
                r.add(body, sh, B("sleeveV", 0.014, 0.05, 0.016, J(sh, (-0.081, -0.09, 0))), "jacket")
                r.add(body, sh, B("sleeveH", 0.014, 0.016, 0.05, J(sh, (-0.081, -0.09, 0))), "jacket")
        if civilian:
            # leather elbow patches
            r.add(body, el, G(f"patch{s}", 0.045, J(el, (0, -0.04, 0.058)), 0, (0.85, 1.2, 0.3)), "boot")
        r.add(body, el, G(f"hand{s}", 0.074, J(el, (0, -0.31, -0.01)), 1, (0.88, 1.12, 1)), "glove")
        r.add(body, el, G(f"thumb{s}", 0.032, J(el, (-sx * 0.055, -0.29, -0.045)), 0), "glove")

    # ---- neck and head
    r.add(body, "neck", C("neckC", 0.065, 0.07, 0.12, 7, J("neck", (0, 0.05, 0))), "skin")
    hd = lambda p: J("head", p)  # noqa: E731
    r.add(body, "head", G("face", 0.185, hd((0, 0.13, 0)), 1, (0.95, 1.06, 1)), "skin")
    r.add(body, "head", G("hairCap", 0.19, hd((0, 0.165, 0.035)), 1), "hair")
    # A face that reads at phone size: eyes, brows, nose, blush and smile all below the hat band.
    # tufts of hair at the temples, under the band (the old fringe poked out through the hat)
    for sx in (-1, 1):
        r.add(body, "head", G(f"tuft{sx}", 0.045, hd((sx * 0.162, 0.135, -0.04)), 0, (0.55, 1.25, 0.9), (0, 0, sx * 0.25)), "hair")
    # eyes: dark ovals with a catchlight; each blinks (squashes) about its own centre
    for s_, sx in (("L", -1), ("R", 1)):
        e = f"eye_{s_}"
        r.add(body, e, G(f"eye{s_}", 0.024, J(e, (0, 0, 0.003)), 0, (0.82, 1.3, 0.45)), "eye")
        r.add(body, e, B(f"glint{s_}", 0.011, 0.011, 0.006, J(e, (0.007, 0.01, -0.0075)), (0, 0, 0.6)), "patchWhite")
        # Art Direction A, an expressive face: a lash line over each eye, flicked up at the outer corner
        # (bound to the eye, so it closes with the blink)
        r.add(body, e, B(f"lash{s_}", 0.044, 0.008, 0.008, J(e, (sx * 0.002, 0.03, -0.008)), (0, 0, sx * -0.18)), "eye")
        r.add(body, e, B(f"flick{s_}", 0.014, 0.007, 0.008, J(e, (sx * 0.025, 0.035, -0.006)), (0, 0, sx * -0.75)), "eye")
        # brows: a soft arch just under the band, lifted at the inner end (friendly, a little keen)
        r.add(body, "head", B(f"brow{s_}", 0.046, 0.009, 0.01, hd((sx * 0.064, 0.16, -0.177)), (-0.25, sx * 0.15, sx * 0.14)), "hair")
    # a button nose
    r.add(body, "head", G("nose", 0.026, hd((0, 0.098, -0.19)), 0, (1, 0.85, 0.95)), "nose")
    if not civilian:
        # a dusting of freckles across the nose and cheeks: an outdoor face
        for k, (fx, fy) in enumerate(((-0.07, 0.102), (-0.05, 0.112), (-0.085, 0.118), (0.07, 0.102), (0.05, 0.112), (0.085, 0.118))):
            fz = -math.sqrt(max(0.0, 0.181 ** 2 - fx * fx / 0.9 - (fy - 0.13) ** 2)) - 0.001
            r.add(body, "head", B(f"freckle{k}", 0.008, 0.008, 0.004, hd((fx, fy, fz)), (0, -fx * 5, 0)), "nose")
    # blush: flat discs lying on the cheeks
    for sx in (-1, 1):
        # on the face's own surface there (x 0.098, 4.5 cm below its centre), facing the way it does
        r.add(body, "head", C(f"blush{sx}", 0.026, 0.026, 0.005, 6, hd((sx * 0.096, 0.085, -0.146)), (math.pi / 2, 0, sx * 0.63), (1, 1, 0.75)), "cheek")
    # the smile: one crescent, tipped to follow the face down toward the chin
    arc = [(math.cos(a) * 0.036, math.sin(a) * 0.02) for a in (math.pi * (1.1 + 0.2 * i) for i in range(5))]
    inner = [(x * 0.86, y * 0.62 + 0.002) for x, y in arc[::-1]]  # a thin, upturned line: a smile, not lips
    r.add(body, "head", P("smile", arc + inner, 0.01, hd((0, 0.073, -0.177)), (-0.32, 0, 0)), "smile")
    # rounded ears
    for sx in (-1, 1):
        r.add(body, "head", S(f"ear{sx}", 0.045, hd((sx * 0.178, 0.122, 0.005)), 6, (0.42, 1, 0.78)), "skin")
    # goggles pushed up on the brow
    # (the villagers' goggles are their own mesh: only the skiers among them wear them)
    gog = "vil_goggles" if civilian else body
    r.add(gog, "head", C("gStrap", 0.19, 0.19, 0.04, 9, hd((0, 0.225, 0.01))), "dark")
    r.add(gog, "head", B("gFrame", 0.25, 0.085, 0.05, hd((0, 0.232, -0.165)), bevel=0.01), "dark")
    r.add(gog, "head", B("gLens", 0.225, 0.065, 0.06, hd((0, 0.232, -0.17))), "lens")

    # ---- hats (one shows at a time); pom-poms on their own joints. Each crown is a dome with no
    # underside (floor) that stops inside its band, so it never covers the face or shows through
    r.add("pat_hat_beanie", "head", S("dome", H, hd((0, 0.21, 0.01)), 9, (1, 0.92, 1), floor=-0.035 / 0.92), "hatMain")
    r.add("pat_hat_beanie", "head", C("band", H + 0.016, H + 0.02, 0.08, 9, hd((0, 0.205, 0.01))), "hatSecond")
    r.add("pat_hat_beanie", "pom_beanie", G("pom", 0.05, J("pom_beanie", (0, 0.05 * 0.75, 0)), 1), "hatSecond")
    r.add("pat_hat_helmet", "head", S("shell", H + 0.02, hd((0, 0.195, 0.01)), 10, (1, 0.95, 1.06), floor=-0.028 / 0.95), "hatMain")
    r.add("pat_hat_helmet", "head", B("ridge", 0.05, 0.04, 0.27, hd((0, 0.39, 0.01))), "hatSecond")
    r.add("pat_hat_helmet", "head", B("badge", 0.08, 0.08, 0.015, hd((0, 0.245, 0.215))), "hatSecond")
    r.add("pat_hat_trapper", "head", S("cap", H + 0.006, hd((0, 0.205, 0.01)), 9, (1, 0.9, 1), floor=-0.04 / 0.9), "hatMain")
    r.add("pat_hat_trapper", "head", C("brim", H + 0.024, H + 0.024, 0.08, 9, hd((0, 0.204, 0.01))), "hatSecond")
    for sx in (-1, 1):
        r.add("pat_hat_trapper", "head", G(f"earflap{sx}", 0.09, hd((sx * 0.185, 0.1, 0.01)), 0, (0.42, 1, 0.8)), "hatSecond")
    r.add("pat_hat_bobble", "head", S("bdome", H, hd((0, 0.225, 0.01)), 9, (1, 1.14, 1), floor=-0.065 / 1.14), "hatMain")
    r.add("pat_hat_bobble", "head", C("bband", H + 0.016, H + 0.02, 0.07, 9, hd((0, 0.195, 0.01))), "hatSecond")
    r.add("pat_hat_bobble", "pom_bobble", G("bpom", 0.085, J("pom_bobble", (0, 0.085 * 0.75, 0)), 1), "hatSecond")

    if not civilian:
        # ---- the patrol's gear (the villagers go without): straps, radio, the cross, the pack
        gear = "pat_gear"
        for sx in (-1, 1):
            r.add(gear, "chest", B(f"strap{sx}", 0.055, 0.3, 0.02, J("chest", (sx * 0.13, 0.2, -0.19)), (0.1, 0, 0)), "strap")
            r.add(gear, "chest", B(f"over{sx}", 0.055, 0.02, 0.36, J("chest", (sx * 0.13, 0.38, 0))), "strap")
        r.add(gear, "chest", B("radio", 0.06, 0.1, 0.04, J("chest", (0.13, 0.26, -0.215)), bevel=0.008), "strap")
        r.add(gear, "chest", C("aerial", 0.007, 0.007, 0.1, 4, J("chest", (0.145, 0.35, -0.215))), "strap")
        r.add(gear, "chest", B("patch", 0.085, 0.085, 0.012, J("chest", (-0.11, 0.24, -0.185)), (0.1, 0, 0)), "patchWhite")
        r.add(gear, "chest", B("pv", 0.022, 0.06, 0.014, J("chest", (-0.11, 0.24, -0.19)), (0.1, 0, 0)), "patchRed")
        r.add(gear, "chest", B("ph", 0.06, 0.022, 0.014, J("chest", (-0.11, 0.24, -0.19)), (0.1, 0, 0)), "patchRed")
        # Art Direction A, the patroller's kit: a sternum strap with a whistle, a hip belt with a buckle
        # and the first-aid pouch on the right hip (red, with the cream cross). Only roles the gear
        # already had: each role on a skinned mesh is another draw call
        r.add(gear, "chest", B("sternum", 0.3, 0.025, 0.02, J("chest", (0, 0.23, -0.2)), (0.1, 0, 0)), "strap")
        r.add(gear, "chest", C("whistle", 0.012, 0.012, 0.045, 6, J("chest", (-0.06, 0.2, -0.212)), (0, 0, 0.3)), "patchRed")
        r.add(gear, "spine", C("belt", 0.236, 0.244, 0.045, 9, J("spine", (0, -0.02, 0)), scale=(1, 1, 0.8)), "strap")
        r.add(gear, "spine", B("buckle", 0.06, 0.045, 0.02, J("spine", (0, -0.02, -0.198))), "trim")
        r.add(gear, "spine", B("pouch", 0.075, 0.11, 0.12, J("spine", (0.215, -0.07, -0.04)), (0, 0.25, 0)), "patchRed")
        r.add(gear, "spine", B("pouchV", 0.006, 0.05, 0.016, J("spine", (0.254, -0.065, -0.05)), (0, 0.25, 0)), "patchWhite")
        r.add(gear, "spine", B("pouchH", 0.006, 0.016, 0.05, J("spine", (0.254, -0.065, -0.05)), (0, 0.25, 0)), "patchWhite")
        r.add(gear, "pack", G("packMain", 0.215, J("pack", (0, 0.15, 0.25)), 1, (0.86, 1.02, 0.42)), "pack")
        r.add(gear, "pack", G("packFlap", 0.2, J("pack", (0, 0.3, 0.255)), 1, (0.92, 0.38, 0.46)), "packDark")
        r.add(gear, "pack", C("crossBg", 0.115, 0.115, 0.012, 8, J("pack", (0, 0.13, 0.348)), (math.pi / 2, 0, 0)), "trim")
        r.add(gear, "pack", B("crossV", 0.055, 0.15, 0.014, J("pack", (0, 0.13, 0.356))), "jacket")
        r.add(gear, "pack", B("crossH", 0.15, 0.055, 0.014, J("pack", (0, 0.13, 0.356))), "jacket")
        for sx in (-1, 1):
            r.add(gear, "pack", G(f"side{sx}", 0.07, J("pack", (sx * 0.19, 0.06, 0.25)), 0, (0.6, 1.1, 1)), "packDark")
        # skis on the pack, carried diagonally (shown when they are not on the feet): tails low at his
        # left hip, tips up past his right shoulder, below the hat, so from behind the hair and the
        # cross read and the pair is one clean diagonal, not two antennae
        for k, dz in enumerate((0.0, 0.035)):
            r.add("pat_skis_back", "pack", B(f"bski{k}", 0.075, 1.32, 0.026, J("pack", (0.02 + k * 0.03, 0.12 - k * 0.012, 0.37 + dz)), (0, 0, -0.98)), "ski")
            r.add("pat_skis_back", "pack", B(f"btip{k}", 0.075, 0.12, 0.026, J("pack", (0.02 + k * 0.03 + 0.55, 0.12 - k * 0.012 + 0.39, 0.37 + dz + 0.02)), (-0.35, 0, -0.98)), "ski")
        r.add("pat_skis_back", "pack", B("bstrap", 0.05, 0.03, 0.12, J("pack", (0.02, 0.13, 0.4))), "strap")
    # skis on the boots, poles in the mittens
    for s in ("L", "R"):
        an, el = f"ankle_{s}", f"elbow_{s}"
        g = (0, -ANKLE - 0.01, -0.07)
        r.add(f"pat_ski_{s}", an, B(f"ski{s}", 0.085, 0.03, 1.65, J(an, v3(g, (0, 0, -0.05)))), "ski")
        r.add(f"pat_ski_{s}", an, B(f"tip{s}", 0.085, 0.03, 0.2, J(an, v3(g, (0, 0.035, -0.95))), (0.45, 0, 0)), "ski")
        r.add(f"pat_ski_{s}", an, B(f"binding{s}", 0.1, 0.04, 0.16, J(an, v3(g, (0, 0.03, 0.03)))), "dark")
        p = (0, -0.31, 0)
        r.add(f"pat_pole_{s}", el, C(f"shaft{s}", 0.012, 0.012, 1.2, 5, J(el, v3(p, (0, -0.85, -0.04)))), "metal")
        r.add(f"pat_pole_{s}", el, C(f"basket{s}", 0.05, 0.05, 0.015, 6, J(el, v3(p, (0, -1.38, -0.04)))), "dark")
    return r


# ====================================================================== Vince (Character Evolution)
# The patroller rebuilt as a character rather than a stack of primitives: lofted, tapered forms (a
# structured parka with a yoke, a stand-up collar and a hood rolled behind it; insulated trousers with
# articulated knees; real boots with a heel, a toe cap and laces; gloves with gauntlets), a larger head
# with a readable face, Vince's own long curly hair as a model, a patrol helmet with goggles, and a
# rescue pack with a shovel and probe. Same skeleton, pivots and node names as the patroller above, so
# the game's gait, springs and toggles drive it unchanged. Colours the game never repaints are baked
# into the vertex colours and drawn with one material (Rig.keep): the figure is richer in colour and
# cheaper to draw than the one it replaces.
HS = 1.12  # the head (and everything on it) is 12 % larger, about the head joint: a friendlier,
#            more readable face at phone distance without changing the skeleton
P_TORSO = 2.6  # the parka's cross-section: a rounded rectangle, not a drum

# the parka's body, (y, half-width, half-depth, centre z): hip-length, a chest that tapers to the
# waist, square shoulders that roll into the collar
TORSO = [
    (0.835, 0.252, 0.200, 0.0), (0.87, 0.250, 0.198, 0.0), (0.95, 0.240, 0.188, 0.0), (1.05, 0.229, 0.179, 0.0),
    (1.15, 0.227, 0.177, 0.0), (1.27, 0.240, 0.186, -0.004), (1.38, 0.256, 0.196, -0.008), (1.48, 0.262, 0.198, -0.006),
    (1.56, 0.257, 0.190, -0.002), (1.63, 0.228, 0.172, 0.0), (1.68, 0.175, 0.145, 0.005), (1.715, 0.142, 0.128, 0.01),
]


def lerp(a, b, t):
    return a + (b - a) * t


def torso_at(y):
    """(half-width, half-depth, centre z) of the parka at height y."""
    if y <= TORSO[0][0]:
        return TORSO[0][1:]
    for a, b in zip(TORSO, TORSO[1:]):
        if a[0] <= y <= b[0]:
            t = (y - a[0]) / (b[0] - a[0])
            return tuple(lerp(a[k], b[k], t) for k in (1, 2, 3))
    return TORSO[-1][1:]


def surf_z(y, x=0.0, side=-1, p=P_TORSO):
    """z of the parka's surface at (x, y): front (side -1) or back (+1)."""
    rx, rz, cz = torso_at(y)
    q = max(0.0, 1 - abs(x / rx) ** p)
    return cz + side * rz * q ** (1 / p)


def loft(n, rings, sides=16, axis="Y", caps=(True, True)):
    """A smooth tube through cross-sections. rings: (t, a, b, ca, cb, p): at t along the axis, a
    superellipse of half-widths a and b centred on (ca, cb) with exponent p (2 an ellipse, 3 to 4 a
    rounded rectangle). Axis Y: (a, b) are (x, z); axis Z: (a, b) are (x, y)."""
    bm = bmesh.new()
    loops = []
    for t, a, b, ca, cb, p in rings:
        ring = []
        for i in range(sides):
            th = math.tau * (i + 0.5) / sides
            c, s_ = math.cos(th), math.sin(th)
            u = ca + a * math.copysign(abs(c) ** (2 / p), c)
            w = cb + b * math.copysign(abs(s_) ** (2 / p), s_)
            ring.append(bm.verts.new((u, t, w) if axis == "Y" else (u, w, t)))
        loops.append(ring)
    for ra, rb in zip(loops, loops[1:]):
        for i in range(sides):
            j = (i + 1) % sides
            bm.faces.new((ra[i], ra[j], rb[j], rb[i]))
    for ring, on, r in ((loops[0], caps[0], rings[0]), (loops[-1], caps[1], rings[-1])):
        if not on:
            continue
        t, a, b, ca, cb, p = r
        cv = bm.verts.new((ca, t, cb) if axis == "Y" else (ca, cb, t))
        for i in range(sides):
            bm.faces.new((ring[i], ring[(i + 1) % sides], cv))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(n)
    bm.to_mesh(me)
    bm.free()
    return K.link(bpy.data.objects.new(n, me))


def tube(n, at, rings, sides=14, p=2.0, caps=(True, True)):
    """A limb from a joint: rings (dy, rx, rz[, dz]) relative to the joint at `at`."""
    rr = []
    for r in rings:
        dy, rx, rz = r[0], r[1], r[2]
        dz = r[3] if len(r) > 3 else 0.0
        rr.append((at[1] + dy, rx, rz, at[0], at[2] + dz, p))
    return loft(n, rr, sides, "Y", caps)


def body_band(n, y0, y1, grow=0.0, steps=3, sides=20, p=P_TORSO):
    """A band of the parka between two heights, `grow` m proud of it (a yoke, a hem, a belt)."""
    rr = []
    for k in range(steps + 1):
        y = lerp(y0, y1, k / steps)
        rx, rz, cz = torso_at(y)
        rr.append((y, rx + grow, rz + grow, 0.0, cz, p))
    return loft(n, rr, sides, "Y")


def front_strip(n, y0, y1, w, d, x=0.0, side=-1, steps=6, lift=0.0):
    """A strip lying on the parka (a zip, a storm flap, a strap): it follows the surface down."""
    rr = []
    for k in range(steps + 1):
        y = lerp(y0, y1, k / steps)
        rr.append((y, w / 2, d / 2, x, surf_z(y, x, side) + side * (d / 2 - 0.004 + lift), 4))
    return loft(n, rr, 6, "Y")


def on_front(y, x, side=-1, out=0.0):
    """A point on the parka's surface (plus `out` m along the way it faces)."""
    return (x, y, surf_z(y, x, side) + side * out)


def head_parts(J):
    """Head-space helpers: positions and sizes in the head's own design space, scaled HS about the
    head joint (the figure's head is HS x the code-built one)."""
    hb = J("head", (0, 0, 0))
    hd = lambda p: (hb[0] + HS * p[0], hb[1] + HS * p[1], hb[2] + HS * p[2])  # noqa: E731
    return hb, hd


def vince():
    mats = K.Materials(pal, {
        # the roles the game repaints: the jacket and its trim, the hats, the goggles' lens, the skis, hair
        "jacket": "Patrol Red", "trim": "#2B2F38", "hatMain": "#2B2F38", "hatSecond": "#E0B042", "lens": "#F2A33A",
        "ski": "#C79A62", "hair": "#E6C27A",
        # everything else is baked: warm off-white, charcoal and muted black, small mustard and safety
        # orange accents
        "baked": "#FFFFFF",
        "pants": "#34363E", "pantsDark": "#2A2C33", "knee": "#41444D", "boot": "#5B3B2A", "bootDark": "#3B2820",
        "sole": "#25211F", "lace": "#E0B042", "glove": "#2E3036", "gloveCuff": "#24262B", "skin": "#F2C9A8",
        "eye": "#1E1B22", "white": "Cross White", "nose": "#E9A685", "cheek": "#EE9E8F", "mouth": "#8E3F4C",
        "brow": "#9A6A34", "freckle": "#D9926F", "fleece": "#EFE4D2", "scarf": "#5F9C86", "scarfDark": "#4F8774",
        "strap": "#2B2D33", "web": "#3B3E46", "buckle": "#E0B042", "pack": "#3E4149", "packDark": "#30333A",
        "red": "Patrol Red", "orange": "#E8742A", "metal": "Steel", "black": "#232329", "frame": "#28282E",
        "zip": "#1F2026", "reflect": "#C9CED6", "jacketDeep": "Patrol Red Deep",
    }, prefix="RS")
    r = Rig(mats, keep={"jacket", "trim", "hatMain", "hatSecond", "lens", "ski", "hair"})
    # ---- the skeleton: identical to the patroller's (the code's joints, at its pivots)
    r.bone("body", None, (0, 0, 0))
    r.bone("pelvis", "body", (0, LEG - 0.03, 0))
    for s, x in (("L", -0.11), ("R", 0.11)):
        r.bone(f"hip_{s}", "pelvis", (x, 0, 0))
        r.bone(f"knee_{s}", f"hip_{s}", (0, -THIGH, 0))
        r.bone(f"ankle_{s}", f"knee_{s}", (0, -SHIN, 0))
    r.bone("spine", "pelvis", (0, 0.12, 0))
    r.bone("chest", "spine", (0, 0.18, 0))
    r.bone("pack", "chest", (0, 0, 0))
    for s, x in (("L", -0.27), ("R", 0.27)):
        r.bone(f"shoulder_{s}", "chest", (x, 0.31, 0))
        r.bone(f"elbow_{s}", f"shoulder_{s}", (0, -0.29, 0))
    r.bone("neck", "chest", (0, 0.4, 0))
    r.bone("head", "neck", (0, 0.13, 0))
    # the eyes and pom-poms keep this model's own pivots (the code only blinks and swings them)
    EYE = (0.07, 0.118, -0.163)
    r.bone("eye_L", "head", (-EYE[0] * HS, EYE[1] * HS, EYE[2] * HS))
    r.bone("eye_R", "head", (EYE[0] * HS, EYE[1] * HS, EYE[2] * HS))
    r.bone("pom_beanie", "head", (0, 0.37 * HS, 0.01 * HS))
    r.bone("pom_bobble", "head", (0, 0.41 * HS, 0.01 * HS))
    tails = ((0, -0.03, 0.2), (1, 0.035, 0.17))
    for i, x, ln in tails:
        r.bone(f"scarf_a_{i}", "chest", (x, 0.46, 0.13))
        r.bone(f"scarf_b_{i}", f"scarf_a_{i}", (0, -ln, 0))
    J = r.at
    body = "pat_body"
    add = r.add

    # ================================================================ legs
    for s, sx in (("L", -1), ("R", 1)):
        hp, kn, an = J(f"hip_{s}", (0, 0, 0)), J(f"knee_{s}", (0, 0, 0)), J(f"ankle_{s}", (0, 0, 0))
        H_, K_, A_ = f"hip_{s}", f"knee_{s}", f"ankle_{s}"
        # insulated trousers: a full thigh that tapers to the knee
        add(body, H_, tube(f"thigh{s}", hp, [(0.07, 0.10, 0.11), (0.0, 0.114, 0.12), (-0.12, 0.112, 0.118), (-0.3, 0.103, 0.108),
                                             (-0.44, 0.096, 0.1), (-0.5, 0.092, 0.096)]), "pants")
        # a cargo pocket on the outside of the thigh, with its flap
        add(body, H_, loft(f"cargo{s}", [(hp[1] - 0.17, 0.02, 0.06, hp[0] + sx * 0.1, 0.005, 3), (hp[1] - 0.2, 0.03, 0.065, hp[0] + sx * 0.104, 0.005, 3),
                                         (hp[1] - 0.31, 0.028, 0.062, hp[0] + sx * 0.097, 0.005, 3), (hp[1] - 0.33, 0.018, 0.05, hp[0] + sx * 0.093, 0.005, 3)], 10), "pantsDark")
        add(body, H_, B(f"cargoFlap{s}", 0.03, 0.035, 0.13, (hp[0] + sx * 0.115, hp[1] - 0.19, 0.005)), "pants")
        # shin, an articulated knee panel, and the trouser cuff that bells over the boot
        add(body, K_, tube(f"shin{s}", kn, [(0.05, 0.096, 0.1), (-0.03, 0.098, 0.103), (-0.18, 0.093, 0.097), (-0.27, 0.092, 0.096)]), "pants")
        add(body, K_, tube(f"knee{s}", kn, [(0.035, 0.1, 0.105), (-0.035, 0.1, 0.105)], caps=(False, False)), "pantsDark")
        add(body, K_, tube(f"cuff{s}", kn, [(-0.25, 0.097, 0.1), (-0.29, 0.11, 0.113), (-0.315, 0.114, 0.117), (-0.325, 0.108, 0.111)], caps=(False, True)), "pantsDark")
        # the boot: a padded collar, a shaft, the foot with a heel and a toe cap, laces, a lugged sole
        add(body, K_, tube(f"shaft{s}", kn, [(-0.3, 0.098, 0.104), (-0.39, 0.098, 0.106), (-0.46, 0.102, 0.112)]), "boot")
        foot = [(0.09, 0.055, 0.04, 0.0, -0.03), (0.075, 0.068, 0.058, 0.0, -0.028), (0.02, 0.076, 0.068, 0.0, -0.03),
                (-0.06, 0.077, 0.066, 0.0, -0.036), (-0.14, 0.08, 0.055, 0.0, -0.045), (-0.2, 0.074, 0.046, 0.0, -0.05),
                (-0.235, 0.058, 0.034, 0.0, -0.056), (-0.252, 0.03, 0.018, 0.0, -0.06)]
        add(body, A_, loft(f"foot{s}", [(an[2] + z, w, h * 0.9, an[0] + cx, an[1] + cy + 0.006, 2.6) for z, w, h, cx, cy in foot], 14, "Z"), "boot")
        add(body, A_, loft(f"toecap{s}", [(an[2] - 0.12, 0.072, 0.045, an[0], an[1] - 0.052, 2.6), (an[2] - 0.18, 0.078, 0.05, an[0], an[1] - 0.052, 2.6),
                                          (an[2] - 0.228, 0.062, 0.038, an[0], an[1] - 0.058, 2.6), (an[2] - 0.256, 0.03, 0.02, an[0], an[1] - 0.064, 2.6)], 14, "Z"), "bootDark")
        add(body, A_, loft(f"sole{s}", [(an[2] + 0.1, 0.06, 0.02, an[0], an[1] - 0.071, 3.5), (an[2] + 0.07, 0.08, 0.021, an[0], an[1] - 0.071, 3.5),
                                        (an[2] - 0.15, 0.085, 0.021, an[0], an[1] - 0.071, 3.5), (an[2] - 0.235, 0.066, 0.021, an[0], an[1] - 0.07, 3.5),
                                        (an[2] - 0.262, 0.03, 0.016, an[0], an[1] - 0.068, 3.5)], 14, "Z"), "sole")
        for k in range(3):
            add(body, A_, B(f"lace{s}{k}", 0.075, 0.012, 0.014, (an[0], an[1] - 0.004 - k * 0.012, an[2] - 0.075 - k * 0.035), (-0.5, 0, 0)), "lace")
        add(body, K_, tube(f"bootCollar{s}", kn, [(-0.395, 0.106, 0.112), (-0.41, 0.108, 0.114)]), "bootDark")

    # ================================================================ the parka
    def band(part, bone, y0, y1, steps, role, grow=0.0):
        add(body, bone, body_band(part, y0, y1, grow, steps), role)
    # three overlapping lengths, one per joint, so the parka bends at the waist without a gap
    band("parkaHem", "pelvis", 0.835, 1.13, 4, "jacket")
    band("parkaWaist", "spine", 1.04, 1.32, 4, "jacket")
    band("parkaChest", "chest", 1.24, 1.715, 7, "jacket")
    # a charcoal hem band and the shoulder yoke in the jacket's second colour (both repaint with it)
    band("hemBand", "pelvis", 0.835, 0.868, 1, "trim", 0.006)
    band("yoke", "chest", 1.475, 1.715, 4, "trim", 0.005)
    # the seat of the trousers under the hem (seen when a leg lifts)
    add(body, "pelvis", tube("seat", J("pelvis", (0, 0, 0)), [(0.0, 0.2, 0.16), (-0.12, 0.21, 0.165), (-0.18, 0.17, 0.13)]), "pants")
    # the front: a zip under a storm flap, a chest pocket with the patrol cross, two hand-warmer pockets
    for part, bone, y0, y1 in (("Hem", "pelvis", 0.845, 1.1), ("Waist", "spine", 1.1, 1.28), ("Chest", "chest", 1.28, 1.7)):
        add(body, bone, front_strip(f"zip{part}", y0, y1, 0.016, 0.012), "zip")
        add(body, bone, front_strip(f"flap{part}", y0, y1, 0.04, 0.016, x=0.026), "jacket")
    pk = on_front(1.385, -0.115, out=0.006)
    add(body, "chest", loft("pocket", [(pk[1] - 0.06, 0.055, 0.012, pk[0], pk[2] + 0.004, 4), (pk[1] + 0.045, 0.058, 0.014, pk[0], pk[2] + 0.002, 4)], 8), "jacket")
    add(body, "chest", front_strip("pocketZip", 1.43, 1.436, 0.1, 0.01, x=-0.115, steps=1, lift=0.008), "zip")
    cx = on_front(1.385, -0.115, out=0.02)
    add(body, "chest", B("crossPatch", 0.07, 0.07, 0.01, cx, (0.08, 0.35, 0), bevel=0.006), "white")
    add(body, "chest", B("crossV", 0.018, 0.05, 0.012, v3(cx, (0.001, 0, -0.003)), (0.08, 0.35, 0)), "red")
    add(body, "chest", B("crossH", 0.05, 0.018, 0.012, v3(cx, (0.001, 0, -0.003)), (0.08, 0.35, 0)), "red")
    for sx in (-1, 1):
        hw = on_front(0.97, sx * 0.15, out=0.0)
        # a welt pocket: a zipped slit, angled for the hand
        add(body, "pelvis", B(f"handZip{sx}", 0.012, 0.12, 0.012, hw, (0.05, sx * 0.62, sx * 0.3)), "zip")
    # reflective piping across the chest, under the yoke, and the patrol's name tape on the back
    band("piping", "chest", 1.465, 1.477, 1, "reflect", 0.007)
    # collar: a high stand-up collar, a fleece lining showing at its rim, the hood rolled behind it
    nk = J("neck", (0, 0, 0))
    add(body, "chest", loft("collar", [(1.69, 0.148, 0.136, 0, 0.012, 2.3), (1.75, 0.142, 0.132, 0, 0.01, 2.3), (1.81, 0.136, 0.128, 0, 0.008, 2.3)], 18, caps=(False, False)), "jacket")
    add(body, "chest", loft("fleece", [(1.795, 0.128, 0.12, 0, 0.008, 2.3), (1.82, 0.13, 0.122, 0, 0.008, 2.3)], 18), "fleece")
    add(body, "chest", G("hood", 0.13, (0, 1.735, 0.135), 1, (1.2, 0.5, 0.65)), "jacket")
    add(body, "chest", G("hoodRoll", 0.1, (0, 1.705, 0.165), 1, (1.25, 0.4, 0.45)), "jacketDeep")
    add(body, "neck", C("neckC", 0.07, 0.075, 0.14, 8, (nk[0], nk[1] + 0.05, nk[2])), "skin")
    # the scarf: one knitted turn over the collar, its two tails hanging behind on their own joints
    add(body, "chest", loft("scarf", [(1.705, 0.168, 0.158, 0, 0.012, 2.2), (1.735, 0.175, 0.164, 0, 0.012, 2.2), (1.765, 0.166, 0.156, 0, 0.012, 2.2)], 18, caps=(False, False)), "scarf")
    add(body, "chest", loft("scarfIn", [(1.705, 0.15, 0.142, 0, 0.012, 2.2), (1.765, 0.15, 0.142, 0, 0.012, 2.2)], 18, caps=(False, False)), "scarfDark")
    for i, x, ln in tails:
        a, b = f"scarf_a_{i}", f"scarf_b_{i}"
        add(body, a, ribbon(f"tailA{i}", 0.04, 0.036, ln, J(a, (0, 0, 0))), "scarf")
        add(body, b, ribbon(f"tailB{i}", 0.036, 0.032, ln * 0.85, J(b, (0, 0, 0))), "scarf")
        add(body, b, ribbon(f"fringe{i}", 0.034, 0.042, 0.035, J(b, (0, 0, 0)), -ln * 0.85), "scarfDark")

    # ================================================================ arms and gloves
    for s, sx in (("L", -1), ("R", 1)):
        sh, el = J(f"shoulder_{s}", (0, 0, 0)), J(f"elbow_{s}", (0, 0, 0))
        S_, E_ = f"shoulder_{s}", f"elbow_{s}"
        # a rounded shoulder that the sleeve grows out of, a full upper sleeve, a tapered forearm
        add(body, S_, tube(f"upper{s}", sh, [(0.02, 0.07, 0.074), (0.0, 0.086, 0.09), (-0.1, 0.088, 0.09), (-0.22, 0.08, 0.082), (-0.31, 0.074, 0.076)]), "jacket")
        add(body, S_, tube(f"cap{s}", sh, [(0.075, 0.02, 0.02), (0.07, 0.052, 0.056), (0.05, 0.08, 0.085), (0.02, 0.093, 0.097), (-0.02, 0.094, 0.098),
                                         (-0.035, 0.091, 0.095)], caps=(False, True)), "trim")
        add(body, E_, tube(f"fore{s}", el, [(0.04, 0.074, 0.076), (-0.04, 0.076, 0.078), (-0.15, 0.071, 0.073), (-0.235, 0.066, 0.068)]), "jacket")
        add(body, E_, tube(f"cuff{s}", el, [(-0.215, 0.07, 0.072), (-0.255, 0.072, 0.074)]), "trim")
        add(body, E_, tube(f"reflect{s}", el, [(-0.17, 0.073, 0.075), (-0.185, 0.073, 0.075)], caps=(False, False)), "reflect")
        # gloves: a gauntlet flaring over the cuff, the hand, a mitt for the fingers, a thumb
        add(body, E_, tube(f"gauntlet{s}", el, [(-0.235, 0.074, 0.076), (-0.27, 0.082, 0.084), (-0.3, 0.078, 0.08)]), "gloveCuff")
        add(body, E_, tube(f"hand{s}", el, [(-0.29, 0.058, 0.048, -0.004), (-0.33, 0.063, 0.052, -0.008), (-0.38, 0.06, 0.05, -0.014),
                                          (-0.41, 0.05, 0.043, -0.018), (-0.428, 0.026, 0.026, -0.02)], p=2.4), "glove")
        add(body, E_, G(f"thumb{s}", 0.028, (el[0] - sx * 0.05, el[1] - 0.335, el[2] - 0.03), 0, (0.8, 1.45, 0.85), (0.35, 0, -sx * 0.35)), "glove")
        add(body, E_, B(f"knuckle{s}", 0.1, 0.012, 0.025, (el[0], el[1] - 0.355, el[2] - 0.055), (0, 0, 0)), "gloveCuff")
        if s == "L":
            # the patrol cross on the left sleeve, facing out
            add(body, S_, C("sleeveDisc", 0.044, 0.044, 0.012, 10, (sh[0] - 0.083, sh[1] - 0.11, sh[2]), (0, 0, math.pi / 2)), "white")
            add(body, S_, B("sleeveV", 0.014, 0.052, 0.016, (sh[0] - 0.09, sh[1] - 0.11, sh[2])), "red")
            add(body, S_, B("sleeveH", 0.014, 0.016, 0.052, (sh[0] - 0.09, sh[1] - 0.11, sh[2])), "red")

    # ================================================================ the head
    hb, hd = head_parts(J)
    Hz = lambda r: r * HS  # noqa: E731
    # a round face with fuller cheeks and a soft chin, ears tucked under the hair
    add(body, "head", G("face", Hz(0.185), hd((0, 0.13, 0)), 2, (0.97, 1.03, 1.0)), "skin")
    add(body, "head", G("cheeks", Hz(0.15), hd((0, 0.078, -0.03)), 2, (1.07, 0.78, 1.0)), "skin")
    for sx in (-1, 1):
        add(body, "head", S(f"ear{sx}", Hz(0.045), hd((sx * 0.18, 0.12, 0.01)), 8, (0.42, 1, 0.75)), "skin")
    add(body, "head", G("hairCap", Hz(0.19), hd((0, 0.168, 0.03)), 2, (1.0, 1.0, 1.0)), "hair")
    # eyes: big dark ovals with two catchlights and a lash line; each blinks about its own centre
    for s_, sx in (("L", -1), ("R", 1)):
        e = J(f"eye_{s_}", (0, 0, 0))
        add(body, f"eye_{s_}", G(f"eye{s_}", Hz(0.031), e, 1, (0.78, 1.22, 0.42)), "eye")
        add(body, f"eye_{s_}", G(f"glint{s_}", Hz(0.0095), v3(e, (Hz(sx * 0.008), Hz(0.012), -Hz(0.011))), 0), "white")
        add(body, f"eye_{s_}", G(f"glint2{s_}", Hz(0.005), v3(e, (-Hz(sx * 0.008), -Hz(0.011), -Hz(0.011))), 0), "white")
        add(body, f"eye_{s_}", B(f"lash{s_}", Hz(0.052), Hz(0.012), Hz(0.01), v3(e, (Hz(sx * 0.004), Hz(0.03), -Hz(0.008))), (0, 0, sx * -0.18), bevel=0.002), "eye")
        add(body, f"eye_{s_}", B(f"flick{s_}", Hz(0.018), Hz(0.009), Hz(0.009), v3(e, (Hz(sx * 0.028), Hz(0.036), -Hz(0.004))), (0, sx * 0.4, sx * -0.7)), "eye")
        # brows: a soft arch, lifted at the inner end (friendly, a little keen)
        add(body, "head", B(f"brow{s_}", Hz(0.056), Hz(0.014), Hz(0.012), hd((sx * 0.07, 0.172, -0.167)), (-0.3, sx * 0.32, sx * 0.13), bevel=0.003), "brow")
    add(body, "head", G("nose", Hz(0.027), hd((0, 0.094, -0.19)), 1, (1.12, 0.9, 1.0)), "nose")
    for sx in (-1, 1):
        add(body, "head", C(f"blush{sx}", Hz(0.028), Hz(0.028), Hz(0.006), 10, hd((sx * 0.104, 0.074, -0.15)), (math.pi / 2, 0, sx * 0.68), (1, 1, 0.75)), "cheek")
    for k, (fx, fy) in enumerate(((-0.07, 0.098), (-0.05, 0.108), (-0.088, 0.112), (0.07, 0.098), (0.05, 0.108), (0.088, 0.112))):
        fz = -math.sqrt(max(0.0, 0.181 ** 2 - fx * fx / 0.9 - (fy - 0.13) ** 2)) - 0.012
        add(body, "head", G(f"freckle{k}", Hz(0.0045), hd((fx, fy, fz + 0.006)), 0, (1, 1, 0.5)), "freckle")
    # the smile: an upturned crescent, open a touch at the middle
    arc = [(math.cos(a) * 0.04, math.sin(a) * 0.024) for a in (math.pi * (1.1 + 0.2 * i / 2) for i in range(9))]
    inner = [(x * 0.82, y * 0.5 + 0.003) for x, y in arc[::-1]]
    sm = P("smile", [(x * HS, y * HS) for x, y in arc + inner], Hz(0.012), hd((0, 0.062, -0.175)), (-0.42, 0, 0))
    add(body, "head", sm, "mouth")
    # goggles riding on the front of whatever is on the head: a strap round it, a curved frame, the lens
    add(body, "head", loft("gStrap", [(hd((0, 0.232, 0))[1], Hz(0.227), Hz(0.229), hb[0], hd((0, 0, 0.012))[2], 2.0),
                                      (hd((0, 0.252, 0))[1], Hz(0.228), Hz(0.23), hb[0], hd((0, 0, 0.012))[2], 2.0),
                                      (hd((0, 0.272, 0))[1], Hz(0.221), Hz(0.223), hb[0], hd((0, 0, 0.012))[2], 2.0)], 28, caps=(False, False)), "frame")
    gf = K.box("gFrameB", (Hz(0.27), Hz(0.09), Hz(0.04)), (0, 0, 0), None, bevel=0.0)
    K.deform(gf, lambda v: Vector((v.x, v.y, v.z + (v.x / Hz(0.27)) ** 2 * Hz(0.13))))
    add(body, "head", place(gf, hd((0, 0.255, -0.213)), (-0.12, 0, 0)), "frame")
    gl = K.box("gLensB", (Hz(0.236), Hz(0.062), Hz(0.03)), (0, 0, 0), None)
    K.deform(gl, lambda v: Vector((v.x, v.y, v.z + (v.x / Hz(0.27)) ** 2 * Hz(0.13))))
    add(body, "head", place(gl, hd((0, 0.255, -0.229)), (-0.12, 0, 0)), "lens")

    # Vince's long hair, a mesh of its own the game shows for him: a soft mass behind, curls round the nape
    # that rest on the collar, locks falling past the ears to frame the face
    hair = "pat_hair_long"
    add(hair, "head", G("hMass", Hz(0.17), hd((0, 0.1, 0.058)), 2, (1.06, 1.05, 0.88)), "hair")
    add(hair, "head", G("hMass2", Hz(0.15), hd((0, -0.0, 0.08)), 2, (1.12, 0.92, 0.74)), "hair")
    def lock(n, a, y0, length, r0, R0, curl=1.0, fwd=0.0):
        """A lock of hair hanging from the crown at angle `a` round the head (0 = straight back): it
        swells, waves a little sideways and turns out into a curl at its end."""
        out, tan = (math.sin(a), 0.0, math.cos(a)), (math.cos(a), 0.0, -math.sin(a))
        rr = []
        for k in range(7):
            f = k / 6
            rad = R0 + 0.018 * math.sin(math.pi * f) + curl * 0.035 * max(0.0, f - 0.6) ** 2 / 0.16
            wave = 0.012 * math.sin(math.tau * f * 1.2 + a * 3)
            rw = r0 * (0.8 + 0.45 * math.sin(math.pi * min(1.0, f * 1.15))) * (1 - 0.45 * f ** 3)
            c = hd((out[0] * rad + tan[0] * wave, y0 - length * f + curl * 0.02 * max(0.0, f - 0.75) / 0.25, out[2] * rad * 0.92 + 0.04 + fwd * f))
            rr.append((c[1], Hz(rw), Hz(rw * 0.85), c[0], c[2], 2.0))
        return loft(n, rr, 8, "Y")
    for i in range(9):
        a = -1.55 + 3.1 * i / 8
        ln = 0.27 - 0.07 * abs(a) / 1.55
        add(hair, "head", lock(f"lock{i}", a, 0.12, ln, 0.05, 0.15), "hair")
    for i in range(4):
        a = -1.1 + 2.2 * i / 3
        add(hair, "head", lock(f"under{i}", a, 0.05, 0.2, 0.045, 0.13, curl=1.3), "hair")
    # locks past the ears that frame the face
    for sx in (-1, 1):
        add(hair, "head", lock(f"side{sx}", sx * 1.95, 0.16, 0.2, 0.042, 0.158, curl=0.8, fwd=-0.01), "hair")
        add(hair, "head", lock(f"side2{sx}", sx * 1.75, 0.16, 0.23, 0.044, 0.16, curl=1.0), "hair")

    # ================================================================ hats (one shows at a time)
    def dome(n, R_, cy, sy, floor_fn, ribs=0, seg=20):
        o = K.sphere(n, R_, (0, 0, 0), None, segs=seg, rings=max(8, round(seg * 0.6)))

        def f(v):
            x, y, z = v.x, v.z, -v.y  # Blender sphere -> three.js (poles on y)
            if ribs:
                a = math.atan2(x, z)
                k = 1 + 0.018 * math.cos(ribs * a) * max(0.0, 1 - max(0.0, y / R_) ** 4)
                x, z = x * k, z * k
            y = max(y * sy, floor_fn(z))
            return Vector((x, y, z))
        K.deform(o, f)
        return place(o, hd((0, cy, 0.01)), (0, 0, 0), (HS, HS, HS))
    # the wool beanie: a ribbed crown, a folded cuff, the pom-pom
    add("pat_hat_beanie", "head", dome("bDome", 0.202, 0.205, 0.95, lambda z: -0.03, ribs=18), "hatMain")
    add("pat_hat_beanie", "head", loft("bCuff", [(hd((0, y, 0))[1], Hz(rx), Hz(rx), hb[0], hd((0, 0, 0.01))[2], 2.0)
                                                for y, rx in ((0.168, 0.21), (0.19, 0.218), (0.235, 0.214), (0.25, 0.205))], 24, caps=(False, False)), "hatSecond")
    pb = J("pom_beanie", (0, 0, 0))
    add("pat_hat_beanie", "pom_beanie", G("pom", Hz(0.056), v3(pb, (0, Hz(0.05), 0)), 1, (1, 0.95, 1)), "hatSecond")
    # the patrol helmet: a smooth shell low over the back and the ears, a red ridge, ear pads, vents,
    # the cross on each side
    add("pat_hat_helmet", "head", dome("hShell", 0.222, 0.195, 0.93, lambda z: lerp(-0.005, -0.13, max(0.0, min(1.0, (z + 0.1) / 0.3))), seg=22), "hatMain")
    HR, HC, HSY = 0.222, 0.195, 0.93

    def shell_y(x, z):
        """height of the helmet's shell (head space) above (x, z)"""
        q = HR * HR - x * x - (z - 0.01) ** 2
        return HC + HSY * math.sqrt(max(0.0, q))

    def on_shell(n, x, w, h, z0, z1, steps=8):
        rr = []
        for k in range(steps + 1):
            z = lerp(z0, z1, k / steps)
            c = hd((x, shell_y(x, z) + h * 0.3, z))
            rr.append((c[2], Hz(w / 2), Hz(h / 2), c[0], c[1], 4))
        return loft(n, rr, 8, "Z")
    add("pat_hat_helmet", "head", on_shell("hRidge", 0.0, 0.05, 0.022, -0.16, 0.19), "hatSecond")
    for k in (-1, 1):
        add("pat_hat_helmet", "head", on_shell(f"hVent{k}", k * 0.075, 0.018, 0.014, -0.06, 0.06, 4), "black")
    for sx in (-1, 1):
        add("pat_hat_helmet", "head", C(f"hCrossBg{sx}", Hz(0.042), Hz(0.042), Hz(0.012), 12, hd((sx * 0.216, 0.24, 0.07)), (0, 0, math.pi / 2)), "hatSecond")
        add("pat_hat_helmet", "head", B(f"hCrossV{sx}", Hz(0.012), Hz(0.052), Hz(0.015), hd((sx * 0.222, 0.24, 0.07))), "white")
        add("pat_hat_helmet", "head", B(f"hCrossH{sx}", Hz(0.012), Hz(0.015), Hz(0.052), hd((sx * 0.222, 0.24, 0.07))), "white")
    # the trapper: a fur-lined cap with a brim and ear flaps
    add("pat_hat_trapper", "head", dome("tCap", 0.204, 0.205, 0.9, lambda z: -0.04), "hatMain")
    add("pat_hat_trapper", "head", loft("tBrim", [(hd((0, y, 0))[1], Hz(rx), Hz(rx), hb[0], hd((0, 0, 0.01))[2], 2.0)
                                                for y, rx in ((0.16, 0.214), (0.18, 0.222), (0.235, 0.222), (0.25, 0.212))], 24, caps=(False, False)), "hatSecond")
    for sx in (-1, 1):
        add("pat_hat_trapper", "head", G(f"earflap{sx}", Hz(0.09), hd((sx * 0.19, 0.1, 0.015)), 1, (0.42, 1.05, 0.85)), "hatSecond")
    # the bobble hat: a tall crown, a band and a big pom-pom
    add("pat_hat_bobble", "head", dome("oDome", 0.2, 0.22, 1.14, lambda z: -0.06, ribs=14), "hatMain")
    add("pat_hat_bobble", "head", loft("oBand", [(hd((0, y, 0))[1], Hz(rx), Hz(rx), hb[0], hd((0, 0, 0.01))[2], 2.0)
                                                for y, rx in ((0.165, 0.21), (0.185, 0.216), (0.225, 0.213), (0.24, 0.205))], 24, caps=(False, False)), "hatSecond")
    po = J("pom_bobble", (0, 0, 0))
    add("pat_hat_bobble", "pom_bobble", G("bpom", Hz(0.088), v3(po, (0, Hz(0.068), 0)), 1), "hatSecond")

    # ================================================================ the patrol's gear
    gear = "pat_gear"
    pkb = J("pack", (0, 0, 0))
    # shoulder straps: padded, over the shoulders and down the front to a sternum strap and buckle
    for sx in (-1, 1):
        add(gear, "chest", front_strip(f"strap{sx}", 1.3, 1.64, 0.056, 0.018, x=sx * 0.125, lift=0.002), "strap")
        add(gear, "chest", B(f"over{sx}", 0.058, 0.024, 0.36, (sx * 0.128, 1.67, 0.015), (0, 0, -sx * 0.32), bevel=0.006), "strap")
        add(gear, "chest", B(f"strapEnd{sx}", 0.04, 0.05, 0.012, on_front(1.28, sx * 0.125, out=0.012), (0.06, 0, 0)), "buckle")
    add(gear, "chest", front_strip("sternum", 1.455, 1.475, 0.27, 0.014, lift=0.012, steps=1), "web")
    add(gear, "chest", B("sternumBuckle", 0.04, 0.03, 0.016, on_front(1.465, 0.0, out=0.03)), "buckle")
    # the radio on the right strap: a rubber body, the aerial, an orange channel knob
    rd = on_front(1.53, 0.125, out=0.04)
    add(gear, "chest", place(K.box("radio", (0.058, 0.1, 0.034), (0, 0, 0), None, bevel=0.008), rd, (0.08, 0, 0)), "black")
    add(gear, "chest", C("aerial", 0.007, 0.006, 0.11, 6, v3(rd, (0.016, 0.1, 0.004))), "black")
    add(gear, "chest", C("knob", 0.01, 0.01, 0.014, 8, v3(rd, (-0.014, 0.056, 0.004))), "orange")
    # the hip belt over the parka: webbing, a mustard buckle, the first-aid pouch and a tool pouch
    add(gear, "spine", body_band("belt", 1.045, 1.085, 0.012, 1), "web")
    add(gear, "spine", place(K.box("buckle", (0.06, 0.05, 0.018), (0, 0, 0), None, bevel=0.004), on_front(1.065, 0.0, out=0.02)), "buckle")
    fa = (0.226, 1.04, -0.05)
    add(gear, "spine", place(K.box("aidPouch", (0.07, 0.11, 0.12), (0, 0, 0), None, bevel=0.012), fa, (0, 0.25, 0)), "red")
    add(gear, "spine", B("aidV", 0.006, 0.05, 0.016, v3(fa, (0.037, 0.005, -0.008)), (0, 0.25, 0)), "white")
    add(gear, "spine", B("aidH", 0.006, 0.016, 0.05, v3(fa, (0.037, 0.005, -0.008)), (0, 0.25, 0)), "white")
    add(gear, "spine", place(K.box("toolPouch", (0.06, 0.09, 0.09), (0, 0, 0), None, bevel=0.01), (-0.228, 1.03, -0.03), (0, -0.25, 0)), "web")
    # the rescue pack: a structured body with a lid, side compression straps, a shovel grip and a probe
    # out of the top, the patrol cross on the back
    pz = 0.252
    add(gear, "pack", loft("packBody", [(1.14, 0.14, 0.045, 0, pz, 3.2), (1.17, 0.162, 0.06, 0, pz, 3.2), (1.4, 0.168, 0.066, 0, pz + 0.004, 3.2),
                                       (1.55, 0.16, 0.062, 0, pz, 3.2), (1.59, 0.135, 0.05, 0, pz - 0.004, 3.2)], 18), "pack")
    add(gear, "pack", loft("packLid", [(1.49, 0.168, 0.07, 0, pz + 0.006, 3.0), (1.59, 0.164, 0.068, 0, pz + 0.004, 3.0), (1.625, 0.135, 0.054, 0, pz, 3.0)], 18), "packDark")
    for sx in (-1, 1):
        add(gear, "pack", B(f"lidStrap{sx}", 0.03, 0.12, 0.01, (sx * 0.08, 1.46, pz + 0.072)), "web")
    add(gear, "pack", B("packPocket", 0.2, 0.12, 0.02, (0, 1.2, pz + 0.066), bevel=0.008), "packDark")
    add(gear, "pack", C("crossBg", 0.075, 0.075, 0.012, 14, (0, 1.34, pz + 0.07), (math.pi / 2, 0, 0)), "white")
    add(gear, "pack", B("pCrossV", 0.032, 0.1, 0.014, (0, 1.34, pz + 0.077)), "red")
    add(gear, "pack", B("pCrossH", 0.1, 0.032, 0.014, (0, 1.34, pz + 0.077)), "red")
    add(gear, "pack", C("shovel", 0.014, 0.014, 0.16, 8, (0.07, 1.68, pz + 0.01), (0, 0, -0.08)), "black")
    add(gear, "pack", place(K.box("shovelGrip", (0.075, 0.022, 0.026), (0, 0, 0), None, bevel=0.006), (0.077, 1.765, pz + 0.01), (0, 0, -0.08)), "orange")
    add(gear, "pack", C("probe", 0.009, 0.009, 0.12, 6, (-0.075, 1.67, pz + 0.02), (0, 0, 0.06)), "metal")
    add(gear, "pack", C("probeCap", 0.012, 0.012, 0.02, 6, (-0.079, 1.73, pz + 0.02), (0, 0, 0.06)), "orange")

    def ski_shape(n, length, w, t, tip=0.13, curl=0.07):
        """A ski along -z from its tail at z=0: waisted, the tip turned up (+y) over its last `tip` m."""
        rr = []
        for k in range(10):
            f = k / 9
            z = -length * f
            waist = 1 - 0.14 * math.sin(math.pi * f)
            lift = curl * max(0.0, (f * length - (length - tip)) / tip) ** 2
            ww = w * waist * (0.55 if k == 9 else 1)
            rr.append((z, ww / 2, t / 2, 0.0, lift, 4))
        return loft(n, rr, 8, "Z")
    # skis on the pack, carried diagonally: tails low at the left hip, tips up past the right shoulder
    for k, dz in enumerate((0.0, 0.03)):
        sk = ski_shape(f"bski{k}", 1.4, 0.075, 0.02, tip=0.16, curl=0.035)
        K.deform(sk, lambda v: Vector((v.x, -v.z, v.y)))  # along +y, the tip leaning back
        add("pat_skis_back", "pack", place(sk, (-0.55 + k * 0.03, 1.035 - k * 0.012, pz + 0.075 + dz), (0, 0, -0.98)), "ski")
    add("pat_skis_back", "pack", B("bstrap", 0.06, 0.03, 0.06, (0.02, 1.43, pz + 0.098)), "web")
    add("pat_skis_back", "pack", B("bstrap2", 0.06, 0.03, 0.06, (-0.18, 1.29, pz + 0.098)), "web")

    # skis on the boots, poles in the gloves
    for s in ("L", "R"):
        an, el = J(f"ankle_{s}", (0, 0, 0)), J(f"elbow_{s}", (0, 0, 0))
        g = v3(an, (0, -ANKLE - 0.01, -0.07))
        sk = ski_shape(f"ski{s}", 1.68, 0.088, 0.026, tip=0.2, curl=0.09)
        add(f"pat_ski_{s}", f"ankle_{s}", place(sk, v3(g, (0, 0, 0.73))), "ski")
        add(f"pat_ski_{s}", f"ankle_{s}", B(f"binding{s}", 0.09, 0.03, 0.3, v3(g, (0, 0.025, 0.02)), bevel=0.006), "black")
        add(f"pat_ski_{s}", f"ankle_{s}", B(f"toePiece{s}", 0.07, 0.035, 0.05, v3(g, (0, 0.035, -0.15)), bevel=0.006), "orange")
        p0 = v3(el, (0, -0.31, 0))
        add(f"pat_pole_{s}", f"elbow_{s}", C(f"grip{s}", 0.018, 0.016, 0.14, 8, v3(p0, (0, -0.03, -0.035))), "black")
        add(f"pat_pole_{s}", f"elbow_{s}", C(f"shaft{s}", 0.011, 0.009, 1.32, 6, v3(p0, (0, -0.76, -0.04))), "metal")
        add(f"pat_pole_{s}", f"elbow_{s}", C(f"basket{s}", 0.05, 0.05, 0.012, 10, v3(p0, (0, -1.36, -0.04))), "black")
        add(f"pat_pole_{s}", f"elbow_{s}", C(f"tip{s}", 0.008, 0.002, 0.05, 6, v3(p0, (0, -1.43, -0.04))), "metal")
    return r


# ====================================================================== Koda
def koda():
    mats = K.Materials(pal, {
        "grey": "#5F6873", "white": "#F4F2EE", "dark": "#3A4048", "noseBlack": "#15171A", "iris": "#8FD0F0",
        "pupil": "#101418", "earInner": "#E8B4A8", "tongue": "#E86A7A", "collar": "#D8382A", "tag": "#F2C230",
        "harnessMain": "#D8382A", "harnessSecond": "#F3EFE6", "bandana": "#D8382A", "glint": "Cross White",
    }, prefix="RS")
    r = Rig(mats)
    r.bone("body", None, (0, 0.5, 0))
    r.bone("front", "body", (0, 0, 0))
    r.bone("rear", "body", (0, 0, 0))
    r.bone("chest", "front", (0, 0, -0.33))
    legs = (("FL", -0.15, -0.34, True), ("FR", 0.15, -0.34, True), ("RL", -0.15, 0.38, False), ("RR", 0.15, 0.38, False))
    for n, x, z, front in legs:
        r.bone(f"leg_{n}_upper", "front" if front else "rear", (x, -0.04, z))
        r.bone(f"leg_{n}_lower", f"leg_{n}_upper", (0, -(0.23 if front else 0.24), 0))
    r.bone("head", "front", (0, 0.3, -0.5))
    r.bone("jaw", "head", (0, -0.11, -0.16))
    r.bone("tongue", "jaw", (0, 0.012, -0.08))
    r.bone("ear_L", "head", (-0.11, 0.16, 0.02))
    r.bone("ear_R", "head", (0.11, 0.16, 0.02))
    r.bone("tail_0", "rear", (0, 0.16, 0.5))
    for i in range(1, 4):
        r.bone(f"tail_{i}", f"tail_{i - 1}", (0, 0.1, 0))
    J = r.at
    body = "koda_body"
    # barrel: grey back over a white belly; chest (breathes) and ruff up front; haunches behind
    r.add(body, "body", G("back", 0.3, J("body", (0, 0.07, 0.02)), 1, (0.92, 0.8, 1.45)), "grey")
    r.add(body, "body", G("belly", 0.27, J("body", (0, -0.04, 0.02)), 1, (0.86, 0.74, 1.4)), "white")
    r.add(body, "chest", G("chestG", 0.25, J("chest", (0, 0, 0)), 1, (1, 1.05, 0.95)), "white")
    r.add(body, "front", G("ruff", 0.27, J("front", (0, 0.15, -0.3)), 1, (1.06, 0.88, 0.82)), "grey")
    r.add(body, "rear", G("haunch", 0.25, J("rear", (0, 0.06, 0.34)), 1, (1, 0.95, 1.05)), "grey")
    r.add(body, "rear", G("rump", 0.2, J("rear", (0, -0.05, 0.4)), 0), "white")
    # the white bib under the jaw: one soft mass, so the head sits into the body instead of on it
    r.add(body, "chest", G("bib", 0.19, J("chest", (0, 0.1, -0.12)), 1, (1.05, 1.0, 0.8)), "white")
    # legs: a six-sided segment from each joint (as the code's), a snowshoe paw
    # (budget: the code-built Koda draws ~1,320 triangles; this one stays under it)
    for n, x, z, front in legs:
        up, lo = f"leg_{n}_upper", f"leg_{n}_lower"
        ul = 0.23 if front else 0.24
        r.add(body, up, C(f"u{n}", 0.08 if front else 0.1, 0.06, ul + 0.04, 7, J(up, (0, -(ul + 0.04) / 2, 0))), "white" if front else "grey")
        if not front:
            r.add(body, up, G(f"thigh{n}", 0.11, J(up, (0, -0.06, 0.01)), 0, (0.8, 1.2, 1.1)), "grey")
        r.add(body, lo, C(f"l{n}", 0.058, 0.05, 0.22, 7, J(lo, (0, -0.11, 0))), "white")
        r.add(body, lo, G(f"paw{n}", 0.07, J(lo, (0, -0.225, -0.03)), 0, (1, 0.58, 1.35)), "white")
    # head: grey cap and mask, white face, the muzzle, a dark nose
    hd = lambda p: J("head", p)  # noqa: E731
    r.add(body, "head", G("skull", 0.2, hd((0, 0.04, 0)), 1, (1, 0.88, 1.05)), "grey")
    r.add(body, "head", G("face", 0.17, hd((0, -0.03, -0.08)), 1, (1.06, 0.85, 1)), "white")
    r.add(body, "head", G("muzzle", 0.11, hd((0, -0.06, -0.25)), 1, (0.92, 0.72, 1.45)), "white")
    # a rounded nose (the old one was a spiky ball)
    r.add(body, "head", S("nose", 0.04, hd((0, -0.012, -0.4)), 6, (1.15, 0.75, 0.85)), "noseBlack")
    # the husky's white brow spots above each eye, and tufts of white ruff at the cheeks
    for sx in (-1, 1):
        r.add(body, "head", G(f"browspot{sx}", 0.03, hd((sx * 0.075, 0.115, -0.168)), 0, (1.15, 0.65, 0.6), (0.3, 0, sx * -0.3)), "white")
        r.add(body, "head", G(f"cheek{sx}", 0.06, hd((sx * 0.15, -0.06, -0.05)), 1, (1.25, 0.8, 1.0), (0, 0, sx * -0.5)), "white")
    r.add(body, "head", G("mask", 0.07, hd((0, 0.06, -0.19)), 0, (0.75, 0.5, 2), (0.3, 0, 0)), "grey")
    r.add(body, "jaw", G("jawG", 0.08, J("jaw", (0, -0.01, -0.08)), 0, (0.95, 0.4, 1.4)), "white")
    # ears (the left flops: the code tips it over on its joint), with pink insides
    for s in ("L", "R"):
        e = f"ear_{s}"
        r.add(body, e, cone(f"ear{s}", 0.08, 0.19, 10, J(e, (0, 0.09, 0)), scale=(1, 1, 0.62)), "grey")
        r.add(body, e, cone(f"inner{s}", 0.05, 0.13, 10, J(e, (0, 0.078, -0.024)), scale=(1, 1, 0.45)), "earInner")
    # the tail: a plume of four links, grey to a white tip
    for i in range(4):
        t = f"tail_{i}"
        rr = 0.085 - i * 0.003
        r.add(body, t, G(f"tuft_{i}", rr, J(t, (0, 0.055, 0)), 0, (1, 1.4, 1)), "white" if i == 3 else "grey")
    # collar and tag (always on; the code paints the collar)
    r.add(body, "front", place(K.torus("collarT", 0.15, 0.03, (0, 0, 0), axis="Z", major=10, minor=4), J("front", (0, 0.18, -0.43)), (math.pi / 2 - 0.5, 0, 0)), "collar")
    r.add(body, "front", G("tag", 0.03, J("front", (0, 0.08, -0.55)), 0), "tag")
    # eyes open and shut (the code swaps them), and the tongue (shown when panting)
    for sx, s in ((-1, "L"), (1, "R")):
        # pale husky-blue almond eyes, tipped up at the outer corner, on the face's surface there
        # (where the skull and the white face meet, z ~ -0.19), the pupil set into the iris (it used
        # to float in front of it) and a catchlight
        r.add("koda_eyes_open", "head", G(f"iris{s}", 0.042, hd((sx * 0.085, 0.06, -0.183)), 0, (1, 0.8, 0.52), (0, 0, sx * 0.25)), "iris")
        r.add("koda_eyes_open", "head", G(f"pupil{s}", 0.021, hd((sx * 0.085, 0.058, -0.2)), 0, (1, 1.05, 0.4)), "pupil")
        r.add("koda_eyes_open", "head", B(f"glint{s}", 0.012, 0.012, 0.006, hd((sx * 0.085 - 0.009, 0.071, -0.209)), (0, 0, 0.6)), "glint")
        # asleep: a curved, closed eye (two strokes bowed downward)
        for k in (-1, 1):
            r.add("koda_eyes_shut", "head", B(f"lid{s}{k}", 0.042, 0.012, 0.02, hd((sx * 0.085 + k * 0.017, 0.055, -0.192)), (0, 0, k * 0.35)), "dark")
    tg = K.box("tongueB", (0.065, 0.015, 0.13), (0, 0, 0))
    K.deform(tg, lambda v: Vector((v.x, v.y, v.z - 0.065)))
    r.add("koda_tongue", "tongue", place(tg, J("tongue", (0, 0, 0))), "tongue")
    # harness and its saddlebags (gear the game turns on)
    r.add("koda_harness", "body", place(K.torus("strapT", 0.28, 0.035, (0, 0, 0), axis="Z", major=12, minor=4), J("body", (0, 0.04, -0.14))), "harnessMain")
    r.add("koda_harness", "body", B("saddle", 0.36, 0.06, 0.32, J("body", (0, 0.31, -0.05)), bevel=0.01), "harnessMain")
    r.add("koda_harness", "body", B("hx", 0.37, 0.065, 0.08, J("body", (0, 0.31, -0.05))), "harnessSecond")
    r.add("koda_harness", "body", B("hz", 0.08, 0.066, 0.2, J("body", (0, 0.31, -0.05))), "harnessSecond")
    for sx in (-1, 1):
        r.add("koda_harness_pack", "body", B(f"bag{sx}", 0.12, 0.2, 0.28, J("body", (sx * 0.29, 0.12, 0.02)), bevel=0.015), "harnessSecond")
    r.add("koda_bandana", "front", place(cone("band", 0.17, 0.2, 3, (0, 0, 0)), J("front", (0, 0.02, -0.5)), (math.pi + 0.4, 0, 0)), "bandana")
    return r


BUILD = {"rs_patroller": vince, "rs_villager": lambda: patroller(civilian=True), "rs_koda": koda}
rig = BUILD[asset]()
arm, objs = build(rig, asset)
bpy.ops.wm.save_as_mainfile(filepath=A["out"])
tris = {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs}
print(f"{asset}: {sum(tris.values())} tris {tris}, {len(rig.bones)} bones, saved {A['out']}")
