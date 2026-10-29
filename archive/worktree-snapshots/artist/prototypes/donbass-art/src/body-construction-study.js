// Local comparison only. Never mutate canonical or imported geometry.
// Save the returned complete character for exact editable replay.
function chibiBodyConstructionStudy(character,choice='current'){
 if(choice==='current'||character.paper!=='brown'||!['sailor','whiteBlouse'].includes(character.outfit))return character;
 if(!['compact','taller'].includes(choice))throw new TypeError('Unknown body construction');
 const geometry=JSON.parse(JSON.stringify(character.geometry||BROWN_MARIA_GEOMETRY));
 const compact=choice==='compact';
 geometry.outfits.sailor.bodyScale=compact?.82:.88;
 geometry.outfits.whiteBlouse.bodyScale=compact?.90:.96;
 return {...character,geometry,bodyScaleX:(character.bodyScaleX??1)*(compact?1.16:1.28)};
}
