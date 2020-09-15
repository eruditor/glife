// GET PARAMS ////////////////////////////////////////////////////////////////

// get GET params
const urlParams = new URLSearchParams(window.location.search);
// get script self address
var scripts = document.getElementsByTagName('script');
var myScript = scripts[scripts.length - 1];
const selfParams = new URLSearchParams(myScript.src);

class Cfg {
  constructor(url, slf) {
    this.debug = url.get('debug') ? 1 : 0;
    this.paused = url.get('paused') ? 1 : 0;
    this.pausestat = url.get('pausestat')>0 ? 1 : 0;
    this.maxfps = intval(url.get('maxfps'));  // Calc framerate limit
    this.showiter = intval(url.get('showiter'));  if(this.showiter<2) this.showiter = 0;  // Show once per showiter Calcs
    this.rerun = url.get('rerun') || slf.get('rerun');
  }
}
var cfg = new Cfg(urlParams, selfParams);

// global vars for constant things, good for shorter names in formulas
var FW = 600;  if(urlParams.get('FW')>0) FW = intval(urlParams.get('FW'));
var FH = 350;  if(urlParams.get('FH')>0) FH = intval(urlParams.get('FH'));
var FD =   3;  if(urlParams.get('FD')>0) FD = intval(urlParams.get('FD'));
var LW = 1.0;  if(urlParams.get('LW')>0) LW = parseFloat(urlParams.get('LW'));  // initially filled piece width
var LH = 0.8;  if(urlParams.get('LH')>0) LH = parseFloat(urlParams.get('LH'));  // initially filled piece height
var ruleset = urlParams.get('ruleset') || selfParams.get('ruleset');
var seed = intval(urlParams.get('seed') || selfParams.get('r'));

if(cfg.debug) {
  cfg.paused = 1;  cfg.maxfps = 1;
  FW = 10;  FH = 5;
  ruleset = 'Debug';
}

if(!ruleset) {
  if(FD==1) ruleset = 'Classic1D';
  else      ruleset = 'Aphrodite';
}

// COMMON MATH ////////////////////////////////////////////////////////////////

function intval(x) { if(!x) return 0;  return parseInt(x, 10); }
function floor(x) { return Math.floor(x); }
function round(x) { return Math.round(x); }
function sgn(x) { return x > 0 ? 1 : (x < 0 ? -1 : 0); }

function arsort_keys(obj) {
  var keys = Object.keys(obj);
  return keys.sort(function(a,b){return obj[b]-obj[a]});
}

function mulberry32(a) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}
var rand32 = mulberry32(seed);
function rnd(a, b) { return Math.floor(rand32()*(b-a)) + a; }  // rand32() <-> Math.random()

// GLSL SHADERS ////////////////////////////////////////////////////////////////

var LifeVertexShaderSource = `
  #version 300 es
  precision mediump float;
  
  uniform highp usampler3D u_fieldtexture;  // Field texture, UInt32
  ivec3 fieldSize;
  
  in vec2 a_position;  // input data from vertice coords buffer
  
  out vec2 v_texcoord;  // texture coord to pass to fragment shader (linearly interpolated)
  
  void main() {
    fieldSize = textureSize(u_fieldtexture, 0);
    
    vec2 clipSpace = (a_position / vec2(fieldSize.xy)) * 2.0 - 1.0;  // convert the position from pixels to clip space: [0..FW/FH/FD] -> [-1..1]
    
    gl_Position = vec4(clipSpace, 0, 1);  // gl_Position is a special variable a vertex shader is responsible for setting
    
    v_texcoord = a_position;  // pass the texCoord to the fragment shader; the GPU will interpolate this value between points
  }
`;

function Bit4Gene(v, i) {
  //return (v << i) >>> 0;  // for 1-bit genes
  if(v==0) return 0;
  var numerator = round(15*v);
  var ret = 0;
  for(var n=3; n>=0; n--) {  // store 8 of 4bit-float [0/15, .. , 15/15] to Uint32 (accuracy loss here, due to JS Uint32->Float conversion)
    var bitOf15 = (numerator >> n) & 1;
    ret |= (bitOf15 << (i + 8*n)) >>> 0;  // main bits are on the left, 8 gene numbers are interleaving: A0B0C0D0E0F0G0H0A1B1C1D1E1F1G1H1...
  }
  return ret;
}

var fs_Bit4Gene = `
  uint Bit4Gene(uint v, uint i) {  // v=0..15 
    //return (v << i);
    if(v==0u) return 0u;
    return (((v >> 0) & 1u) << (i +  0u))
         + (((v >> 1) & 1u) << (i +  8u))
         + (((v >> 2) & 1u) << (i + 16u))
         + (((v >> 3) & 1u) << (i + 24u));
  }
`;

function Gene4Bit(x, i) {
  //return (x >>> i) & 1;
  if(x==0) return 0;
  var numerator = 0;
  for(var n=3; n>=0; n--) {
    numerator += ((x >>> (i + 8*n)) & 1) * (2 ** n);
  }
  return numerator / 15.;
}

var fs_Gene4Bit = `
  uint Gene4Bit(uint x, uint i) {
    //return (x >> i) & 1u;  // % 2u
    if(x==0u) return 0u;
    return (((x >> (i +  0u)) & 1u) << 0)
         + (((x >> (i +  8u)) & 1u) << 1)
         + (((x >> (i + 16u)) & 1u) << 2)
         + (((x >> (i + 24u)) & 1u) << 3);
  }
`;

function Color4Bits(bits) {
  var born = [], surv = [];
  for(var i=0; i<8; i++) {
    born[i] = Gene4Bit(bits.iborn, i);
    surv[i] = Gene4Bit(bits.isurv, i);
  }
  var ret = {'r':0, 'g':0, 'b':0};
  ret.r = (born[2] + born[3] + born[7]) / 2. + (surv[0] + surv[3]          ) / 3.;
  ret.g = (born[1] + born[4] + born[6]) / 2. + (surv[1] + surv[5] + surv[7]) / 3.;
  ret.b = (born[0] + born[5] + born[5]) / 2. + (surv[2] + surv[4] + surv[6]) / 3.;
  var l = Math.sqrt(ret.r*ret.r + ret.g*ret.g + ret.b*ret.b);
  if(l>0) {
    ret.r *= 200 / l;
    ret.g *= 200 / l;
    ret.b *= 200 / l;
  }
  return ret;
} //console.log(Color4Bits(Bits4Genom(Genom4Idx('001000000:000001100'))));  throw new Error("Stopped!");

