const key='crusaders-sketch-sliders-v1';
export function installLookPresets(apply,setZoom){
 const inputs=Array.from(document.querySelectorAll('.sliders input')),feedback=document.querySelector('#preset-feedback');
 const defaults=Object.fromEntries(inputs.map(i=>[i.id,Number(i.defaultValue)]));
 function use(values){inputs.forEach(i=>i.value=values[i.id]);setZoom(values.zoom);apply();}
 function valid(data){return data?.version===1&&data.values&&inputs.every(i=>typeof data.values[i.id]==='number'&&Number.isFinite(data.values[i.id])&&data.values[i.id]>=Number(i.min)&&data.values[i.id]<=Number(i.max));}
 try{const raw=localStorage.getItem(key);if(raw){const saved=JSON.parse(raw);if(valid(saved)){use(saved.values);feedback.textContent='Saved sliders restored.';}else feedback.textContent='Saved settings were invalid; defaults are ready.';}}catch{feedback.textContent='Saved settings could not be read; controls still work.';}
 inputs.forEach(i=>i.addEventListener('input',()=>feedback.textContent='Unsaved adjustments.'));
 document.querySelector('#save-look').onclick=()=>{try{const values=Object.fromEntries(inputs.map(i=>[i.id,Number(i.value)]));localStorage.setItem(key,JSON.stringify({version:1,values}));feedback.textContent='Sliders saved in this browser.';}catch{feedback.textContent='Saving is unavailable in this browser; your current adjustments are still active.';}};
 document.querySelector('#reset-look').onclick=()=>{use(defaults);try{localStorage.removeItem(key);feedback.textContent='Default sliders restored; saved preset cleared.';}catch{feedback.textContent='Default sliders restored for this visit; saved preset could not be cleared.';}};
}
