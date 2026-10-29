import {castleRouteGoals} from '../floating-castle/castle-navigation.js?v=route-goals-1';
export function captureOriginalGoals(layout){return castleRouteGoals(layout).map(o=>({...o,id:'original-'+o.id}));}