var fs_Color4Cell = `
  vec4 Color4Cell(uvec4 cell) {
    if(cell.a==0u) return vec4(0., 0., 0., 1.);
    float born[8], surv[8];
    for(uint i=0u; i<8u; i++) {
      born[i] = float(Gene4Bit(cell.r, i)) / 15.;
      surv[i] = float(Gene4Bit(cell.g, i)) / 15.;
    }
    vec4 ret;
    ret.r = (born[2] + born[3] + born[7]) / 2. + (surv[0] + surv[3]) / 3.;
    ret.g = (born[1] + born[4] + born[6]) / 2. + (surv[1] + surv[5] + surv[7]) / 3.;
    ret.b = (born[5] + born[5]) / 2. + (surv[2] + surv[4] + surv[6]) / 3.;
    float l = sqrt(ret.r*ret.r + ret.g*ret.g + ret.b*ret.b);
    if(l>0.) {
      l = l * 200. / float(cell.a);
      ret.r /= l;
      ret.g /= l;
      ret.b /= l;
    }
    ret.a = 1.;
    return ret;
  }
`;

var CalcFragmentShaderSource = `
  #version 300 es
  precision mediump float;
  precision highp int;
  
  uniform highp usampler3D u_fieldtexture;  // Field texture, UInt32
  
  in vec2 v_texcoord;  // the texCoords passed in from the vertex shader
  
  out uvec4 glFragColor[`+FD+`];
  
  ivec3 tex3coord;
  ivec3 fieldSize;
  
  ivec3 modulo3(ivec3 a, ivec3 b) {  // make the field torus-shaped (can use simple fract() for float vec3)
    ivec3 ret = a;
    if(a.x<0) ret.x = b.x + a.x;
    if(a.y<0) ret.y = b.y + a.y;
    if(a.z<0) ret.z = b.z + a.z;
    if(a.x>=b.x) ret.x = a.x - b.x;
    if(a.y>=b.y) ret.y = a.y - b.y;
    if(a.z>=b.z) ret.z = a.z - b.z;
    return ret;
  }
  
  uvec4 GetCell(int x, int y, int z) {
    return texelFetch(u_fieldtexture, modulo3(tex3coord + ivec3(x, y, z), fieldSize), 0);
  }
  
  ` + fs_Bit4Gene + `
  
  ` + fs_Gene4Bit + `
  
  uint Round05(uint x, uint y) {
    return uint(floor(float(x)/float(y) + 0.499));  // rounding 0.5 to 0! to make half-blood species less surviving
  }
  
  bool IsAlive(uvec4 cell) {
    return cell.a==255u ? true : false;
  }
  
  void main() {
    #define diealpha 100u;  // opacity value for just-died cell
    
    fieldSize = textureSize(u_fieldtexture, 0);
    
    uvec4 colors[`+FD+`];
    
    for(int layer=0; layer<`+FD+`; layer++) {
      
      tex3coord = ivec3(v_texcoord, layer);
      
      /*
      // static environs
      if(tex3coord.x==1) {
        colors[layer] = tex3coord.y%2==1 ? uvec4(100,100,100,255) : uvec4(0);
        continue;
      }
      if(tex3coord.y==1) {
        colors[layer] = tex3coord.x%2==1 ? uvec4(100,100,100,255) : uvec4(0);
        continue;
      }
      if(tex3coord.x>`+round(0.4*FW)+` && tex3coord.x<`+round(0.6*FW)+`
      && tex3coord.y>`+round(0.4*FH)+` && tex3coord.y<`+round(0.6*FH)+`) {
        colors[layer] = tex3coord.x%2==1 && tex3coord.y%2==1 ? uvec4(100,100,100,255) : uvec4(0);
        continue;
      }
      */
      
      uvec4 cells[9];
      // for xy-plane - Moore neighborhood
      cells[0] = GetCell( 0,  0,  0);
      cells[1] = GetCell(-1, -1,  0);
      cells[2] = GetCell( 0, -1,  0);
      cells[3] = GetCell( 1, -1,  0);
      cells[4] = GetCell(-1,  0,  0);
      cells[5] = GetCell( 1,  0,  0);
      cells[6] = GetCell(-1,  1,  0);
      cells[7] = GetCell( 0,  1,  0);
      cells[8] = GetCell( 1,  1,  0);
      
      uvec4 curcell = cells[0];
      
      uint neibcount = 0u;
      for(uint n=1u; n<9u; n++) {
        if(IsAlive(cells[n])) neibcount++;
      }
      
      // for z-axis (layers) - hard-coded von Neumann neighborhood calc'ed below
      
      uvec4 color;
      color = curcell;  // by default cell stays the same as in previous turn
      
      if(neibcount==0u) {  // no neibs -> always die (we don't even have genes encoded for B/S=0)
        if(IsAlive(curcell)) color.a = diealpha;  // die
      }
      else if(IsAlive(curcell)) {  // alive cell - will it survive?
        if(false && `+FD+`>2 && layer==0 && IsAlive(GetCell(0, 0, `+(FD-1)+`))) {
          // grass survives, protected and fed by top-level carnivore
        }
        else if(layer<`+(FD-1)+` && IsAlive(GetCell(0, 0, 1))) {
          color.a = diealpha;  // die, eaten by carnivore
        }
        else {
          uint survbit = Gene4Bit(curcell.g, neibcount - 1u);  // green channel = surv rule in bits
          if(survbit<=7u) color.a = diealpha;  // die
          // else survive
        }
      }
      else {  // dead cell - will it be born?
        if(layer>0 && !IsAlive(GetCell(0, 0, -1))) {
          // can't be born without food below
        }
        else {
          uint bornbit = 0u;  // average among living neighbors of the bit needed to define if new cell will be born
          for(uint n=1u; n<9u; n++) {
            if(IsAlive(cells[n])) {
              bornbit += Gene4Bit(cells[n].r, neibcount - 1u);  // red channel = born rule in bits
            }
          }
          bornbit = Round05(bornbit, neibcount);
          
          if(bornbit>7u) {  // born
            uvec4 neibbits[8];
            for(uint i=0u; i<8u; i++) {
              neibbits[i] = uvec4(0);
              for(uint n=1u; n<9u; n++) {
                if(IsAlive(cells[n])) {
                  neibbits[i].r += Gene4Bit(cells[n].r, i);
                  neibbits[i].g += Gene4Bit(cells[n].g, i);
                }
              }
              neibbits[i].r = Round05(neibbits[i].r, neibcount);
              neibbits[i].g = Round05(neibbits[i].g, neibcount);
            }
            color = uvec4(0u, 0u, 0u, 255u);
            for(uint i=0u; i<8u; i++) {
              color.r += Bit4Gene(neibbits[i].r, i);
              color.g += Bit4Gene(neibbits[i].g, i);
            }
          }
          // else stay dead
        }
      }
      
      if(!IsAlive(color)) {
        if(color.a>30u) color.a = color.a * 9u / 10u;  // alpha channel = color decay for died cell
        else            color.a = 0u;
      }
      
      colors[layer] = color;
      
    }
    
    glFragColor[0] = colors[0];
    ` + (FD>1 ? `glFragColor[1] = colors[1];` : ``) + `
    ` + (FD>2 ? `glFragColor[2] = colors[2];` : ``) + `
    ` + (FD>3 ? `glFragColor[3] = colors[3];` : ``) + `
  }
`;

