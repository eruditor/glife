// GET PARAMS ////////////////////////////////////////////////////////////////

const urlParams = new URLSearchParams(window.location.search);
paused = urlParams.get('paused') ? 1 : 0;
debug = urlParams.get('debug') ? 1 : 0;
maxfps = intval(urlParams.get('maxfps'));
FW = 1200;  if(urlParams.get('FW')>0) FW = intval(urlParams.get('FW'));
FH = 600;   if(urlParams.get('FH')>0) FH = intval(urlParams.get('FH'));
if(debug) {
  FW = 8;  FH = 5;
}

// GET SCRIPT SELF ADDRESS
var scripts = document.getElementsByTagName('script');
var myScript = scripts[scripts.length - 1];
const selfParams = new URLSearchParams(myScript.src);

// GLSL SHADERS ////////////////////////////////////////////////////////////////

var VertexShaderSource = `
  #version 300 es
  precision mediump float;
  
  uniform vec2 u_resolution;  // Field width and height
  
  in vec2 a_position;  // this attribute will receive data from a buffer of vertice coords
  in vec2 a_texcoord;  // this attribute will receive data from a buffer of texture coords
  
  out vec2 v_texcoord;  // texture coord to pass to fragment shader (linearly interpolated)
  
  void main() {
    vec2 zeroToOne = a_position / u_resolution;  // convert the position from pixels to 0.0 to 1.0
    vec2 clipSpace = zeroToOne * 2.0 - 1.0;      // convert from 0->1 to -1->+1 (clip space)
    //vec2 flipY = clipSpace * vec2(1, -1);        // flip Y axes direction
    
    gl_Position = vec4(clipSpace, 0, 1);  // gl_Position is a special variable a vertex shader is responsible for setting
    
    v_texcoord = a_texcoord;  // pass the texCoord to the fragment shader; the GPU will interpolate this value between points
  }
`;

function Bit4Gene(v, i) {//i += 10;
  //return (v << i) >>> 0;
  if(v==0) return 0;
  var numerator = round(15*v);
  var ret = 0;
  for(var n=3; n>=0; n--) {  // store 8 of 4bit-float [0/15, .. , 15/15] to Uint32 (accuracy loss here, due to JS Uint32->Float conversion)
    var bitOf15 = (numerator >> n) & 1;
    ret |= (bitOf15 << (i + 8*n)) >>> 0;  // main bits are on the left, 8 gene numbers are interleaving: A0B0C0D0E0F0G0H0A1B1C1D1E1F1G1H1...
  }
  return ret;
}

function Gene4Bit(x, i) {//i += 10;
  //return (x >>> i) & 1;
  if(x==0) return 0;
  var numerator = 0;
  for(var n=3; n>=0; n--) {
    numerator += ((x >>> (i + 8*n)) & 1) * (2 ** n);
  }
  return numerator / 15.;
}

function Color4Bits(bits) {
  /*
  var red = bits.iborn;
  var green = bits.isurv;
  var blue = 255 - red - green;  if(blue<0) blue = 0;
  return {'r':red, 'g':blue, 'b':green};  // swapping blue and green as in ShowFragment
  */
  var born=[], surv=[];
  for(var i=0; i<8; i++) {
    born[i] = Gene4Bit(bits.iborn, i);
    surv[i] = Gene4Bit(bits.isurv, i);
  }
  console.log(born);
  var ret = {'r':0, 'g':0, 'b':0};
  ret.r = (born[2] + born[3] + born[7]) / 2. + (surv[0] + surv[3]) / 3.;
  ret.g = (born[4] + born[6]) / 2. + (surv[1] + surv[5] + surv[7]) / 3.;
  ret.b = (born[5] + born[5]) / 2. + (surv[2] + surv[4] + surv[6]) / 3.;
  var l = Math.sqrt(ret.r*ret.r + ret.g*ret.g + ret.b*ret.b);
  if(l>0) {
    ret.r *= 255 / l;
    ret.g *= 255 / l;
    ret.b *= 255 / l;
  }
  return ret;
}

