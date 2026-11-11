// Real model files: a small glTF 2.0 binary (.glb) loader with no other library, and the model library the game uses.
// It reads meshes (indexed or not, interleaved or not), PBR materials (base colour, normal, occlusion/roughness/metal
// "ORM" maps, emissive, alpha), node hierarchies, skins (skinned meshes with their bones) and animations.
// browserdev/assetbuild.py makes the files: models/<id>.glb (textures up to 1024 px) and models/<id>_lo.glb (a
// simplified mesh with 256 px textures), listed in models/manifest.json with each model's credit.
//   - props: model(id) gives a THREE.LOD (full model up close, the light one far away; phones only load the light one)
//   - guns: gunParts(root) finds the working parts by node name (slide, bolt, mag, trigger, charging handle, hammer,
//     selector, ejection port cover) so the game can move them; paintSkin textures go on the meshes named "body"
//   - characters: retarget(clip, root) renames the game's Mixamo clips onto a model whose bones carry Mixamo names
//     (with or without the "mixamorig:" prefix), so every existing animation plays on a new soldier unchanged
import * as THREE from '../sdk/three.module.min.js';
import { litPatch } from './world.js';

const COMP = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const NUM = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const WRAP = { 33071: THREE.ClampToEdgeWrapping, 33648: THREE.MirroredRepeatWrapping, 10497: THREE.RepeatWrapping };
const ATTR = { POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv', TEXCOORD_1: 'uv1', COLOR_0: 'color', JOINTS_0: 'skinIndex', WEIGHTS_0: 'skinWeight', TANGENT: 'tangent' };

export function parseGLB(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546C67 || dv.getUint32(4, true) !== 2) throw new Error('not a glTF 2.0 .glb');
  let off = 12, json = null, bin = null;
  while (off < buf.byteLength) {
    const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
    if (type === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, off + 8, len)));
    else if (type === 0x004E4942) bin = buf.slice(off + 8, off + 8 + len);
    off += 8 + len;
  }
  return { json, bin };
}