var ShowFragmentShaderSource = `
  #version 300 es
  precision mediump float;
  precision highp int;
  
  uniform highp usampler3D u_fieldtexture;  // Field texture, UInt32
  uniform vec2 u_canvas;  // canvas width and height
  uniform vec3 u_surface;  // surface: (left, top, zoom)
  
  in vec2 v_texcoord;  // the texCoords passed in from the vertex shader
  
  out vec4 color;
  
  ` + fs_Gene4Bit + `
  
  ` + fs_Color4Cell + `
  
  void main() {
    ivec3 fieldSize = textureSize(u_fieldtexture, 0);
    ivec2 xy = ivec2(gl_FragCoord.xy / u_canvas * vec2(fieldSize.xy) * 2.);  // current coords, [0..2F]
    
    // display 3rd dimension (layers 0,1,2,3) as 4 pixels in 2*2 square:
    // | z=0 | z=1 |
    // | z=2 | z=3 |
    int layer = 0;
    ` + (FD>1 ? `
      if((xy.x % 2) == 1) layer += 1;
      if((xy.y % 2) == 1) layer += 2;
    ` : ``) + `
    
    ivec2 tex2coord = ivec2(v_texcoord / u_surface.z - u_surface.xy);
    if(tex2coord.x<0 || tex2coord.y<0 || tex2coord.x>=fieldSize.x || tex2coord.y>=fieldSize.y) {
      color = vec4(0.5, 0.5, 0.5, 1.);
    }
    else {
      uvec4 cell = texelFetch(u_fieldtexture, ivec3(tex2coord, layer), 0);
      color = Color4Cell(cell);
    }
  }
`;

var MousFragmentShaderSource = `
  #version 300 es
  precision mediump float;
  precision highp int;
  
  uniform highp usampler3D u_fieldtexture;  // Field texture, UInt32
  uniform ivec3 u_mouse;  // mouse coords (x,y,z)
  uniform uvec4 u_rgba;  // color to paint with
  
  in vec2 v_texcoord;  // the texCoords passed in from the vertex shader
  
  out uvec4 glFragColor[`+FD+`];
  
  ivec3 tex3coord;
  ivec3 fieldSize;
  
  uvec4 GetCell() {
    return texelFetch(u_fieldtexture, tex3coord, 0);
  }
  
  ` + fs_Bit4Gene + `
  
  ` + fs_Gene4Bit + `
  
  void main() {
    fieldSize = textureSize(u_fieldtexture, 0);
    
    uvec4 colors[`+FD+`];
    
    for(int layer=0; layer<`+FD+`; layer++) {
      
      tex3coord = ivec3(v_texcoord, layer);
      
      uvec4 color = GetCell();
      
      if(tex3coord==u_mouse) {
        color = u_rgba;
      }
      
      colors[layer] = color;
    }
    
    glFragColor[0] = colors[0];
    ` + (FD>1 ? `glFragColor[1] = colors[1];` : ``) + `
    ` + (FD>2 ? `glFragColor[2] = colors[2];` : ``) + `
    ` + (FD>3 ? `glFragColor[3] = colors[3];` : ``) + `
  }
`;

// RULES (GENES) ////////////////////////////////////////////////////////////////

// each Rule ('3:23') encodes two DNA Strands of Born and Surv rules
// each Strand consists of 9 Genes
// each Gene is a bit (0/1) or float - probability [0., 1.]
// we omit gene#0 (it rarely exists) to pack strands to 8*bit or 8*Float4 (1*Float32 or 1*UInt32) numbers
// it is possible to modify or extend this logic:
// 1. Skip bits 0 and 1 for born to keep bit 0 for surv (encoding-decoding logic will become more complicated)
// 2. Use blue and alpha channels to add one more bit to every gene - Float5 precision instead of Float4 (loosing color decay info in alpha-channel)

var Rules = GetRuleset(ruleset);

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

// idx is encoding of genes to print them on the screen as sequences of chars
// 0 a b c d e f g h i  j  k  l  m  n  1
// 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15
// idx4 encoding to 0, 1/4, 1/2, 3/4, 1 looks like this:
// 0 0 A A A A B B B B  C  C  C  C  1  1

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

function Idx54Idx(idx) {
  var l = idx.length, ret = '';
  for(var j=0; j<l; j++) {
    var c = idx[j], c5 = '';
         if(c=='0' || c=='a')                     c5 = '0';
    else if(c=='b' || c=='c' || c=='d' || c=='e') c5 = 'A';
    else if(c=='f' || c=='g' || c=='h' || c=='i') c5 = 'B';
    else if(c=='j' || c=='k' || c=='l' || c=='m') c5 = 'C';
    else if(c=='n' || c=='1')                     c5 = '1';
    else c5 = ':';
    ret += c5;
  }
  return ret;
}

function Idx4Idx5(idx5) {
  var l = idx5.length, ret = '';
  for(var j=0; j<l; j++) {
    var c5 = idx5[j], c = '';
         if(c5=='0') c = '0';
    else if(c5=='A') c = 'c';
    else if(c5=='B') c = 'g';
    else if(c5=='C') c = 'l';
    else if(c5=='1') c = '1';
    else c = ':';
    ret += c;
  }
  return ret;
}

