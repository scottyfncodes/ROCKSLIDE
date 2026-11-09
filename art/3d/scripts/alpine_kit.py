"""SNOW PATROL: the Alpine kit, Art Direction A ("Stylized Alpine 3D").

Shared, reusable pieces for the patrol's buildings, vehicles and yards, loaded by the MeshCraft scripts
(valley_buildings.py, patrol_models.py) with:

    exec(open(os.path.join(os.path.dirname(A["palette"]), "3d", "scripts", "alpine_kit.py")).read())
    AK = AlpineKit(K, paint=lambda o, role: K.assign(o, M(role)))

Everything is in three.js space (metres, +Y up), like the scripts that use it, and every piece is painted
by palette *role* (never a raw colour), so the game re-dresses it with its own materials and grade() and
the lit-glass role ("window") glows at dusk on every building alike.

The conventions (docs/art-direction-a/CONVENTIONS.md has the full list):
  * Snow is a soft mass, never a slab: a blanket that bulges, rolls over the eaves in a bull-nose and
    rounds off at the gables, with a crest roll on the ridge and uneven icicles under the eave.
  * Buildings stand on a fieldstone socle: irregular coursed stones in two tones over a mortar bed.
  * Working detail tells you people live here: a woodpile, skis against the wall, a lamp, the sign.
  * Low poly, high read: stones are 12-triangle blocks, icicles 5-sided cones, logs 7-sided; budgets are
    held by tests/models.test.ts. No textures, no normal maps: shape and role colour only.
  * Deterministic: every random piece takes a seed, so a rebuild gives the same file.
"""
import math
import random

import bmesh
import bpy
from mathutils import Vector