// build a scene from a parsed .glb. opts.lit: light it with the map's baked light like every other prop (default on)
export async function buildGLB({ json: J, bin }, opts = {}) {
  const views = J.bufferViews || [], accs = J.accessors || [];
  const accCache = new Map();
  function accessor(i) {
    if (accCache.has(i)) return accCache.get(i);
    const a = accs[i], T = COMP[a.componentType], n = NUM[a.type], v = views[a.bufferView];
    let attr;
    if (a.bufferView === undefined) attr = new THREE.BufferAttribute(new T(a.count * n), n, !!a.normalized);
    else {
      const stride = v.byteStride || 0, es = T.BYTES_PER_ELEMENT, off = (v.byteOffset || 0) + (a.byteOffset || 0);
      if (stride && stride !== es * n) {   // interleaved: share the whole view, read with a stride
        const ib = new THREE.InterleavedBuffer(new T(bin, v.byteOffset || 0, v.byteLength / es), stride / es);
        attr = new THREE.InterleavedBufferAttribute(ib, n, (a.byteOffset || 0) / es, !!a.normalized);
      } else attr = new THREE.BufferAttribute(off % es ? new T(bin.slice(off, off + a.count * n * es)) : new T(bin, off, a.count * n), n, !!a.normalized);
    }
    accCache.set(i, attr); return attr;
  }
  // textures: decoded off the main thread where the browser can
  const imgs = await Promise.all((J.images || []).map(async (im) => {
    const v = views[im.bufferView]; if (!v) return null;
    const blob = new Blob([new Uint8Array(bin, v.byteOffset || 0, v.byteLength)], { type: im.mimeType || 'image/jpeg' });
    try { return await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }); }
    catch (e) { return await new Promise((ok) => { const el = new Image(); el.onload = () => ok(el); el.onerror = () => ok(null); el.src = URL.createObjectURL(blob); }); }
  }));
  const texCache = new Map();
  const tex = (ref, srgb) => {
    if (!ref) return null; const k = ref.index + (srgb ? 's' : 'l');
    if (texCache.has(k)) return texCache.get(k);
    const td = J.textures[ref.index], im = imgs[td.source]; if (!im) return null;
    const t = new THREE.Texture(im); t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    const s = (J.samplers || [])[td.sampler] || {}; t.wrapS = WRAP[s.wrapS] || THREE.RepeatWrapping; t.wrapT = WRAP[s.wrapT] || THREE.RepeatWrapping;
    t.anisotropy = opts.anisotropy || 4; t.channel = ref.texCoord || 0; t.needsUpdate = true;
    texCache.set(k, t); return t;
  };
  const mats = (J.materials || []).map((m) => {
    const pb = m.pbrMetallicRoughness || {}, bc = pb.baseColorFactor || [1, 1, 1, 1];
    const mat = new THREE.MeshStandardMaterial({ name: m.name || '', color: new THREE.Color().setRGB(bc[0], bc[1], bc[2], THREE.LinearSRGBColorSpace),
      metalness: pb.metallicFactor ?? 1, roughness: pb.roughnessFactor ?? 1, side: m.doubleSided ? THREE.DoubleSide : THREE.FrontSide });
    mat.map = tex(pb.baseColorTexture, true);
    const orm = tex(pb.metallicRoughnessTexture, false); mat.roughnessMap = orm; mat.metalnessMap = orm;
    if (m.normalTexture) { mat.normalMap = tex(m.normalTexture, false); const s = m.normalTexture.scale ?? 1; mat.normalScale.set(s, -s); }
    if (m.occlusionTexture) { mat.aoMap = tex(m.occlusionTexture, false); mat.aoMapIntensity = m.occlusionTexture.strength ?? 1; }
    if (m.emissiveTexture || m.emissiveFactor) { mat.emissiveMap = tex(m.emissiveTexture, true); mat.emissive.setRGB(...(m.emissiveFactor || [1, 1, 1]), THREE.LinearSRGBColorSpace); }
    if (m.alphaMode === 'BLEND') { mat.transparent = true; mat.opacity = bc[3]; mat.depthWrite = false; } else if (m.alphaMode === 'MASK') mat.alphaTest = m.alphaCutoff ?? 0.5;
    if (opts.lit !== false) litPatch(mat, 'dyn');
    return mat;
  });
  const defMat = () => mats.def || (mats.def = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.8, metalness: 0 }));
  const isJoint = new Set(); for (const s of J.skins || []) for (const j of s.joints) isJoint.add(j);
  const geoCache = new Map();
  const nodes = (J.nodes || []).map((n, i) => {
    const o = isJoint.has(i) ? new THREE.Bone() : new THREE.Group();
    o.name = n.name || 'node_' + i;
    if (n.matrix) new THREE.Matrix4().fromArray(n.matrix).decompose(o.position, o.quaternion, o.scale);
    else { if (n.translation) o.position.fromArray(n.translation); if (n.rotation) o.quaternion.fromArray(n.rotation); if (n.scale) o.scale.fromArray(n.scale); }
    return o;
  });
  const skinned = [];
  (J.nodes || []).forEach((n, i) => {
    if (n.mesh === undefined) return;
    for (const [pi, pr] of J.meshes[n.mesh].primitives.entries()) {
      if ((pr.mode ?? 4) !== 4) continue;
      const gk = n.mesh + ':' + pi; let g = geoCache.get(gk);
      if (!g) {
        g = new THREE.BufferGeometry();
        for (const [k, ai] of Object.entries(pr.attributes)) if (ATTR[k]) g.setAttribute(ATTR[k], accessor(ai));
        if (pr.indices !== undefined) g.setIndex(accessor(pr.indices));
        if (!g.attributes.normal) g.computeVertexNormals();
        geoCache.set(gk, g);
      }
      const mat = pr.material !== undefined ? mats[pr.material] : defMat();
      if (g.attributes.color && !mat.vertexColors) mat.vertexColors = true;
      const sk = n.skin !== undefined && g.attributes.skinIndex;
      const mesh = sk ? new THREE.SkinnedMesh(g, mat) : new THREE.Mesh(g, mat);
      mesh.name = J.meshes[n.mesh].primitives.length > 1 ? nodes[i].name + '_' + pi : nodes[i].name;
      mesh.castShadow = mesh.receiveShadow = true;
      if (sk) { skinned.push([mesh, n.skin]); mesh.frustumCulled = false; }
      nodes[i].add(mesh);
    }
  });
  (J.nodes || []).forEach((n, i) => { for (const c of n.children || []) nodes[i].add(nodes[c]); });
  const scene = new THREE.Group(); scene.name = 'glb';
  const sc = (J.scenes || [])[J.scene || 0];
  for (const r of sc ? sc.nodes : nodes.map((_, i) => i).filter((i) => !nodes[i].parent)) scene.add(nodes[r]);
  scene.updateMatrixWorld(true);
  for (const [mesh, si] of skinned) {
    const s = J.skins[si], bones = s.joints.map((j) => nodes[j]);
    const ibm = s.inverseBindMatrices !== undefined ? accessor(s.inverseBindMatrices) : null;
    const inv = bones.map((_, k) => (ibm ? new THREE.Matrix4().fromArray(ibm.array, k * 16) : new THREE.Matrix4()));
    mesh.bind(new THREE.Skeleton(bones, inv), mesh.matrixWorld);
  }
  const animations = (J.animations || []).map((an, ai) => {
    const tracks = [];
    for (const ch of an.channels) {
      const sm = an.samplers[ch.sampler], node = nodes[ch.target.node]; if (!node || ch.target.path === 'weights') continue;
      const times = accessor(sm.input).array, raw = accessor(sm.output); let vals = Float32Array.from(raw.array);
      if (raw.normalized) { const d = raw.array instanceof Int16Array ? 32767 : raw.array instanceof Int8Array ? 127 : raw.array instanceof Uint16Array ? 65535 : 255; vals = vals.map((x) => Math.max(x / d, -1)); }
      const n = ch.target.path === 'rotation' ? 4 : 3;
      if (sm.interpolation === 'CUBICSPLINE') { const out = new Float32Array(times.length * n); for (let k = 0; k < times.length; k++) for (let c = 0; c < n; c++) out[k * n + c] = vals[k * n * 3 + n + c]; vals = out; }
      const T = ch.target.path === 'rotation' ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack;
      const tr = new T(node.name + '.' + { translation: 'position', rotation: 'quaternion', scale: 'scale' }[ch.target.path], Float32Array.from(times), vals);
      if (sm.interpolation === 'STEP') tr.setInterpolation(THREE.InterpolateDiscrete);
      tracks.push(tr);
    }
    return new THREE.AnimationClip(an.name || 'anim_' + ai, -1, tracks);
  });
  const byName = new Map(); scene.traverse((o) => { if (!byName.has(o.name)) byName.set(o.name, o); });
  return { scene, nodes: byName, animations, credit: (J.asset && J.asset.copyright) || '' };
}

