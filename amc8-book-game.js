/* Book Blocks Lab — interactive grouping, permutations, and multiplication. */
(function(){
  "use strict";
  function el(id){return document.getElementById(id);}
  function escape(s){return String(s).replace(/[&<>"']/g,function(v){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[v];});}
  function fact(n){var x=1;for(var i=2;i<=n;i++)x*=i;return x;}
  function fmt(n){return Number(n).toLocaleString("en-US");}
  function blank(n){return Array.from({length:n},function(){return null;});}
  function countState(n){return {positions:blank(n),expr:{numbers:blank(n),ops:blank(n-1)},phase:"place",verified:false};}
  function makeSpec(id,groups,singles,answer){
    var s={id:id,groups:groups,singles:singles,answer:answer};
    s.allBooks=groups.reduce(function(a,g){return a.concat(g.books);},[]).concat(singles);
    s.objects=groups.map(function(g){return {id:"block:"+g.name,label:g.name+" block",group:g.name};}).concat(singles.map(function(b){return {id:"single:"+b,label:b};}));
    s.n=s.objects.length;
    s.insideFactor=groups.reduce(function(a,g){return a*fact(g.books.length);},1);
    if(fact(s.n)*s.insideFactor!==answer)throw new Error("Invalid game data "+id);
    return s;
  }
  var specs=[
    makeSpec("question-1",[{name:"French",books:["F1","F2","F3"]},{name:"Italian",books:["I1","I2"]}],["J1","J2","J3"],1440),
    makeSpec("question-2",[{name:"Science",books:["S1","S2"]},{name:"Novels",books:["N1","N2","N3","N4","N5"]}],["H1","H2","H3"],28800),
    makeSpec("question-3",[{name:"Mathematics",books:["M1","M2","M3"]},{name:"Physics",books:["P1","P2","P3"]},{name:"Chemistry",books:["C1","C2","C3","C4"]}],[],5184)
  ];
  function groupForBook(spec,b){return spec.groups.find(function(g){return g.books.indexOf(b)!==-1;});}
  function groupByName(spec,name){return spec.groups.find(function(g){return g.name===name;});}
  function mixBooks(spec){
    var arr=spec.groups.map(function(g){return g.books.slice();}).concat([spec.singles.slice()]);var out=[];
    while(arr.some(function(list){return list.length;})){arr.forEach(function(list){if(list.length)out.push(list.shift());});}
    return out;
  }
  function newGame(spec){
    var inside={};var grouped={};
    spec.groups.forEach(function(g){inside[g.name]=countState(g.books.length);grouped[g.name]=[];});
    return {spec:spec,step:0,grouped:grouped,outer:countState(spec.n),inside:inside,
      final:{expr:{numbers:blank(spec.groups.length+1),ops:blank(spec.groups.length)},verified:false},
      selected:null,selectedSlot:null,notice:"",noticeError:false};
  }
  function finalIndex(s){return 2+s.spec.groups.length;}
  function finishIndex(s){return finalIndex(s)+1;}
  function groupReady(s){return s.spec.groups.every(function(g){return s.grouped[g.name].length===g.books.length;});}
  function stageReady(s,step){
    if(step===0)return groupReady(s);
    if(step===1)return s.outer.verified;
    if(step>=2&&step<finalIndex(s))return s.inside[s.spec.groups[step-2].name].verified;
    if(step===finalIndex(s))return s.final.verified;
    return true;
  }
  function unlocked(s){
    var index=0;
    while(index<finishIndex(s)&&stageReady(s,index))index++;
    return index;
  }
  function forgetLater(s,step){
    if(step<=0){
      s.outer=countState(s.spec.n);
      s.spec.groups.forEach(function(g){s.inside[g.name]=countState(g.books.length);});
    }else if(step<=1){
      s.spec.groups.forEach(function(g){s.inside[g.name]=countState(g.books.length);});
    }else{
      s.spec.groups.slice(Math.max(0,step-1)).forEach(function(g){s.inside[g.name]=countState(g.books.length);});
    }
    s.final={expr:{numbers:blank(s.spec.groups.length+1),ops:blank(s.spec.groups.length)},verified:false};
  }
  function say(s,text,isError){s.notice=text;s.noticeError=!!isError;}
  function typeOfBook(spec,b){
    var g=groupForBook(spec,b);return g?g.name.toLowerCase():({J:"japanese",H:"history",C:"chemistry"})[b[0]]||"";
  }
  function book(spec,b){return '<span class="gm-book '+typeOfBook(spec,b)+'">'+escape(b)+'</span>';}
  function stack(s,g,small,active){
    var books=s.inside[g.name].positions.every(Boolean)?s.inside[g.name].positions:s.grouped[g.name];
    var nodes=books.map(function(b){return book(s.spec,b);}).join("");
    return '<span class="gm-stack'+(active?" active":"")+(books.length?"":" empty")+'">'+
      '<span class="gm-stack-label">'+escape(g.name)+' · 1 object</span>'+
      '<span class="gm-stack-items">'+(nodes||'<span class="gm-little-note">Empty band</span>')+'</span></span>';
  }
  function objectNode(s,id,active){
    if(id.indexOf("single:")===0)return book(s.spec,id.substring(7));
    var name=id.substring(6);
    return stack(s,groupByName(s.spec,name),false,active);
  }
  function source(kind,value,context,html,selected,extra){
    return '<button type="button" draggable="true" class="gm-pick'+(selected?" selected":"")+'"'+
      ' data-source-kind="'+escape(kind)+'" data-value="'+escape(value)+'" data-context="'+escape(context)+'" '+
      (extra||"")+' aria-label="Select '+escape(value)+'">'+html+'</button>';
  }
  function info(s){return s.notice?'<div class="gm-feedback'+(s.noticeError?' error':'')+'" role="status" aria-live="polite">'+escape(s.notice)+'</div>':'';}
  function activeSelection(s,kind,value,context){return s.selected && s.selected.kind===kind&&s.selected.value===value&&s.selected.context===context;}
  function choiceHelp(){
    return '<p class="gm-little-note">Drag a tile into a box, or tap the tile and then tap its destination. On a phone, both tapping and dragging work.</p>';
  }
  function previewShelf(s){
    var spec=s.spec,step=s.step,focus=step>=2&&step<finalIndex(s)?spec.groups[step-2].name:null;
    if(step===0&&!groupReady(s)){
      return '<div class="gm-mini-board">'+mixBooks(spec).map(function(b){
        var g=groupForBook(spec,b);
        return g&&s.grouped[g.name].indexOf(b)!==-1?'':book(spec,b);
      }).join("")+'</div>'+
      '<div class="gm-overview-group"><b>Groups being built</b><div class="gm-mini-board">'+
      spec.groups.map(function(g){return stack(s,g,true,false);}).join("")+'</div></div>';
    }
    var ids=s.outer.positions.slice();
    var n=spec.n;
    var cells=ids.map(function(id,i){
      return id?objectNode(s,id,id==="block:"+focus):'<span class="gm-mini-empty">'+(i+1)+'</span>';
    }).join("");
    return '<div class="gm-mini-board">'+cells+'</div>'+
      (step<=1?'<p class="gm-little-note">Each outside slot holds a whole block or one single book.</p>':'');
  }
  function factorRow(title,sub,formula,active){
    return '<div class="gm-factor'+(active?' active':'')+'"><div><b>'+escape(title)+'</b><small>'+escape(sub)+'</small></div><strong>'+escape(formula)+'</strong></div>';
  }
  function overview(s){
    var spec=s.spec,stage=s.step,outer=s.outer.verified,groupComplete=groupReady(s);
    var rows=factorRow("Outside shelf",spec.n+" movable objects",outer?spec.n+"! = "+fmt(fact(spec.n)):"? × ? × …",stage===1);
    spec.groups.forEach(function(g,i){
      var verified=s.inside[g.name].verified;
      rows+=factorRow(g.name+" block",g.books.length+" distinct books",
        verified?g.books.length+"! = "+fmt(fact(g.books.length)):"? inside orders",stage===i+2);
    });
    var finalDone=s.final.verified;
    var formulaParts=[outer?fmt(fact(spec.n)):"?"].concat(spec.groups.map(function(g){return s.inside[g.name].verified?fmt(fact(g.books.length)):"?";}));
    return '<aside class="gm-overview" aria-label="Always-visible overall bookshelf and solution">'+
      '<h4>Whole shelf · live picture</h4>'+
      '<p class="gm-overview-sub">'+(groupComplete?spec.n+" movable objects, made from "+spec.allBooks.length+" real books":"Build the groups, then arrange the outside objects")+'</p>'+
      '<div class="gm-board"><span class="gm-board-label">Overview — entire problem</span>'+previewShelf(s)+'</div>'+
      '<h4>Count ledger</h4><div class="gm-ledger">'+rows+'</div>'+
      '<div class="gm-total">Whole result<span class="gm-big">'+formulaParts.join(" × ")+(finalDone?" = "+fmt(spec.answer):" = ?")+'</span></div>'+
      '<p class="gm-little-note">The highlighted factor is the small part you are working on. Every finished part appears here.</p></aside>';
  }
  function heading(s){
    var names=["1 · Group books","2 · Outside order"].concat(s.spec.groups.map(function(g,i){return (i+3)+" · "+g.name+" inside";}));
    names.push((finalIndex(s)+1)+" · Multiply");names.push("✓ Complete");
    return '<header class="gm-head"><div class="gm-head-top"><span class="gm-kicker">Book Blocks Counting Game</span>'+
      '<button type="button" class="gm-restart" data-action="restart">↺ Restart game</button></div>'+
      '<h3>Build the answer yourself</h3>'+
      '<nav class="gm-trail" aria-label="Game steps">'+names.map(function(label,i){
        var available=i<=unlocked(s);var active=i===s.step;
        return '<button type="button" class="gm-step'+(i<s.step&&stageReady(s,i)?" done":"")+(active?" active":"")+'" data-action="jump" data-index="'+i+'"'+
          (!available?' disabled':'')+(active?' aria-current="step"':'')+'>'+escape(label)+'</button>';
      }).join("")+'</nav></header>';
  }
  function stageGroup(s){
    var spec=s.spec;
    var remaining=mixBooks(spec).filter(function(b){
      var g=groupForBook(spec,b);return !g||s.grouped[g.name].indexOf(b)<0;
    });
    var zones=spec.groups.map(function(g){
      var selected=s.selected&&s.selected.kind==="book"&&s.selected.context==="group";
      var done=s.grouped[g.name].length===g.books.length;
      var placed=s.grouped[g.name].map(function(b){
        return '<button type="button" data-action="remove-group" data-value="'+escape(b)+'" data-group="'+escape(g.name)+'" title="Remove '+escape(b)+' from this group">'+book(spec,b)+'</button>';
      }).join("");
      return '<div class="gm-zone'+(done?" correct":"")+'" role="button" tabindex="0" data-drop-kind="group" data-group="'+escape(g.name)+'" aria-label="Put selected books in '+escape(g.name)+' block">'+
        '<b>'+escape(g.name)+' band</b><small>'+s.grouped[g.name].length+' / '+g.books.length+' books'+(done?" ✓":"")+'</small>'+
        '<div class="gm-group-books">'+(placed||'<span class="gm-little-note">Drop books here</span>')+'</div></div>';
    }).join("");
    var ready=groupReady(s);
    return '<h4 class="gm-panel-title">Step 1 · Put related books in a band</h4>'+
      '<p class="gm-help">The rule says certain books must stay next to each other. Move those books into the matching band. The other books will remain separate.</p>'+
      '<div class="gm-board"><span class="gm-board-label">Books available to move</span><div class="gm-objects">'+remaining.map(function(b){
        var g=groupForBook(spec,b);
        return g?source("book",b,"group",book(spec,b),activeSelection(s,"book",b,"group")):
          '<span title="This book stays single">'+book(spec,b)+'</span>';
      }).join("")+'</div></div>'+
      '<p class="gm-prompt">Move each required book into its group:</p><div class="gm-zone-grid">'+zones+'</div>'+
      choiceHelp()+
      '<div class="gm-branch"><b>Why can this group count as ONE object?</b>'+
      '<p>When moving books on the outside shelf, an entire band travels together. No other book can get between its books. We will still rearrange them INSIDE the band later.</p></div>'+
      (ready?'<div class="gm-feedback"><strong>Groups complete!</strong> '+spec.allBooks.length+' separate books have become '+spec.n+
        ' movable outside objects: '+spec.groups.length+' blocks + '+spec.singles.length+' single books.</div>':'')+
      actions(s);
  }
  function availableObjects(s,scope,gname){
    if(scope==="outer")return s.spec.objects.filter(function(o){return s.outer.positions.indexOf(o.id)<0;}).map(function(o){return {id:o.id,label:o.label,html:objectNode(s,o.id,false)};});
    var g=groupByName(s.spec,gname);
    return g.books.filter(function(b){return s.inside[gname].positions.indexOf(b)<0;}).map(function(b){return {id:b,label:b,html:book(s.spec,b)};});
  }
  function placementBoard(s,scope,group){
    var st=scope==="outer"?s.outer:s.inside[group];
    var n=st.positions.length;
    var available=availableObjects(s,scope,group);
    var placed=st.positions.filter(Boolean).length;
    var context=scope==="outer"?"outer":"inner:"+group;
    var options=available.map(function(v){
      return source(scope==="outer"?"object":"book",v.id,context,v.html,activeSelection(s,scope==="outer"?"object":"book",v.id,context));
    }).join("");
    var slots=st.positions.map(function(id,i){
      return '<div class="gm-slot'+(id?" filled":"")+'" role="button" tabindex="0" data-drop-kind="'+(scope==="outer"?"outer-position":"inner-position")+'" data-index="'+i+'" '+
        (group?'data-group="'+escape(group)+'" ':'')+'aria-label="Shelf position '+(i+1)+(id?" occupied by "+id:" empty")+'">'+
        '<span class="gm-slot-index">Position '+(i+1)+'</span>'+
        (id?(scope==="outer"?objectNode(s,id,false):book(s.spec,id)):'<span class="gm-slot-placeholder">Drop here</span>')+
        (id?'<button type="button" class="gm-slot-delete" data-action="remove-position" data-index="'+i+'" data-scope="'+escape(context)+'">Undo</button>':'')+'</div>';
    }).join("");
    var all=placed===n;
    return '<div class="gm-board"><span class="gm-board-label">The '+(scope==="outer"?"outside objects":"books inside "+escape(group))+' — move one to a shelf position</span>'+
      '<div class="gm-shelf">'+slots+'</div>'+
      '<div class="gm-objects gm-choices">'+(options||'<span class="gm-little-note">All objects have been placed.</span>')+'</div></div>'+
      '<div class="gm-count-rail">'+st.positions.map(function(_,i){
        return (i?'<span class="gm-count-arrow">→</span>':'')+
          '<span class="gm-count-step'+(i<placed?"":" future")+'"><strong>'+(n-i)+'</strong><small>choices · '+(i+1)+'</small></span>';
      }).join("")+'</div>'+
      '<p class="gm-help">'+(all?
        '<strong>One order is complete!</strong> You made one example shelf, but there were '+n+' choices for the first position. Each first choice leaves '+(n-1)+' choices for the next. Now build the expression that counts ALL possible orders.' :
        '<strong>Next choice:</strong> '+(n-placed)+' unused '+(scope==="outer"?"object(s)":"book(s)")+' can go in position '+(placed+1)+
        '. Every earlier choice leaves one fewer unused item. It never changes the number of choices remaining.')+'</p>'+
      '<div class="gm-actions"><button type="button" class="gm-action" data-action="undo-position" data-scope="'+escape(context)+'"'+(placed===0?' disabled':'')+'>← Undo last placement</button>'+
      '<button type="button" class="gm-action" data-action="reset-positions" data-scope="'+escape(context)+'">↺ Try a different order</button></div>'+
      (all?'<div class="gm-feedback"><strong>Now count ALL possible orders.</strong> This is just one path through the choices. Fill the number of choices for each position and put an operation between every pair.</div>':'')+
      (all?expressionBuilder(s,context,n,false):'');
  }
  function exprModel(s,scope){
    if(scope==="outer")return s.outer.expr;
    if(scope==="final")return s.final.expr;
    return s.inside[scope.substring(6)].expr;
  }
  function factorChoices(spec){
    return [{id:"outer",title:"Outside",value:fact(spec.n)}].concat(spec.groups.map(function(g){return {id:"group:"+g.name,title:g.name+" inside",value:fact(g.books.length)};}));
  }
  function numberBank(n){
    var arr=[];for(var low=1,high=n;low<=high;low++,high--){arr.push(low);if(low!==high)arr.push(high);}
    return arr;
  }
  function formulaSlot(scope,kind,index,value,selected,spec){
    var text=value===null?"?":(kind==="factor"?fmt(factorChoices(spec).find(function(f){return f.id===value;}).value):escape(value));
    return '<button type="button" class="gm-expr-slot'+(kind==="op"?" op":"")+(value!==null?" filled":"")+(selected?" selected":"")+
      '" data-drop-kind="expr" data-scope="'+escape(scope)+'" data-kind="'+kind+'" data-index="'+index+'" '+
      'aria-label="'+(kind==="op"?"Operator":kind==="factor"?"Factor":"Choices at position "+(index+1))+': '+text+'; tap to edit">'+text+'</button>';
  }
  function expressionBuilder(s,scope,n,isFinal){
    var model=exprModel(s,scope),spec=s.spec;
    var bank=isFinal?factorChoices(spec):numberBank(n).map(function(v){return {id:String(v),title:"",value:v};});
    var occupied=model.numbers.filter(function(v){return v!==null;});
    var slots=model.numbers.map(function(v,i){
      var kind=isFinal?"factor":"number";
      return (i?formulaSlot(scope,"op",i-1,model.ops[i-1],s.selectedSlot&&s.selectedSlot.scope===scope&&s.selectedSlot.kind==="op"&&s.selectedSlot.index===i-1,spec):"")+
        formulaSlot(scope,kind,i,v,s.selectedSlot&&s.selectedSlot.scope===scope&&s.selectedSlot.tokenKind===kind&&s.selectedSlot.index===i,spec);
    }).join("");
    var chips=bank.map(function(item){
      var used=occupied.indexOf(isFinal?item.id:item.value)>=0;
      var val=isFinal?item.id:item.value;
      return '<button type="button" class="gm-chip'+(isFinal?" factor":"")+(used?" used":"")+'" draggable="true" data-source-kind="chip" data-context="'+escape(scope)+'" '+
        'data-kind="'+(isFinal?"factor":"number")+'" data-value="'+escape(val)+'"'+(used?' aria-disabled="true"':'')+'>'+
        (isFinal?'<small>'+escape(item.title)+'</small>'+fmt(item.value):item.value)+'</button>';
    }).join("");
    var opChips=["×","+"].map(function(op){
      return '<button type="button" draggable="true" class="gm-chip operator" data-source-kind="chip" data-context="'+escape(scope)+'" data-kind="op" data-value="'+op+'">'+op+'</button>';
    }).join("");
    return '<div class="gm-formula"><h5>'+(isFinal?"Combine every factor":"Build the permutation expression")+'</h5>'+
      '<p class="gm-formula-hint">'+(isFinal?
        "Each number counts one decision. A complete shelf needs an outside arrangement AND an inside order for EVERY group.":
        "For each position, enter how many unused objects could go there. Choose × or + to connect the choices. Decide which rule counts all complete orders.")+'</p>'+
      '<div class="gm-expr" role="group" aria-label="Fill expression from left to right">'+slots+'</div>'+
      '<div class="gm-board"><span class="gm-board-label">Number tiles — tap or drag to a blank number box</span><div class="gm-choices">'+chips+'</div>'+
      '<span class="gm-board-label">Operation tiles — use one between every pair of numbers</span><div class="gm-choices">'+opChips+'</div></div>'+
      '<p class="gm-little-note">Tap a filled box to remove its tile and try a different one. You may also tap a specific blank box before choosing a tile.</p>'+
      '<div class="gm-actions"><button type="button" class="gm-action primary" data-action="check-expression" data-scope="'+escape(scope)+'">✓ Check my counting</button>'+
      '<button type="button" class="gm-action" data-action="clear-expression" data-scope="'+escape(scope)+'">Clear formula</button></div>'+
      branchExplanation(n,isFinal,isFinal?[]:(scope==="outer"?spec.objects.map(function(o){return o.label;}):groupByName(spec,scope.slice(6)).books));
  }
  function branchExplanation(n,isFinal,labels){
    if(isFinal){
      return '<div class="gm-branch"><b>Why multiplication here?</b><p>Every outside arrangement works with EVERY order inside the first group and EVERY order inside the other groups. A complete shelf needs one choice from all these lists, so multiply their sizes. Adding only counts the lists separately.</p></div>';
    }
    var names=labels&&labels.length===n?labels:Array.from({length:n},function(_,i){return String(i+1);});
    var rows=names.map(function(first,i){
      var rest=names.filter(function(_,j){return i!==j;});
      return '<div class="gm-branch-row"><b>First: '+escape(first)+'</b><div class="gm-branch-grid">'+
        rest.map(function(second){return '<div class="gm-branch-item">'+escape(first)+' → '+escape(second)+'</div>';}).join("")+'</div></div>';
    }).join("");
    return '<details class="gm-branch"><summary><b>Show WHY we multiply: all '+n+' × '+(n-1)+' first-two-position beginnings</b></summary>'+
      '<p>There are '+n+' possible first choices (one row for each). For EACH first choice, '+(n-1)+' different objects can be second. That is '+n+' groups of '+(n-1)+' possibilities.</p>'+
      rows+
      '<p><strong>'+n+' × '+(n-1)+' = '+(n*(n-1))+' different first-two-position beginnings.</strong> Not '+n+' + '+(n-1)+
      (n===2?'. Both positions are now filled.':'. After filling two positions, '+(n-2)+' unused objects remain; keep selecting one for each later position until the final choice is forced.')+
      ' Therefore all full orders are '+Array.from({length:n},function(_,i){return n-i;}).join(' × ')+' = '+n+'!.</p></details>';
  }
  function stageOuter(s){
    return '<h4 class="gm-panel-title">Step 2 · Arrange the outside objects</h4>'+
      '<p class="gm-help">Each band moves as one object. Every object is different, so changing their order makes a new arrangement. Fill positions from left to right, using every object exactly once.</p>'+
      placementBoard(s,"outer")+
      (s.outer.verified?'<div class="gm-feedback"><strong>Correct: '+s.spec.n+'! = '+fmt(fact(s.spec.n))+' outside arrangements.</strong> Each first choice has a complete set of possible endings. That is why the numbers multiply, not add.</div>':'')+
      actions(s);
  }
  function stageInner(s,g){
    var v=s.inside[g.name];
    return '<h4 class="gm-panel-title">Step '+(s.step+1)+' · Open the '+escape(g.name)+' block</h4>'+
      '<p class="gm-help">Keep the whole outside shelf fixed. The '+g.books.length+' books inside the '+escape(g.name)+' band can exchange places. Fill their local positions and count all possible orders with the same rule.</p>'+
      '<div class="gm-board"><span class="gm-board-label">Close-up · only the '+escape(g.name)+' books</span><div class="gm-objects">'+
      '<span class="gm-stack active"><span class="gm-stack-label">This is ONE outer object</span><span class="gm-stack-items">'+
      g.books.map(function(b){return book(s.spec,b);}).join("")+'</span></span></div></div>'+
      placementBoard(s,"inner",g.name)+
      (v.verified?'<div class="gm-feedback"><strong>Correct: '+g.books.length+'! = '+fmt(fact(g.books.length))+' internal orders.</strong> The entire '+escape(g.name)+' block remains in one outside position while its books change places.</div>':'')+
      actions(s);
  }
  function stageFinal(s){
    var spec=s.spec,m=spec.groups.length+1;
    return '<h4 class="gm-panel-title">Last step · Count every complete shelf</h4>'+
      '<p class="gm-help">Every outside layout can combine with every inside order for every required group. Bring the factors you discovered into the final line and choose the operations that combine them.</p>'+
      '<div class="gm-board"><span class="gm-board-label">The factors you earned</span><div class="gm-card-row">'+
      factorChoices(spec).map(function(c){return '<div class="gm-factor"><b>'+escape(c.title)+'</b><strong>'+fmt(c.value)+'</strong></div>';}).join("")+'</div></div>'+
      expressionBuilder(s,"final",m,true)+
      (s.final.verified?'<div class="gm-feedback"><strong>Correct! '+fmt(fact(spec.n))+' outside ways × '+fmt(spec.insideFactor)+' inside combinations = '+fmt(spec.answer)+' complete shelves.</strong> Every combination is counted once.</div>':'')+
      actions(s);
  }
  function stageWin(s){
    var spec=s.spec;
    return '<div class="gm-win"><span class="gm-kicker">Challenge completed</span><h4>You built the whole solution!</h4>'+
      '<div class="gm-total-number">'+fmt(spec.answer)+'</div><p class="gm-help">distinct valid bookshelf arrangements</p>'+
      '<ol class="gm-summary-list"><li>Group books that must be neighbors into one outside object.</li>'+
      '<li>Choose the outside positions: '+spec.n+' × '+(spec.n-1)+' × ... × 1 = '+fmt(fact(spec.n))+'.</li>'+
      spec.groups.map(function(g){return '<li>Inside '+escape(g.name)+': '+g.books.length+' × ... × 1 = '+fmt(fact(g.books.length))+' orders.</li>';}).join("")+
      '<li>Every outside arrangement can pair with every internal order. Multiply the factors to count complete shelves.</li></ol>'+
      '<div class="gm-actions"><button type="button" class="gm-action primary" data-action="restart">↺ Play again</button></div></div>';
  }
  function actions(s){
    var ready=stageReady(s,s.step);
    return '<div class="gm-actions">'+
      (s.step>0?'<button type="button" class="gm-action" data-action="back">← Previous task</button>':'')+
      '<button type="button" class="gm-action" data-action="hint">Show a hint</button>'+
      '<button type="button" class="gm-action primary" data-action="next"'+(ready?'':' disabled')+'>'+
      (s.step===finalIndex(s)?"See my result →":"Continue →")+'</button></div>';
  }
  function stepContent(s){
    if(s.step===0)return stageGroup(s);
    if(s.step===1)return stageOuter(s);
    if(s.step<finalIndex(s))return stageInner(s,s.spec.groups[s.step-2]);
    if(s.step===finalIndex(s))return stageFinal(s);
    return stageWin(s);
  }
  function view(s){
    return '<div class="gm-game">'+heading(s)+
      '<div class="gm-stage"><section class="gm-local">'+stepContent(s)+info(s)+'</section>'+overview(s)+'</div></div>';
  }
  function validateExpr(s,scope){
    var model=exprModel(s,scope),spec=s.spec;
    var isFinal=scope==="final";
    var n=model.numbers.length;
    if(model.numbers.some(function(x){return x===null;})||model.ops.some(function(x){return x===null;})){
      say(s,"Fill every number box and every operation box before checking.",true);return false;
    }
    if(model.ops.some(function(op){return op!=="×";})){
      say(s,isFinal?"Try multiplication (×). Every outside shelf can pair with EVERY possible order inside each band. Addition would count decision lists separately, not all complete shelves.":"Try multiplication (×). For EACH first choice there are all the possible second choices, and for EACH beginning there are further choices. Addition does not count these full branches.",true);return false;
    }
    if(isFinal){
      var expected=factorChoices(spec).map(function(x){return x.id;}).sort().join("|");
      if(model.numbers.slice().sort().join("|")!==expected){
        say(s,"Use each earned factor exactly once: the outside count and every grouped block's inside count.",true);return false;
      }
      s.final.verified=true;
      say(s,"Correct! Each complete shelf combines one outside arrangement with an order inside every band.");return true;
    }
    var nReal=scope==="outer"?spec.n:groupByName(spec,scope.slice(6)).books.length;
    for(var i=0;i<nReal;i++){
      if(Number(model.numbers[i])!==nReal-i){
        say(s,"Check position "+(i+1)+": there are "+(nReal-i)+" unused objects available there, regardless of the earlier selections. Place "+(nReal-i)+" in this number box.",true);
        return false;
      }
    }
    if(scope==="outer")s.outer.verified=true;
    else s.inside[scope.slice(6)].verified=true;
    say(s,"Yes: "+Array.from({length:nReal},function(_,i){return nReal-i;}).join(" × ")+" = "+fmt(fact(nReal))+" complete orders. The choices multiply because every earlier choice can be combined with each later choice.");
    return true;
  }
  function clearFrom(s,step){
    forgetLater(s,step);
    s.notice="";
    s.selected=null;s.selectedSlot=null;
  }
  function removeFromPosition(s,scope,index){
    var model=scope==="outer"?s.outer:s.inside[scope.slice(6)];
    if(!model||index<0||index>=model.positions.length||!model.positions[index])return;
    model.positions=model.positions.map(function(value,i){return i>=index?null:value;});model.verified=false;
    model.expr={numbers:blank(model.positions.length),ops:blank(model.positions.length-1)};
    if(scope==="outer")forgetLater(s,1);else forgetLater(s,s.step);
  }
  function assignSource(s,src,target){
    if(!src || !target)return false;
    var spec=s.spec,kind=target.kind;
    if(kind==="group"){
      if(src.kind!=="book"||src.context!=="group")return false;
      var g=groupForBook(spec,src.value);
      if(!g){say(s,"That book is a single book. It stays outside the bands.",true);return false;}
      if(g.name!==target.group){say(s,"Look at the subject of "+src.value+". It belongs in the "+g.name+" band, not the "+target.group+" band.",true);return false;}
      if(s.grouped[g.name].indexOf(src.value)>=0)return false;
      clearFrom(s,0);s.grouped[g.name].push(src.value);
      say(s,src.value+" moved into "+g.name+". The band will move all its books as one outside object.");
      return true;
    }
    if(kind==="outer-position"||kind==="inner-position"){
      var isOuter=kind==="outer-position",scope=isOuter?"outer":"inner:"+target.group;
      var st=isOuter?s.outer:s.inside[target.group];
      if(!st)return false;
      if(src.context!==scope || src.kind!==(isOuter?"object":"book"))return false;
      var value=src.value;
      var options=isOuter?spec.objects.map(function(x){return x.id;}):groupByName(spec,target.group).books;
      if(options.indexOf(value)<0){say(s,"This object does not belong in this shelf.",true);return false;}
      var idx=target.index;
      if(idx<0||idx>=st.positions.length)return false;
      var next=st.positions.indexOf(null);
      if(idx!==next){say(s,"Fill the shelf from LEFT to RIGHT so the number of choices decreases one position at a time. The next empty position is "+(next+1)+".",true);return false;}
      if(st.positions.indexOf(value)!==-1){say(s,"You already used this object in another position. Each object can appear only once.",true);return false;}
      if(st.positions[idx]!==null){say(s,"This position is full. Tap Undo on that position to move its object first.",true);return false;}
      if(isOuter)clearFrom(s,1);else clearFrom(s,s.step);
      st.positions[idx]=value;
      st.expr={numbers:blank(st.positions.length),ops:blank(st.positions.length-1)};
      st.verified=false;
      say(s,(isOuter?"Moved a whole object":"Moved a book")+" to position "+(idx+1)+". Now "+(options.length-st.positions.filter(Boolean).length)+" unused choice(s) remain.");
      return true;
    }
    if(kind==="expr"){
      var scope=target.scope,model=exprModel(s,scope);
      if(!model || src.kind!=="chip"||src.context!==scope || src.tokenKind!==target.tokenKind)return false;
      var idx=target.index;
      var nums=model.numbers,ops=model.ops,arr=target.tokenKind==="op"?ops:nums;
      if(idx<0||idx>=arr.length)return false;
      var value=src.tokenKind==="number"?Number(src.value):src.value;
      if(src.tokenKind==="number"||src.tokenKind==="factor"){
        if(nums.indexOf(value)!==-1&&nums[idx]!==value){
          say(s,"That tile is already in another box. Each choice or factor is used exactly once.",true);return false;
        }
      }
      arr[idx]=value;
      if(scope==="outer"){s.outer.verified=false;forgetLater(s,1);}
      else if(scope==="final")s.final.verified=false;
      else {s.inside[scope.slice(6)].verified=false;forgetLater(s,s.step);}
      s.notice="";s.selectedSlot=null;
      return true;
    }
    return false;
  }
  function parseSource(node){
    if(!node)return null;
    return {kind:node.dataset.sourceKind,value:node.dataset.value,context:node.dataset.context,tokenKind:node.dataset.kind};
  }
  function parseTarget(node){
    if(!node)return null;
    return {kind:node.dataset.dropKind,group:node.dataset.group,scope:node.dataset.scope,
      tokenKind:node.dataset.kind,index:Number(node.dataset.index)};
  }
  function choiceScope(s){
    if(s.step===1)return "outer";
    if(s.step>=2&&s.step<finalIndex(s))return "inner:"+s.spec.groups[s.step-2].name;
    return "final";
  }
  function firstSlot(s,src){
    var model=exprModel(s,src.context);
    if(!model)return null;
    var type=src.tokenKind,arr=type==="op"?model.ops:model.numbers;
    var i=arr.findIndex(function(v){return v===null;});
    return i>=0?{kind:"expr",scope:src.context,tokenKind:type,index:i}:null;
  }
  function selectOrUse(s,src){
    if(src.kind==="chip"){
      var target=s.selectedSlot && s.selectedSlot.scope===src.context && s.selectedSlot.tokenKind===src.tokenKind ?
        {kind:"expr",scope:s.selectedSlot.scope,tokenKind:s.selectedSlot.tokenKind,index:s.selectedSlot.index}:firstSlot(s,src);
      if(!target){say(s,"There is no empty box for that tile. Tap an existing box to remove it first.",true);return;}
      if(assignSource(s,src,target))s.selected=null;
      return;
    }
    if(s.selected && s.selected.kind===src.kind && s.selected.value===src.value && s.selected.context===src.context){
      s.selected=null;s.notice="";return;
    }
    s.selected=src;s.selectedSlot=null;
    if(src.context==="group"){
      var g=groupForBook(s.spec,src.value);
      say(s,"Selected "+src.value+". Now tap the "+(g?g.name:"matching")+" band, or drag the book there.");
    }else say(s,"Selected "+(src.kind==="object"?"the whole "+src.value:"book "+src.value)+". Now tap an empty shelf position.");
  }
  function sourceTarget(s,target){
    if(target.kind==="expr"){
      var model=exprModel(s,target.scope);
      if(!model)return;
      var arr=target.tokenKind==="op"?model.ops:model.numbers;
      if(arr[target.index]!==null){
        arr[target.index]=null;
        if(target.scope==="outer"){s.outer.verified=false;forgetLater(s,1);}
        else if(target.scope==="final")s.final.verified=false;
        else {s.inside[target.scope.substring(6)].verified=false;forgetLater(s,s.step);}
        s.selectedSlot={scope:target.scope,tokenKind:target.tokenKind,index:target.index};
        say(s,"Tile removed. Choose a replacement from the tile bank.");return;
      }
      if(s.selected&&assignSource(s,s.selected,target)){s.selected=null;return;}
      s.selectedSlot={scope:target.scope,tokenKind:target.tokenKind,index:target.index};
      say(s,"Now select a "+(target.tokenKind==="op"?"multiplication or addition":target.tokenKind==="factor"?"factor":"number")+" tile to fill this box.");
      return;
    }
    if(s.selected&&assignSource(s,s.selected,target)){s.selected=null;return;}
    if(!s.selected)say(s,"Choose a book or object from the available tiles first, then tap this destination.",true);
  }
  function hint(s){
    var spec=s.spec,step=s.step;
    if(step===0){
      var g=spec.groups.find(function(x){return s.grouped[x.name].length<x.books.length;});
      say(s,g?"Move the "+g.books.filter(function(b){return s.grouped[g.name].indexOf(b)===-1;}).join(", ")+" into the "+g.name+" band. Books not in a required group remain separate.":"Every required group is full. Tap Continue.");
    }else if(step===1 || (step>=2&&step<finalIndex(s))){
      var scope=choiceScope(s),n=scope==="outer"?spec.n:groupByName(spec,scope.slice(6)).books.length;
      var c=scope==="outer"?s.outer:s.inside[scope.slice(6)];
      if(c.positions.some(function(x){return x===null;}))say(s,"Every position takes one unused object. You have "+c.positions.filter(function(x){return x===null;}).length+" positions left. Place each remaining item once.");
      else say(s,"Fill the number boxes with "+Array.from({length:n},function(_,i){return n-i;}).join(", ")+" in that order. Each first choice combines with every possible next choice, so the connecting operation is ×.");
    }else if(step===finalIndex(s)){
      say(s,"Place one factor for the outside shelf and one factor for each band. Every outside order pairs with every inside order; multiply the factors.");
    }
  }
  function dispatchAction(s,node){
    var action=node.dataset.action,scope=node.dataset.scope||"",idx=Number(node.dataset.index);
    if(action==="restart"){var ns=newGame(s.spec);Object.keys(s).forEach(function(k){delete s[k];});Object.assign(s,ns);return "jump";}
    if(action==="next"){
      if(stageReady(s,s.step)){s.step=Math.min(finishIndex(s),s.step+1);s.notice="";s.selected=null;s.selectedSlot=null;return "jump";}
      say(s,"Finish this task and check your expression before continuing.",true);return;
    }
    if(action==="back"){s.step=Math.max(0,s.step-1);s.notice="";s.selected=null;s.selectedSlot=null;return "jump";}
    if(action==="jump"){
      if(idx>=0&&idx<=unlocked(s)){s.step=idx;s.notice="";s.selected=null;s.selectedSlot=null;return "jump";}
      say(s,"Complete earlier stages to unlock this one.",true);return;
    }
    if(action==="hint"){hint(s);return;}
    if(action==="remove-group"){
      var g=node.dataset.group,b=node.dataset.value;
      if(s.grouped[g] && s.grouped[g].indexOf(b)>=0){
        s.grouped[g]=s.grouped[g].filter(function(v){return v!==b;});clearFrom(s,0);
        say(s,b+" returned to the available books. Rebuild this group.");
      }return;
    }
    if(action==="remove-position"){
      removeFromPosition(s,scope,idx);say(s,"Removed the object. You can choose a different order.");return;
    }
    if(action==="undo-position"){
      var st=scope==="outer"?s.outer:s.inside[scope.slice(6)];
      if(st){var last=st.positions.map(function(v,i){return v===null?-1:i;}).filter(function(i){return i>=0;}).pop();
        if(last!==undefined)removeFromPosition(s,scope,last);
      }
      say(s,"Last placement undone.");return;
    }
    if(action==="reset-positions"){
      var st2=scope==="outer"?s.outer:s.inside[scope.slice(6)];
      if(st2){st2.positions=blank(st2.positions.length);st2.expr={numbers:blank(st2.positions.length),ops:blank(st2.positions.length-1)};st2.verified=false;
        forgetLater(s,s.step);
      }say(s,"Shelf cleared. Try a different ordering.");return;
    }
    if(action==="clear-expression"){
      var x=exprModel(s,scope),len=x.numbers.length;
      x.numbers=blank(len);x.ops=blank(len-1);
      if(scope==="outer"){s.outer.verified=false;forgetLater(s,1);}
      else if(scope==="final")s.final.verified=false;
      else{s.inside[scope.slice(6)].verified=false;forgetLater(s,s.step);}
      s.selectedSlot=null;s.notice="";return;
    }
    if(action==="check-expression"){validateExpr(s,scope);return;}
  }
  function addGame(root,spec){
    var state=newGame(spec),drag=null,suppressClickUntil=0;
    function repaint(scroll){
      root.innerHTML=view(state);
      if(scroll){var h=root.querySelector(".gm-head");if(h&&h.scrollIntoView)h.scrollIntoView({behavior:"smooth",block:"start"});}
    }
    function process(source,target){
      if(assignSource(state,source,target)){state.selected=null;repaint(false);}
      else repaint(false);
    }
    function closestTarget(node){
      if(!node||!node.closest)return null;
      var candidate=node.closest("[data-drop-kind]");
      return candidate&&root.contains(candidate)?candidate:null;
    }
    root.addEventListener("click",function(ev){
      if(Date.now()<suppressClickUntil)return;
      var action=ev.target.closest("[data-action]");
      if(action&&root.contains(action)){
        var mode=dispatchAction(state,action);
        repaint(mode==="jump");return;
      }
      var src=ev.target.closest("[data-source-kind]");
      if(src&&root.contains(src)){selectOrUse(state,parseSource(src));repaint(false);return;}
      var dest=closestTarget(ev.target);
      if(dest){sourceTarget(state,parseTarget(dest));repaint(false);}
    });
    root.addEventListener("keydown",function(ev){
      if(ev.key!=="Enter"&&ev.key!==" ")return;
      var dest=closestTarget(ev.target);
      if(dest && !ev.target.closest("button")){ev.preventDefault();sourceTarget(state,parseTarget(dest));repaint(false);}
    });
    root.addEventListener("dragstart",function(ev){
      var item=ev.target.closest("[data-source-kind]");
      if(!item||!root.contains(item))return;
      var src=parseSource(item);
      if(ev.dataTransfer){ev.dataTransfer.setData("text/plain",JSON.stringify(src));ev.dataTransfer.effectAllowed="move";}
      state.selected=src;
    });
    root.addEventListener("dragover",function(ev){
      var dst=closestTarget(ev.target);
      if(dst){ev.preventDefault();if(ev.dataTransfer)ev.dataTransfer.dropEffect="move";dst.classList.add("gm-drag-target");}
    });
    root.addEventListener("dragleave",function(ev){
      var dst=closestTarget(ev.target);
      if(dst)dst.classList.remove("gm-drag-target");
    });
    root.addEventListener("drop",function(ev){
      var dst=closestTarget(ev.target);
      if(!dst)return;ev.preventDefault();dst.classList.remove("gm-drag-target");
      var src=state.selected;
      try{var d=ev.dataTransfer&&ev.dataTransfer.getData("text/plain");if(d)src=JSON.parse(d);}catch(err){}
      process(src,parseTarget(dst));
      suppressClickUntil=Date.now()+120;
    });
    /* Touchscreen drag uses pointer events. Tapping is also always supported. */
    root.addEventListener("pointerdown",function(ev){
      if(ev.pointerType==="mouse")return;
      var item=ev.target.closest("[data-source-kind]");
      if(!item||!root.contains(item))return;
      drag={src:parseSource(item),startX:ev.clientX,startY:ev.clientY,active:false,ghost:null,highlight:null};
    });
    function movePointer(ev){
      if(!drag)return;
      var dx=ev.clientX-drag.startX,dy=ev.clientY-drag.startY;
      if(!drag.active&&Math.hypot(dx,dy)>12){
        drag.active=true;
        var ghost=document.createElement("div");
        ghost.className="gm-drag-ghost";
        var card=drag.src.kind==="chip"?'<span class="gm-chip">'+escape(drag.src.value)+'</span>':
          drag.src.kind==="book"?book(state.spec,drag.src.value):objectNode(state,drag.src.value,false);
        ghost.innerHTML=card;document.body.appendChild(ghost);drag.ghost=ghost;
      }
      if(!drag.active)return;
      if(ev.cancelable)ev.preventDefault();
      drag.ghost.style.left=ev.clientX+"px";drag.ghost.style.top=ev.clientY+"px";
      var node=document.elementFromPoint(ev.clientX,ev.clientY);
      var dst=closestTarget(node);
      if(drag.highlight&&drag.highlight!==dst)drag.highlight.classList.remove("gm-drag-target");
      drag.highlight=dst;
      if(dst)dst.classList.add("gm-drag-target");
    }
    function endPointer(ev){
      if(!drag)return;
      var moving=drag.active,src=drag.src;
      if(drag.highlight)drag.highlight.classList.remove("gm-drag-target");
      if(drag.ghost)drag.ghost.remove();
      drag=null;
      if(!moving)return;
      suppressClickUntil=Date.now()+350;
      var node=document.elementFromPoint(ev.clientX,ev.clientY),dst=closestTarget(node);
      if(dst)process(src,parseTarget(dst));
      else{say(state,"Drop onto a matching band, shelf position, or formula box.",true);repaint(false);}
    }
    document.addEventListener("pointermove",movePointer,{passive:false});
    document.addEventListener("pointerup",endPointer);
    document.addEventListener("pointercancel",function(){if(drag){if(drag.ghost)drag.ghost.remove();if(drag.highlight)drag.highlight.classList.remove("gm-drag-target");drag=null;}});
    repaint(false);
    return {getState:function(){return state;},render:function(){repaint(false);}};
  }
  var top=el("why-tutor");if(top)addGame(top,specs[0]);
  specs.forEach(function(spec){
    var card=el(spec.id);if(!card)return;
    var solution=card.querySelector(".solution");if(!solution)return;
    var mount=document.createElement("div");mount.className="gm-lesson";
    mount.setAttribute("aria-label","Play the solution as a book arranging game");
    solution.insertBefore(mount,solution.querySelector(".steps"));
    var written=document.createElement("details");written.className="gm-written";
    var title=document.createElement("summary");title.textContent="Show original written calculation";written.appendChild(title);
    [".steps",".formula",".note"].forEach(function(selector){var item=solution.querySelector(selector);if(item)written.appendChild(item);});
    solution.appendChild(written);
    addGame(mount,spec);
  });
})();
