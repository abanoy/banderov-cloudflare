import {proposeGalleryBridges} from './court-gallery-bridges.mjs';
export function proposeGatewayAccess(layout,gateway){return proposeGalleryBridges(layout,{id:'floor-gateway-access',cluster:[gateway]}).map(p=>({pieces:p.pieces,from:p.from,to:p.to}));}
