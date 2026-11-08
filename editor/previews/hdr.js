(function () {
  const radiancePattern = /#\?RADIANCE/;
  const commentPattern = /#.*/;
  const exposurePattern = /EXPOSURE=\s*([0-9]*[.][0-9]*)/;
  const formatPattern = /FORMAT=32-bit_rle_rgbe/;
  const widthHeightPattern = /-Y ([0-9]+) \+X ([0-9]+)/;

  function readPixelsRawRLE(buffer, data, offset, fileOffset, scanlineWidth, numScanlines) {
    var rgbe = new Array(4), scanlineBuffer = null, ptr, ptrEnd, count, buf = new Array(2), bufferLength = buffer.length;
    function readBuf(out) { var bytesRead = 0; do { out[bytesRead++] = buffer[fileOffset]; } while (++fileOffset < bufferLength && bytesRead < out.length); return bytesRead; }
    function readBufOffset(out, off, length) { var bytesRead = 0; do { out[off + bytesRead++] = buffer[fileOffset]; } while (++fileOffset < bufferLength && bytesRead < length); return bytesRead; }
    function readPixelsRaw(out, off, count) { var expected = 4 * count, got = readBufOffset(out, off, expected); if (got < expected) throw new Error('Error reading raw pixels: got ' + got + ' bytes, expected ' + expected); }
    while (numScanlines > 0) {
      if (readBuf(rgbe) < 4) throw new Error('Error reading bytes: expected 4');
      if ((rgbe[0] != 2) || (rgbe[1] != 2) || ((rgbe[2] & 0x80) != 0)) { data[offset++] = rgbe[0]; data[offset++] = rgbe[1]; data[offset++] = rgbe[2]; data[offset++] = rgbe[3]; readPixelsRaw(data, offset, scanlineWidth * numScanlines - 1); return; }
      if ((((rgbe[2] & 255) << 8) | (rgbe[3] & 255)) != scanlineWidth) throw new Error('Wrong scanline width');
      if (!scanlineBuffer) scanlineBuffer = new Array(4 * scanlineWidth);
      ptr = 0;
      for (var i = 0; i < 4; i++) {
        ptrEnd = (i + 1) * scanlineWidth;
        while (ptr < ptrEnd) {
          if (readBuf(buf) < 2) throw new Error('Error reading 2-byte buffer');
          if ((buf[0] & 255) > 128) {
            count = (buf[0] & 255) - 128;
            if (!count || count > ptrEnd - ptr) throw new Error('Bad scanline data');
            while (count-- > 0) scanlineBuffer[ptr++] = buf[1];
          } else {
            count = buf[0] & 255;
            if (!count || count > ptrEnd - ptr) throw new Error('Bad scanline data');
            scanlineBuffer[ptr++] = buf[1];
            if (--count > 0) { if (readBufOffset(scanlineBuffer, ptr, count) < count) throw new Error('Error reading non-run data'); ptr += count; }
          }
        }
      }
      for (var x = 0; x < scanlineWidth; x++) {
        data[offset++] = scanlineBuffer[x];
        data[offset++] = scanlineBuffer[x + scanlineWidth];
        data[offset++] = scanlineBuffer[x + 2 * scanlineWidth];
        data[offset++] = scanlineBuffer[x + 3 * scanlineWidth];
      }
      numScanlines--;
    }
  }
  function parseHdr(buffer) {
    if (buffer instanceof ArrayBuffer) buffer = new Uint8Array(buffer);
    var fileOffset = 0, bufferLength = buffer.length;
    function readLine() { var buf = ''; do { var b = buffer[fileOffset]; if (b === 10) { ++fileOffset; break; } buf += String.fromCharCode(b); } while (++fileOffset < bufferLength); return buf; }
    var width = 0, height = 0, exposure = 1, gamma = 1, rle = false;
    for (var i = 0; i < 20; i++) {
      var line = readLine(), match;
      if ((match = line.match(radiancePattern))) {}
      else if ((match = line.match(formatPattern))) rle = true;
      else if ((match = line.match(exposurePattern))) exposure = Number(match[1]);
      else if ((match = line.match(commentPattern))) {}
      else if ((match = line.match(widthHeightPattern))) { height = Number(match[1]); width = Number(match[2]); break; }
    }
    if (!rle) throw new Error('File is not run length encoded!');
    var data = new Uint8Array(width * height * 4);
    readPixelsRawRLE(buffer, data, 0, fileOffset, width, height);
    var floatData = new Float32Array(width * height * 4);
    for (var offset = 0; offset < data.length; offset += 4) {
      var r = data[offset] / 255, g = data[offset + 1] / 255, b = data[offset + 2] / 255, e = data[offset + 3], f = Math.pow(2, e - 128);
      floatData[offset] = r * f; floatData[offset + 1] = g * f; floatData[offset + 2] = b * f; floatData[offset + 3] = 1;
    }
    return { shape: [width, height], exposure, gamma, data: floatData };
  }
  async function toPNG(ctx) {
    const hdr = parseHdr(ctx.readBinary());
    const [width, height] = hdr.shape;
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      for (let c = 0; c < 3; c++) {
        let val = hdr.data[idx + c];
        val = val / (0.3 + val);
        val = Math.pow(val, 1 / 2.2);
        rgba[idx + c] = Math.max(0, Math.min(255, val * 255));
      }
      rgba[idx + 3] = 255;
    }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    canvas.getContext('2d').putImageData(new ImageData(rgba, width, height), 0, 0);
    return canvas.toDataURL('image/png');
  }

  function createPanorama(ctx) {
    const hdr = parseHdr(ctx.readBinary());
    const width = hdr.shape[0], height = hdr.shape[1];
    const canvas = document.createElement('canvas');
    canvas.className = 'editor-hdr-panorama-canvas';
    const shell = document.createElement('section');
    shell.className = 'editor-hdr-panorama';
    const toolbar = document.createElement('div');
    toolbar.className = 'editor-hdr-panorama-toolbar';
    const hint = document.createElement('span'); hint.textContent = 'Drag to look around · Scroll to zoom';
    const reset = document.createElement('button'); reset.type='button'; reset.textContent='Reset view';
    toolbar.append(hint,reset);
    const overlay=document.createElement('div');overlay.className='editor-hdr-panorama-overlay';overlay.textContent='Preparing panorama…';
    shell.append(canvas,overlay,toolbar);ctx.host.appendChild(shell);
    const gl=canvas.getContext('webgl2',{antialias:false,alpha:false})||canvas.getContext('webgl',{antialias:false,alpha:false});
    if(!gl){overlay.textContent='WebGL is unavailable in this browser.';return;}
    const is2=typeof WebGL2RenderingContext!=='undefined'&&gl instanceof WebGL2RenderingContext;
    const vertex=is2
      ? '#version 300 es\nin vec2 position;out vec2 vUv;void main(){vUv=position*.5+.5;gl_Position=vec4(position,0.,1.);}'
      : 'attribute vec2 position;varying vec2 vUv;void main(){vUv=position*.5+.5;gl_Position=vec4(position,0.,1.);}';
    const fragment2='#version 300 es\nprecision highp float;in vec2 vUv;out vec4 outColor;uniform sampler2D panorama;uniform vec2 resolution;uniform float yaw;uniform float pitch;uniform float fov;uniform float exposure;const float PI=3.141592653589793;void main(){vec2 p=vUv*2.-1.;float aspect=resolution.x/resolution.y;float z=1./tan(radians(fov)*.5);vec3 ray=normalize(vec3(p.x*aspect,-p.y,z));float cp=cos(pitch),sp=sin(pitch),cy=cos(yaw),sy=sin(yaw);vec3 yawRay=vec3(ray.x*cy+ray.z*sy,ray.y,-ray.x*sy+ray.z*cy);ray=vec3(yawRay.x,yawRay.y*cp-yawRay.z*sp,yawRay.y*sp+yawRay.z*cp);float u=atan(ray.x,ray.z)/(2.*PI)+.5;float v=acos(clamp(ray.y,-1.,1.))/PI;vec4 rgbe=texture(panorama,vec2(fract(u),clamp(v,0.,1.)));float e=rgbe.a*255.-128.;vec3 hdr=rgbe.rgb*exp2(e);vec3 mapped=1.-exp(-hdr*exposure);mapped=pow(max(mapped,vec3(0.)),vec3(1./2.2));outColor=vec4(mapped,1.);}';
    const fragment1='precision highp float;varying vec2 vUv;uniform sampler2D panorama;uniform vec2 resolution;uniform float yaw;uniform float pitch;uniform float fov;uniform float exposure;const float PI=3.141592653589793;void main(){vec2 p=vUv*2.-1.;float aspect=resolution.x/resolution.y;float z=1./tan(radians(fov)*.5);vec3 ray=normalize(vec3(p.x*aspect,-p.y,z));float cp=cos(pitch),sp=sin(pitch),cy=cos(yaw),sy=sin(yaw);vec3 yawRay=vec3(ray.x*cy+ray.z*sy,ray.y,-ray.x*sy+ray.z*cy);ray=vec3(yawRay.x,yawRay.y*cp-yawRay.z*sp,yawRay.y*sp+yawRay.z*cp);float u=atan(ray.x,ray.z)/(2.*PI)+.5;float v=acos(clamp(ray.y,-1.,1.))/PI;vec4 rgbe=texture2D(panorama,vec2(fract(u),clamp(v,0.,1.)));float e=rgbe.a*255.-128.;vec3 hdr=rgbe.rgb*exp2(e);vec3 mapped=1.-exp(-hdr*exposure);mapped=pow(max(mapped,vec3(0.)),vec3(1./2.2));gl_FragColor=vec4(mapped,1.);}';
    const fragment=is2?fragment2:fragment1;
    const compile=(type,source)=>{const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh)||'Shader compilation failed');return sh;};
    let program,texture,buffer,raf=0,disposed=false,yaw=0,pitch=0,fov=80,exposure=1,drag=null;
    try{
      program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'Shader link failed');
      gl.useProgram(program);
      buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
      const pos=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
      const rgbe=new Uint8Array(width*height*4);
      for(let i=0;i<width*height;i++){const p=i*4,r=hdr.data[p],g=hdr.data[p+1],b=hdr.data[p+2],max=Math.max(r,g,b);if(max<1e-32){rgbe[p]=rgbe[p+1]=rgbe[p+2]=rgbe[p+3]=0;continue;}const e=Math.ceil(Math.log2(max)),scale=256/Math.pow(2,e);rgbe[p]=Math.min(255,Math.round(r*scale));rgbe[p+1]=Math.min(255,Math.round(g*scale));rgbe[p+2]=Math.min(255,Math.round(b*scale));rgbe[p+3]=Math.max(0,Math.min(255,e+128));}
      texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,rgbe);
      const u={panorama:gl.getUniformLocation(program,'panorama'),resolution:gl.getUniformLocation(program,'resolution'),yaw:gl.getUniformLocation(program,'yaw'),pitch:gl.getUniformLocation(program,'pitch'),fov:gl.getUniformLocation(program,'fov'),exposure:gl.getUniformLocation(program,'exposure')};
      gl.uniform1i(u.panorama,0);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
      const resize=()=>{const r=shell.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.floor(r.width*d)),h=Math.max(1,Math.floor(r.height*d));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.viewport(0,0,w,h);};
      const draw=()=>{if(disposed)return;resize();gl.useProgram(program);gl.uniform2f(u.resolution,canvas.width,canvas.height);gl.uniform1f(u.yaw,yaw);gl.uniform1f(u.pitch,pitch);gl.uniform1f(u.fov,fov);gl.uniform1f(u.exposure,exposure);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);raf=requestAnimationFrame(draw);};
      const down=e=>{drag={x:e.clientX,y:e.clientY,yaw,pitch};canvas.setPointerCapture?.(e.pointerId);};
      const move=e=>{if(!drag)return;yaw=drag.yaw-(e.clientX-drag.x)*.004;pitch=Math.max(-Math.PI/2+.01,Math.min(Math.PI/2-.01,drag.pitch+(e.clientY-drag.y)*.004));};
      const up=()=>{drag=null;};const wheel=e=>{e.preventDefault();fov=Math.max(30,Math.min(110,fov+e.deltaY*.04));};
      canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('wheel',wheel,{passive:false});
      reset.addEventListener('click',()=>{yaw=0;pitch=0;fov=80;exposure=1;});
      overlay.remove();
      ctx.addCleanup(()=>{disposed=true;cancelAnimationFrame(raf);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);canvas.removeEventListener('wheel',wheel);gl.deleteTexture(texture);gl.deleteBuffer(buffer);gl.deleteProgram(program);});
      draw();
    }catch(error){overlay.textContent='Could not render panorama: '+error.message;}
  }

  window.EditorPreviewProviders = window.EditorPreviewProviders || [];
  window.EditorPreviewProviders.push({
    id: 'hdr',
    match(file) { return file.mime === 'image/vnd.radiance' || /\.hdr$/i.test(String(file.name || file.path || '')); },
    views: [{
      id: 'hdr-preview',
      label: 'Preview',
      default: true,
      priority: 120,
      async create(ctx) {
        const img = document.createElement('img');
        img.className = 'editor-image';
        img.src = await toPNG(ctx);
        ctx.host.appendChild(img);
      }
    }, {
      id: 'hdr-panorama', label: 'Panorama', default: false, priority: 115, create: createPanorama
    }]
  });
})();
