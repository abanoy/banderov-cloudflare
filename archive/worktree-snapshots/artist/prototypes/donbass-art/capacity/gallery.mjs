import {icons,props,iconSVG,propSVG} from './renderer.mjs';
import {iconStateSVG,statePalettes,contrastRatio} from './states.mjs';
import {mountIconButton} from './native-button.mjs';
const $=id=>document.getElementById(id);let selected='heart',dark=false;
let nativeCount=0;
const nativeAction=label=>()=>{$('nativeStatus').textContent=label+' activated. Total actions: '+(++nativeCount)+'.';};
const nativeButtons=[
 mountIconButton($('nativeBack'),{icon:'back',size:16,label:'Back',iconOnly:true,onActivate:nativeAction('Back')}),
 mountIconButton($('nativeBag'),{icon:'bag',size:24,label:'Inventory',onActivate:nativeAction('Inventory')}),
 mountIconButton($('nativeAttack'),{icon:'sword',size:32,label:'Attack',disabled:true,onActivate:nativeAction('Attack')})
];
$('attackAvailable').onchange=()=>{nativeButtons[2].update({disabled:!$('attackAvailable').checked});$('nativeStatus').textContent=$('attackAvailable').checked?'Attack is available.':'Attack is unavailable; it will not activate.';};
function settings(){return {color:dark?'#dce8ca':$('ink').value,stroke:Number($('weight').value),badge:$('treatment').value==='badge'};}
function drawIcon(id,size){return $('previewState').value==='normal'?iconSVG(id,{...settings(),size}):iconStateSVG(id,{size,stroke:settings().stroke,state:$('previewState').value,theme:dark?'dark':'light'});}
function render(){
 for(const button of nativeButtons)button.update({theme:dark?'dark':'light'});
 const fixedPalette=$('previewState').value!=='normal';$('ink').disabled=dark||fixedPalette;$('treatment').disabled=fixedPalette;
 $('weightValue').textContent=Number($('weight').value).toFixed(1);
 $('largeIcon').innerHTML=drawIcon(selected,128);$('selectedName').textContent=icons.find(i=>i.id===selected).name;
 $('sample16').innerHTML=drawIcon(selected,16);$('sample24').innerHTML=drawIcon(selected,24);$('sample32').innerHTML=drawIcon(selected,32);
 $('iconGroups').innerHTML=['Navigation','Actions','Status','Game'].map(group=>'<h3 class="group-title">'+group+'</h3><div class="icon-grid">'+icons.filter(i=>i.group===group).map(i=>'<button class="icon-card" data-icon="'+i.id+'" aria-label="'+i.name+'" aria-pressed="'+(selected===i.id)+'"><span class="icon-pair">'+drawIcon(i.id,16)+drawIcon(i.id,24)+drawIcon(i.id,32)+'</span><span class="name">'+i.name+'</span></button>').join('')+'</div>').join('');
 for(const button of $('iconGroups').querySelectorAll('button'))button.onclick=()=>{selected=button.dataset.icon;render();};
 $('playButton').innerHTML=iconSVG('play',{...settings(),size:20,color:dark?'#213c36':'#fffdf7'})+'Begin';$('inventoryButton').innerHTML=drawIcon('bag',20)+'Bag';$('restartButton').innerHTML=drawIcon('rotate',20);
 $('readyStatus').innerHTML=drawIcon('check',16)+'Ready';$('warningStatus').innerHTML=iconSVG('alert',{size:16,color:'#725122',stroke:1.8})+'Low health';$('rewardIcon').innerHTML=drawIcon('star',42);$('rewardButton').innerHTML=drawIcon('coin',20)+'Collect reward';drawProps();drawStates();
}
function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:'image/svg+xml'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('download').onclick=()=>download(drawIcon(selected,32),selected+'-'+$('previewState').value+'.svg');
$('previewState').onchange=render;$('ink').onchange=render;$('weight').oninput=render;$('treatment').onchange=render;
$('theme').onclick=()=>{dark=!dark;document.body.classList.toggle('dark',dark);$('theme').setAttribute('aria-pressed',String(dark));$('theme').textContent=dark?'Light paper':'Dark paper';render();};
for(const[id,message]of [['playButton','The action button responds. This is a drawing sample, not a game.'],['inventoryButton','Inventory button selected.'],['restartButton','Sample reset.'],['rewardButton','Reward collected in this sample.']])$(id).onclick=()=>{$('actionStatus').textContent=message;if(id==='restartButton'){$('health').value='72';updateHealth();}};
function updateHealth(){const value=Number($('health').value);$('healthFill').style.width=value+'%';$('healthText').textContent=value+' / 100';$('warningStatus').hidden=value>=35;}
$('health').oninput=updateHealth;
function drawProps(){const options={outline:dark?'#acc8b5':'#293e3b'};$('propGrid').innerHTML=props.map(p=>'<article class="prop-card"><div class="prop-pair">'+propSVG(p.id,{...options,size:128})+propSVG(p.id,{...options,size:48})+'</div><h3>'+p.name+'</h3><p>'+p.note+'</p><a href="exports/props/'+p.id+'.svg" download data-prop="'+p.id+'">Download SVG</a></article>').join('');for(const a of $('propGrid').querySelectorAll('a'))a.onclick=event=>{event.preventDefault();download(propSVG(a.dataset.prop,options),a.dataset.prop+'.svg');};}

function drawStates(){const theme=dark?'dark':'light';$('stateComparison').innerHTML=['normal','hover','pressed','disabled'].map(state=>{const paint=statePalettes[theme][state];return '<article class="state-card"><h3>'+state+'</h3><div class="state-samples">'+[16,24,32].map(size=>'<div><button class="state-button" data-preview="'+state+'" '+(state==='disabled'?'disabled ':'')+'aria-label="'+state+' '+selected+' '+size+' pixels">'+iconStateSVG(selected,{size,state,theme,stroke:settings().stroke})+'</button><small>'+size+' px</small></div>').join('')+'</div><p>'+contrastRatio(paint.ink,paint.paper).toFixed(2)+':1 ink / paper</p></article>';}).join('');for(const button of $('stateComparison').querySelectorAll('button:not(:disabled)'))button.onclick=()=>{$('stateStatus').textContent=button.dataset.preview+' example selected. Disabled samples do not activate.';};}
render();updateHealth();