export async function loadGLB(url, opts) {
  const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status);
  return buildGLB(parseGLB(await r.arrayBuffer()), opts);
}

// ---- the model library ----------------------------------------------------------------------------------------------
let manifest = null;
const loaded = new Map();
export function modelManifest() { return manifest || (manifest = fetch('models/manifest.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({}))); }
function file(id, tier) {
  const k = id + '|' + tier;
  if (!loaded.has(k)) loaded.set(k, modelManifest().then((m) => (m[id] ? loadGLB(m[id].files[tier] || m[id].files.hi) : null)).catch((e) => { console.warn('model', id, e.message); return null; }));
  return loaded.get(k);
}
// a placed copy of a model: an empty group at once, filled when the file arrives. hq: the full model up close and the
// light one beyond `far` metres; otherwise only the light one is ever downloaded
export function model(id, { hq = true, far = 14 } = {}) {
  const g = new THREE.Group(); g.name = 'model:' + id;
  Promise.all([hq ? file(id, 'hi') : null, file(id, 'lo')]).then(([hi, lo]) => {
    const pick = (x) => { if (!x) return null; const s = x.scene.clone(true); s.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return s; };
    const a = pick(hi), b = pick(lo);
    if (a && b) { const lod = new THREE.LOD(); lod.addLevel(a, 0); lod.addLevel(b, far); g.add(lod); } else if (a || b) g.add(a || b);
    g.userData.ready = true;
  });
  return g;
}

// ---- guns: the working parts, found by name -----------------------------------------------------------------------
const PART_NAMES = { slide: /slide/i, bolt: /bolt|carrier/i, mag: /mag(azine)?\b|mag_|clip/i, trigger: /trigger/i, charging: /charg/i, hammer: /hammer/i, selector: /selector|safety/i, cover: /port_?cover|dust_?cover/i, body: /^body|receiver/i };
export function gunParts(root) {
  const out = {};
  root.traverse((o) => { for (const [k, re] of Object.entries(PART_NAMES)) if (!out[k] && re.test(o.name)) { out[k] = o; o.userData.rest = o.position.clone(); } });
  return out;
}
// scale and turn a gun model so its barrel runs down -z and it is `length` metres long (the game's gun space)
export function fitGun(root, length) {
  const b = new THREE.Box3().setFromObject(root), s = new THREE.Vector3(); b.getSize(s);
  const axis = s.x >= s.y && s.x >= s.z ? 'x' : s.z >= s.y ? 'z' : 'y';
  if (axis === 'x') root.rotation.y = Math.PI / 2;
  root.scale.multiplyScalar(length / Math.max(s.x, s.y, s.z));
  return root;
}

// ---- characters: play the game's Mixamo clips on a model's skeleton by bone name ------------------------------------
const norm = (n) => n.replace(/^mixamorig[:_]?/i, '').replace(/^.*[:|]/, '').toLowerCase();
export function retarget(clip, root, { hipsScale = 1 } = {}) {
  const have = new Map(); root.traverse((o) => { if (o.isBone || o.type === 'Group') have.set(norm(o.name), o.name); });
  const tracks = [];
  for (const t of clip.tracks) {
    const [bone, prop] = [t.name.slice(0, t.name.lastIndexOf('.')), t.name.slice(t.name.lastIndexOf('.') + 1)];
    const to = have.get(norm(bone)); if (!to) continue;
    if (prop === 'position' && norm(bone) !== 'hips') continue;   // only the hips move; every other bone keeps the model's own lengths
    const c = t.clone(); c.name = to + '.' + prop;
    if (prop === 'position' && hipsScale !== 1) for (let i = 0; i < c.values.length; i++) c.values[i] *= hipsScale;
    tracks.push(c);
  }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}
