function GetRuleset(get) {
  if(!get) return [];
  var ret = [];
  if(get=='random') {  // generating random rules (FD must be set)
    ret = RandomRules();
  }
  else if(get.indexOf('[')>-1) {  // taking rules from GET as full genom
    var planes = get.replace('],]', "").split('],[');
    for(var z in planes) {
      var plane = planes[z].replace(/[\[\]]/g, "");
      var rules = plane.split(',');
      var ar = new Array();
      for(var k in rules) {
        var rule = rules[k];
        ar[k] = rule;
      }
      ret[z] = [...ar];
    }
  }
  else if(get.indexOf(';')>-1) {  // taking rules from GET as a list of named rules
    var ar = get.split(';');
    for(var k in ar) {
      var r = GetRuleset(NamedRules[ar[k]]);
      var maxl = 0;
      for(var z=0; z<FD; z++) {
        if(r[z] && maxl<r[z].length) maxl = r[z].length;
      }
      var s = '';
      for(var z=0; z<FD; z++) {
        if(!ret[z]) ret[z] = [];
        s = '';
        for(var l=0; l<maxl; l++) {
          if(r && r[z] && r[z].length>l) s = r[z][l] || '';
          ret[z].push(s);
        }
      }
    }
  }
  else {  // taking rules from GET as a single named rule
    ret = GetRuleset(NamedRules[get]) || [];
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