var CalcFragmentShaderSource = `
  #version 300 es
  precision mediump float;
  precision highp int;
  
  uniform vec2 u_resolution;  // Field width and height
  uniform highp usampler2D u_texture;  // Field texture, UInt32
  
  in vec2 v_texcoord;  // the texCoords passed in from the vertex shader
  
  out uvec4 color;
  
  vec2 dxdy;  // pixel size in clip space
  
  uvec4 GetCell(int x, int y) {
    return texture(u_texture, fract(v_texcoord + vec2(x, y) * dxdy));  // fract makes it torus
  }
  
  uint Bit4Gene(uint v, uint i) {  // v=0..15 
    //return (v << i);
    if(v==0u) return 0u;
    return (((v >> 0) & 1u) << (i +  0u))
         + (((v >> 1) & 1u) << (i +  8u))
         + (((v >> 2) & 1u) << (i + 16u))
         + (((v >> 3) & 1u) << (i + 24u));
  }
  
  uint Gene4Bit(uint x, uint i) {
    //return (x >> i) & 1u;  // % 2u
    if(x==0u) return 0u;
    return (((x >> (i +  0u)) & 1u) << 0)
         + (((x >> (i +  8u)) & 1u) << 1)
         + (((x >> (i + 16u)) & 1u) << 2)
         + (((x >> (i + 24u)) & 1u) << 3);
  }
  /* // for some reason this code doesn't work and insanely lags
  uint numerator = 0u;
  for(uint n=3u; n>=0u; n--) {
    numerator += ((x >> (i + 8u*n)) & 1u) << n;
  }
  return numerator;  // 0..15
  */
  
  uint Round05(uint x, uint y) {
    return uint(floor(float(x)/float(y) + 0.499));  // rounding 0.5 to 0!
  }
  
  void main() {
    dxdy = vec2(1.0, 1.0) / u_resolution;
    
    uvec4 cells[9];
    cells[0] = GetCell(-1, -1);
    cells[1] = GetCell( 0, -1);
    cells[2] = GetCell( 1, -1);
    cells[3] = GetCell(-1,  0);
    cells[4] = GetCell( 0,  0);
    cells[5] = GetCell( 1,  0);
    cells[6] = GetCell(-1,  1);
    cells[7] = GetCell( 0,  1);
    cells[8] = GetCell( 1,  1);
    uvec4 curcell = cells[4];
    uint neibcount = cells[0].a + cells[1].a + cells[2].a + cells[3].a + cells[5].a + cells[6].a + cells[7].a + cells[8].a;
    
    if(neibcount==0u) {  // no neibs -> always die (we even dont have genes encoded for B/S=0)
      color = uvec4(0);
    }
    else if(curcell.a==1u) {  // alive cell - will it survive?
      uint survbit = Gene4Bit(curcell.g, neibcount - 1u);  // green channel = surv rule in bits
      
      if(survbit>7u) color = curcell;  // survive
      else           color = uvec4(0);  // die
    }
    else {  // dead cell - will it be born?
      uint bornbit = 0u;  // average among living neighbors of the bit needed to define if new cell will be born
      for(uint n=0u; n<9u; n++) {
        bornbit += Gene4Bit(cells[n].r, neibcount - 1u);
      }
      bornbit = Round05(bornbit, neibcount);
      
      if(bornbit>7u) {  // born
        uvec4 neibbits[8];
        for(uint i=0u; i<8u; i++) {
          for(uint n=0u; n<9u; n++) {
            neibbits[i].r += Gene4Bit(cells[n].r, i);
            neibbits[i].g += Gene4Bit(cells[n].g, i);
          }
          neibbits[i].r = Round05(neibbits[i].r, neibcount);
          neibbits[i].g = Round05(neibbits[i].g, neibcount);
        }
        curcell.r = 0u;  curcell.g = 0u;
        for(uint i=0u; i<8u; i++) {
          curcell.r += Bit4Gene(neibbits[i].r, i);
          curcell.g += Bit4Gene(neibbits[i].g, i);
        }
        
        curcell.b = 0u;
        curcell.a = 1u;
        color = curcell;
      }
      else color = uvec4(0);  // stay dead
    }
  }
`;

