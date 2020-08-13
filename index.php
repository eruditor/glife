<? define("_root","../../");
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
include(_root."page.php");
$page->type = "page";
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

$p = mysql_o("SELECT * FROM rr_pages WHERE typ='k' AND url='alife'");

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

$ver = 212;

$otitle = "GLife";
$h1 = "";
$zabst = "
  Life game on WebGL2.
";
$zzt = "";
$zpubd = "2020-06-08";

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
if(isset($_GET['savedcat']) || isset($_GET['typed']) || isset($_GET['named']) || isset($_GET['savedid'])) {
  if(isset($_GET['typed'])) {
    $typed = $_GET['typed'];
    if($typed) {
      $stitle = "Typed «".SPCQA($typed)."»";
      $Q = "typed='".MRES($typed)."'";
    }
    else {
      $stitle = "Named Un-Typed";
      $Q = "typed='' AND named<>''";
    }
  }
  elseif($_GET['named']=="all") {
    $stitle = "All Named";
    $Q = "named<>''";
  }
  elseif($_GET['savedid']) {
    $savedid = intval($_GET['savedid']);
    $stitle = "All Named";
    $Q = "id='$savedid'";
  }
  else {
    $savedcat = $_GET['savedcat'];
    $goodness = intval($_GET['goodness']);
    $stitle = "Category «".SPCQA($savedcat)."»";
    $Q = "failed_at='".MRES($savedcat)."'" . ($goodness ? " AND failed_nturn>=".intval($nturn4goodness[$goodness]) : "");
  }
  
  $page->title = "Alife: $otitle: Saved Genoms: $stitle – ERUDITOR.RU";
  $h1 = "<a href='/k/?alife'>Alife</a> &rarr; <a href='/alife/glife/'>$otitle</a> &rarr; <a href='$_self?savedlist=1'>Saved Genoms</a> &rarr; $stitle";
  
  $s = '';
  $nturn4goodness = [1=>5000, 2=>1000, 3=>0];
  $res = mysql_query(
   "SELECT *
    FROM rr_glifes
    WHERE $Q
    ORDER BY found_dt DESC
  ");
  while($r = mysql_fetch_object($res)) {
    $s .= "
      <tr>
        <td>$r->id</td>
        <td><a href='$_self?ruleset=$r->rules&maxfps=300'>$r->rules</a></td>
        <td><i>$r->named</i></td>
        <td>$r->typed</td>
        <td>$r->found_dt</td>
        <td>$r->failed_at</td>
        <td>$r->failed_nturn</td>
        ".(_local==="1" ? "
          <td>
            <input type=text id='glrule$r->id' value='".SPCQA($r->named . ($r->typed?":$r->typed":""))."' size=24><input type=button value=' Save ' onclick='XHRsave(`id=$r->id&named=`+encodeURIComponent(document.getElementById(`glrule$r->id`).value));'>
          </td>
        " : "")."
      </tr>
    ";
  }
  $zzt = "
    <style>
      #SavedListTB TD, #SavedListTB TH {font:normal 11px/13px arial; padding:1px 3px; vertical-align:top;}
      #SavedListTB TH {text-align:left; font-weight:bold;}
      #SavedListTB TD INPUT {font:normal 11px/11px arial; padding:0;}
    </style>
    <table cellspacing=0 id='SavedListTB'>
      <tr><th>id</th><th>genom</th><th>named</th><th>typed</th><th>datetime</th><th>category</th><th>nturn</th></tr>
      $s
    </table>
  ";
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
elseif($_GET['savedlist']) {
  $stitle = "Saved Genoms: Category List";
  $page->title = "Alife: $otitle: $stitle – ERUDITOR.RU";
  $h1 = "<a href='/k/?alife'>Alife</a> &rarr; <a href='/alife/glife/'>$otitle</a> &rarr; $stitle";
  
  $s = '';  $ss = [];
  $clr4cat = [0=>"4ff", 1=>"8f8", 2=>"ff8", 3=>"f88"];
  $clr4nmd = [
    "foam"=>"efe", "brain"=>"efe", "vores"=>"efe", "cyclic"=>"efe", ""=>"efe",
    "amoeba"=>"ffd", "holey"=>"ffd", "shoal"=>"ffd", "vapor"=>"ffd", "?"=>"ffd",
    "boil"=>"fee", "extin"=>"fee", "conway"=>"fee", "blink"=>"fee", "gas"=>"fee", "kia"=>"fee",
  ];
  
  $named_nn = mysql_r("SELECT COUNT(*) FROM rr_glifes WHERE named<>''");
  $ss[0] .= "
      <tr style='background:#dff;'>
       <td><a href='$_self?named=all'><i>all named</i></a></td>
       <td align=right>$named_nn</td>
      </tr>
  ";
  
  $res = mysql_query(
   "SELECT typed, COUNT(*) nn
    FROM rr_glifes
    WHERE named<>'' OR typed<>''
    GROUP BY typed
    ORDER BY nn DESC
  ");
  while($r = mysql_fetch_object($res)) {
    $ss[0] .= "
      <tr style='background:#".$clr4nmd[$r->typed].";'>
       <td><a href='$_self?typed=$r->typed'>".($r->typed?:"-?-")."</a></td>
       <td align=right>$r->nn</td>
      </tr>
    ";
  }
  
  $res = mysql_query(
   "SELECT failed_at, IF(failed_nturn>=5000, 1, IF(failed_nturn>=1000, 2, 3)) goodness, COUNT(*) nn
    FROM rr_glifes
    WHERE 1
    GROUP BY failed_at, goodness
    ORDER BY goodness, nn DESC
  ");
  while($r = mysql_fetch_object($res)) {
    $ss[$r->goodness] .= "
      <tr>
        <td><a href='$_self?savedcat=$r->failed_at&goodness=$r->goodness'>".($r->failed_at?:"---")."</a></td>
        <td align=right>$r->nn</td>
      </tr>
    ";
  }
  
  for($goodness=0; $goodness<=3; $goodness++) {
    if($goodness==0) {
      $th1 = "manually selected";
      $th2 = "type";
    }
    else {
      $th1 = "goodness = $goodness";
      $th2 = "category";
    }
    $s .= "
      <td width=20%>
        <table cellspacing=0 width=100%>
          <tr><th colspan=2 style='background:#".$clr4cat[$goodness].";'>$th1</th></tr>
          <tr><th>$th2</th><th style='text-align:right;'>genoms</th></tr>
          ".$ss[$goodness]."
        </table>
      </td>
      <td width=5%>&nbsp;</td>
    ";
  }
  $zzt = "
    <style>
      #SavedListTB TD, #SavedListTB TH {font:normal 11px/13px arial; padding:1px 3px; vertical-align:top;}
      #SavedListTB TH {text-align:left; font-weight:bold;}
    </style>
    <table cellspacing=0 id='SavedListTB'><tr>
      $s
    </tr></table>
  ";
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
else {
  $rand = intval($_GET['seed']) ?: rand(1,getrandmax());
  $ruleset = '';
  
  if($_GET['ruleset']) {
    $ruleset = $_GET['ruleset'];
    $s = '';
    if(strpos($ruleset, "[")!==false) $q = "rules='".MRES($ruleset)."'";
    else $q = "named='".MRES($ruleset)."'";
    $gl = mysql_o("SELECT * FROM rr_glifes WHERE $q");
    if($gl) {
      $res = mysql_query("SELECT * FROM rr_gliferuns WHERE gl_id='$gl->id' LIMIT 5");
      while($r = mysql_fetch_object($res)) {
        $s .= "
          <b>Run #$r->id</b><br>
          ".($r->named ? "named = ".SPCQA($r->named)."<br>" : "")."
          ".($r->typed ? "typed = ".SPCQA($r->typed)."<br>" : "")."
          $r->failed_at / $r->failed_nturn<br>
        ";
        if($r->records) {
          $json = json_decode($r->records) ?: [];
          $st = $stb = $sth = '';
          foreach($json as $k=>$v) {
            //if($k=='icehsh') continue;
            if(!in_array($k,['fillin','spread','variat'])) continue;
            if(is_array($v)) {
              $stb .= "<tr><td>" . SPCQA($k) . "</td>";
              foreach($v as $kv=>$vv) {
                $vv = round($vv) . "%";
                $stb .= "<td>" . SPCQA($vv) . "</td>";
                if($k=='fillin') $sth .= "<th>".SPCQA($kv)."</th>";
              }
              $stb .= "</tr>";
            }
            else {
              $st .= SPCQA($k) . " = " . SPCQA($v) . "<br>";
            }
          }
          $s .= $st . "
            <table cellspacing=0 id='glifeStatTB'>
              <tr><th>z-layer</th>$sth</tr>
              $stb
            </table>
          ";
        }
        $s .= "<br>";
      }
      $zzt .= "<div class=stxt>$s</div>";
    }
    $stitle = SPCQA($ruleset);
  }
  elseif($_GET['rerun']) { // rerun old runs to calc gl.records field
    usleep(200000);
    $q = '';
        if($_GET['rerun']=='typed') $q = "gl.typed<>''";
    elseif($_GET['rerun']=='5000')  $q = "gl.failed_nturn>=5000";
    else die("err. #478126332");
    $res = mysql_query("
      SELECT gl.*, gr.id
      FROM rr_glifes gl
      LEFT JOIN rr_gliferuns gr ON gr.gl_id=gl.id AND gr.records<>''
      WHERE $q
      GROUP BY gl.id
      HAVING gr.id IS NULL
      LIMIT 1
    ");
    while($r = mysql_fetch_object($res)) {
      $ruleset = $r->rules;
    }
    if(!$ruleset) exit("rerun finished");
    $stitle = "Rerun = " . SPCQA($ruleset);
  }
  
  $page->title = "Alife: $otitle".($stitle ? ": ".$stitle : "")." – ERUDITOR.RU";
  
  $h1 = "<a href='/k/?alife'>Alife</a> &rarr; " . ($_GET ? "<a href='/alife/glife/'>$otitle</a>" : $otitle . " <span>v".sprintf("%.2lf", $ver/100)."</span>") . ($stitle ? " &rarr; ".$stitle : "");
  
  $zabst .= "<br>&rarr; <a href='$_self?savedlist=1'>Database of Genoms found in random-search</a>";
  
  $zzt .= "
    <style>
      CANVAS {vertical-align:top; background:#eee; cursor:crosshair; width:400px; height:100px;}
      DIV#statcanvas {white-space:normal;}
      #topbar {width:400px; text-align:left; padding:0 0 0 0;}
      #pausebtn, #pausestatbtn {width:100px;}
      #topform {float:right; font:normal 14px/17px Arial;}
    </style>
    
    <div id='topbar'>
      <form method=GET action='$_self' id='topform'></form>
    </div>
    
    <canvas id='cnv'></canvas><br>
    
    <div id='stxtfps'    class='stxt' style='margin-bottom:10px;'></div>
    <div id='stxtstat'   class='stxt'></div>
    <div id='statcanvas' class='stxt'></div>
    <div id='stxtgenom'  class='stxt'></div>
    <div id='stxtlog'    class='stxt'></div>
    
    <script src='lib/rules.js?v=$ver&r=$rand'></script>
    <script src='glife.js?v=$ver&r=$rand".($ruleset?"&ruleset=".urlencode($ruleset):"")."'></script>
  ";
}

$page->z .= "
  <style>
    DIV.stxt {font:normal 11px/11px Lucida Console, Monaco, Monospace; margin-top:5px; white-space:nowrap;}
    #glifeStatTB {border:solid 2px #ddd; margin-top:3px;}
    #glifeStatTB TD, #glifeStatTB TH {padding:2px 4px; text-align:right;}
    #glifeStatTB TH {background:#f4f4f4; border-bottom:solid 1px #ddd;}
  </style>
";

$page->z .= "
  <h1>$h1</h1>
  
  <div class=zabst>
    $zabst
  </div>
  
  <div class=zzt>
    $zzt
  </div>
  
  <div class=zauth><span title='Àâòîð'>&copy; </span>".GetAuthorName($p->author)."</div>
  
  <div class=zpubd>$zpubd</div>
";

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

MakePage();

?>