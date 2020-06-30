<? define("_root","../../");
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
include(_root."page.php");
$page->type = "page";
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

$p = mysql_o("SELECT * FROM rr_pages WHERE typ='k' AND url='alife'");

$ver = 204;

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
    #stxt1, #stxt2, #statcanvas {font:normal 11px/11px Lucida Console, Monaco, Monospace; margin-bottom:5px;}
    #stxt1, #stxt2 {overflow-x:scroll; white-space:nowrap;}
    #stxt1 {margin-bottom:10px;}
    #pausecont {width:400px; text-align:right;}
  </style>

  <canvas id='cnv'></canvas><br>
  <div id='pausecont'>
    <input type='button' value='pause stats' onclick='if(pausestat){pausestat=0; this.value=`pause stats`; ReadStat();} else {pausestat=1; this.value=`unpause stats`;}' style='width:100px; float:left;'>
    <input type='button' value='pause' autofocus onclick='if(paused){paused=0; this.value=`pause`; CalcWorld(); ReadStat();} else {paused=1; this.value=`unpause`;}' style='width:100px;'>
  </div>
  <div id='stxt1'></div>
  <div id='statcanvas'></div>
  <div id='stxt2'></div><br>

  $ztt
  
</div>

<div class=zauth><span title='јвтор'>&copy; </span>".GetAuthorName($p->author)."</div>

<div class=zpubd>$zpubd</div>

<script src='vendor/stats.js'></script>
<script src='glife.js?v=$ver&r=".rand(1,getrandmax())."'></script>

";
  
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

MakePage();

?>