var ShowFragmentShaderSource = `
  #version 300 es
  precision mediump float;
  precision highp int;
  
  uniform highp usampler2D u_texture;  // Field texture
  
  in vec2 v_texcoord;  // the texCoords passed in from the vertex shader
  
  out vec4 color;
  
  uint Gene4Bit(uint x, uint i) {
    //return (x >> i) & 1u;  // % 2u
    if(x==0u) return 0u;
    return (((x >> (i +  0u)) & 1u) << 0)
         + (((x >> (i +  8u)) & 1u) << 1)
         + (((x >> (i + 16u)) & 1u) << 2)
         + (((x >> (i + 24u)) & 1u) << 3);
  }
  
  vec4 Color4Cell(uvec4 cell) {
    float born[8], surv[8];
    for(uint i=0u; i<8u; i++) {
      born[i] = float(Gene4Bit(cell.r, i)) / 15.;
      surv[i] = float(Gene4Bit(cell.g, i)) / 15.;
    }
    vec4 ret;
    ret.r = (born[2] + born[3] + born[7]) / 2. + (surv[0] + surv[3]) / 3.;
    ret.g = (born[4] + born[6]) / 2. + (surv[1] + surv[5] + surv[7]) / 3.;
    ret.b = (born[5] + born[5]) / 2. + (surv[2] + surv[4] + surv[6]) / 3.;
    float l = sqrt(ret.r*ret.r + ret.g*ret.g + ret.b*ret.b);
    if(l>0.) {
      ret.r /= l;
      ret.g /= l;
      ret.b /= l;
    }
    ret.a = 1.;
    return ret;
  }
  
  void main() {
    uvec4 cell = texture(u_texture, v_texcoord);
    color = Color4Cell(cell);
    //color = color.rbga;  // swapping blue and green, to make Conway's rules green, not blue (looks better)
  }
`;

// INIT SHADERS ////////////////////////////////////////////////////////////////

canvas = document.querySelector("#cnv");

gl = canvas.getContext("webgl2");  //, {premultipliedAlpha:false}  //"experimental-webgl"
if(!gl) alert('Enable WebGL2 in your browser');

function createShader(gl, type, source) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if(success) {
    return shader;
  }
  else {
    console.log(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
  }
}

var VertexShader       = createShader(gl, gl.VERTEX_SHADER,   VertexShaderSource.trim());  // same for both Calc and Show
var CalcFragmentShader = createShader(gl, gl.FRAGMENT_SHADER, CalcFragmentShaderSource.trim());
var ShowFragmentShader = createShader(gl, gl.FRAGMENT_SHADER, ShowFragmentShaderSource.trim());

function createProgram(gl, vertexShader, fragmentShader) {
  var program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  var success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if(success) {
    return program;
  }
  else {
    console.log(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
  }
}

var CalcProgram = createProgram(gl, VertexShader, CalcFragmentShader);
var ShowProgram = createProgram(gl, VertexShader, ShowFragmentShader);

// LINKING DATA ////////////////////////////////////////////////////////////////

gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);  // 1 byte alignment (not default 4) for WebGL

// we use same "program" object to store variable locations
CalcProgram.positionLocation   = gl.getAttribLocation(CalcProgram, "a_position");
CalcProgram.texcoordLocation   = gl.getAttribLocation(CalcProgram, "a_texcoord");
CalcProgram.resolutionLocation = gl.getUniformLocation(CalcProgram, "u_resolution");
CalcProgram.textureLocation    = gl.getUniformLocation(CalcProgram, "u_texture");

ShowProgram.positionLocation   = gl.getAttribLocation(ShowProgram, "a_position");
ShowProgram.texcoordLocation   = gl.getAttribLocation(ShowProgram, "a_texcoord");
ShowProgram.resolutionLocation = gl.getUniformLocation(ShowProgram, "u_resolution");
ShowProgram.textureLocation    = gl.getUniformLocation(ShowProgram, "u_texture");

// CANVAS SIZE ////////////////////////////////////////////////////////////////

if(document.body.clientWidth < document.body.clientHeight) [FW, FH] = [FH, FW];
var zoomx = Math.floor(0.9 * document.body.clientWidth  / FW);  if(zoomx<1) zoomx = 1;
var zoomy = Math.floor(0.9 * document.body.clientHeight / FH);  if(zoomy<1) zoomy = 1;
zoom = Math.min(zoomx, zoomy);
FWzoom = FW * zoom;

canvas.width  = zoom * FW;  canvas.style.width  = canvas.width  + 'px';
canvas.height = zoom * FH;  canvas.style.height = canvas.height + 'px';

document.getElementById('pausecont').style.width = canvas.width + 'px';

