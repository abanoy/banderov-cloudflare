// Frontend-only adapter for the preserved Godot export's oversized engine file.
// Only the engine request is reconstructed; ordinary game assets use native fetch.
window.hopAssetFetch = async function (file) {
  const target = new URL(file, document.baseURI);
  const engine = new URL('index.wasm', document.baseURI);
  if (target.href !== engine.href) return fetch(file);
  const parts = [{name:'index.wasm.part-1.bin',bytes:20971520},{name:'index.wasm.part-2.bin',bytes:18543234}];
  const buffers = []; let received = 0;
  // Resolve the response only after a complete download. The archived engine's
  // stream tracker does not propagate mid-stream errors to its launch promise.
        for (const part of parts) {
          const response = await fetch(new URL(part.name, engine));
          if (!response.ok || !response.body) throw new Error('Engine download failed: ' + response.status);
          const reader = response.body.getReader(); let count = 0;
          try { for (;;) {
            const {done,value} = await reader.read(); if (done) break;
            count += value.byteLength;
            if (count > part.bytes) throw new Error('Engine download has an unexpected size');
            buffers.push(value); received += value.byteLength;
            const fill = document.getElementById('fill');
            if (fill) fill.style.width = Math.max(parseFloat(fill.style.width) || 0, Math.floor(received / 41506382 * 100)) + '%';
          } } finally { reader.releaseLock(); }
          if (count !== part.bytes) throw new Error('Engine download was incomplete. Reload to retry.');
        }
  return new Response(new Blob(buffers).stream(), {headers:{'Content-Type':'application/wasm','Content-Length':'39514754'}});
};
