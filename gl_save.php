<? define("_root","../../");
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
include(_root . "lib/var.php");
include(_root . "lib/db.php");
include(_root . "lib/lib.php");
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

$q = '';
$post = ['rules'=>'', 'seed'=>'', 'failed_at'=>'', 'failed_nturn'=>0, 'context'=>''];
foreach($post as $k=>$v) {
  $post[$k] = MRES($_POST[$k]);
  $q .= ($q?", ":"") . "$k='".$post[$k]."'";
}

mysql_query("INSERT INTO rr_glifes SET found_dt=NOW(), $q");

?>