function resizeCanvasToDisplaySize(canvas) {
  // Lookup the size the browser is displaying the canvas.
  var displayWidth  = canvas.clientWidth;
  var displayHeight = canvas.clientHeight;
 
  // Check if the canvas is not the same size.
  if (canvas.width  != displayWidth ||
      canvas.height != displayHeight) {
 
    // Make the canvas the same size
    canvas.width  = displayWidth;
    canvas.height = displayHeight;
  }
}

// FPS STATS ////////////////////////////////////////////////////////////////

statsUi = new Stats();
statsUi.domElement.style.position = 'fixed';
statsUi.domElement.style.left = '0px';
statsUi.domElement.style.top = '0px';
document.body.appendChild(statsUi.domElement);

// VERTICES ////////////////////////////////////////////////////////////////

var positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.enableVertexAttribArray(CalcProgram.positionLocation);

gl.vertexAttribPointer( // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
  CalcProgram.positionLocation,
  2,  // size (2 components per iteration)
  gl.FLOAT,  // type (the data is 32bit floats)
  false,  // normalize
  0,  // stride (0 = move forward size * sizeof(type) each iteration to get the next position)
  0,  // offset (start at the beginning of the buffer)
);

gl.bufferData(gl.ARRAY_BUFFER,
  new Float32Array([
     0,  0,
     0, FH,
    FW, FH,
    FW,  0,
  ]),
  gl.STATIC_DRAW
);

// TEXTURES ////////////////////////////////////////////////////////////////

// we need to store 32bit (not default 8bit) in each color channel - Float32 or Int32

//var float_texture_ext = gl.getExtension('OES_texture_float');        if(!float_texture_ext) alert('OES_texture_float not supported');
//var float_colorbu_ext = gl.getExtension('WEBGL_color_buffer_float'); if(!float_colorbu_ext) alert('WEBGL_color_buffer_float not supported');
//var float_colorbu_ext = gl.getExtension('EXT_color_buffer_float');   if(!float_colorbu_ext) alert('EXT_color_buffer_float not supported');

gldata_InternalFormat = gl.RGBA32UI;  //RGBA32F  //RGBA
gldata_Format = gl.RGBA_INTEGER;      //RGBA     //RGBA
gldata_Type = gl.UNSIGNED_INT;        //FLOAT    //UNSIGNED_BYTE

var texcoordBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
gl.enableVertexAttribArray(CalcProgram.texcoordLocation);
gl.vertexAttribPointer(CalcProgram.texcoordLocation, 2, gl.FLOAT, false, 0, 0);
gl.bufferData(gl.ARRAY_BUFFER,
  new Float32Array([
    0, 0,
    0, 1,
    1, 1,
    1, 0,
  ]),
  gl.STATIC_DRAW
);

function CreateTexture(width, height) {
  var texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  
  gl.texImage2D(gl.TEXTURE_2D, 0, gldata_InternalFormat, width, height, 0, gldata_Format, gldata_Type, null);
  
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return texture;
}

function SetTexture(texture_num, texture, width, height, data) {
  gl.activeTexture(gl.TEXTURE0 + texture_num);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gldata_InternalFormat, width, height, 0, gldata_Format, gldata_Type, data);
}

function CreateFramebuffer(texture) {
  var framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  return framebuffer;
}

Textures = new Array(2);
Textures[0] = CreateTexture(FW, FH);
Textures[1] = CreateTexture(FW, FH);

Framebuffers = new Array(2);
Framebuffers[0] = CreateFramebuffer(Textures[0]);
Framebuffers[1] = CreateFramebuffer(Textures[1]);

// RULES (GENES) ////////////////////////////////////////////////////////////////

// each Rule ('3:23') encodes two DNA Strands of Born and Surv rules
// each Strand consists of 9 Genes
// each Gene is a bit (0/1) or float - probability [0., 1.]
// we omit gene#0 (it rarely exists) to pack strands to 8*bit or 8*Float4 (1*Float32) numbers

