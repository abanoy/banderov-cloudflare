// Optional local review parameters shared by workshop and movement courtyard.
// Keep production defaults in chibi8.js; never mutate its authored geometry.
function chibiEyeStudy(character,choice='current'){
 if(choice==='current'||character.paper!=='brown'||character.expression!=='neutral'||character.faceForm==='previous')return character;
 const geometry=character.geometry||BROWN_MARIA_GEOMETRY;
 if((character.headForm??geometry.headBasis.shape)!=='round-circle')return character;
 if(!['narrow','deep'].includes(choice))throw new TypeError('Unknown eye study: '+choice);
 const copy=JSON.parse(JSON.stringify(geometry)),deep=choice==='deep';
 copy.headBasis.faceStyle.irisHeight=deep?.75:.52;
 return {...character,geometry:copy,paperEyeOpening:deep?1.05:.74};
}
