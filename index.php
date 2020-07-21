<? define("_root","../../");
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
include(_root."page.php");
$page->type = "page";
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

$p = mysql_o("SELECT * FROM rr_pages WHERE typ='k' AND url='alife'");

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

$ver = 210;

$otitle = "GLife";
$zabst = "
  Life game on WebGL2.
";
$ztt = "
  ...
";
$zpubd = "2020-06-08";

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
if(isset($_GET['savedcat'])) {
  $savedcat = MRES(SPCQA($_GET['savedcat']));
  $goodness = intval($_GET['goodness']);
  
  $stitle = "Category «".$savedcat."»";
  $page->title = "Alife: $otitle: Saved Genoms: $stitle – ERUDITOR.RU";
  $page->z .= "<h1><a href='/k/?alife'>Alife</a> &rarr; <a href='/alife/glife/'>$otitle</a> &rarr; <a href='$_self?savedlist=1'>Saved Genoms</a> &rarr; $stitle</h1>";
  
  $nturn4goodness = [1=>5000, 2=>1000, 3=>0];
  $s = '';
  $res = mysql_query(
   "SELECT *
    FROM rr_glifes
    WHERE failed_at='$savedcat'
      ".($goodness ? "AND failed_nturn>=".intval($nturn4goodness[$goodness]) : "")."
    ORDER BY found_dt DESC
  ");
  while($r = mysql_fetch_object($res)) {
    $s .= "
      <tr>
        <td>$r->id</td>
        <td><a href='$_self?ruleset=$r->rules&pausestat=1'>$r->rules</a></td>
        <td>$r->found_dt</td>
        <td>$r->failed_at</td>
        <td>$r->failed_nturn</td>
      </tr>
    ";
  }
  $page->z .= "
  <div class=ztt>
    <style>
      #SavedListTB TD, #SavedListTB TH {font:normal 11px/13px arial; padding:1px 3px; vertical-align:top;}
      #SavedListTB TH {text-align:left; font-weight:bold;}
    </style>
    <table cellspacing=0 id='SavedListTB'>
      <tr><th>id</th><th>genom</th><th>datetime</th><th>category</th><th>nturn</th></tr>
      $s
    </table>
  </div>
  ";
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
elseif($_GET['savedlist']) {
  $stitle = "Saved Genoms: Category List";
  $page->title = "Alife: $otitle: $stitle – ERUDITOR.RU";
  $page->z .= "<h1><a href='/k/?alife'>Alife</a> &rarr; <a href='/alife/glife/'>$otitle</a> &rarr; $stitle</h1>";
  
  $s = '';  $ss = [];
  $clr4cat = [1=>"8f8", 2=>"ff8", 3=>"f88"];
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
  for($goodness=1; $goodness<=3; $goodness++) {
    $s .= "
      <td>
        <div style='background:#".$clr4cat[$goodness].";'>goodness = $goodness</div>
        <table cellspacing=0>
          <tr><th>category</th><th>genoms</th></tr>
          ".$ss[$goodness]."
        </table>
      </td>
      <td width=30>&nbsp;</td>
    ";
  }
  $page->z .= "
  <div class=ztt>
    <style>
      #SavedListTB TD, #SavedListTB TH {font:normal 11px/13px arial; padding:1px 3px; vertical-align:top;}
      #SavedListTB TH {text-align:left; font-weight:bold;}
    </style>
    <table cellspacing=0 id='SavedListTB'><tr>
      $s
    </tr></table>
  </div>
  ";
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
else {
  $rand = intval($_GET['seed']) ?: rand(1,getrandmax());
  
  $stitle = $_GET['ruleset'] ? ": ".SPCQA($_GET['ruleset']) : "";

  $page->title = "Alife: $otitle – ERUDITOR.RU";

  $page->z .= "<h1><a href='/k/?alife'>Alife</a> &rarr; $otitle <span>v".sprintf("%.2lf", $ver/100)."</span> $stitle</h1>";
  
  $page->z .= "
  <div class=zabst>
    $zabst
  </div>

  <div class=ztt>
    &rarr; <a href='$_self?savedlist=1'>List of Genoms found in random-search</a>
    
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
    
    $ztt
    
  </div>

  <div class=zauth><span title='Àâòîð'>&copy; </span>".GetAuthorName($p->author)."</div>

  <div class=zpubd>$zpubd</div>

  <script src='lib/rules.js?v=$ver&r=$rand'></script>
  <script src='glife.js?v=$ver&r=$rand'></script>

  ";
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

MakePage();

?>