// SPACE (FIELD) ////////////////////////////////////////////////////////////////

var F = new Uint32Array(4 * FW * FH * FD);  //Float32Array  //Uint8Array

function SetCell(x, y, z, r, g, b, a) {
  if(x<0 || y<0 || z<0 || x>FW || y>FH || z>FD) return;
  var s = 4 * (z * FH * FW + y * FW + x);
  F[s+0] = r;
  F[s+1] = g;
  F[s+2] = b;
  F[s+3] = a;
}

function GetCell(x, y, z) {
  if(x<0 || y<0 || z<0 || x>FW || y>FH || z>FD) return;
  var s = 4 * (z * FH * FW + y * FW + x);
  return {'r':F[s+0], 'g':F[s+1], 'b':F[s+2], 'a':F[s+3]};
}

// TIME (ITERATIONS) ////////////////////////////////////////////////////////////////

var T0 = 0, T1 = 1;  // previous (0) and current (1) moments

function FlipTime() {
  if(T1==1) { T1 = 0;  T0 = 1; } else { T1 = 1;  T0 = 0; } // switching between previous and current moment fields
}

// INIT FIELD ////////////////////////////////////////////////////////////////

function InitSetCell(x, y, z, r) {
  if(!Rules[z][r]) return;
  var bitrules = Bits4Genom(Genom4Rule(Rules[z][r]));
  SetCell(x, y, z, bitrules.iborn, bitrules.isurv, 0, 255);
}

function InitialFill() {
  F.fill(0);  // zeroing F in case this call is to restart everything
  
  if(cfg.debug) {
    if(1) {
      InitSetCell(1, 2, 0, 0);
      InitSetCell(2, 2, 0, 0);
      InitSetCell(3, 2, 0, 1);
    }
    if(FD>2) {
      InitSetCell(8, 2, 2, 0);
      InitSetCell(7, 2, 2, 0);
      InitSetCell(6, 2, 2, 1);
    }
    return;
  }
  
  for(var z=0; z<FD; z++) {
    for(var x=round(FW/2-FW*LW/2); x<round(FW/2+FW*LW/2); x++) {
      for(var y=round(FH/2-FH*LH/2); y<round(FH/2+FH*LH/2); y++) {
        if(y<0 || y>=FH) continue;
        if(z>=2 && y<FH/2) continue; // not too much predators
        var density = round((1 - Math.abs(2*y/FH-1)/LH)*10);
        if(rnd(0,10)<density) {
          var r = floor(Rules[z].length * (x-round(FW/2-FW*LW/2)) / FW / LW);
          InitSetCell(x, y, z, r);
        }
      }
    }
  }
  
  if(cfg.debug) console.log(F);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// INIT SHADERS ////////////////////////////////////////////////////////////////

var canvas = document.querySelector("#cnv");

var gl = canvas.getContext("webgl2");  //, {premultipliedAlpha:false}  //"experimental-webgl"
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

var LifeVertexShader   = createShader(gl, gl.VERTEX_SHADER,   LifeVertexShaderSource.trim());  // same for all fragment shaders
var CalcFragmentShader = createShader(gl, gl.FRAGMENT_SHADER, CalcFragmentShaderSource.trim());
var ShowFragmentShader = createShader(gl, gl.FRAGMENT_SHADER, ShowFragmentShaderSource.trim());
var MousFragmentShader = createShader(gl, gl.FRAGMENT_SHADER, MousFragmentShaderSource.trim());

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

var CalcProgram = createProgram(gl, LifeVertexShader, CalcFragmentShader);
var ShowProgram = createProgram(gl, LifeVertexShader, ShowFragmentShader);
var MousProgram = createProgram(gl, LifeVertexShader, MousFragmentShader);

// LINKING DATA ////////////////////////////////////////////////////////////////

gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);  // 1 byte alignment (not default 4) for WebGL

// we use same "program" object to store variable locations
CalcProgram.location = {};
CalcProgram.location.a_position     = gl.getAttribLocation( CalcProgram, "a_position");
CalcProgram.location.u_fieldtexture = gl.getUniformLocation(CalcProgram, "u_fieldtexture");
ShowProgram.location = {};
ShowProgram.location.a_position     = gl.getAttribLocation( ShowProgram, "a_position");
ShowProgram.location.u_fieldtexture = gl.getUniformLocation(ShowProgram, "u_fieldtexture");
ShowProgram.location.u_canvas       = gl.getUniformLocation(ShowProgram, "u_canvas");
ShowProgram.location.u_surface      = gl.getUniformLocation(ShowProgram, "u_surface");
MousProgram.location = {};
MousProgram.location.a_position     = gl.getAttribLocation( MousProgram, "a_position");
MousProgram.location.u_fieldtexture = gl.getUniformLocation(MousProgram, "u_fieldtexture");
MousProgram.location.u_mouse        = gl.getUniformLocation(MousProgram, "u_mouse");
MousProgram.location.u_rgba         = gl.getUniformLocation(MousProgram, "u_rgba");

// CANVAS SIZE ////////////////////////////////////////////////////////////////

//if(document.body.clientWidth < document.body.clientHeight) [FW, FH] = [FH, FW];
var zoomx = Math.floor(0.9 * document.body.clientWidth  / FW);  if(zoomx<1) zoomx = 1;
var zoomy = Math.floor(0.9 * document.body.clientHeight / FH);  if(zoomy<1) zoomy = 1;
var zoom = Math.min(zoomx, zoomy);
if(FD>1 && zoom<2) zoom = 2;  // for displaying 3D case we need at least 2*2 pixels for each cell

canvas.width  = zoom * FW;  canvas.style.width  = canvas.width  + 'px';
canvas.height = zoom * FH;  canvas.style.height = canvas.height + 'px';

document.getElementById('topbar').style.width = canvas.width + 'px';

function resizeCanvasToDisplaySize(canvas) {
  var displayWidth = canvas.clientWidth, displayHeight = canvas.clientHeight;  // Lookup the size the browser is displaying the canvas
  if(canvas.width!=displayWidth || canvas.height!=displayHeight) {  // Check if the canvas is not the same size
    canvas.width = displayWidth;  canvas.height = displayHeight;  // Make the canvas the same size
  }
}

