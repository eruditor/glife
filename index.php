<? define("_root","../../");
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
include(_root."page.php");
$page->type = "page";
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

$p = mysql_o("SELECT * FROM rr_pages WHERE typ='k' AND url='alife'");

$ver = 208;

$rand = intval($_GET['seed']) ?: rand(1,getrandmax());

if(true) {
  $otitle = "GLife";
  $zabst = "Life game on WebGL2.";
  $ztt = "
    ...
  ";
  $zpubd = "2020-06-08";
}

$page->title = "Alife: $otitle Ц ERUDITOR.RU";

$page->z .= "
<h1><a href='/k/?alife'>Alife</a> &rarr; $otitle <span>v".sprintf("%.2lf", $ver/100)."</span></h1>

<div class=zabst>
  $zabst
</div>

<div class=ztt>
  <style>
    CANVAS {vertical-align:top; background:#eee; cursor:crosshair; width:400px; height:100px;}
    DIV.stxt {font:normal 11px/11px Lucida Console, Monaco, Monospace; margin-top:5px; overflow-x:auto; white-space:nowrap;}
    DIV#statcanvas {overflow-x:visible; white-space:normal;}
    #topbar {width:400px; text-align:left; padding:0 0 0 0;}
    #topbar INPUT[type=button] {width:100px;}
    #topform {float:right; font:normal 14px/17px Arial;}
  </style>
  
  <div id='topbar'>
    <input type='button' id='pausebtn' value='".($_GET['paused']?"unpause":"pause")."' autofocus onclick='Pause()'>
    <input type='button' id='pausestatbtn' value='pause stats' onclick='PauseStat()'>
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

<div class=zauth><span title='јвтор'>&copy; </span>".GetAuthorName($p->author)."</div>

<div class=zpubd>$zpubd</div>

<script src='lib/rules.js?v=$ver&r=$rand'></script>
<script src='glife.js?v=$ver&r=$rand'></script>

";
  
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

MakePage();

?>