class AlpineKit:
    def __init__(self, K, paint):
        self.K = K
        self.paint = paint

    # ------------------------------------------------------------------ primitives
    def _place(self, o, pos=(0, 0, 0), rot=(0, 0, 0), role=None):
        o.rotation_mode = "ZYX"  # Blender ZYX == three.js 'XYZ'
        o.location = pos
        o.rotation_euler = rot
        if role:
            self.paint(o, role)
        return o

    def box(self, role, w, h, d, pos=(0, 0, 0), rot=(0, 0, 0), taper=0.0):
        o = self.K.box("ak", (w, h, d), (0, 0, 0), None)
        if taper:
            self.K.deform(o, lambda v: Vector((v.x * (1 - taper if v.y > 0 else 1), v.y, v.z * (1 - taper if v.y > 0 else 1))))
        return self._place(o, pos, rot, role)

    def cyl(self, role, rt, rb, h, seg, pos=(0, 0, 0), rot=(0, 0, 0)):
        return self._place(self.K.cylinder("ak", rt, h, (0, 0, 0), axis="Y", verts=seg, r2=rb), pos, rot, role)

    def cone(self, role, r, h, seg, pos=(0, 0, 0), rot=(0, 0, 0)):
        """A cone pointing DOWN (an icicle): base at pos, tip h below it."""
        bm = bmesh.new()
        ring = [bm.verts.new((math.cos(a) * r, 0, math.sin(a) * r)) for a in (math.tau * i / seg for i in range(seg))]
        tip = bm.verts.new((0, -h, 0))
        bm.faces.new(ring[::-1])
        for i in range(seg):
            bm.faces.new((ring[i], ring[(i + 1) % seg], tip))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        me = bpy.data.meshes.new("icicle")
        bm.to_mesh(me)
        bm.free()
        return self._place(self.K.link(bpy.data.objects.new("icicle", me)), pos, rot, role)

    def _mesh(self, name, verts, faces, pos=(0, 0, 0), rot=(0, 0, 0), role=None):
        bm = bmesh.new()
        vs = [bm.verts.new(v) for v in verts]
        for f in faces:
            bm.faces.new([vs[i] for i in f])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        return self._place(self.K.link(bpy.data.objects.new(name, me)), pos, rot, role)

    def stone(self, role, w, h, d, pos, rot=(0, 0, 0), taper=0.1):
        """A wall stone, 8 triangles: its face, top and two ends. No back (it lies on the mortar) and no
        bottom (it sits on the course below); the top edge is drawn in a little so it reads as dressed."""
        x, y, z, t = w / 2, h / 2, d, taper
        v = [(-x, -y, 0), (x, -y, 0), (x - t * w, y, 0), (-x + t * w, y, 0),           # back (on the wall)
             (-x, -y, z), (x, -y, z), (x - t * w, y - t * h, z), (-x + t * w, y - t * h, z)]  # face
        return self._mesh("stone", v, [(4, 5, 6, 7), (7, 6, 2, 3), (0, 4, 7, 3), (5, 1, 2, 6)], pos, rot, role)

    def log_end(self, log, grain, r, depth, pos, along_x=True, seg=6, face=1):
        """A split log seen end-on: an open six-sided tube (12 triangles) and its sawn face (4)."""
        ring = [(math.cos(a) * r, math.sin(a) * r) for a in (math.tau * (i + 0.5) / seg for i in range(seg))]
        if along_x:   # the log runs along z (out of a wall that runs along x)
            P = lambda c, w: (c[0], c[1], w)  # noqa: E731
        else:
            P = lambda c, w: (w, c[1], c[0])  # noqa: E731
        v = [P(c, 0) for c in ring] + [P(c, depth) for c in ring]
        tube = self._mesh("log", v, [(i, (i + 1) % seg, seg + (i + 1) % seg, seg + i) for i in range(seg)], pos, (0, 0, 0), log)
        cap = self._mesh("grain", [P(c, depth if face > 0 else 0) for c in ring], [tuple(range(seg))], pos, (0, 0, 0), grain)
        return [tube, cap]

    def blob(self, role, r, pos, scale=(1, 1, 1), rot=(0, 0, 0), seed=0, wobble=0.12, sub=1):
        """A soft lump (a snow pillow, a drift, a stone): a wobbly icosphere."""
        o = self.K.ico("ak", r, (0, 0, 0), None, sub=sub, scale=scale, seed=seed, wobble=wobble)
        return self._place(o, pos, rot, role)

    # ------------------------------------------------------------------ snow
    @staticmethod
    def _lumps(u, v, seed):
        """Low-frequency, deterministic lumpiness in -1..1 (no noise library inside Blender's sandbox)."""
        r = random.Random(seed)
        a, b, c, d = (r.uniform(0, math.tau) for _ in range(4))
        return 0.5 * math.sin(u * 5.1 + a) * math.sin(v * 3.3 + b) + 0.5 * math.sin(u * 2.3 + v * 7.9 + c) * math.cos(v * 1.7 + d)

    def snow_slope(self, span, L, H, side, role="roofSnow", depth=0.3, board=0.11, overhang=0.32, seed=0, nu=7, step=0.9):
        """The snow on one plane of a pitched roof (ridge along z at x = 0, y = H; eave at x = side * span,
        y = 0): a closed soft mass, thickest across the middle, rolled over the eave in a bull-nose that
        hangs `overhang` past it, rounded off at both gable ends. `board` is the roof's half thickness (the
        snow lies on its top face)."""
        a = math.atan2(H, span)
        slope = math.hypot(span, H)
        n = Vector((side * math.sin(a), math.cos(a), 0))   # the roof's outward normal
        t = Vector((side * math.cos(a), -math.sin(a), 0))  # down the slope, ridge to eave
        o0 = Vector((0, H, 0)) + n * board
        U = slope + overhang                               # along the slope, ridge to the end of the lip
        hl = L / 2 + 0.28                                  # the load overhangs the gables a little too
        nv = max(4, round(L / step))
        bm = bmesh.new()
        top = []
        for j in range(nv + 1):
            v = j / nv
            z = -hl + 2 * hl * v
            ez = min(1.0, (hl - abs(z)) / 0.6)             # rounding off at the gable ends
            row = []
            for i in range(nu + 1):
                u = i / nu * U
                k = 1.0
                if u > slope - 0.25:                        # the bull-nose over the eave
                    q = (u - (slope - 0.25)) / (overhang + 0.25)
                    k = math.sqrt(max(0.0, 1 - q * q))
                k *= math.sqrt(max(0.0, ez * (2 - ez)))
                th = depth * k * (1 + 0.3 * self._lumps(u / U, v, seed))
                if i == 0:
                    th = depth * math.sqrt(max(0.0, ez * (2 - ez)))  # an even crest under the ridge roll
                # past the eave the load sags: the lip curls down over the fascia
                sag = Vector((0, -0.55 * max(0.0, u - slope) ** 1.5 / max(overhang, 0.01) ** 0.5, 0))
                p = o0 + t * u + n * th + sag
                if i == nu or j in (0, nv):
                    p = o0 + t * u + sag                    # the edge lies on the roof plane: closed
                row.append(bm.verts.new((p.x, p.y, z)))
            top.append(row)
        # winding set by hand (outward = up the roof normal): (b - a) x (d - a) is t x z, which points
        # down the normal on the +x side and up it on the -x side
        for j in range(nv):
            for i in range(nu):
                f = (top[j][i], top[j][i + 1], top[j + 1][i + 1], top[j + 1][i])
                bm.faces.new(f[::-1] if side > 0 else f)
        # the underside: one face on the roof plane along the boundary, facing into the roof
        loop = [top[0][i] for i in range(nu + 1)] + [top[j][nu] for j in range(1, nv + 1)] + \
               [top[nv][i] for i in range(nu - 1, -1, -1)] + [top[j][0] for j in range(nv - 1, 0, -1)]
        under = bm.faces.new(loop)
        under.normal_update()
        if under.normal.dot(n) > 0:
            under.normal_flip()
        me = bpy.data.meshes.new("snowSlope")
        bm.to_mesh(me)
        bm.free()
        o = self.K.link(bpy.data.objects.new("snowSlope", me))
        self.paint(o, role)
        return o

    def snow_roof(self, W, L, H, roof="roof", snow="roofSnow", depth=0.48, overhang=0.42, seed=0, icicles=True, icicle_role="ice"):
        """A pitched roof under a real snow load: the two roof planes (span W across x, length L along z,
        pitch H, ridge along z; origin at eave level, centred), a soft snow blanket on each that rolls over
        the eaves, a crest roll on the ridge, fascia boards, and icicles along both eaves.
        Drop-in for valley_buildings.snow_roof()."""
        parts = []
        half = W / 2
        slope = math.hypot(half, H)
        a = math.atan2(H, half)
        for s in (-1, 1):
            parts.append(self.box(roof, slope, 0.22, L, (s * half / 2, H / 2, 0), (0, 0, -s * a)))
            parts.append(self.snow_slope(half, L, H, s, role=snow, depth=depth, overhang=overhang, seed=seed * 7 + (s > 0)))
            # the fascia: a deep board along the eave, under the snow's lip
            parts.append(self.box(roof, 0.08, 0.3, L, (s * (half + 0.02), -0.06, 0)))
            if icicles:
                parts += self.icicles(L - 0.6, (s * (half + 0.06), -0.12, 0), along_x=False, role=icicle_role, seed=seed * 13 + (s > 0))
        # the crest roll along the ridge: a soft, uneven bolster
        nseg = max(2, round(L / 3.0))
        for k in range(nseg):
            z = -L / 2 + (k + 0.5) * L / nseg
            parts.append(self.blob(snow, 0.5, (0, H + 0.42, z), (0.75, 0.5, L / nseg + 0.3), seed=seed + k, wobble=0.06))
        return parts

    def snow_shed(self, span, L, H, roof="roof", snow="roofSnow", depth=0.36, overhang=0.32, seed=0, icicles=True, icicle_role="ice"):
        """A lean-to: one roof plane falling toward +x (high edge at x = 0, y = H; eave at x = span, y = 0),
        under snow, with icicles at the eave. Origin at the eave height, at the high edge."""
        slope = math.hypot(span, H)
        a = math.atan2(H, span)
        parts = [self.box(roof, slope, 0.16, L, (span / 2, H / 2, 0), (0, 0, -a)),
                 self.snow_slope(span, L, H, 1, role=snow, depth=depth, board=0.08, overhang=overhang, seed=seed, nu=5)]
        if icicles:
            parts += self.icicles(L - 0.4, (span + 0.05, -0.12, 0), along_x=False, role=icicle_role, seed=seed + 5, max_len=0.45)
        return parts

    def icicles(self, length, pos, along_x=True, role="ice", seed=0, every=0.32, max_len=0.6):
        """A run of uneven icicles hanging from a line (centred on pos, along x or z): clusters with gaps,
        long ones near the middle of each cluster. 5-sided cones."""
        r = random.Random(seed)
        out = []
        n = max(1, int(length / every))
        for i in range(n):
            u = -length / 2 + (i + 0.5) * length / n + r.uniform(-0.08, 0.08)
            cluster = 0.5 + 0.5 * math.sin(u * 1.7 + seed)
            if r.random() > 0.35 + 0.55 * cluster:
                continue
            h = max_len * (0.2 + 0.8 * cluster * r.random())
            rad = 0.025 + 0.03 * h / max_len
            p = (pos[0] + u, pos[1], pos[2]) if along_x else (pos[0], pos[1], pos[2] + u)
            out.append(self.cone(role, rad, h, 5, p))
        return out

    def drift(self, w, h, d, pos, rot=(0, 0, 0), role="roofSnow", seed=0):
        """A wind drift banked against a wall: a soft, low mound (closed underneath)."""
        o = self.K.mound("drift", w, h, d, (0, 0, 0), None, segs=12, rings=3)
        # K.mound is Blender Z-up: turn it into y-up, then add some lumpiness
        self.K.deform(o, lambda v: Vector((v.x, v.z * (1 + 0.15 * self._lumps(v.x / w, v.y / d, seed)), -v.y)))
        return self._place(o, pos, rot, role)

    # ------------------------------------------------------------------ stone
    def fieldstone(self, length, height, pos, along_x=True, face=1, roles=("stone", "stoneDark", "stoneLight"), mortar="mortar",
                   seed=0, course=0.3, skip=()):
        """A fieldstone socle: a mortar bed with irregular coursed stones proud of it, in three tones.
        Centred on pos (the wall's outer face, foot at pos.y), running along x (or z), facing +face.
        skip: [(u0, u1)] spans to leave open (a door). Each stone is a 12-triangle block with a softened
        top (taper), set at a slight random tilt, so the band reads as stone at 40 m and at 4 m."""
        r = random.Random(seed)
        out = []
        dz = 0.07
        spans = [(-length / 2, length / 2)]
        for u0, u1 in skip:
            nxt = []
            for a, b in spans:
                if u1 <= a or u0 >= b:
                    nxt.append((a, b))
                    continue
                if u0 > a:
                    nxt.append((a, u0))
                if u1 < b:
                    nxt.append((u1, b))
            spans = nxt

        def at(u, y, n):
            return (pos[0] + u, pos[1] + y, pos[2] + n * face) if along_x else (pos[0] + n * face, pos[1] + y, pos[2] + u)

        def bx(role, a, h, n, u, y, dn, rot=0.0):
            if along_x:
                return self.box(role, a, h, n, at(u, y, dn), (0, 0, rot))
            return self.box(role, n, h, a, at(u, y, dn), (rot, 0, 0))

        def st(role, a, h, n, u, y, rot):
            # the stone's back lies on the mortar's face, its face toward +face
            yaw = (0 if face > 0 else math.pi) if along_x else (math.pi / 2 if face > 0 else -math.pi / 2)
            return self.stone(role, a, h, n, at(u, y, dz), (0, yaw, rot))

        rows = max(1, round(height / course))
        ch = height / rows
        for a, b in spans:
            out.append(bx(mortar, b - a, height, dz, (a + b) / 2, height / 2, dz / 2))
            for k in range(rows):
                u = a + r.uniform(0, 0.15) * (k % 2)
                while u < b - 0.12:
                    w = min(r.uniform(0.42, 0.8), b - u)
                    h = ch * r.uniform(0.8, 0.95)
                    role = roles[r.choice((0, 0, 1, 2))]
                    out.append(st(role, w - 0.05, h, 0.07 + r.uniform(0, 0.05), u + w / 2, k * ch + ch / 2, r.uniform(-0.05, 0.05)))
                    u += w
            # a cap: a dressed coping stone along the top
            out.append(bx(roles[1], b - a, 0.08, 0.2, (a + b) / 2, height + 0.04, dz + 0.04))
        return out

    # ------------------------------------------------------------------ working detail
    def patrol_sign(self, pos, along_x=True, face=1, size=0.9, frame="timber", board="red", cross="white"):
        """The patrol's enamel plaque: a red board with the cream cross in a timber frame, on a wall
        facing +face along x (or z)."""
        t = 0.05

        def bx(role, a, h, d, dn):
            p = (pos[0], pos[1], pos[2] + dn * face) if along_x else (pos[0] + dn * face, pos[1], pos[2])
            return self.box(role, a, h, d, p) if along_x else self.box(role, d, h, a, p)
        s = size
        return [bx(frame, s + 0.12, s + 0.12, t, t / 2), bx(board, s, s, t, t + 0.01),
                bx(cross, s * 0.2, s * 0.62, t, t + 0.03), bx(cross, s * 0.62, s * 0.2, t, t + 0.03)]

    def woodpile(self, length, height, pos, along_x=True, face=1, depth=0.55, seed=0, log="log", grain="grain", snow="roofSnow"):
        """Split firewood stacked against a wall: rows of 7-sided log ends between two end posts, a board
        on top and a little snow on it. Centred on pos (foot), standing out from the wall by `depth`."""
        r = random.Random(seed)
        out = []
        rad = 0.1

        def at(u, y, n):
            return (pos[0] + u, pos[1] + y, pos[2] + n * face) if along_x else (pos[0] + n * face, pos[1] + y, pos[2] + u)
        rows = max(1, int(height / (rad * 1.8)))
        per = max(1, int(length / (rad * 2.05)))
        for k in range(rows):
            for i in range(per - (k % 2)):
                u = -length / 2 + rad + (k % 2) * rad + i * rad * 2.05
                y = rad + k * rad * 1.78
                rr = rad * r.uniform(0.82, 1.0)
                p0 = at(u, y, 0)
                if face < 0:  # build outward from the wall either way
                    p0 = at(u, y, depth)
                out += self.log_end(log, grain, rr, depth, p0, along_x, face=face)
        top = rows * rad * 1.78 + 0.04
        for e in (-1, 1):
            p = at(e * (length / 2 + 0.05), (top + 0.1) / 2, depth / 2)
            out.append(self.box("timber", 0.08, top + 0.1, depth, p) if along_x else self.box("timber", depth, top + 0.1, 0.08, p))
        p = at(0, top + 0.08, depth / 2)
        out.append(self.box("timber", length + 0.3, 0.05, depth + 0.15, p) if along_x else self.box("timber", depth + 0.15, 0.05, length + 0.3, p))
        out.append(self.blob(snow, 0.5, at(0, top + 0.15, depth / 2), (length / 1.0 + 0.2, 0.14, depth + 0.1) if along_x else (depth + 0.1, 0.14, length + 0.2), seed=seed))
        return out

    def skis_against_wall(self, pos, along_x=True, face=1, pairs=2, seed=0, colors=("red", "ski", "white")):
        """Pairs of skis and a pair of poles leaning on a wall, tips up (6 to 8 boxes a pair)."""
        r = random.Random(seed)
        out = []
        lean = 0.17
        for p in range(pairs):
            role = colors[p % len(colors)]
            for k in (0, 1):
                u = p * 0.3 + k * 0.1 + r.uniform(-0.02, 0.02)
                h = 1.7
                y = h / 2 * math.cos(lean)
                n = 0.1 + h / 2 * math.sin(lean)
                q = (pos[0] + u, pos[1] + y, pos[2] + n * face) if along_x else (pos[0] + n * face, pos[1] + y, pos[2] + u)
                rot = (-lean * face, 0, 0) if along_x else (0, 0, lean * face)
                out.append(self.box(role, 0.08, h, 0.025, q, rot) if along_x else self.box(role, 0.025, h, 0.08, q, rot))
                # the tip, curled toward the wall
                tq = (q[0], pos[1] + h * math.cos(lean) + 0.04, q[2] - (0.05 * face if along_x else 0)) if along_x else \
                     (q[0] - 0.05 * face, pos[1] + h * math.cos(lean) + 0.04, q[2])
                out.append(self.box(role, 0.08, 0.14, 0.025, tq, rot) if along_x else self.box(role, 0.025, 0.14, 0.08, tq, rot))
                # the binding
                bq = (q[0], pos[1] + 0.75, q[2] + 0.05 * face) if along_x else (q[0] + 0.05 * face, pos[1] + 0.75, q[2])
                out.append(self.box("iron", 0.09, 0.12, 0.05, bq, rot) if along_x else self.box("iron", 0.05, 0.12, 0.09, bq, rot))
        # the poles
        for k in (0, 1):
            u = pairs * 0.3 + 0.08 + k * 0.07
            h = 1.35
            q = (pos[0] + u, pos[1] + h / 2, pos[2] + (0.08 + h / 2 * 0.1) * face) if along_x else (pos[0] + (0.08 + h / 2 * 0.1) * face, pos[1] + h / 2, pos[2] + u)
            out.append(self.cyl("iron", 0.012, 0.012, h, 5, q, (-0.1 * face, 0, 0) if along_x else (0, 0, 0.1 * face)))
        return out

    def wall_lamp(self, pos, along_x=True, face=1, glow="window", iron="iron"):
        """A gooseneck lamp on a wall: a bracket, a dark shade and a lit bulb (the lit-glass role, so it
        glows at dusk with the windows)."""
        def at(dn, dy):
            return (pos[0], pos[1] + dy, pos[2] + dn * face) if along_x else (pos[0] + dn * face, pos[1] + dy, pos[2])
        arm = self.box(iron, 0.04, 0.04, 0.42, at(0.21, 0.12)) if along_x else self.box(iron, 0.42, 0.04, 0.04, at(0.21, 0.12))
        return [self.box(iron, 0.14, 0.2, 0.04, at(0.02, 0)) if along_x else self.box(iron, 0.04, 0.2, 0.14, at(0.02, 0)), arm,
                self.cyl(iron, 0.05, 0.2, 0.14, 8, at(0.42, 0.05)),
                self.cyl(glow, 0.15, 0.15, 0.03, 8, at(0.42, -0.03))]
