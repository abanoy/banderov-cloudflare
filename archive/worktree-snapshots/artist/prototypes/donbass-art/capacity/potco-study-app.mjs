import {potcoChestSVG} from './potco-study.mjs';
import {potcoChestRefinedSVG} from './potco-study-refined.mjs';
const $=id=>document.getElementById(id);
const settings=()=>({wear:$('wear').checked,key:$('key').checked});
function render(){
 $('before').innerHTML=potcoChestSVG({...settings(),size:256});
 $('large').innerHTML=potcoChestRefinedSVG({...settings(),size:256,id:'hero'});
 $('beforeSizes').innerHTML=[32,44,64].map(size=>'<div>'+potcoChestSVG({...settings(),size})+'<small>'+size+' px</small></div>').join('');
 $('afterSizes').innerHTML=[32,44,64].map(size=>'<div>'+potcoChestRefinedSVG({...settings(),size,id:'after'+size})+'<small>'+size+' px</small></div>').join('');
 $('inventory').innerHTML=potcoChestRefinedSVG({...settings(),size:64,id:'button'});
 $('inventory').querySelector('svg').setAttribute('aria-hidden','true');
}
function setOpen(open){
 $('inventoryPanel').hidden=!open;
 $('inventory').setAttribute('aria-expanded',String(open));
 $('inventory').setAttribute('aria-label',open?'Close inventory preview':'Open inventory preview');
}
$('inventory').onclick=()=>setOpen($('inventoryPanel').hidden);
$('closeInventory').onclick=()=>{setOpen(false);$('inventory').focus();};
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('inventoryPanel').hidden){setOpen(false);$('inventory').focus();}});
$('wear').onchange=render;$('key').onchange=render;
$('save').onclick=()=>{
 const url=URL.createObjectURL(new Blob([potcoChestRefinedSVG(settings())],{type:'image/svg+xml'}));
 const a=document.createElement('a');a.href=url;a.download='potco-inventory-refined.svg';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
};
render();