// stats canvas
var scnv_height = 100;
var scnvs = [], sctxs = [];
var sdiv = document.getElementById('statcanvas');
sdiv.innerHTML = 'species population (log scale):<br>';
for(var z=0; z<FD; z++) {
  scnvs[z] = document.createElement('canvas');
  sdiv.appendChild(scnvs[z]);
  scnvs[z].width  = zoom * FW;    scnvs[z].style.width  = scnvs[z].width  + 'px';
  scnvs[z].height = scnv_height;  scnvs[z].style.height = scnvs[z].height + 'px';
  scnvs[z].style.margin = '0 0 5px 0';
  sctxs[z] = scnvs[z].getContext('2d');
}

class Surface {
  constructor() {
    this.zoom = 1;
    this.left = 0;
    this.top = 0;
  }
}
var surface = new Surface();

// HTML TOP FORM ////////////////////////////////////////////////////////////////

function Pause(set=0) {
  var btn = document.getElementById('pausebtn');
  if(set==-1 || cfg.paused && set!=1) { cfg.paused = 0;  btn.value = 'pause';  Start(); }
  else                                { cfg.paused = 1;  btn.value = 'unpause'; }
}

function PauseStat() {
  var btn = document.getElementById('pausestatbtn');
  if(cfg.pausestat) { cfg.pausestat = 0;  btn.value = 'pause stats';   }
  else              { cfg.pausestat = 1;  btn.value = 'unpause stats'; }
}

var topbar  = document.getElementById('topbar');
var topform = document.getElementById('topform');

function CreateTopForm() {
  var ret = '', sp = ' &nbsp; ';
  
  ret += '<input type=submit value=" OK " style="float:right; height:42px;">';
  
  var s = '';  for(var t=1; t<=4; t++) s += '<option value="' + t + '" ' + (t==FD?'selected':'') + '>' + t;
  ret += '<span title="Field Depth">FD=</span><select name="FD" id="FDsel">' + s + '</select>' + sp;
  
  ret += '<span title="Field Width">FW=</span><input type=text name="FW" value="' + FW + '" size=4>' + sp;
  
  ret += '<span title="Field Height">FH=</span><input type=text name="FH" value="' + FH + '" size=4>' + sp;
  
  var rule0 = [];  if(ruleset.indexOf(',')>-1) rule0[ruleset] = ruleset;  else rule0[''] = '';
  var s = '';  for(var t in {...rule0, 'random':'', ...NamedRules}) s += '<option value="' + t + '" ' + (t==ruleset?'selected':'') + '>' + t;
  var onchange = `if(this.value!='random') document.getElementById('FDsel').value = GetRuleset(NamedRules[this.value]).length`;
  ret += '<span title="NamedRules">Genom=</span><select name="ruleset" onchange="' + onchange + '">' + s + '</select>' + sp;
  
  ret += '<span title="PRNG seed">seed=</span><input type=text name="seed" value="' + seed + '" size=10>' + sp;
  
  ret += '<br>';
  
  ret += '<span title="Width of initially filled area">LW=</span><input type=text name="LW" value="' + LW + '" size=3>' + sp;
  
  ret += '<span title="Height of initially filled area">LH=</span><input type=text name="LH" value="' + LH + '" size=3>' + sp;
  
  ret += '<span title="0 = requestAnimationFrame, 1000 = no setTimeout">maxfps=</span>';
  ret += '<input type=number name="maxfps" value="' + cfg.maxfps + '" min=0 max=300 style="width:4em;" onchange="cfg.maxfps=this.value; Show();">' + sp;
  
  ret += '<span title="Show once per showiter Calcs">showiter=</span><input type=text name="showiter" value="' + cfg.showiter + '" size=3>' + sp;
  
  ret += '<span title="paused at start">paused=</span><input type=checkbox name="paused" ' + (cfg.paused ? 'checked' : '') + '>' + sp;
  
  return ret;
}
topform.innerHTML += CreateTopForm();

function CreateNavButtons() {
  var ret = '';
  
  ret += `
    <input type=button id='pausebtn' value='` + (cfg.paused ? `unpause` : `pause`) + `' onclick='Pause();' autofocus>
    <input type=button id='pausestatbtn' value='` + (cfg.pausestat ? `unpause stats` : `pause stats`) + `' onclick='PauseStat();'>
  `;
  ret += '<br>';
  ret += `
    <input type=button value="&minus;" onclick="surface.left+=0.1*(FW/surface.zoom/2); surface.top +=0.1*(FH/surface.zoom/2); surface.zoom/=1.1; Show();">
    <input type=button value="+"       onclick="surface.zoom*=1.1; surface.left-=0.1*(FW/surface.zoom/2); surface.top -=0.1*(FH/surface.zoom/2); Show();">
    
    <input type=button value="&larr;" onclick="surface.left+=10; Show();">
    <input type=button value="&rarr;" onclick="surface.left-=10; Show();">
    <input type=button value="&uarr;" onclick="surface.top -=10; Show();">
    <input type=button value="&darr;" onclick="surface.top +=10; Show();">
    
    <input type=button value="&empty;" onclick="surface.left=0; surface.top=0; surface.zoom=1; Show();">
  `;
  
  return ret;
}
topbar.innerHTML += CreateNavButtons();

// MOUSE ////////////////////////////////////////////////////////////////

var mouseX = 0, mouseY = 0, mouseZ = 0, mouseRGBA = {};

gl.canvas.onmousemove = function(e) {
  mouseX = floor((e.offsetX / surface.zoom) / zoom - surface.left);
  mouseY = floor(((gl.canvas.height - e.offsetY) / surface.zoom) / zoom - surface.top);
};

gl.canvas.onmousedown = function(e) {
  Pause(1);
  if(e.which===1) {  // left click
    console.log(mouseX+':'+mouseY);
    Mous();
    gl.canvas.addEventListener('mousemove', Mous);
  }
  else if(e.which===3) {  // right click
    gl.bindFramebuffer(gl.FRAMEBUFFER, Framebuffers[T0]);
    for(var z=0; z<FD; z++) {
      gl.readBuffer(gl.COLOR_ATTACHMENT0 + z);
      gl.readPixels(0, 0, FW, FH, gldata_Format, gldata_Type, F);
      var cell = GetCell(mouseX, mouseY, 0);
      if(cell.a<255) {
        continue;
      }
      else {
        mouseRGBA = {...cell};
        mouseZ = z;
        console.log('z='+mouseZ+', rgba=');  console.log(mouseRGBA);
        break;
      }
    }
  }
};