Rules = [
  '37:23',  // DryLife
  //'3:023',  // DotLife
  '357:238',  // Pseudo Life
  '36:125',  // 2x2
  '38:23',  // Pedestrian Life
  '3:23',  // Conway's Life
  '368:238',  // LowDeath
  '36:23',  // HighLife
  '38:238',  // HoneyLife
  '3:238',  // EightLife
  
  //'357:1358',  // Amoeba
  //'35678:5678',  // Diamoeba
  //'34:456',  // Bacteria
  //'3:45678',  // Coral
  //'34578:456',  // Gems Minor
  //'36:235',  // Blinker Life
];
//Rules = ['37:23'];
if(debug) Rules = ['37:23', '36:125'];

function Strand4Rule(r) {
  var strand = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  var ar = r.split('');
  if(ar) for(k in ar) strand[ar[k]] = 1;
  return strand;
}

function Genom4Rule(rule) {
  var b, s;
  [b, s] = rule.split(':');
  return {'born':Strand4Rule(b), 'surv':Strand4Rule(s)};
}

function Bits4Genom(genom) {
  // k=0 is omitted, no species can have b=0 or s=0
  var iborn = 0;  for(var k=0; k<8; k++) iborn |= Bit4Gene(genom.born[k+1], k);
  var isurv = 0;  for(var k=0; k<8; k++) isurv |= Bit4Gene(genom.surv[k+1], k);
  // addition if UInt32 is not accurate in JS, accuracy can be lost here in += (trying |=)
  return {'iborn':iborn, 'isurv':isurv};
}

function Genom4Bits(ibs) {
  var born = [];  born[0] = 0;  for(var k=0; k<8; k++) born[k+1] = Gene4Bit(ibs.iborn, k);
  var surv = [];  surv[0] = 0;  for(var k=0; k<8; k++) surv[k+1] = Gene4Bit(ibs.isurv, k);
  return {'born':born, 'surv':surv};
}

// 0 a b c d e f g h i  j  k  l  m  n  1
// 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15
function Idx4Strand(strand) {
  var idx = '', d;
  for(var n=0; n<9; n++) {
    var g = Math.round(strand[n] * 15);
         if(g== 0) d = '0';
    else if(g==15) d = '1';
    else           d = String.fromCharCode(96 + g);
    idx += d;
  }
  return idx;
}

function Idx4Genom(genom) {
  return Idx4Strand(genom.born) + ':' + Idx4Strand(genom.surv);
}

function Strand4Idx(idx) {
  var strand = [], g;
  for(var n=0; n<9; n++) {
    var d = idx[n];
         if(d=='0') g =  0;
    else if(d=='1') g = 15;
    else            g = d.charCodeAt(0) - 96;
    strand[n] = g / 15;
  }
  return strand;
}

function Genom4Idx(idx) {
  return {'born':Strand4Idx(idx.substring(0,9)), 'surv':Strand4Idx(idx.substring(10,19))};
}

// MATH ////////////////////////////////////////////////////////////////

function intval(x) { return parseInt(x, 10); }
function floor(x) { return Math.floor(x); }
function round(x) { return Math.round(x); }
function rnd(a, b) { return Math.floor(Math.random()*(b-a)) + a; }

function arsort_keys(obj) {
  var keys = Object.keys(obj);
  return keys.sort(function(a,b){return obj[b]-obj[a]});
}

// SPACE (FIELD) ////////////////////////////////////////////////////////////////

F = new Uint32Array(4 * FW * FH);  //Float32Array  //Uint8Array

function SetCell(x, y, r, g, b, a) {
  if(x<0 || y<0 || x>FW || y>FH) return;
  var s = 4 * (y * FW + x);
  F[s+0] = r;
  F[s+1] = g;
  F[s+2] = b;
  F[s+3] = a;
}

function GetCell(x, y) {
  if(x<0 || y<0 || x>FW || y>FH) return;
  var s = 4 * (y * FW + x);
  return {'r':F[s+0], 'g':F[s+1], 'b':F[s+2], 'a':F[s+3]};
}

// TIME (ITERATIONS) ////////////////////////////////////////////////////////////////

T0 = 0;  T1 = 1;  // previous (0) and current (1) moments

function FlipTime() {
  if(T1==1) { T1 = 0;  T0 = 1; } else { T1 = 1;  T0 = 0; } // switching between previous and current moment fields
}

// INIT FIELD ////////////////////////////////////////////////////////////////

function InitSetCell(x, y, r) {
  if(!Rules[r]) return;
  var bitrules = Bits4Genom(Genom4Rule(Rules[r]));
  SetCell(x, y, bitrules.iborn, bitrules.isurv, 0, 1);
}

