import {iconStateSVG,statePalettes} from './states.mjs';

/** Mount on a real <button>. The browser owns activation, focus and disabled behavior.
 * Import native-button.css with this module. update() retains the button/focus.
 * dispose() removes the activation listener; the caller owns the DOM element.
 */
export function mountIconButton(button,initial){
 if(button.tagName!=='BUTTON')throw new Error('A native button is required');
 let options={icon:'back',size:24,theme:'light',label:'Back',iconOnly:false,disabled:false,...initial};
 const activate=event=>{if(!button.disabled)options.onActivate?.(event);};
 function update(next={}){
  const candidate={...options,...next};
  if(![16,24,32].includes(candidate.size))throw new Error('Use native16,24 or32px artwork');
  if(!candidate.label)throw new Error('Give the button an accessible action name');
  const paint=statePalettes[candidate.theme];if(!paint)throw new Error('Unknown paper theme');
  const artwork=['normal','hover','pressed','disabled'].map(state=>
   '<span class="native-art" data-state="'+state+'">'+iconStateSVG(candidate.icon,{size:candidate.size,theme:candidate.theme,state}).replace('role="img"','aria-hidden="true"')+'</span>').join('');
  options=candidate;
  button.type='button';button.classList.add('native-icon-button');button.disabled=!!options.disabled;
  button.setAttribute('aria-label',options.label);button.dataset.paper=options.theme;
  for(const [state,colours] of Object.entries(paint))for(const [part,colour] of Object.entries(colours))button.style.setProperty('--'+state+'-'+part,colour);
  button.style.setProperty('--native-size',options.size+'px');
  button.innerHTML='<span class="native-button-icon" aria-hidden="true">'+artwork+'</span>';
  if(!options.iconOnly){const label=button.ownerDocument.createElement('span');label.textContent=options.label;button.append(label);}
 }
 update();button.addEventListener('click',activate);return {update,dispose(){button.removeEventListener('click',activate);}};
}
