function GetRuleset(get) {
  if(!get) return [];
  var ret = [];
  if(get=='random') {  // generating random rules (FD must be set)
    ret = RandomRules();
  }
  else if(get.indexOf('[')>-1) {  // taking rules from GET as full genom
    var ar = get.split(',');
    for(var k in ar) {
      var s = ar[k];
      s = s.replace(/[\[\]]/g, "");
      if(!s) continue;
      var a = new Array();
      a[0] = s;
      ret.push(a);
    }
  }
  else if(get.indexOf(',')>-1) {  // taking rules from GET as a list of named rules
    var ar = get.split(',');
    for(var k in ar) {
      var r = NamedRules[ar[k]];
      for(var z=0; z<FD; z++) {
        if(!ret[z]) ret[z] = [];
        var s = '';
        if(r && r[z]) s = r[z][0];
        ret[z].push(s);
      }
    }
  }
  else {  // taking rules from GET as a single named rule
    ret = NamedRules[get] || [];
  }
  return ret;
}

function RandomRuleStrand(min=0) {
  var ret = '';
  var l = rnd(1,9);
  var r = [];
  for(var j=0; j<l; j++) {
    var d = rnd(min, 9);
    r[d] = 1;
  }
  for(var k in r) {
    if(r[k]) ret += k.toString();
  }
  return ret;
}

function RandomRule(start_b=0, start_s=0) {
  return RandomRuleStrand(start_b) + ':' + RandomRuleStrand(start_s);
}

function RandomRules() {  // random rules to look for something new and interesting
  var perplane = 1;
  var rules = [];
  for(var z=0; z<FD; z++) {
    rules[z] = [];
    for(var v=0; v<perplane; v++) {
      rules[z][v] = RandomRule(1, 1);
    }
  }
  
  console.log(rules);
  var s = '';
  for(z in rules) {
    var t = '';
    for(v in rules[z]) {
      t += (t ? ', ' : '') + '"' + rules[z][v] + '"';
    }
    s += '  [' + t + '],\n';
  }
  document.getElementById('stxtlog').innerHTML += '<pre>[\n' + s + '],</pre>';
  
  return rules;
}

NamedRules = {
         'Debug': [
                    ['37:23', '36:125'],
                    ['37:23', '36:125'],
                    ['37:23', '36:125'],
                    ['37:23', '36:125'],
                  ],
     'Classic1D': [
                    [
                      '37:23',  // DryLife
                      '38:23',  // Pedestrian Life
                      '357:238',  // Pseudo Life
                      '36:125',  // 2x2
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
                    ],
                  ],
         'Vores': [
                    ['35678:5678'],  // plants
                    ['347:235', '', '3568:2367'],  // herbivores
                    ['', '12:1', '12:14', ''],  // carnivores
                  ],
     'Aphrodite': [
                    ["368:134567"],
                    ["13567:47"],
                    ["12678:138"],
                  ],
         'Swamp': [
                    ["1347:23478"],
                    ["23578:248"],
                    ["1:25"],
                  ],
     'BrainLike': [
                    ["1245678:1245678"],
                    ["25678:4578"],
                    ["124:1345"],
                  ],
    'DarkClouds': [
                    ["3567:12368"],
                    ["123578:357"],
                    ["2:23578"],
                  ],
   'AcidHorizon': [
                    ["247:18"],
                    ["23458:14567"],
                    ["1258:35678"],
                  ],
      'CloudBox': [
                    ["368:23456"],
                    ["235678:17"],
                    ["1678:138"],
                  ],
    'ChaoticFox': [
                    ['28:18'],
                    ['13:58'],
                    ['12:14'],
                  ],
    'BlackHoles': [
                    ["3:345"],
                    ["2:12578"],
                    ["126:1345"],
                  ],
    'ChaoticMoss':[
                    ["147:2458"],
                    ["25:124678"],
                    ["12467:1457"],
                  ],
    'Egyptian':   [
                    ["3457:67"],
                    ["167:4678"],
                    ["134568:123467"],
                  ],
    'Morphosis' : [
                    ["1348:3467"],
                    ["234568:1"],
                    ["1238:24"],
                  ],
    'Sharmosoma': [
                    ["12348:8"],
                    ["234568:16"],
                    ["123678:2347"],
                  ],
      'Remazing': [
                    ["1:12347"],
                    ["1278:25"],
                    ["123457:13457"],
                  ],
    'DarkClouds2':[
                    ["3458:4"],
                    ["14567:568"],
                    ["156:23678"],
                  ],
    'Nuclearity': [
                    ["3567:1356"],
                    ["14568:37"],
                    ["1378:12"],
                  ],
    'Aphrodite7': [
                    ["368:134567"],
                    ["13567:47"],
                    ["1267:138"],
                  ],
        'SunFox': [
                    ["12578:47"],
                    ["25678:23458"],
                    ["234578:12456"],
                  ],
        'Dionis': [
                    ["2458:34568"],
                    ["257:345678"],
                    ["2368:1"],
                  ],
   'DemiChaotic': [
                    ["1236:12346"],
                    ["248:13568"],
                    ["1568:14678"],
                  ],
        'Autumn': [
                    ["28:24"],
                    ["24:12368"],
                    ["12357:15"],
                  ],
   'Aphrodisiac': [
                    ["37:34567"],
                    ["14:678"],
                    ["158:1458"],
                  ],
       'Seaweed': [
                    ["12567:4678"],
                    ["23678:2578"],
                    ["146:235678"],
                  ],
    'SuperBrain': [
                    ["234578:345678"],
                    ["2356:7"],
                    ["1356:2357"],
                  ],
};