function InitialFill() {
  if(debug) {
    InitSetCell(1, 2, 0);
    InitSetCell(2, 2, 0);
    InitSetCell(3, 2, 1);
    return;
  }
  
  var lx = 1.0, ly = 0.8;
  
  {
    for(var x=round(FW/2-FW*lx/2); x<round(FW/2+FW*lx/2); x++) {
      for(var y=round(FH/2-FH*ly/2); y<round(FH/2+FH*ly/2); y++) {
        var density = round((1 - Math.abs(2*y/FH-1)/ly)*10)/10;  // Math.sin(Math.PI * x / FW);
        if(Math.random()<=density) {
          var r = floor(Rules.length * (x-round(FW/2-FW*lx/2)) / FW / lx);
          InitSetCell(x, y, r);
        }
      }
    }
  }
}

InitialFill();  if(debug) console.log(F);

SetTexture(T0, Textures[T0], FW, FH, F);

// RENDERING ////////////////////////////////////////////////////////////////

Show();  // draw initial state as first frame (useful for GET-paused mode)
Read(true);

CalcWorld();

setTimeout(Read, 1000);

function Calc() {
  gl.useProgram(CalcProgram);
  
  gl.bindFramebuffer(gl.FRAMEBUFFER, Framebuffers[T1]);
  
  gl.viewport(0, 0, FW, FH);
  gl.uniform2f(CalcProgram.resolutionLocation, FW, FH);
  
  gl.activeTexture(gl.TEXTURE0 + T0);
  gl.bindTexture(gl.TEXTURE_2D, Textures[T0]);
  gl.uniform1i(CalcProgram.textureLocation, T0);
  
  gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

  FlipTime();
}

function Show() {
  resizeCanvasToDisplaySize(gl.canvas);
  
  gl.useProgram(ShowProgram);
  
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); // render to canvas
  
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.uniform2f(ShowProgram.resolutionLocation, FW, FH);
  
  gl.activeTexture(gl.TEXTURE0 + T0);
  gl.bindTexture(gl.TEXTURE_2D, Textures[T0]);
  gl.uniform1i(ShowProgram.textureLocation, T0);
  
  gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
}

function Read(force=false) {
  if(paused && !force) return 0;
  
  gl.bindFramebuffer(gl.FRAMEBUFFER, Framebuffers[T0]);
  
  gl.readPixels(0, 0, FW, FH, gldata_Format, gldata_Type, F);  if(debug) console.log(F);
  
  var s1 = '', s2 = '';
  
  s1 += 'r = ' + selfParams.get('r') + '<br>';
  
  var specstat = [], ttl = 0, gcount = 0;
  for(var x=0; x<FW; x++) {
    for(var y=0; y<FH; y++) {
      var cell = GetCell(x, y);
      if(!cell.a) continue;  // dead cell
      var bits = {'iborn': cell.r, 'isurv': cell.g};
      var idx = Idx4Genom(Genom4Bits(bits));

      if(!specstat[idx]) { specstat[idx] = 0;  gcount ++; }
      specstat[idx] ++;
      ttl ++;
    }
  }
  s1 += 'live cells = ' + ttl + '<br>';
  s1 += 'genotypes = ' + gcount + '<br>';
  
  var tracked = specstat;  // tracking all for now
  
  var trsorted = arsort_keys(tracked);
  
  s2 += 'dominating genotypes:<br>';
  for(var j in trsorted) {
    idx = trsorted[j];
    var clr = Color4Bits(Bits4Genom(Genom4Idx(idx)));
    s2 +=
      '<span style="color:rgb('+clr.r+','+clr.g+','+clr.b+'); background:#000;">' + idx + '</span>'
      + ' = ' + tracked[idx]
      + ' = ' + (ttl ? round(tracked[idx]/ttl*100) : '-') + '%'
      + '<br>';
  }
  
  document.getElementById('stxt1').innerHTML = s1;
  document.getElementById('stxt2').innerHTML = s2;

  setTimeout(Read, 1000);
}

function CalcWorld() {
  if(paused) return 0;

  Calc();

  Show();

  statsUi.update();
  
  if(maxfps) setTimeout(CalcWorld, 1000 / maxfps);
  else       requestAnimationFrame(CalcWorld);
}
