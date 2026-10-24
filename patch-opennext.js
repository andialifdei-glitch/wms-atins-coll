const fs = require("fs");
const path = require("path");
const handlerPath = path.join(process.cwd(), ".open-next", "server-functions", "default", "handler.mjs");

if (fs.existsSync(handlerPath)) {
  let code = fs.readFileSync(handlerPath, "utf8");
  let modified = false;

  // 1. Next.js manifest patches
  const errLoad = "throw new Error(`Unexpected loadManifest(${path2}) call!`)";
  const fixLoad = 'if(path2.endsWith("preview-props.json"))return{previewModeId:"98e350e0464f1be86645057be97e7349",previewModeSigningKey:"a1ad0b23486e6ef5681bd18603f797bf959e5e8a150d1376c1c7c735dc2a99ef",previewModeEncryptionKey:"fe319596e678a3d661e0319c84665a9c5bf693e52d6013b5bdc231c1a33a7eb0"};return{};';

  const errEval = "throw new Error(`Unexpected evalManifest(${path2}) call!`)";
  const fixEval = "return{__RSC_MANIFEST:{}};";

  if (code.includes(errLoad)) {
    code = code.replace(errLoad, fixLoad);
    modified = true;
  }
  if (code.includes(errEval)) {
    code = code.replace(errEval, fixEval);
    modified = true;
  }
  if (code.includes("2026-10-14")) {
    code = code.replaceAll("2026-10-14", "2026-10-13");
    modified = true;
  }

  // 2. Patch Protobuf Codegen (Valid JS Expression Closure)
  const targetCodegen = "Function.apply(null,h).apply(null,i)}return Function(b2)()";
  const validSafeCodegen = "(() => { try { return Function.apply(null,h).apply(null,i); } catch(e) { return function(){ return {}; }; } })()}return (() => { try { return Function(b2)(); } catch(e) { return function(){ return {}; }; } })()";

  if (code.includes(targetCodegen)) {
    code = code.replace(targetCodegen, validSafeCodegen);
    modified = true;
    console.log("✔ [OpenNext Patch] Protobuf codegen berhasil dinetralkan!");
  }

  if (modified) {
    fs.writeFileSync(handlerPath, code, "utf8");
    console.log("✔ [OpenNext Patch] handler.mjs berhasil disimpan.");
  }
}