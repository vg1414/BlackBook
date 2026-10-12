// Splash: en glödande guldorb där guldet virvlar som vätska. Den plattas sedan ut till bokens form,
// och boken (CSS-animation i style.css) tonar fram ur guldet. Ritas med WebGL för mjuk rörelse.
(function () {
  const splash = document.getElementById('splash-screen');
  const canvas = document.getElementById('splash-orb');
  const book = document.getElementById('splash-book');
  if (!splash || !canvas || !book) return;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const vert = `
    attribute vec2 a;
    void main() { gl_Position = vec4(a, 0.0, 1.0); }`;

  const frag = `
    precision highp float;
    uniform vec2  uRes;
    uniform float uDpr, uTime, uR, uMorph, uFill, uHeat, uFade, uGlow, uEnergy;
    uniform vec2  uHalf;

    float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
                 mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
      for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
      return v;
    }
    // Avstånd till en rundad rektangel – med hörnradie = halva storleken blir det en cirkel
    float sdBox(vec2 p, vec2 b, float r) {
      vec2 q = abs(p) - b + r;
      return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
    }
    // Färgskala: nästan svart bläck → brons → guld → blekt guld
    vec3 ramp(float v) {
      vec3 c0 = vec3(0.05, 0.04, 0.02), c1 = vec3(0.29, 0.20, 0.06),
           c2 = vec3(0.72, 0.53, 0.16), c3 = vec3(0.91, 0.77, 0.35), c4 = vec3(1.0, 0.95, 0.78);
      v = clamp(v, 0.0, 1.0);
      if (v < 0.30) return mix(c0, c1, v / 0.30);
      if (v < 0.60) return mix(c1, c2, (v - 0.30) / 0.30);
      if (v < 0.85) return mix(c2, c3, (v - 0.60) / 0.25);
      return mix(c3, c4, (v - 0.85) / 0.15);
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uDpr;     // pixlar från mitten
      float R = uR * (1.0 + 0.018 * sin(uTime * 1.4));     // orben "andas"
      vec2 hs = mix(vec2(R), uHalf, uMorph);               // cirkel → bokens rektangel
      float rad = mix(R, 16.0, uMorph);
      float sd = sdBox(uv, hs, min(rad, min(hs.x, hs.y)));

      float a = smoothstep(1.2, -1.2, sd) * (1.0 - uFade);

      // Låtsas-3D: bula ut mönstret mot mitten så det ser ut som en kula
      float edge = max(min(hs.x, hs.y), 1.0);
      float inner = clamp(-sd / edge, 0.0, 1.0);
      float z = sqrt(1.0 - (1.0 - inner) * (1.0 - inner));
      vec2 q = uv / edge;
      vec2 p = q / (z + 0.55) * 1.1;

      // Domain warping: brus som förskjuter brus ger de flytande virvlarna
      float t = uTime * (0.16 + 0.5 * uEnergy);
      vec2 w1 = vec2(fbm(p * 1.3 + vec2(0.0, t)), fbm(p * 1.3 + vec2(5.2, 1.3) - t));
      vec2 w2 = vec2(fbm(p * 1.7 + 3.0 * w1 + vec2(1.7, 9.2) + 0.7 * t),
                     fbm(p * 1.7 + 3.0 * w1 + vec2(8.3, 2.8) - 0.5 * t));
      float f = fbm(p * 1.1 + 3.5 * w2 + 0.3 * t);
      float v = pow(smoothstep(0.22, 0.72, f), 1.1);

      // Guldet sprider sig inifrån som bläck i vatten
      float reveal = smoothstep(0.0, 0.35, uFill * 1.5 - length(uv) / max(R, 1.0) * 0.9 + (f - 0.5) * 0.8);
      reveal = mix(reveal, 1.0, step(0.999, uFill));
      v *= reveal;
      v = mix(v, 0.62 + 0.38 * v, uHeat);                  // glöder upp innan boken bildas

      vec3 col = ramp(v);
      col *= 0.55 + 0.45 * z;                              // mörkare mot kanten
      col += vec3(1.0, 0.82, 0.4) * pow(1.0 - z, 2.5) * 0.55;  // gyllene kantljus
      float spec = smoothstep(0.45, 0.0, length(uv / max(R, 1.0) - vec2(-0.35, 0.42))) * (1.0 - uMorph) * 0.22;
      col += vec3(1.0, 0.9, 0.65) * spec;                  // glasreflex

      // Mjukt sken runt formen, färgat av virvlarna
      float glow = exp(-max(sd, 0.0) / (22.0 + 18.0 * uEnergy)) * uGlow * (0.85 + 0.15 * sin(uTime * 1.4));
      vec3 gcol = mix(vec3(0.55, 0.40, 0.12), vec3(0.95, 0.78, 0.35), v * 0.6 + 0.2);
      // Tona ut skenet mot canvasens kanter så ingen fyrkant syns
      vec2 e = min(gl_FragCoord.xy, uRes - gl_FragCoord.xy) / uDpr;
      float ga = glow * 0.55 * smoothstep(0.0, 70.0, min(e.x, e.y));

      gl_FragColor = vec4(col * a + gcol * ga * (1.0 - a), a + ga * (1.0 - a));
    }`;

  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false });
  if (!gl) {
    // Ingen WebGL: hoppa över orben och visa boken direkt
    splash.classList.add('no-orb');
    return;
  }

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vert));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    splash.classList.add('no-orb');
    return;
  }
  gl.useProgram(prog);

  // En triangel som täcker hela canvasen – shadern räknar ut varje pixel
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  ['uRes', 'uDpr', 'uTime', 'uR', 'uMorph', 'uFill', 'uHeat', 'uFade', 'uGlow', 'uEnergy', 'uHalf']
    .forEach(n => U[n] = gl.getUniformLocation(prog, n));

  let dpr = 1, bookW = 280, bookH = 149;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    bookW = book.offsetWidth || 280;
    bookH = bookW * (579 / 1089);   // blackbook.png:s proportioner
  }
  addEventListener('resize', resize);
  resize();

  const clamp01 = x => Math.min(1, Math.max(0, x));
  const seg = (t, a, b) => clamp01((t - a) / (b - a));
  const easeOutBack = x => { const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const easeOutCubic = x => 1 - Math.pow(1 - x, 3);
  const easeInOut = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

  // Tempot läses från CSS-variabeln --splash-k så orben och CSS-animationerna alltid följs åt
  const K = parseFloat(getComputedStyle(splash).getPropertyValue('--splash-k')) || 1;

  function frame(now) {
    // Splashen är borttagen – sluta rita och släpp minnet
    if (!canvas.isConnected) {
      removeEventListener('resize', resize);
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      return;
    }
    // Klockan räknas från sidladdning, precis som CSS-animationerna
    const t = reduceMotion ? 99999 : now / K;

    const R     = bookW * 0.34 * easeOutBack(seg(t, 100, 900));
    const fill  = easeOutCubic(seg(t, 150, 1000));
    const morph = easeInOut(seg(t, 1050, 1650));
    const heat  = easeInOut(seg(t, 1150, 1650));
    const fade  = easeInOut(seg(t, 1500, 2050));
    const swirl = 0.8 * Math.sin(Math.PI * seg(t, 700, 1900));
    const glow  = (0.9 - 0.4 * fade) * seg(t, 0, 500);

    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uDpr, dpr);
    gl.uniform1f(U.uTime, reduceMotion ? 0 : now / 1000);
    gl.uniform1f(U.uR, R);
    gl.uniform1f(U.uMorph, morph);
    gl.uniform1f(U.uFill, fill);
    gl.uniform1f(U.uHeat, heat);
    gl.uniform1f(U.uFade, fade);
    gl.uniform1f(U.uGlow, glow);
    gl.uniform1f(U.uEnergy, swirl);
    gl.uniform2f(U.uHalf, bookW * 0.46, bookH * 0.42);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (!reduceMotion) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