gl.canvas.onmouseup = function(e) {
  if(e.which===1) {
    gl.canvas.removeEventListener('mousemove', Mous);
  }
  Pause(-1);
};

gl.canvas.oncontextmenu = function() {
  return false;
};

// VERTICES ////////////////////////////////////////////////////////////////

var positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.enableVertexAttribArray(CalcProgram.location.a_position);

gl.vertexAttribPointer( // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
  CalcProgram.location.a_position,
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

var gldata_InternalFormat = gl.RGBA32UI;  //RGBA32F  //RGBA
var gldata_Format = gl.RGBA_INTEGER;      //RGBA     //RGBA
var gldata_Type = gl.UNSIGNED_INT;        //FLOAT    //UNSIGNED_BYTE

function CreateTexture(width, height, depth=1) {
  var texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D, texture);
  
  gl.texImage3D(gl.TEXTURE_3D, 0, gldata_InternalFormat, width, height, depth, 0, gldata_Format, gldata_Type, null);
  
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return texture;
}

function SetTexture(texture_num, texture, width, height, depth=1, data) {
  gl.activeTexture(gl.TEXTURE0 + texture_num);
  gl.bindTexture(gl.TEXTURE_3D, texture);
  gl.texImage3D(gl.TEXTURE_3D, 0, gldata_InternalFormat, width, height, depth, 0, gldata_Format, gldata_Type, data);
}

function CreateFramebuffer(texture) {
  var framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  for(let layer=0; layer<FD; layer++) {
    gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + layer, texture, 0, layer);
  }
  return framebuffer;
}

var Textures = new Array(2);
Textures[0] = CreateTexture(FW, FH, FD);
Textures[1] = CreateTexture(FW, FH, FD);

var Framebuffers = new Array(2);
Framebuffers[0] = CreateFramebuffer(Textures[0]);
Framebuffers[1] = CreateFramebuffer(Textures[1]);

// MAIN ////////////////////////////////////////////////////////////////

var nGen = 1;  // number of genoms produced in random-search

class Record {
  constructor() {
    this.ttl = 0;  // total number of living cells
    this.gcount = 0;  // number of different genoms in the biosphere
    
    this.livecells = [];  // total number of living cells in this z-plane
    this.icehsh = [];  // quasi-sum of living cell coordinates, to detect frozen states
    this.frozentime = [];  // for how many turns this z-plane is frozen

    this.nqfilld = [];  // total number of non-empty squares
    this.nqchngd = [];  // number of squared that changed their emptiness
    
    this.fillin = [];
    this.spread = [];
    this.variat = [];
    
    this.zero();
  }

  zero() {
    for(let key in this) {
      if(Array.isArray(this[key])) {
        for(let z=0; z<FD; z++) this[key][z] = 0;
      }
      else if(Number.isInteger(this[key])) {
        this[key] = 0;
      }
    }
  }
}

class Records {  // tracking and writing to DB population characteristics
  constructor() {
    this[0] = new Record();  // storing it for SO (previous)
    this[1] = new Record();  // and S1 (current) turns
  }
  
  delta(field, z) {
    return 2 * (this[S1][field][z] - this[S0][field][z]) / (this[S1][field][z] + this[S0][field][z]);
  }
  
  absdelta(field, z) {
    return Math.abs(this.delta(field, z));
  }
  
  Bgc(k, v) {
    var bgc = '';
    for(let x in gl_bgc4records[k]) {
      bgc = gl_bgc4records[k][x];
      if(v<x) break;
    }
    return bgc;
  }
  
  SpanBgc(k, v) {
    v = round(v);
    return `<span style='background:#` + this.Bgc(k, v) + `'>` + v + `</span>%`;
  }
}

function Init() {
  nturn = 0;
  nturn0 = 0;
  nshow = 0;
  date0 = new Date;
  saved = false;
  qq0 = [];
  
  rec = new Records();  
  
  tracked = [], tracked5 = [];
  prevpoints = [], infostep = -1;
  
  T0 = 0;  T1 = 1;  // time moments for Calc
  S0 = 0;  S1 = 1;  // time moments for Stats
  
  InitialFill();
  
  SetTexture(T0, Textures[T0], FW, FH, FD, F);
  
  for(z=0; z<FD; z++) sctxs[z].clearRect(0, 0, FW * zoom, scnv_height);
}

Init();

function Start() {
  Show();  // draw initial state as first frame (useful for GET-paused mode)
  
  Stats(true);
  
  Calc();  // start Calc-ing world iterations
}

Start();

function Calc() {
  if(cfg.paused) return 0;
  
  gl.useProgram(CalcProgram);
  
  gl.bindFramebuffer(gl.FRAMEBUFFER, Framebuffers[T1]);
  
  var color_attachments = [];
  for(let layer=0; layer<FD; layer++) {
    color_attachments[layer] = gl.COLOR_ATTACHMENT0 + layer;
  }
  gl.drawBuffers(color_attachments);
  
  gl.viewport(0, 0, FW, FH);
  
  gl.activeTexture(gl.TEXTURE0 + T0);
  gl.bindTexture(gl.TEXTURE_3D, Textures[T0]);
  gl.uniform1i(CalcProgram.location.u_fieldtexture, T0);
  
  gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

  FlipTime();
  
  nturn ++;
  
  if(cfg.showiter) { if(nturn % cfg.showiter == 0) Show(); }
  else if(cfg.maxfps<=60) Show();
  // else Show() rotates in its own cycle

  if((nturn % 200)==0) Stats();
  
  if(cfg.maxfps>=1000) Calc();
  else if(cfg.maxfps && cfg.maxfps!=60) setTimeout(Calc, 1000 / cfg.maxfps);
  else requestAnimationFrame(Calc);
}

function Show() {
  resizeCanvasToDisplaySize(gl.canvas);
  
  gl.useProgram(ShowProgram);
  
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); // render to canvas
  
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  
  gl.uniform2f(ShowProgram.location.u_canvas, gl.canvas.width, gl.canvas.height);
  gl.uniform3f(ShowProgram.location.u_surface, surface.left, surface.top, surface.zoom);
  
  gl.activeTexture(gl.TEXTURE0 + T0);
  gl.bindTexture(gl.TEXTURE_3D, Textures[T0]);
  gl.uniform1i(ShowProgram.location.u_fieldtexture, T0);
  
  gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
  
  nshow ++;
  
  if(cfg.maxfps>60 && !cfg.showiter) requestAnimationFrame(Show);  // overwise Show() is called in Calc()
}

