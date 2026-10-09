// Offline extraction only; the deployed planner does not load a Spine runtime.
const fs = require("node:fs");
const spine = require("@pixi-spine/runtime-3.8");
require("@pixi-spine/base").settings.yDown = false;
const jobs = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const result = [];
for (const job of jobs) {
  try {
    const regions = new Map(job.regions.map((r) => [r.name, r]));
    const loader = new spine.AtlasAttachmentLoader({
      findRegion: (name) => regions.get(name) || regions.get(name.trim()),
    });
    const bytes = fs.readFileSync(job.skeleton);
    const reader =
      bytes[0] === 123
        ? new spine.SkeletonJson(loader)
        : new spine.SkeletonBinary(loader);
    const data = reader.readSkeletonData(
      bytes[0] === 123 ? JSON.parse(bytes.toString()) : new Uint8Array(bytes),
    );
    const skeleton = new spine.Skeleton(data);
    if (job.skin && data.findSkin(job.skin)) skeleton.setSkinByName(job.skin);
    else if (!data.defaultSkin && data.skins.length)
      skeleton.setSkin(data.skins[0]);
    skeleton.setSlotsToSetupPose();
    for (const slot of skeleton.slots) {
      const attachment = slot.getAttachment();
      if (attachment instanceof spine.RegionAttachment) {
        attachment.setRegion(attachment.region);
        attachment.updateOffset();
      }
    }
    const idle = data.animations.find((a) =>
      /^(idle|animation)$/i.test(a.name),
    );
    if (idle) idle.apply(skeleton, 0, 0, true, [], 1, 0, 0);
    skeleton.updateWorldTransform();
    const layers = [];
    for (const slot of skeleton.drawOrder) {
      const a = slot.getAttachment();
      if (!a || !a.region || slot.color.a * a.color.a < 0.001) continue;
      let vertices, triangles, uvs;
      if (a instanceof spine.RegionAttachment) {
        vertices = new Float32Array(8);
        a.computeWorldVertices(slot.bone, vertices, 0, 2);
        triangles = [0, 1, 2, 0, 2, 3];
        uvs = [...a.uvs];
      } else if (a instanceof spine.MeshAttachment) {
        vertices = new Float32Array(a.worldVerticesLength);
        a.computeWorldVertices(slot, 0, a.worldVerticesLength, vertices, 0, 2);
        triangles = a.triangles;
        const r = a.region;
        uvs = [];
        for (let i = 0; i < a.regionUVs.length; i += 2) {
          const u = a.regionUVs[i],
            v = a.regionUVs[i + 1];
          uvs.push(
            r.rotate ? r.u + v * (r.u2 - r.u) : r.u + u * (r.u2 - r.u),
            r.rotate ? r.v2 - u * (r.v2 - r.v) : r.v + v * (r.v2 - r.v),
          );
        }
      } else continue;
      layers.push({
        texture: a.region.page,
        vertices: [...vertices],
        triangles: [...triangles],
        uvs,
        alpha: slot.color.a * a.color.a,
        color: [
          slot.color.r * a.color.r,
          slot.color.g * a.color.g,
          slot.color.b * a.color.b,
        ],
      });
    }
    result.push({ id: job.id, layers });
  } catch (error) {
    result.push({ id: job.id, error: error.message });
  }
}
fs.writeFileSync(process.argv[3], JSON.stringify(result));
