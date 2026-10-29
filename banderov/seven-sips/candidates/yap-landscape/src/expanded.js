// Expanded month state. Quick Match's checkpoint and collection stay separate.
var SevenExpanded = (() => {
  const LIMIT=5, FIRST=8, LAST=28, START_COINS=40, DATE_COST=20, SHIFT_HOURS=3, MEET_HOUR=19, MISS_LOSS=12, POINTS_PER_COIN=3, MAX_SHIFT_PAY=20, DATE_BONUS=3, DATE_GOAL=7;
  const won=(save,keys)=>keys.filter(k=>Number.isSafeInteger(save.endings?.['win:'+k])&&save.endings['win:'+k]>0);
  const ended=s=>s.hearts===0||s.day>LAST;
  const completed=s=>s.day>LAST&&s.hearts>0&&s.dates>=s.dateGoal;
  function clean(raw,winners) {
    const slots=[], ids=new Set();
    if ([1,2,3].includes(raw?.v)&&Array.isArray(raw.slots)) for(const s of raw.slots.slice(0,50)) {
      if(slots.length===LIMIT) break;
      if(!s||!Number.isSafeInteger(s.id)||s.id<1||s.id>LIMIT||ids.has(s.id)||!winners.includes(s.key)
        ||!Number.isInteger(s.day)||s.day<FIRST||s.day>LAST+1||!Number.isFinite(s.hearts)||s.hearts<0||s.hearts>130) continue;
      const days=s.day-FIRST, legacy=raw.v===1;
      const coins=legacy?START_COINS:s.coins, hour=legacy?9:s.hour;
      const dates=legacy?0:s.dates, hangouts=legacy?days:s.hangouts, missed=legacy?0:s.missed;
      const dateGoal=raw.v===3?s.dateGoal:0; // Earlier plans retain their original completion rules.
      if(!Number.isSafeInteger(coins)||coins<0||coins>100000||![9,12,15,18].includes(hour)
        ||![dates,hangouts,missed].every(n=>Number.isInteger(n)&&n>=0&&n<=21)
        ||![0,DATE_GOAL].includes(dateGoal)||dates+hangouts+missed!==days||s.exchanges!==(dates+hangouts)*3) continue;
      ids.add(s.id); slots.push({id:s.id,key:s.key,day:s.day,hearts:s.hearts,exchanges:s.exchanges,coins,hour,dates,hangouts,missed,dateGoal});
    }
    const latest=raw?.latest;
    return {v:3,slots,latest:latest&&winners.includes(latest.key)&&Number.isFinite(latest.hearts)&&latest.hearts>=100&&latest.hearts<=130?{key:latest.key,hearts:latest.hearts}:null};
  }
  function add(state,key,winners) {
    if(!winners.includes(key)||state.slots.length>=LIMIT) return null;
    let id=1; while(state.slots.some(s=>s.id===id)) id++;
    const slot={id,key,day:FIRST,hearts:state.latest?.key===key?state.latest.hearts:100,exchanges:0,coins:START_COINS,hour:9,dates:0,hangouts:0,missed:0,dateGoal:DATE_GOAL};
    state.slots.push(slot); return slot;
  }
  function advance(state,id,day,hearts,kind='hangout') {
    const s=state.slots.find(s=>s.id===id);
    if(!s||s.day!==day||ended(s)||!Number.isFinite(hearts)||!['date','hangout','missed'].includes(kind)
      ||kind==='date'&&(s.coins<DATE_COST||s.hour>MEET_HOUR)) return false;
    s.day++; s.hearts=Math.max(0,Math.min(130,hearts+(kind==='date'&&hearts>0?DATE_BONUS:0)));
    if(kind==='date'){s.coins-=DATE_COST;s.dates++;}
    else if(kind==='hangout')s.hangouts++;
    else s.missed++;
    if(kind!=='missed')s.exchanges+=3;
    s.hour=9; return true;
  }
  function work(state,id,day,hour,points) {
    const s=state.slots.find(s=>s.id===id);
    if(!s||ended(s)||s.day!==day||s.hour!==hour||!Number.isInteger(points)||points<0||points>MAX_SHIFT_PAY*POINTS_PER_COIN) return null;
    const earned=Math.floor(points/POINTS_PER_COIN); s.coins=Math.min(100000,s.coins+earned); s.hour+=SHIFT_HOURS;
    const late=s.hour>MEET_HOUR;
    if(late)advance(state,id,day,s.hearts-MISS_LOSS,'missed');
    return {earned,late};
  }

  // Days8–28: three newly authored prompts/day; response tone keeps original likes/scoring.
  const scenes=[["A new routine","Same table, another week. What should our new routine be?","Our usual seats are taken. How do we handle it?","We found a quieter corner. What will you remember?"],["Bakery window","The bakery is testing a new pastry. Want to be taste testers?","The first batch came out lopsided. Is it still worth trying?","They gave us the last little heart-shaped bun. Your verdict?"],["Rain check","Rain all afternoon. What should we do with our plans?","My umbrella has one broken spoke. Now what?","The rain stopped just as we got inside. Was the walk worth it?"],["Bookshop notes","There is a handwritten recommendation shelf at the bookshop. Interested?","We picked completely different books. Is that a problem?","Someone left a tiny drawing between the pages. What do you think?"],["A small favour","A neighbour needs help carrying some boxes. Should we stop?","One box is labelled FRAGILE in enormous letters. Who gets that one?","The neighbour thanked us with biscuits. Good afternoon?"],["River route","The river path has reopened. Shall we explore it?","We missed the turn and reached a muddy patch. Your plan?","We found the bridge by following the sound of bicycles. Favourite part?"],["Two weeks","Two weeks since we met. What should we celebrate?","I cannot remember every word from our first conversation. Can you?","I remember how you made me feel. What has changed for you?"],["Music swap","We both brought a favourite song. Who plays theirs first?","Our playlists have almost nothing in common. What now?","There was one song we both liked. What should we call our playlist?"],["Market morning","The market has a stall selling mystery fruit. Curious?","The seller will only say it is sour. Still interested?","It was much sweeter than expected. Any lessons from that?"],["Photo walk","The light outside is lovely. Shall we go looking for a photo?","A pigeon walked straight into the shot. Retake it?","The accidental photo looks better than the careful one. Keep it?"],["Different opinions","We disagree about the film we saw. Want to compare notes?","My favourite scene is the one you disliked. Does that bother you?","We still enjoyed talking about it. What makes a good disagreement?"],["A tired afternoon","I am tired today. Could we keep things simple?","Everyone seems to have a bigger plan than ours. Should we change it?","Sitting here quietly helped. Did you need a quiet day too?"],["Little goals","What is one small thing you would like to learn this week?","Learning it is harder than it looked. What would you tell me?","I finally managed the first step. Should that count as progress?"],["Three weeks","Three weeks already. What have you noticed about us?","I still sometimes need time to myself. Is that okay?","It is nice to be able to say that. What helps you feel comfortable?"],["Kitchen experiment","We could try making something instead of buying it. Ideas?","The recipe calls for a tool neither of us owns. Do we improvise?","It looks unusual but tastes good. What should we name it?"],["Hidden courtyard","I heard there is a tiny courtyard behind these buildings. Explore?","The gate is marked private. How should we handle that?","We found a public garden instead. Better choice?"],["An awkward moment","I made an awkward joke earlier. Did it land badly?","I would rather you tell me than pretend. What do you think?","Thanks for hearing me out. How do we move past awkward moments?"],["Change of plans","The place we wanted to visit is closed. Backup plan?","I was looking forward to it. Can I be disappointed for a minute?","We found something else to enjoy. What saved the afternoon?"],["A kindness remembered","Someone remembered my usual order today. Why did that feel nice?","I worry that I forget little details about people. Any advice?","You remembered something small about me. What made it stick?"],["Looking ahead","What is a small plan you would like us to make next?","We cannot fit every idea into one week. How should we choose?","One realistic plan feels better than ten promises. Agree?"],["A month together","A month since we first met. What stands out for you?","There were awkward days as well as good ones. Was it worth it?","I am glad we kept making time. What would you like to say now?"]];
  const voices={"The Unimpressed": "No small talk today. ", "The Waitress": "My shift is over. ", "The Scientist": "New hypothesis: ", "Maria": "Do not make a big deal of this. ", "The Doll": "If you would be so kind: ", "The Sunhat": "Come on, this could be fun! ", "The Princess": "A proposal for the court: ", "The Android": "New shared experience: "};
  const answersByDay={
  "8": [
    {
      "sweet": "A regular little meeting, with room to change our plans.",
      "polite": "Shall we choose a regular time and place that suits us both?",
      "smart": "A regular meeting spot would make planning easier.",
      "funny": "Same table, fewer dramatic chair negotiations.",
      "bold": "Let's pick our spot. I'll make time.",
      "weird": "A weekly summit of two friendly earthlings.",
      "cringe": "Every second together, forever!",
      "rude": "Whatever takes the least effort."
    },
    {
      "sweet": "Another table is fine. I'm here for you.",
      "polite": "Let's look for another seat without disturbing anyone.",
      "smart": "Find a free table; the company hasn't changed.",
      "funny": "Our chairs have betrayed us. On to the next table.",
      "bold": "Let's find another table and get comfortable.",
      "weird": "Time to establish our backup lunar base.",
      "cringe": "Demand our destined seats back!",
      "rude": "Tell those people to move. I want our table."
    },
    {
      "sweet": "I'll remember being close to you in that quiet corner.",
      "polite": "The peaceful corner, and your company. Thank you.",
      "smart": "We adapted our routine without losing what mattered.",
      "funny": "Our dramatic victory over a shortage of chairs.",
      "bold": "Finding a place for us. I'd do it again.",
      "weird": "The corner where two undercover moon explorers landed.",
      "cringe": "The sacred corner where our eternal destiny began!",
      "rude": "Nothing. It was just a table."
    }
  ],
  "9": [
    {
      "sweet": "Yes. I'd love to try something new with you.",
      "polite": "Yes, if they're offering samples. Let's ask.",
      "smart": "Yes. We can compare flavour and texture.",
      "funny": "Yes. I accept this extremely delicious research grant.",
      "bold": "I'm in. Let's try the new pastry.",
      "weird": "Yes. My pastry-detective hat is ready.",
      "cringe": "Yes! Every bite will seal our eternal bond!",
      "rude": "No. This sounds boring."
    },
    {
      "sweet": "Yes. It doesn't need to look perfect to be lovely.",
      "polite": "I'd try it if the baker says it's ready.",
      "smart": "Shape alone doesn't tell us how it tastes.",
      "funny": "Yes. A crooked pastry deserves a straight answer.",
      "bold": "Give it a chance. Looks aren't everything.",
      "weird": "Yes. Perhaps it bends toward a secret pastry dimension.",
      "cringe": "Yes! Its shape is a sign from our cosmic destiny!",
      "rude": "No. Anything that ugly belongs in the bin."
    },
    {
      "sweet": "It's lovely. Sharing it makes it even better.",
      "polite": "A little uneven, but very good. My compliments to the baker.",
      "smart": "Good flavour matters more than perfect symmetry.",
      "funny": "A heart-shaped bun with excellent emotional complexity.",
      "bold": "Delicious. I'd order another.",
      "weird": "A tasty message from a slightly crooked pastry planet.",
      "cringe": "A flawless symbol of our eternal cosmic love!",
      "rude": "It looks ridiculous. They should have thrown it out."
    }
  ],
  "10": [
    {
      "sweet": "A short walk together, then somewhere warm.",
      "polite": "Would a short walk and a warm drink suit you?",
      "smart": "Keep the walk short and choose a sheltered route.",
      "funny": "A short walk. My socks have a strict rain budget.",
      "bold": "Let's take a short walk, then dry off.",
      "weird": "A brief expedition through the cloud aquarium.",
      "cringe": "Walk all day! Our love will keep us magically dry!",
      "rude": "Forget the plans. Rain ruins everything."
    },
    {
      "sweet": "We can share the working side and keep the walk short.",
      "polite": "Let's share what shelter it gives us and head inside soon.",
      "smart": "Keep the broken spoke away from us and find shelter.",
      "funny": "Share the working half. The other half is on holiday.",
      "bold": "Let's get under the good side and head for shelter.",
      "weird": "Our umbrella ship needs a quick return to port.",
      "cringe": "Throw it away! Destiny will shield us!",
      "rude": "Buy a better umbrella. This is your fault."
    },
    {
      "sweet": "Yes. Even a rainy walk feels warmer with you.",
      "polite": "Yes, thank you for sharing your umbrella.",
      "smart": "Yes. We found a workable plan despite the weather.",
      "funny": "Yes. My socks disagree, but they never get a vote.",
      "bold": "Absolutely. A little rain wouldn't stop me.",
      "weird": "Yes. We completed our amphibious training mission.",
      "cringe": "Yes! Our destined love commands the clouds!",
      "rude": "No. You made me get wet for nothing."
    }
  ],
  "11": [
    {
      "sweet": "Yes. I'd like to see which recommendation catches your eye.",
      "polite": "Yes, let's browse without disturbing the notes.",
      "smart": "Yes. I'm curious what readers recommend and why.",
      "funny": "Yes. Finally, books with handwritten sales pitches.",
      "bold": "Let's take a look. Pick one that interests you.",
      "weird": "Yes. A secret council of book people has left clues.",
      "cringe": "Yes! We'll find the book that foretells our love!",
      "rude": "No. Other people's opinions are tedious."
    },
    {
      "sweet": "Not at all. I'd like to hear what you found.",
      "polite": "No. We can compare them without needing the same taste.",
      "smart": "Different choices give us more to discuss.",
      "funny": "No. Our books can politely disagree on the shelf.",
      "bold": "No problem. Tell me why you chose yours.",
      "weird": "Two different portals are better than one.",
      "cringe": "Yes! Destined soulmates must choose identical books!",
      "rude": "Yes. Your choice is obviously worse."
    },
    {
      "sweet": "It's a lovely little surprise to find together.",
      "polite": "How thoughtful. I'd leave it for the next reader to enjoy.",
      "smart": "One small drawing can give a book a second story.",
      "funny": "The book has hired a very small illustrator.",
      "bold": "I like it. A good reason to look more closely.",
      "weird": "Clearly a secret map for a paper-sized dragon.",
      "cringe": "It's a sign that the universe approves of us!",
      "rude": "Someone scribbled in a book. Big deal."
    }
  ],
  "12": [
    {
      "sweet": "Yes. Let's ask what help they need.",
      "polite": "Let's offer, if they'd welcome a hand.",
      "smart": "Yes. Check which boxes we can comfortably carry.",
      "funny": "Yes. My career in professional box relocation begins.",
      "bold": "Let's stop and lend a hand.",
      "weird": "Yes. The cardboard migration needs escorts.",
      "cringe": "Yes! They'll witness our perfect destined teamwork!",
      "rude": "No. That's their problem."
    },
    {
      "sweet": "I'll take it carefully, if you're comfortable with the others.",
      "polite": "May I take that one? I'll keep it steady.",
      "smart": "Whoever can keep it level; we can ask how best to carry it.",
      "funny": "I'll take it. My juggling career is officially suspended.",
      "bold": "I'll carry it carefully. No rushing.",
      "weird": "I'll guard the tiny glass kingdom inside.",
      "cringe": "I'll toss it to you! Our cosmic bond will catch it!",
      "rude": "Give it to me. Labels are pointless."
    },
    {
      "sweet": "Yes. We helped someone and spent time together.",
      "polite": "Very good. The biscuits were a kind thank-you.",
      "smart": "Yes. A small effort made someone's afternoon easier.",
      "funny": "Excellent. My biscuit-based payment plan is working.",
      "bold": "Yes. I'm glad we stopped to help.",
      "weird": "Yes. The biscuit council has rewarded our service.",
      "cringe": "Perfect! Everyone can see we're eternal soulmates!",
      "rude": "No. Carrying boxes was a waste of time."
    }
  ],
  "13": [
    {
      "sweet": "Yes. I'd love a quiet walk along the river with you.",
      "polite": "Yes, if the reopened path is safe to use.",
      "smart": "Let's follow the marked route and see where it leads.",
      "funny": "Yes. My very serious river inspector badge is imaginary.",
      "bold": "Let's go. I'm curious what's changed.",
      "weird": "Yes. We can inspect the river's secret sky mirror.",
      "cringe": "Yes! The river must lead to our eternal destiny!",
      "rude": "No. It's just water."
    },
    {
      "sweet": "Let's find a dry route. There's no need to struggle.",
      "polite": "Shall we turn back to the last marked path?",
      "smart": "Return to the last known turn and take the dry route.",
      "funny": "Let's retreat before the mud appoints us permanent residents.",
      "bold": "Back to the last turn. We'll find a better way.",
      "weird": "The mud kingdom can keep its invitation. Let's take dry ground.",
      "cringe": "Charge through! Destiny won't let us slip!",
      "rude": "You got us lost. Sort it out yourself."
    },
    {
      "sweet": "Walking beside you, even when we took the wrong turn.",
      "polite": "The bridge. Thank you for exploring with me.",
      "smart": "Finding the route by listening, rather than guessing again.",
      "funny": "The moment our mud expedition became a bridge expedition.",
      "bold": "Making the detour work. We didn't give up.",
      "weird": "The bicycle chorus guiding us to its mysterious bridge.",
      "cringe": "Every step proved our cosmic destinies are intertwined!",
      "rude": "Finally finding the exit from this boring walk."
    }
  ],
  "14": [
    {
      "sweet": "That we keep choosing to spend time together.",
      "polite": "Our second week, and getting to know each other better.",
      "smart": "The small routines we've started to build.",
      "funny": "Two weeks of surviving my jokes. A remarkable achievement.",
      "bold": "Making time for each other. Let's mark it.",
      "weird": "Two weeks of peaceful contact between our strange planets.",
      "cringe": "Our inevitable eternal marriage, obviously!",
      "rude": "Nothing. It's only been two weeks."
    },
    {
      "sweet": "Not every word. I remember feeling glad to be with you.",
      "polite": "Not all of it, but I remember enjoying your company.",
      "smart": "No. The feeling and key moments stayed more than exact words.",
      "funny": "No. My brain forgot to appoint a stenographer.",
      "bold": "Not every word. Enough to know I wanted another conversation.",
      "weird": "Only the bits my tiny memory librarian put on the top shelf.",
      "cringe": "Every syllable! I replay it every minute forever!",
      "rude": "No. It wasn't interesting enough."
    },
    {
      "sweet": "I feel more at ease with you now.",
      "polite": "I'm more comfortable saying what I think. Thank you.",
      "smart": "I understand more of what matters to you.",
      "funny": "I need fewer emergency jokes to survive a silence.",
      "bold": "I know I want to keep making time for you.",
      "weird": "My inner alien has stopped wearing its formal disguise.",
      "cringe": "I've realised we must spend every second together forever!",
      "rude": "Nothing. Two weeks haven't made you more interesting."
    }
  ],
  "15": [
    {
      "sweet": "You first. I'd like to hear what you love about it.",
      "polite": "Would you like to go first? I'll listen.",
      "smart": "You first, then mine. We can compare what we notice.",
      "funny": "You first. My song is rehearsing its grand entrance.",
      "bold": "I'll go first, then you get your turn.",
      "weird": "You first. Let's tune our two personal radio planets.",
      "cringe": "Mine first! It's our cosmic wedding song!",
      "rude": "Mine. Your music can wait."
    },
    {
      "sweet": "We can still enjoy hearing what matters to each other.",
      "polite": "Let's give each playlist a fair listen.",
      "smart": "Compare one song each instead of forcing matching tastes.",
      "funny": "Our playlists can negotiate a musical ceasefire.",
      "bold": "Different is fine. Play me your favourite.",
      "weird": "Let's build a bridge between our distant sound planets.",
      "cringe": "Replace yours with mine so our souls can finally match!",
      "rude": "Your playlist is the problem."
    },
    {
      "sweet": "Call it Our Little Soundtrack.",
      "polite": "How about Shared Favourites, if you like that?",
      "smart": "Common Ground fits the one song we both liked.",
      "funny": "Musical Diplomacy. The negotiations were intense.",
      "bold": "Our Song. I'm claiming it.",
      "weird": "Songs for Two Earthlings and One Imaginary Moon.",
      "cringe": "The Eternal Soundtrack of Our Cosmic Destiny!",
      "rude": "Who cares? It's only a playlist."
    }
  ],
  "16": [
    {
      "sweet": "Yes. Let's ask about it and have a look together.",
      "polite": "Yes. We could ask the seller what it is.",
      "smart": "Yes. I'd like to learn what variety it is.",
      "funny": "Yes. Finally, fruit with a mysterious backstory.",
      "bold": "Let's take a look and ask about it.",
      "weird": "Yes. It may be a visitor from the fruit moon.",
      "cringe": "Yes! That fruit is a sign of our destined love!",
      "rude": "No. Mystery fruit sounds stupid."
    },
    {
      "sweet": "A little curious. Let's ask what it tastes like before deciding.",
      "polite": "Perhaps. Could we ask for a little more information?",
      "smart": "Ask what it is and whether a taste is available first.",
      "funny": "Interested, but my taste buds would like a briefing.",
      "bold": "Let's find out more before buying it.",
      "weird": "Perhaps its sour disguise hides a secret identity.",
      "cringe": "Buy it all! Our destiny will make it sweet!",
      "rude": "No. That seller is wasting our time."
    },
    {
      "sweet": "Trying something new is nicer with you.",
      "polite": "It helped to ask before choosing.",
      "smart": "A description is a clue, not a guarantee.",
      "funny": "The fruit has a better poker face than I do.",
      "bold": "I'm glad we gave it a chance.",
      "weird": "The fruit was clearly wearing a sour disguise.",
      "cringe": "Even the fruit approves of our cosmic destiny!",
      "rude": "We wasted time talking about fruit."
    }
  ],
  "17": [
    {
      "sweet": "Yes. I'd love to capture a little moment with you.",
      "polite": "Yes. Let's find a nice spot without blocking anyone.",
      "smart": "Yes. Look for an interesting composition in this light.",
      "funny": "Yes. My camera needs evidence that we went outside.",
      "bold": "Let's go find a shot worth keeping.",
      "weird": "Yes. Let's collect a rectangle of Earth's lovely light.",
      "cringe": "Yes! Every photograph must celebrate our cosmic love!",
      "rude": "No. Taking photos is a waste of time."
    },
    {
      "sweet": "Let's keep this one too. The surprise is rather sweet.",
      "polite": "May we keep it and take another for comparison?",
      "smart": "Keep it, then compare it with a shot without the pigeon.",
      "funny": "No. The pigeon has clearly earned its leading role.",
      "bold": "Keep it. That bird committed to the shot.",
      "weird": "No. Our feathered photo spirit has arrived.",
      "cringe": "No! It's the sacred messenger of our eternal bond!",
      "rude": "Delete it. Stupid bird ruined everything."
    },
    {
      "sweet": "Yes. It reminds me of a lovely afternoon with you.",
      "polite": "Yes, if you like it too. It's a good photograph.",
      "smart": "Yes. An unplanned detail made the composition more interesting.",
      "funny": "Yes. The pigeon has already signed its modelling contract.",
      "bold": "Keep it. The accident made it better.",
      "weird": "Yes. Our feathered ambassador deserves an official portrait.",
      "cringe": "Yes! The pigeon is the sacred witness to our love!",
      "rude": "Delete it. It's only a stupid bird."
    }
  ],
  "18": [
    {
      "sweet": "Yes. I'd like to understand what you enjoyed.",
      "polite": "Yes. Let's compare without dismissing each other's views.",
      "smart": "Yes. Which details led us to different conclusions?",
      "funny": "Yes. The popcorn jury is ready to hear both sides.",
      "bold": "Let's compare. I can handle a different opinion.",
      "weird": "Yes. Two brain planets have filed conflicting film reports.",
      "cringe": "No need! Our destined minds must secretly agree!",
      "rude": "No. My opinion is right."
    },
    {
      "sweet": "No. I can like you without liking every scene you like.",
      "polite": "Not at all. I'd like to hear why it worked for you.",
      "smart": "No. Different interpretations are useful to compare.",
      "funny": "No. The film can survive being reviewed twice.",
      "bold": "No. Tell me what I missed.",
      "weird": "No. Our brain projectors use different lenses.",
      "cringe": "Yes! You must agree with your eternal soulmate!",
      "rude": "Yes. You clearly didn't understand the film."
    },
    {
      "sweet": "Knowing we can disagree and still care about each other.",
      "polite": "Listening without making the other person feel foolish.",
      "smart": "Comparing reasons instead of trying to win.",
      "funny": "Leaving the popcorn out of the cross-examination.",
      "bold": "Saying what we think without taking cheap shots.",
      "weird": "Letting two different brain planets share an orbit.",
      "cringe": "Agreeing with me, because our destined minds are one!",
      "rude": "Admitting I'm right so we can stop talking."
    }
  ],
  "19": [
    {
      "sweet": "Of course. We can just sit somewhere quiet.",
      "polite": "Certainly. Would a quiet seat and a drink suit you?",
      "smart": "Yes. A simple plan leaves room to rest.",
      "funny": "Yes. I'll cancel the imaginary parade.",
      "bold": "Keep it simple. We don't need a grand plan.",
      "weird": "Yes. Our little space station can enter quiet mode.",
      "cringe": "No! Every moment of our destined love must be spectacular!",
      "rude": "If you're tired, why did you bother coming?"
    },
    {
      "sweet": "No. A small, peaceful afternoon with you is enough.",
      "polite": "Only if you want to. Our plan doesn't need to match theirs.",
      "smart": "No. Their plans don't determine what works for us.",
      "funny": "No. We're not entering the competitive afternoon championships.",
      "bold": "Keep our plan. It's ours.",
      "weird": "No. Their adventure planets can orbit somewhere else.",
      "cringe": "Yes! We must prove our love is grander than everyone else's!",
      "rude": "Yes. Our plan looks pathetic compared with theirs."
    },
    {
      "sweet": "Yes. Being quietly here with you was just what I needed.",
      "polite": "Yes, thank you. A quiet afternoon helped me too.",
      "smart": "Yes. Rest is useful even when there is no big plan.",
      "funny": "Yes. My enthusiasm had put up a Gone Fishing sign.",
      "bold": "Yes. I'm glad we kept things simple.",
      "weird": "Yes. My inner space hamster needed a nap.",
      "cringe": "Yes, but I'll never need rest when our love powers me!",
      "rude": "No. Sitting around was boring."
    }
  ],
  "20": [
    {
      "sweet": "I'd like to learn a simple recipe we could enjoy together.",
      "polite": "I'd like to learn a few words in another language.",
      "smart": "I'd like to learn how to identify one constellation.",
      "funny": "I'd like to learn one joke that doesn't need explaining.",
      "bold": "I'd like to learn a simple rhythm and get it right.",
      "weird": "I'd like to draw a respectable portrait of an imaginary moon creature.",
      "cringe": "I'd like to learn every detail about you by tomorrow!",
      "rude": "Nothing. Learning new things is too much effort."
    },
    {
      "sweet": "Take your time. I'm glad you're giving it a try.",
      "polite": "Start with one manageable step and give yourself time.",
      "smart": "Break it into smaller steps and practise the first one.",
      "funny": "Even the tiny victory parade needs rehearsal.",
      "bold": "Try the first step again. You don't need to master it today.",
      "weird": "Even a moon creature learns to wobble before it walks.",
      "cringe": "Our destined bond should make you perfect already!",
      "rude": "If it's hard, you're probably bad at it."
    },
    {
      "sweet": "Of course. I'm happy you kept trying.",
      "polite": "Yes. You deserve credit for taking that first step.",
      "smart": "Yes. A repeatable first step is measurable progress.",
      "funny": "Yes. The tiny victory parade starts immediately.",
      "bold": "Absolutely. You did something you couldn't do before.",
      "weird": "Yes. One small step for you, one giant leap for tiny moon beings.",
      "cringe": "Yes! Your success proves our eternal cosmic perfection!",
      "rude": "No. One little step is nothing."
    }
  ],
  "21": [
    {
      "sweet": "We seem more comfortable being ourselves around each other.",
      "polite": "We're getting better at saying what we need.",
      "smart": "We've started to notice each other's preferences.",
      "funny": "Our silences no longer need emergency joke repairs.",
      "bold": "We keep showing up. I like that.",
      "weird": "Our two strange planets have found a friendlier orbit.",
      "cringe": "We're obviously ready to spend every second together forever!",
      "rude": "You're still hard work, honestly."
    },
    {
      "sweet": "Of course. Take the time you need; I'll be glad to see you when you're ready.",
      "polite": "Certainly. Just let me know what works for you.",
      "smart": "Yes. Time apart can give both of us room to recharge.",
      "funny": "Yes. I'll give my imaginary calendar a day off too.",
      "bold": "Absolutely. We can both have our own time.",
      "weird": "Yes. Even friendly planets need their own little orbits.",
      "cringe": "No! Eternal soulmates must never be apart!",
      "rude": "Do whatever you want. I don't care."
    },
    {
      "sweet": "Being able to be honest without losing your kindness.",
      "polite": "Knowing we can ask for space and have it respected.",
      "smart": "Clear expectations, and room to say when they need changing.",
      "funny": "Knowing a quiet moment won't trigger an emergency meeting.",
      "bold": "Being myself, and knowing you can do the same.",
      "weird": "Knowing my inner alien can take its helmet off here.",
      "cringe": "Knowing we'll never spend a single moment apart again!",
      "rude": "You doing what I want without complaining."
    }
  ],
  "22": [
    {
      "sweet": "A simple snack we can make side by side.",
      "polite": "Perhaps a simple recipe using what we already have.",
      "smart": "Choose a recipe that suits our ingredients and tools.",
      "funny": "Something simple enough to survive my dramatic stirring.",
      "bold": "Let's choose an easy recipe and give it a go.",
      "weird": "A modest feast for two visiting kitchen aliens.",
      "cringe": "A grand seven-course feast worthy of our eternal bond!",
      "rude": "Why bother? Your cooking will probably be awful."
    },
    {
      "sweet": "Let's choose something we can make comfortably with our tools.",
      "polite": "Could we switch to a recipe that uses what we have?",
      "smart": "Check what the tool does; choose another recipe if we need it.",
      "funny": "Let's retire this recipe before the spoons form a rescue team.",
      "bold": "Pick a recipe we have the tools for. No need to force it.",
      "weird": "Our kitchen spaceship needs a mission it can actually fly.",
      "cringe": "Use anything! Our cosmic love makes every tool safe!",
      "rude": "Ignore it. Recipe instructions are pointless."
    },
    {
      "sweet": "Our Little Kitchen Victory.",
      "polite": "A Happy Experiment, perhaps?",
      "smart": "Successful Improvisation. The taste is the evidence.",
      "funny": "Looks Questionable, Tastes Excellent.",
      "bold": "The House Special. We made it work.",
      "weird": "An Edible Visitor from Planet Biscuit.",
      "cringe": "Our Eternal Love Feast!",
      "rude": "Kitchen Disaster. It looks awful."
    }
  ],
  "23": [
    {
      "sweet": "Let's have a look from the public paths.",
      "polite": "Yes, if it's open to visitors. Let's check.",
      "smart": "Let's check access before choosing a route.",
      "funny": "Yes. My tiny garden explorer badge is mostly imaginary.",
      "bold": "Let's see whether it's open to the public.",
      "weird": "Let's seek the secret flower planet from permitted paths.",
      "cringe": "Yes! No gate can keep our destined love out!",
      "rude": "It sounds boring, but fine."
    },
    {
      "sweet": "Let's leave it alone and find somewhere we can relax freely.",
      "polite": "Respect the sign. Perhaps there's a public garden nearby.",
      "smart": "Don't enter. Look for a public route or garden instead.",
      "funny": "Let's avoid earning a very unromantic trespassing complaint.",
      "bold": "Leave the gate closed. We'll find a public place.",
      "weird": "That garden planet hasn't granted landing permission.",
      "cringe": "Enter anyway! Our eternal love outranks private signs!",
      "rude": "Ignore it. Nobody will notice."
    },
    {
      "sweet": "Yes. I'm glad we found somewhere we could relax together.",
      "polite": "Yes. We can enjoy it without intruding on anyone.",
      "smart": "Yes. A public garden solves the access problem.",
      "funny": "Yes. Fewer trespassing charges, more flowers.",
      "bold": "Definitely. This was the right call.",
      "weird": "Yes. The public flowers have granted us landing permission.",
      "cringe": "Yes! This garden was planted for our destined love!",
      "rude": "No. We should have ignored the private sign."
    }
  ],
  "24": [
    {
      "sweet": "A little. I'd rather talk it through than leave you guessing.",
      "polite": "It felt awkward, yes. Thank you for asking.",
      "smart": "It didn't land as intended. We can work out why.",
      "funny": "A bit. That joke may need a quieter second career.",
      "bold": "Yes, a little. We can be honest about it.",
      "weird": "A little. The joke spaceship missed its landing pad.",
      "cringe": "Nothing you say could ever upset your eternal soulmate!",
      "rude": "Yes. Your jokes are terrible."
    },
    {
      "sweet": "It felt off, but I'm glad you asked how it came across.",
      "polite": "I agree. An honest answer is kinder than pretending.",
      "smart": "Honesty helps us understand the gap between intent and impact.",
      "funny": "Fair. I'll spare the joke a fake standing ovation.",
      "bold": "Then I'll be direct: it felt awkward, and we can move on.",
      "weird": "Let's give the joke an honest report from mission control.",
      "cringe": "I think our cosmic bond means you should always agree with me!",
      "rude": "I think you should stop talking if you can't make a decent joke."
    },
    {
      "sweet": "Listen, be kind, and give each other room to try again.",
      "polite": "Say what felt wrong, and respect the answer.",
      "smart": "Understand what went wrong before repeating it.",
      "funny": "Retire that joke and let it pursue a quieter career.",
      "bold": "Own it, apologise, and do better next time.",
      "weird": "Put the joke in a tiny museum of things not to repeat.",
      "cringe": "Our cosmic bond makes apologies unnecessary!",
      "rude": "Get over it. It's just a joke."
    }
  ],
  "25": [
    {
      "sweet": "Let's find somewhere simple where we can still enjoy being together.",
      "polite": "Would a walk or a quiet café suit you instead?",
      "smart": "Pick an open place nearby that fits our time and budget.",
      "funny": "Time to promote our understudy plan to the starring role.",
      "bold": "Let's choose a nearby alternative and make it work.",
      "weird": "Our adventure goblin can scout a public backup route.",
      "cringe": "Demand they open! Our eternal date cannot be interrupted!",
      "rude": "Go home. This afternoon is ruined."
    },
    {
      "sweet": "Of course. You don't need to pretend you're not disappointed.",
      "polite": "Certainly. We can take a moment before choosing anything else.",
      "smart": "Yes. Recognising the disappointment helps us move forward.",
      "funny": "Yes. The backup plan can wait politely in the wings.",
      "bold": "Take a minute. Then we'll decide what to do.",
      "weird": "Yes. Even an adventure goblin needs a little sigh break.",
      "cringe": "No! Our destined dates are always perfect!",
      "rude": "No. Stop making a fuss."
    },
    {
      "sweet": "We stayed kind to each other when the plan fell apart.",
      "polite": "Taking a moment, then choosing something we could both enjoy.",
      "smart": "Changing the plan instead of treating it as a failed day.",
      "funny": "Our backup plan escaped from the cupboard just in time.",
      "bold": "We didn't let one closed door decide the whole day.",
      "weird": "Our emergency adventure goblin finally earned its keep.",
      "cringe": "Our cosmic destiny forced the afternoon to be perfect!",
      "rude": "Me finding something better than your idea."
    }
  ],
  "26": [
    {
      "sweet": "Because someone noticed a small thing that matters to you.",
      "polite": "Being remembered is a thoughtful form of attention.",
      "smart": "It shows they paid attention and retained a useful detail.",
      "funny": "Your usual order has finally achieved local celebrity status.",
      "bold": "Because they noticed you. Small things can count.",
      "weird": "A tiny kindness librarian kept your order on the special shelf.",
      "cringe": "It proves the whole universe is arranging our cosmic destiny!",
      "rude": "Because you need attention over nothing."
    },
    {
      "sweet": "Pick one little detail and listen without putting pressure on yourself.",
      "polite": "You could start with one detail from each conversation.",
      "smart": "Link one detail to the conversation where you heard it.",
      "funny": "Give your brain one small filing job, not a whole office.",
      "bold": "Start small. Pay attention to one thing and build from there.",
      "weird": "Ask your tiny memory librarian to shelve one fact at a time.",
      "cringe": "Memorise everything! True soulmates never forget a syllable!",
      "rude": "If you forget, those people probably aren't interesting."
    },
    {
      "sweet": "It mattered to you, so I wanted to remember it.",
      "polite": "You mentioned it, and I paid attention.",
      "smart": "Connecting the detail to our conversation helped me remember.",
      "funny": "My brain filed it under Actually Important, for a change.",
      "bold": "I listened. You're worth paying attention to.",
      "weird": "My tiny brain librarian put it on the special shelf.",
      "cringe": "I memorise everything about you because we are destined!",
      "rude": "You repeated it so often I couldn't forget."
    }
  ],
  "27": [
    {
      "sweet": "A quiet walk together next week, if that suits you.",
      "polite": "Perhaps another visit to the bookshop when we're both free.",
      "smart": "One short outing we can fit into our schedules.",
      "funny": "A walk with a strict limit of one terrible joke per bench.",
      "bold": "Let's pick a day for another café visit.",
      "weird": "A small expedition to inspect Earth's next interesting corner.",
      "cringe": "Let's plan our entire eternal life tonight!",
      "rude": "Something that doesn't take much of my time."
    },
    {
      "sweet": "Choose something we'd both enjoy, and leave the rest for later.",
      "polite": "Let's each name a favourite and see what fits.",
      "smart": "Compare time and cost, then choose one achievable plan.",
      "funny": "Hold a tiny election. The losing ideas can run next week.",
      "bold": "Pick one we can actually do. We'll save the others.",
      "weird": "Give one adventure planet a landing slot and let the others orbit.",
      "cringe": "Promise to do everything! Destiny will create more hours!",
      "rude": "Just pick mine. Yours can wait."
    },
    {
      "sweet": "Yes. I'd rather keep one promise to you well.",
      "polite": "I agree. Let's choose something we can both manage.",
      "smart": "Yes. A realistic plan is easier to follow through on.",
      "funny": "Yes. My imaginary calendar is already overworked.",
      "bold": "Agreed. One plan, and we actually do it.",
      "weird": "Yes. Even our imaginary moon mission needs a schedule.",
      "cringe": "No! I'll promise you the entire universe by tomorrow!",
      "rude": "No. Promises don't matter if I change my mind."
    }
  ],
  "28": [
    {
      "sweet": "The little moments when being with you felt easy.",
      "polite": "Getting to know you, and learning what matters to you.",
      "smart": "How our routines grew through small choices rather than grand promises.",
      "funny": "A month of dates, and my jokes still haven't been formally outlawed.",
      "bold": "We kept making time. That's what stands out.",
      "weird": "Our two odd little planets learning to share an orbit.",
      "cringe": "Every second proved we must never be apart again!",
      "rude": "How much time this has taken."
    },
    {
      "sweet": "Yes. The difficult moments didn't erase the good ones.",
      "polite": "Yes. I appreciated being able to work through them honestly.",
      "smart": "Yes. We learned from the awkward moments as well as the easy ones.",
      "funny": "Yes. Even the awkward bits gave our story better editing notes.",
      "bold": "Yes. I'd choose to keep making time again.",
      "weird": "Yes. A few wobbles didn't knock our little planets out of orbit.",
      "cringe": "Yes! Now our perfect destiny means nothing can ever go wrong!",
      "rude": "No. I expected this to be easier."
    },
    {
      "sweet": "I'm glad we kept making time. I'd like to keep seeing you.",
      "polite": "Thank you for this month. I've enjoyed getting to know you.",
      "smart": "We've learned how to make room for each other.",
      "funny": "One month, and you still haven't banned my jokes. A success.",
      "bold": "I want to keep this going. Same time next week?",
      "weird": "Our two strange little planets have found a comfortable orbit.",
      "cringe": "Now promise we'll be together every second forever!",
      "rude": "A whole month, and this is all we have to show for it?"
    }
  ]
};
  function story(key,day,likes) {
    const scene=scenes[day-FIRST];
    if(!scene||!voices[key])return null;
    const [title,p0,p1,p2]=scene;
    const tags=Object.keys(likes), positive=tags.filter(t=>likes[t]>0).sort((a,b)=>likes[b]-likes[a]);
    const selected=positive.slice(0,2);
    const neutral=tags.filter(t=>!selected.includes(t)&&likes[t]>=-1&&likes[t]<=0);
    selected.push(neutral[(day-FIRST)%neutral.length]||positive[2]);
    selected.push(tags.filter(t=>!selected.includes(t)).sort((a,b)=>likes[a]-likes[b])[0]);
    const lines=[p0,p1,p2].map((prompt,i)=>{
      const answers=answersByDay[day][i];
      return [(i===0?voices[key]:'')+prompt,selected.map(tag=>[answers[tag],tag])];
    });
    return {title,lines};
  }
  // Each shift balances two routine, two suspicious and two unverified requests.
  const officePacks = [
    [
      {
        "kind": "Task board",
        "title": "Stock count",
        "body": "You opened the usual internal task board yourself. Today's expected task: count the blank folders and enter the total here. No link, attachment or sensitive information.",
        "best": "work",
        "why": "This is the expected task in the workspace you already opened. Complete the count there. A familiar sender name alone would not establish trust.",
        "cue": "Expected task in the independently opened internal board; no sensitive request."
      },
      {
        "kind": "Email",
        "title": "Payroll on hold",
        "body": "A message claiming to be Payroll says: Your salary is frozen. Open the attached form and enter your password and bank details within ten minutes.",
        "best": "report",
        "why": "Unexpected demands for credentials and bank details, an attachment and urgency are warning signs. Report through your workplace's established channel. Check payroll separately using a contact you already know.",
        "cue": "Unexpected password/bank-details request, attachment and ten-minute pressure."
      },
      {
        "kind": "SMS",
        "title": "Delivery fee",
        "body": "An unexpected text says: Your parcel is waiting. Pay a small fee through the link in this text now. You did not order a delivery.",
        "best": "report",
        "why": "An unexpected delivery and payment link are warning signs. Report the suspicious text without opening its link. If needed, check the delivery service independently.",
        "cue": "Unordered parcel plus an unexpected payment link."
      },
      {
        "kind": "Email",
        "title": "Changed invoice",
        "body": "A supplier you use asks to change the bank account for an expected invoice. The message sounds professional, but this change was not agreed before.",
        "best": "verify",
        "why": "This request is unverified, not proven fraudulent. Confirm the change through an independently known supplier contact and follow the normal payment approval process. Do not use contact details from this message.",
        "cue": "An unconfirmed change to a known supplier's bank account."
      },
      {
        "kind": "Task board",
        "title": "Meeting room list",
        "body": "In the internal task board you opened yourself, an expected task asks you to count the empty meeting rooms. It asks for no payment, login or download.",
        "best": "work",
        "why": "Complete the routine task in the existing workspace. Trust comes from the independently opened workflow and expected task, not spelling, polish or a sender's name.",
        "cue": "Expected task in the independently opened board; no payment, login or download."
      },
      {
        "kind": "Email",
        "title": "A familiar colleague",
        "body": "A message bearing your colleague's name asks you to open an unexpected shared file. You were not expecting a file from them today.",
        "best": "verify",
        "why": "A familiar name does not prove the message is genuine. Ask the colleague through a contact you already know before opening the file. Do not reply using a new address supplied by the message.",
        "cue": "A familiar name paired with an unexpected shared file."
      }
    ],
    [
      {
        "kind": "Task board",
        "title": "Visitor chairs",
        "body": "You opened the usual internal task board yourself. An expected task asks you to count the chairs in the booked meeting room. No download, payment or personal information is needed.",
        "best": "work",
        "cue": "Expected chair count in the independently opened internal board.",
        "why": "Complete the routine count in the workspace you already opened. A sender name alone would not establish trust."
      },
      {
        "kind": "Email",
        "title": "Account reactivation",
        "body": "An unexpected message says your work account will be deleted today. Open its attachment and enter your password to stop the deletion.",
        "best": "report",
        "cue": "Unexpected password request through an attachment, with deletion pressure.",
        "why": "Report the suspicious message through the established workplace channel without opening the attachment. Check your account independently through the service or contact you already know."
      },
      {
        "kind": "SMS",
        "title": "Urgent gift cards",
        "body": "A text claiming to be your manager asks you to buy gift cards, send the codes to a new number and skip the usual approval process because it is urgent.",
        "best": "report",
        "cue": "Gift-card codes, a new number, urgency and bypassing payment approval.",
        "why": "Report the suspicious request through the established channel. Do not buy cards or send codes. Contact the manager independently using details you already know."
      },
      {
        "kind": "Email",
        "title": "Supplier price sheet",
        "body": "A familiar supplier sends an unexpected attachment labeled New price sheet. You were not expecting a new file or a price update today.",
        "best": "verify",
        "cue": "An unexpected supplier attachment, even though the sender name is familiar.",
        "why": "Keep the file unopened while checking with the supplier through an independently known contact. This unexpected request is unverified; the name alone does not prove it is genuine or fraudulent."
      },
      {
        "kind": "Task board",
        "title": "Supply tally",
        "body": "In the internal task board you opened yourself, the expected task asks you to count sealed pens in the supply drawer. It asks for no login, payment or download.",
        "best": "work",
        "cue": "Expected supply count in the independently opened workspace.",
        "why": "Complete the routine count there. The independently opened, expected workflow is the useful context, rather than a polished message or familiar name."
      },
      {
        "kind": "Email",
        "title": "Meeting location changed",
        "body": "A message bearing a colleague's name says today's meeting moved to another room. The independently opened calendar still lists the original room, and you were not expecting a change.",
        "best": "verify",
        "cue": "An unexpected meeting change that conflicts with the independently opened calendar.",
        "why": "Confirm with the colleague through a known work contact and check the calendar independently. A scheduling discrepancy needs verification; it is not proof of fraud."
      }
    ],
    [
      {
        "kind": "Task board",
        "title": "Room equipment count",
        "body": "You opened the usual internal board yourself. An expected task asks you to count the spare projector cables in the room. No installation or sensitive information is requested.",
        "best": "work",
        "cue": "Expected equipment count in the independently opened internal board.",
        "why": "Handle the routine count in the workspace you already opened. No new link or attachment is needed."
      },
      {
        "kind": "Email",
        "title": "Voicemail login form",
        "body": "An unexpected message says you have a confidential voicemail. Open the attached login form and enter your work password to listen immediately.",
        "best": "report",
        "cue": "Unexpected password form in an attachment, presented as urgent voicemail access.",
        "why": "Report through the established workplace channel without opening the form or entering credentials. Check voicemail separately through the service you already use."
      },
      {
        "kind": "SMS",
        "title": "Refund waiting",
        "body": "An unexpected text from a service you do not use promises a refund. It asks you to open its link and provide your password and bank details before the offer expires.",
        "best": "report",
        "cue": "An unrecognized service requests credentials and bank details through a refund link.",
        "why": "Report the suspicious text without opening its link or supplying details. If you need to check a refund, use an independently known service or contact."
      },
      {
        "kind": "Email",
        "title": "Unexpected support visit",
        "body": "Someone claiming to be IT support asks you to install a remote-support tool. You have no open support request and no independently confirmed appointment.",
        "best": "verify",
        "cue": "An unexpected installation request without a known support appointment.",
        "why": "Keep the request on hold and verify through your independently known service desk before installing anything. An unconfirmed support request is not proof of legitimacy or fraud."
      },
      {
        "kind": "Task board",
        "title": "Print supply check",
        "body": "In the internal board you opened yourself, an expected task asks you to count unopened paper packs beside the printer. It requests no payment, file or sensitive data.",
        "best": "work",
        "cue": "Expected paper count in the independently opened task board.",
        "why": "Complete the routine count in the existing workspace. No new login, download or payment is required."
      },
      {
        "kind": "Email",
        "title": "Client document share",
        "body": "A familiar client name appears on an unexpected file-sharing message. You were not expecting a document from that client today.",
        "best": "verify",
        "cue": "An unexpected shared file with a familiar client name.",
        "why": "Check with the client through a contact you already know before opening the file. A familiar name alone does not establish trust; do not use new contact details supplied in the message."
      }
    ]
  ];
  function officeShift(day=FIRST,hour=9) {
    if(!Number.isInteger(day)||day<FIRST||day>LAST||![9,12,15,18].includes(hour))throw new RangeError("Invalid office day or hour");
    const index=(day-FIRST)*4+(hour-9)/SHIFT_HOURS;
    const pack=officePacks[index%officePacks.length], rotation=Math.floor(index/officePacks.length)%pack.length;
    return pack.map((_,i)=>({...pack[(i+rotation)%pack.length]}));
  }
  return {officeShift,story,LIMIT,FIRST,LAST,START_COINS,DATE_COST,SHIFT_HOURS,MEET_HOUR,MISS_LOSS,POINTS_PER_COIN,MAX_SHIFT_PAY,DATE_BONUS,DATE_GOAL,won,clean,add,advance,work,ended,completed};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SevenExpanded;