function Mous() {
  gl.useProgram(MousProgram);
  
  gl.bindFramebuffer(gl.FRAMEBUFFER, Framebuffers[T1]);
  
  var color_attachments = [];
  for(let layer=0; layer<FD; layer++) {
    color_attachments[layer] = gl.COLOR_ATTACHMENT0 + layer;
  }
  gl.drawBuffers(color_attachments);
  
  gl.viewport(0, 0, FW, FH);
  
  gl.activeTexture(gl.TEXTURE0 + T0);
  gl.bindTexture(gl.TEXTURE_3D, Textures[T0]);
  gl.uniform1i(MousProgram.location.u_fieldtexture, T0);
  gl.uniform3i(MousProgram.location.u_mouse, mouseX, mouseY, mouseZ);
  gl.uniform4ui(MousProgram.location.u_rgba, mouseRGBA.r, mouseRGBA.g, mouseRGBA.b, mouseRGBA.a);
  
  gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

  FlipTime();
  
  Show();
}

function SaveRules(failed_at='') {
  var q = '';
  
  var s = '';
  for(z in Rules) {
    var t = '';
    for(v in Rules[z]) {
      t += (t ? ',' : '') + '' + Rules[z][v] + '';
    }
    s += '[' + t + '],';
  }
  s = '[' + s + ']';
  q += (q?'&':'') + 'rules=' + encodeURIComponent(s);
  
  q += (q?'&':'') + 'seed=' + encodeURIComponent(seed);
  
  q += (q?'&':'') + 'failed_at=' + encodeURIComponent(failed_at);
  
  q += (q?'&':'') + 'failed_nturn=' + encodeURIComponent(nturn);
  
  srec = JSON.stringify(rec[S1]);
  q += (q?'&':'') + 'records=' + encodeURIComponent(srec);
  
  scon = window.location.search;
  q += (q?'&':'') + 'context=' + encodeURIComponent(scon);
  
  XHRsave(q);
  
  saved = true;
}

