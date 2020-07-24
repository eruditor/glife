<? define("_root","../../");
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
include(_root."page.php");
$page->type = "page";
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

$p = mysql_o("SELECT * FROM rr_pages WHERE typ='k' AND url='alife'");

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

$ver = 211;

$otitle = "GLife";
$h1 = "";
$zabst = "
  Life game on WebGL2.
";
$zzt = "
  ...
";
$zpubd = "2020-06-08";

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
if(isset($_GET['savedcat']) || isset($_GET['typed'])) {
  $savedcat = $_GET['savedcat'];
  $typed = $_GET['typed'];
  $goodness = intval($_GET['goodness']);
  
  if(isset($_GET['typed'])) {
    if($typed) {
      $stitle = "Typed «".SPCQA($typed)."»";
      $Q = "typed='".MRES($typed)."'";
    }
    else {
      $stitle = "Named Un-Typed";
      $Q = "typed='' AND named<>''";
    }
  }
  else {
    $stitle = "Category «".SPCQA($savedcat)."»";
    $Q = "failed_at='".MRES($savedcat)."'";
  }
  
  $page->title = "Alife: $otitle: Saved Genoms: $stitle – ERUDITOR.RU";
  $h1 = "<a href='/k/?alife'>Alife</a> &rarr; <a href='/alife/glife/'>$otitle</a> &rarr; <a href='$_self?savedlist=1'>Saved Genoms</a> &rarr; $stitle";
  
  $s = '';
  $nturn4goodness = [1=>5000, 2=>1000, 3=>0];
  $res = mysql_query(
   "SELECT *
    FROM rr_glifes
    WHERE $Q
      ".($goodness ? "AND failed_nturn>=".intval($nturn4goodness[$goodness]) : "")."
    ORDER BY found_dt DESC
  ");
  while($r = mysql_fetch_object($res)) {
    $s .= "
      <tr>
        <td>$r->id</td>
        <td><a href='$_self?ruleset=$r->rules&pausestat=1'>$r->rules</a></td>
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
  
  $res = mysql_query(
   "SELECT typed, COUNT(*) nn
    FROM rr_glifes
    WHERE named<>'' OR typed<>''
    GROUP BY typed
    ORDER BY nn DESC
  ");
  while($r = mysql_fetch_object($res)) {
    $ss[0] .= "
      <tr>
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
  
  $stitle = $_GET['ruleset'] ? ": ".SPCQA($_GET['ruleset']) : "";
  
  $page->title = "Alife: $otitle – ERUDITOR.RU";
  
  $h1 = "<a href='/k/?alife'>Alife</a> &rarr; $otitle <span>v".sprintf("%.2lf", $ver/100)."</span> $stitle";
  
  $zzt = "
    &rarr; <a href='$_self?savedlist=1'>Database of Genoms found in random-search</a>
      
    <style>
      CANVAS {vertical-align:top; background:#eee; cursor:crosshair; width:400px; height:100px;}
      DIV.stxt {font:normal 11px/11px Lucida Console, Monaco, Monospace; margin-top:5px; white-space:nowrap;}
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
    <script src='glife.js?v=$ver&r=$rand'></script>
  ";
}

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