function Stats(force=false) {
  // calc fps
  var sfps = '';
  
  sfps += 'turn = ' + nturn + ' | ';
  sfps += 'shown = ' + nshow + ' | ';
  
  var date1 = new Date;
  var ms = (date1 - date0) / (nturn - nturn0);
  date0 = date1;  nturn0 = nturn;
  sfps += 'fps = ' + round(1000 / ms) + '<br>';
  if(nGen>1) sfps = 'nGen = ' + nGen + ' | ' + sfps;
  
  if(sfps) document.getElementById('stxtfps').innerHTML = sfps;
  
  if(!force && (cfg.paused || cfg.pausestat)) return;
  
  // calc stats and genom list
  
  var sstat = '', sgenom = '';
  
  var x, y, z, idx, idx5, zidx, zidx5;
  
  var specstat = [];  // precise stat for top-genom list
  var specstat5 = [];  // rounded stat for graph
  
  var qd = 10, qx, qy, qq = []; // grid of squares qd*qd with coordinates (qx,qy) is to measure how species spread
  var qw = floor(FW / qd), qh = floor(FH / qd);  // assuming FW%qd==0 && FH%qd==0
  var nqtotal = qw * qh;  // total number of squares
  
  rec[S1].zero();
  
  gl.bindFramebuffer(gl.FRAMEBUFFER, Framebuffers[T0]);  // preparing to fetch Field data from GPU
  
  for(var z=0; z<FD; z++) {
    
    gl.readBuffer(gl.COLOR_ATTACHMENT0 + z);  // z-plane of the Field is a buffer attached to a texture point
    gl.readPixels(0, 0, FW, FH, gldata_Format, gldata_Type, F);  // reading pixels of layer=z to F(z=0) part of F
    
    specstat[z] = [];  specstat5[z] = [];  qq[z] = [];
    
    for(var x=0; x<FW; x++) {
      qx = floor(x / qd);
      if(!qq[z][qx]) qq[z][qx] = [];
      for(var y=0; y<FH; y++) {
        var cell = GetCell(x, y, 0);
        if(cell.a<255) continue;  // dead cell
        
        var bits = {'iborn': cell.r, 'isurv': cell.g};
        idx = Idx4Genom(Genom4Bits(bits));
        idx5 = Idx54Idx(idx);
        if(!specstat[z][idx]) { specstat[z][idx] = 0;  specstat5[z][idx5] = 0;  rec[S1].gcount ++; }
        specstat[z][idx] ++;
        specstat5[z][idx5] ++;
        rec[S1].ttl ++;

        rec[S1].livecells[z] ++;
        
        qy = floor(y / qd);
        if(!qq[z][qx][qy]) qq[z][qx][qy] = 0;
        qq[z][qx][qy] ++;  // each element of qq stores number of living cells in this square
        
        rec[S1].icehsh[z] += (x + y);  // hash-like sum of living cells
      }
    }
  }
  sstat += 'live cells = ' + rec[S1].ttl + ' | ';
  sstat += 'genoms = ' + rec[S1].gcount + '<br>';
  
  // counting squares
  for(z=0; z<FD; z++) {
    for(qx=0; qx<qw; qx++) {
      for(qy=0; qy<qh; qy++) {
        if(qq[z][qx][qy]) rec[S1].nqfilld[z] ++;
        if(qq0.length && sgn(qq[z][qx][qy]) != sgn(qq0[z][qx][qy])) rec[S1].nqchngd[z] ++;
      }
    }
  }
  qq0 = [...qq];
  
  // tracking all species ever reached top-10 or filled 0.1% of field's area
  for(z=0; z<FD; z++) {
    var sorted = arsort_keys(specstat[z]);
    var l = sorted.length, lmt = round(0.001*FW*FH);
    for(i=0; i<l; i++) {
      idx = sorted[i];  if(!idx) break;  if(!specstat[z][idx]) break;
      if(i<10 || specstat[z][idx]>lmt) {
        zidx = z + ': ' + idx;
        tracked[zidx] = specstat[z][idx];
        idx5 = Idx54Idx(idx);
        zidx5 = z + ': ' + idx5;
        tracked5[zidx5] = specstat5[z][idx5];
      }
      else break;
    }
  }
  
  // updating all tracked values
  for(zidx in tracked) {
    z = zidx.substring(0, 1);  idx = zidx.substring(3);
    tracked[zidx] = specstat[z][idx] ? specstat[z][idx] : 0;
    if(!tracked[zidx]) delete tracked[zidx];
  }
  for(zidx5 in tracked5) {
    z = zidx5.substring(0, 1);  idx5 = zidx5.substring(3);
    tracked5[zidx5] = specstat5[z][idx5] ? specstat5[z][idx5] : 0;
  }
  
  sgenom += 'dominating genoms:<br>';
  var trsorted = arsort_keys(tracked);
  for(var j in trsorted) {
    zidx = trsorted[j];
    z = zidx.substring(0, 1);  idx = zidx.substring(3);
    
    var clr = Color4Bits(Bits4Genom(Genom4Idx(idx)));
    sgenom +=
      '<span style="color:rgb('+clr.r+','+clr.g+','+clr.b+'); background:#000;">' + z + ':' + idx + '</span>'
      + ' = ' + tracked[zidx]
      + ' = ' + (rec[S1].ttl ? round(tracked[zidx]/rec[S1].ttl*100) : '-') + '%'
      + '<br>';
  }
  
  // plotting graphs
  infostep ++;
  if(infostep<zoom*FW) {
    for(zidx5 in tracked5) {
      z = zidx5.substring(0, 1);  idx5 = zidx5.substring(3);
      
      var clr = Color4Bits(Bits4Genom(Genom4Idx(Idx4Idx5(idx5))));
      
      var xx = infostep;
      var yy = tracked5[zidx5] ? scnv_height - round(Math.log2(tracked5[zidx5]) / Math.log2(FW*FH) * scnv_height) : scnv_height; // Math.log2 or cbrt here
      var style = 'rgb('+clr.r+','+clr.g+','+clr.b+')';
      if(prevpoints[zidx5] && xx>0) {
        sctxs[z].beginPath();
        sctxs[z].strokeStyle = style;
        sctxs[z].moveTo(xx-1, prevpoints[zidx5]);
        sctxs[z].lineTo(xx, yy);
        sctxs[z].stroke();
      }
      else {
        sctxs[z].fillStyle = style;
        sctxs[z].fillRect(xx, yy, 1, 1);
      }
      
      prevpoints[zidx5] = yy;
    }
  }
  
  // removing extinct tracked5 (here, not above in update-cycle, to show extinction points on graphs)
  for(zidx5 in tracked5) if(!tracked5[zidx5]) { delete tracked5[zidx5];  delete prevpoints[zidx5]; }
  
  // for how long planes are frozen
  for(z=0; z<FD; z++) {
    if(!rec[S1].ttl || !rec[S1].icehsh[z]) rec[S1].frozentime[z] = rec[S0].frozentime[z] + 10;
    else if(rec.absdelta('icehsh', z) < 0.01 && rec.absdelta('livecells', z) < 0.01) rec[S1].frozentime[z] = rec[S0].frozentime[z] + 1;
    else rec[S1].frozentime[z] = 0;
  }
  
  // empty or full or frozen planes
  var interesting_z = 0;  // number of planes that are not full and not dead and not frozen
  var failed_at = '';  // reason why failed
  var stb = '';  // table contents to output
  for(z=0; z<FD; z++) {
    var fillin = 100 * (rec[S1].livecells[z] / (FW*FH));  // percent of all cells alive
    var spread = 100 * (rec[S1].nqfilld[z] / nqtotal);  // percent of filled (non-empty) squares
    var variat = 100 * (rec[S1].nqchngd[z] / rec[S1].nqfilld[z]);  // percent of non-empty squares that changed their emptiness in the current turn
    
    var flags = '';
    
    var clr1 = '';
         if(spread< 5) clr1 = 'd00';
    else if(spread<10) clr1 = 'ff0';
    else if(spread>99) clr1 = '777';
    else if(spread>95) clr1 = 'ccc';
    if(clr1) flags = '<span style="background:#' + clr1 + ';">' + round(spread) + '%</span> ';
    
    var clr2 = '';
         if(rec[S1].frozentime[z]>2) clr2 = 'D00';
    else if(rec[S1].frozentime[z]>0) clr2 = 'FF0';
    if(clr2) flags += '<span style="background:#' + clr2 + ';">frozen=' + rec[S1].frozentime[z] + '</span> ';
    
    if(spread<5 || spread>99 || rec[S1].frozentime[z]>2) { failed_at += clr1 + clr2 + ';'; }
    else interesting_z ++;
    
    rec[S1].fillin[z] = fillin;
    rec[S1].spread[z] = spread;
    rec[S1].variat[z] = variat;
    
    stb += `
      <tr>
        <td>` + z + `</td>
        <td>` + rec[S1].livecells[z] + `</td>
        <td>` + rec[S1].nqfilld[z] + `</td>
        <td>` + rec[S1].nqchngd[z] + `</td>
        <td>` + rec.SpanBgc('fillin', fillin) + `</td>
        <td>` + rec.SpanBgc('spread', spread) + `</td>
        <td>` + rec.SpanBgc('variat', variat) + `</td>
        <td>` + rec[S1].icehsh[z] + `</td>
        <td>` + flags + `</td>
      </tr>
    `;
  }
  sstat += `
    <table cellspacing=0 id='glifeStatTB'>
      <tr>
        <th>z</th><th>livecells</th><th>nqfilld</th><th>nqchngd</th>
        <th>fillin</th><th>spread</th><th>variat</th>
        <th>icehsh</th><th>flags</th>
      </tr>
      ` + stb + `
    </table>
  `;
  
  if(ruleset=='random' || cfg.rerun) {
    if((!interesting_z && nturn>500) || (nturn>=5000)) {  // if no interesting planes left - restart
      SaveRules(failed_at);
      nGen ++;
      if(nGen>300 || cfg.rerun) {
        window.location.reload(true);  // reloading page sometimes to refresh seed for rand32 to avoid cycles
      }
      else {
        Rules = RandomRules();
        Init();
      }
    }
  }
  else if(nturn>=10000 && !saved) {  // saving all long-runned cases
    SaveRules('x');
  }
  
  if(S1==1) { S1 = 0;  S0 = 1; } else { S1 = 1;  S0 = 0; }  // flipping time for Stats
  
  if(sstat)  document.getElementById('stxtstat').innerHTML = sstat;
  if(sgenom) document.getElementById('stxtgenom').innerHTML = sgenom;
  
}