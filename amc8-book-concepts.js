/* AMC 8 visual counting tutor: teach choices before symbols. */
(function () {
  "use strict";
  var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function factorial(n) { var v=1; for(var i=2;i<=n;i++) v*=i; return v; }
  function fmt(x) { return x.toLocaleString("en-US"); }
  function product(values) { return values.reduce(function(a,b){return a*b;},1); }
  function chain(n) { return Array.from({length:n},function(_,i){return n-i;}).join(" × "); }
  function permute(a) {
    if (a.length===0) return [[]];
    var out=[];
    a.forEach(function(item,i) {
      permute(a.filter(function(_,j){return i!==j;})).forEach(function(tail){
        out.push([item].concat(tail));
      });
    });
    return out;
  }
  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g,function(x){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x];});
  }
  function mkSpec(id, groups, singles, expected) {
    var spec={id:id,groups:groups.map(function(g){return {name:g.name,code:g.code,books:g.books,perms:permute(g.books)};}),singles:singles,answer:expected};
    spec.objects=spec.groups.map(function(group,i){return {id:"group"+i,name:group.name,type:"group",group:i};})
      .concat(spec.singles.map(function(book){return {id:"single"+book,type:"single",name:book,label:book};}));
    spec.n=spec.objects.length;
    spec.outerWays=factorial(spec.n);
    spec.insideWays=product(spec.groups.map(function(g){return g.perms.length;}));
    return spec;
  }
  var specs=[
    mkSpec("question-1",[
      {name:"French",code:"F",books:["F1","F2","F3"]},
      {name:"Italian",code:"I",books:["I1","I2"]}
    ],["J1","J2","J3"],1440),
    mkSpec("question-2",[
      {name:"Science",code:"S",books:["S1","S2"]},
      {name:"Novels",code:"N",books:["N1","N2","N3","N4","N5"]}
    ],["H1","H2","H3"],28800),
    mkSpec("question-3",[
      {name:"Mathematics",code:"M",books:["M1","M2","M3"]},
      {name:"Physics",code:"P",books:["P1","P2","P3"]},
      {name:"Chemistry",code:"C",books:["C1","C2","C3","C4"]}
    ],[],5184)
  ];
  function getObj(spec,id) { return spec.objects.find(function(o){return o.id===id;}); }
  function freshState(spec) {
    return {spec:spec,stage:0,bandCount:0,placed:[],
      orderIndices:spec.groups.map(function(){return 0;}),
      didSwap:spec.groups.map(function(){return false;}),
      outerVariant:0,recall:"",factorialLevel:0,factorialBranch:0};
  }
  function bookType(label) {return label[0].toLowerCase();}
  function book(label) {return '<span class="cb-book '+bookType(label)+'" data-cb-label="'+escapeHtml(label)+'" aria-label="Book '+escapeHtml(label)+'">'+escapeHtml(label)+'</span>';}
  function minibook(label,changed) {return '<span class="cb-mini-book '+bookType(label)+(changed?' changed':'')+'">'+escapeHtml(label)+'</span>';}
  function miniShelf(labels) {return '<div class="cb-mini-shelf">'+labels.map(function(b){return minibook(b,false);}).join("")+'</div>';}
  function actualBooks(spec) {return spec.groups.flatMap(function(g){return g.books;}).concat(spec.singles);}
  function groupView(group,books) {
    return '<span class="cb-band '+group.code.toLowerCase()+'" role="group" aria-label="'+escapeHtml(group.name)+' grouped books">' +
      '<span class="cb-band-label">'+escapeHtml(group.name)+' = 1 object</span>' +
      '<span class="cb-books">'+books.map(book).join("")+'</span></span>';
  }
  function objView(spec,obj,st,expanded) {
    if(obj.type==="single") return book(obj.label);
    var g=spec.groups[obj.group];
    return groupView(g,expanded ? g.perms[st.orderIndices[obj.group]] : g.books);
  }
  function viewOutside(spec,ids,st,expanded) {
    return '<div class="cb-books">'+ids.map(function(id){
      return objView(spec,getObj(spec,id),st,expanded);
    }).join("")+'</div>';
  }
  function fullLabels(spec,ids,perms) {
    var list=[];
    ids.forEach(function(id) {
      var obj=getObj(spec,id);
      if(obj.type==="single") list.push(obj.label);
      else list.push.apply(list,perms[obj.group] || spec.groups[obj.group].books);
    });
    return list;
  }
  function chosenInside(spec,st) {return spec.groups.map(function(g,i){return g.perms[st.orderIndices[i]];});}
  function currentIds(st) {return st.placed.length===st.spec.n?st.placed:st.spec.objects.map(function(o){return o.id;});}
  function outsideVariant(st) {
    var arr=currentIds(st).slice();
    if(st.outerVariant===1 && arr.length>1){var tmp=arr[0]; arr[0]=arr[1]; arr[1]=tmp;}
    return arr;
  }
  function factorCards(n,completed) {
    return '<div class="cb-math-strip">'+Array.from({length:n},function(_,i){
      return (i>0?'<span class="cb-times">×</span>':'')+
        '<span class="cb-number" style="opacity:'+((i<completed?1:i===completed?.84:.4))+'">'+(n-i)+'<small>spot '+(i+1)+'</small></span>';
    }).join("")+'</div>';
  }
  function maybeTree(spec) {
    var firstThree=spec.objects.slice(0,3);
    var branches=firstThree.map(function(first,i){
      var rest=firstThree.filter(function(x){return x.id!==first.id;});
      return '<div class="cb-tree-branch"><b>Start: '+escapeHtml(first.name)+'</b>'+
        rest.map(function(second){
          var last=rest.find(function(x){return x.id!==second.id;});
          return '<div class="cb-tree-leaf">'+escapeHtml(first.name)+' → '+escapeHtml(second.name)+' → '+escapeHtml(last.name)+'</div>';
        }).join("")+'</div>';
    }).join("");
    return '<div class="cb-figure"><span class="cb-fig-title">Look at just 3 objects — ALL 6 complete orders</span>'+
      '<div class="cb-tree">'+branches+'</div>'+
      '<div class="cb-nudge"><strong>Why 3 × 2 × 1?</strong> Three choices to start. Under EACH start, two choices come next. The last one is forced. That makes 6 whole orders, not 3 + 2 + 1.</div></div>';
  }
  function twoSpotPairs(spec) {
    var rows=spec.objects.map(function(first){
      var remaining=spec.objects.filter(function(second){return second.id!==first.id;});
      return '<div class="cb-branch"><strong>First: '+escapeHtml(first.name)+'</strong><span>'+remaining.map(function(o){return escapeHtml(o.name);}).join(" · ")+'</span></div>';
    }).join("");
    return '<details class="cb-alternate"><summary>Still unsure? Show ALL '+spec.n+' × '+(spec.n-1)+' = '+(spec.n*(spec.n-1))+' possible first-two-position choices</summary>'+
      '<div class="cb-branch-list">'+rows+'</div><p class="cb-copy">Each row has '+(spec.n-1)+' possible second choices. There are '+spec.n+' rows, so '+spec.n+' × '+(spec.n-1)+' = '+(spec.n*(spec.n-1))+' two-position beginnings, not '+(spec.n+(spec.n-1))+'.</p></details>';
  }

  function messyRemaining(spec,done) {
    var groups=spec.groups.slice(done).map(function(g){return g.books.slice();});
    var singles=spec.singles.slice();
    var result=[];
    while(groups.some(function(g){return g.length>0;}) || singles.length) {
      groups.forEach(function(g){if(g.length)result.push(g.shift());});
      if(singles.length)result.push(singles.shift());
    }
    return result;
  }
  function sceneBand(st) {
    var spec=st.spec,done=st.bandCount;
    var bundled=spec.groups.slice(0,done).map(function(g){return groupView(g,g.books);}).join("");
    var messy=messyRemaining(spec,done).map(book).join("");
    var nBooks=actualBooks(spec).length;
    var nextGroup=spec.groups[done];
    return '<h3 class="cb-title">1. Make the groups you are not allowed to split</h3>'+
      '<p class="cb-question">Which books MUST touch each other? Can another book go between them?</p>'+
      '<p class="cb-copy">No! Look at this mixed-up shelf. Books from the same required group are separated. Click the button to pull each group together and wrap a pretend rubber band around it.</p>'+
      '<div class="cb-figure"><span class="cb-fig-title">'+(done===0?'✗ Before: the shelf breaks the rules':done<spec.groups.length?'Not finished: another group is still separated':'✓ After: every required group is together')+'</span>'+
      '<div class="cb-books">'+bundled+messy+'</div>'+
      '<div class="cb-legend"><b>Band = ONE movable object</b><span>Books can still swap positions INSIDE it.</span></div></div>'+
      '<span class="cb-tag '+(done<spec.groups.length?'warning':'')+'">'+
        (done===0?'✗ Matching books are separated':
          done<spec.groups.length?'△ Some groups are together; not all yet':
          '✓ All required groups are together')+'</span>'+
      '<div class="cb-nudge">'+(done===0?
        'Count the BOOKS first: '+nBooks+' real books. But we want to count the big pieces we can move without breaking the rule.' :
        done<spec.groups.length?
        '<strong>'+escapeHtml(spec.groups[done-1].name)+' is ONE movable piece now.</strong> There is still another separated group to fix.' :
        '<strong>Now look carefully:</strong> there are still '+nBooks+' real books, but only <strong>'+spec.n+' pieces to move</strong> on the outside shelf.')+'</div>'+
      '<div class="cb-actions">'+(nextGroup?
        '<button type="button" class="cb-button primary" data-cb-action="band">Pull '+escapeHtml(nextGroup.name)+' books together and band them →</button>' :
        '<span class="cb-tag">✓ All bands are ready</span>')+
      '<button type="button" class="cb-button" data-cb-action="reset-bands">↺ Start with the messy shelf</button></div>'+
      (done===spec.groups.length?'<div class="cb-count">'+spec.groups.length+' banded groups + '+spec.singles.length+' individual books = '+spec.n+' movable objects</div>':'')+
      '<p class="cb-shortcut"><strong>Visual rule:</strong> If you cannot insert a different book in the middle, surround the books with a band and move the entire band as ONE piece.</p>';
  }

  /* Derivation first, notation last: count every full ordering for
     two, three and four objects, then reuse that argument for this problem. */
  function orderChip(items) {
    return '<span class="cb-order" role="listitem">'+items.map(function(o){return escapeHtml(o.name || o);}).join(' → ')+'</span>';
  }
  function factorialDiscovery(st) {
    var level=st.factorialLevel, spec=st.spec, n=spec.n;
    var titles=[
      "Start with only 2 different books",
      "Add a third book: where do the 6 orders come from?",
      "Add a fourth book: why 4 × 6, not 4 + 6?",
      "Use the actual "+n+" movable objects in THIS problem",
      "General rule: why this works for ANY n"
    ];
    var body="", result="";
    if(level===0){
      body='<p>Put A and B in TWO positions. If A goes first, B must go second. If B goes first, A must go second. <strong>These are ALL the possibilities.</strong></p>'+
        '<div class="cb-order-buckets"><div class="cb-order-bucket"><b>First choice: A</b><div class="cb-order-list">'+orderChip(["A","B"])+'</div><small>Only B remains</small></div>'+
        '<div class="cb-order-bucket"><b>First choice: B</b><div class="cb-order-list">'+orderChip(["B","A"])+'</div><small>Only A remains</small></div></div>'+
        '<p>There are <strong>2 choices for position 1</strong> and <strong>1 forced choice for position 2</strong>. Each first choice creates one full order.</p>';
      result='2 × 1 = 2 complete orders. We call this 2!';
    }else if(level===1){
      var a=["A","B","C"];
      body='<p>Choose the <strong>FIRST</strong> book. Then count the <strong>two</strong> ways of arranging the other two. Notice that the same “2 ways” happens under <em>each</em> first choice.</p>'+
        '<div class="cb-order-buckets">'+a.map(function(first){
          var endings=permute(a.filter(function(x){return x!==first;}));
          return '<div class="cb-order-bucket"><b>First book: '+first+'</b><small>Two endings for this first book:</small><div class="cb-order-list">'+
            endings.map(function(end){return orderChip([first].concat(end));}).join('')+'</div><small>2 complete orders in this row</small></div>';
        }).join('')+'</div>'+
        '<p>Count the rows: <strong>2 + 2 + 2 = 6.</strong> Because the 2 endings repeat for <em>all 3</em> first choices, that is <strong>3 groups of 2 = 3 × 2</strong>. The last position is forced, so its factor is × 1.</p>';
      result='3 × 2 × 1 = 6 complete orders. We call this 3!';
    }else if(level===2){
      var a4=["A","B","C","D"];
      body='<p>Fix the first book. There are <strong>3 books left</strong>. You just discovered that <strong>3 different books have 6 orders</strong>. Therefore, whichever first book you choose, there are 6 ways to finish.</p>'+
        '<div class="cb-order-buckets">'+a4.map(function(first){
          var endings=permute(a4.filter(function(x){return x!==first;}));
          return '<div class="cb-order-bucket"><b>First: '+first+' → 6 endings</b>'+
            '<div class="cb-order-list">'+endings.map(function(end){return orderChip([first].concat(end));}).join('')+'</div></div>';
        }).join('')+'</div>'+
        '<p>We have <strong>4 rows</strong> with <strong>6 complete arrangements in EACH row</strong>, so 6 + 6 + 6 + 6 = 4 × 6 = 24. Since 6 = 3 × 2 × 1, we get 4 × 3 × 2 × 1.</p>';
      result='4 × 3 × 2 × 1 = 24 complete orders. We call this 4!';
    }else if(level===3){
      var objects=spec.objects;
      var selected=Math.max(0,Math.min(objects.length-1,st.factorialBranch));
      var first=objects[selected];
      var remainder=objects.filter(function(o){return o.id!==first.id;});
      var endings=permute(remainder);
      var count=factorial(n-1);
      body='<p>The outside objects are <strong>'+objects.map(function(o){return escapeHtml(o.name);}).join(', ')+'</strong>. Pick any object for the first position. Once it is fixed, there are <strong>'+(n-1)+' objects left</strong>, and you already know how to count their arrangements.</p>'+
        '<div class="cb-first-branch" role="group" aria-label="Choose a first object to inspect">'+objects.map(function(o,i){
          return '<button type="button" class="cb-branch-button" data-cb-action="factorial-branch" data-index="'+i+'" aria-pressed="'+(i===selected?'true':'false')+'">'+
            escapeHtml(o.name)+' <small>'+fmt(count)+' endings</small></button>';
        }).join('')+'</div>'+
        '<div class="cb-order-bucket"><b>First object: '+escapeHtml(first.name)+'</b>'+
        '<p>Keep this object first. These are <strong>all '+fmt(count)+'</strong> possible endings (each full sequence uses every outside object exactly once):</p>'+
        '<div class="cb-order-list cb-order-list-scroll" role="list">'+endings.map(function(end){return orderChip([first].concat(end));}).join('')+'</div>'+
        '<small>Change the first object above. Every button reveals a different set of '+fmt(count)+' whole orders, with NO overlap because the first object is different.</small></div>'+
        '<p><strong>'+n+' choices for the first object</strong>, with <strong>'+fmt(count)+' endings for each</strong>, gives '+n+' groups of '+fmt(count)+'.</p>';
      result=n+' × '+(n-1)+'! = '+n+' × '+fmt(count)+' = '+fmt(spec.outerWays)+' = '+n+'! outside orders';
    }else{
      body='<p>For <strong>n different objects</strong> arranged in a line, the first position has <strong>n choices</strong>. After you choose one, only <strong>n − 1</strong> remain. Every one of the n first choices has the same number of ways to finish: <strong>(n − 1)!</strong>.</p>'+
        '<div class="cb-general-steps">'+
        '<div><b>1 object</b><span>Only 1 order</span><strong>1! = 1</strong></div>'+
        '<div><b>2 objects</b><span>2 first choices × 1 ending each</span><strong>2! = 2 × 1</strong></div>'+
        '<div><b>3 objects</b><span>3 first choices × 2 endings each</span><strong>3! = 3 × 2 × 1</strong></div>'+
        '<div><b>4 objects</b><span>4 first choices × 3! endings each</span><strong>4! = 4 × 3 × 2 × 1</strong></div>'+
        '<div><b>n objects</b><span>n first choices × (n − 1)! endings each</span><strong>n! = n × (n − 1) × ··· × 1</strong></div></div>'+
        '<div class="cb-nudge"><strong>Why none are missed or repeated:</strong> Every complete order has exactly ONE first object, so it belongs to exactly ONE row. Within that row, each distinct order of the remaining books appears exactly once.</div>'+
        '<p>This formula applies when <strong>all n objects are different</strong>, every object is used exactly once, and their positions form a line.</p>';
      result='n! = n × (n − 1) × (n − 2) × ··· × 2 × 1';
    }
    return '<section class="cb-factorial-lab" aria-label="Discover why n factorial counts arrangements">'+
      '<div class="cb-factorial-top"><span class="cb-tag">DISCOVER n! · '+(level+1)+' / 5</span>'+
      '<span class="cb-factorial-markers" aria-hidden="true">'+Array.from({length:5},function(_,i){return '<span class="'+(i<=level?'active':'')+'"></span>';}).join('')+'</span></div>'+
      '<h4>'+titles[level]+'</h4>'+body+'<div class="cb-count">'+result+'</div>'+
      '<div class="cb-factorial-actions">'+
      '<button type="button" class="cb-button" data-cb-action="factorial-prev" '+(level===0?'disabled':'')+'>← Earlier example</button>'+
      '<button type="button" class="cb-button primary" data-cb-action="factorial-next" '+(level===4?'disabled':'')+'>'+
      (level===4?'Rule discovered ✓':['Add a third book →','Add a fourth book →','Apply it to our shelf →','Explain the general n! rule →'][level])+'</button>'+
      '<button type="button" class="cb-button" data-cb-action="factorial-restart">↺ Start with 2 books</button></div>'+
      '<p class="cb-shortcut">Question to ask: <em>“If I fix the first object, how many different ways can I finish?”</em></p></section>';
  }

  function sceneOutside(st) {
    var spec=st.spec,ids=st.placed;
    var available=spec.objects.filter(function(o){return ids.indexOf(o.id)===-1;});
    var n=spec.n,k=ids.length;
    var slots=Array.from({length:n},function(_,i){
      var id=ids[i];
      if(!id)return '<div class="cb-position"><span class="hint">Spot '+(i+1)+'<br>?</span></div>';
      return '<div class="cb-position filled" style="animation-delay:'+(i*30)+'ms">'+
        '<div>'+objView(spec,getObj(spec,id),st,false)+'</div></div>';
    }).join("");
    var nextCount=n-k;
    var sentence=k===0? 'Every object can go into the FIRST position. There are '+n+' choices.' :
      k===n? 'You made ONE outside order. But any first choice is allowed, and each has further branches. The total is '+fmt(spec.outerWays)+' different outside orders.' :
      'You chose an object for spot '+k+'. That object cannot be used again. For the next position you now have '+nextCount+' choices.';
    var options=available.map(function(o){
      return '<button type="button" class="cb-pick" data-cb-action="pick" data-id="'+escapeHtml(o.id)+'" aria-label="Put '+escapeHtml(o.name)+' into position '+(k+1)+'">'+
        '<span class="cb-tile">'+objView(spec,o,st,false)+'<small>Choose this</small></span></button>';
    }).join("");
    var directions=k<n?'Tap an object below to place it in spot '+(k+1)+'. Watch the number of available choices shrink.':'You have filled all the outside positions. Now count all the OTHER orders you could have built.';
    var math=k===n?
      '<div class="cb-count">'+chain(n)+' = '+n+'! = '+fmt(spec.outerWays)+' outside orders</div>'+
      '<p class="cb-copy">You saw '+n+' possibilities for spot 1, then '+(n-1)+' for spot 2 <em>for each first choice</em>, then fewer choices at every step. That branching is the reason for multiplication.</p>'+maybeTree(spec)+twoSpotPairs(spec) :
      '<p class="cb-copy">'+sentence+'</p>'+
      (k>0?'<div class="cb-nudge"><strong>Why multiply?</strong> For EACH possible first object, the remaining '+(n-1)+' choices are available again in the second spot. That is '+n+' groups of '+(n-1)+' possible beginnings, or '+n+' × '+(n-1)+'. Try the full example above to see why the branching continues.</div>':'');
    return '<h3 class="cb-title">2. Fill the shelf using ONLY the movable objects</h3>'+
      '<p class="cb-question">How many different outside orders are possible for these '+n+' objects?</p>'+
      '<p class="cb-copy">'+directions+'</p>'+
      factorialDiscovery(st)+
      '<div class="cb-figure"><span class="cb-fig-title">Shelf slots — select objects one by one</span><div class="cb-positions">'+slots+'</div>'+
      (k<n?'<span class="cb-tag">'+nextCount+' choices remain for spot '+(k+1)+'</span>':'<span class="cb-tag">✓ One legal outside order completed</span>')+'</div>'+
      factorCards(n,k)+
      (available.length?'<div class="cb-figure"><span class="cb-fig-title">Available objects — tap one to place it</span><div class="cb-tray">'+options+'</div></div>':'')+
      '<div class="cb-actions"><button type="button" class="cb-button" data-cb-action="undo" '+(k===0?'disabled':'')+'>← Undo last</button>'+
      (k<n?'<button type="button" class="cb-button" data-cb-action="fill">Fill the rest for me</button>':'')+
      '<button type="button" class="cb-button" data-cb-action="clear-placements">↺ Rearrange outside</button></div>'+
      math;
  }
  function sceneInside(st) {
    var spec=st.spec,objects=currentIds(st);
    var allReady=st.didSwap.every(Boolean);
    var options=spec.groups.map(function(g,i){
      var order=g.perms[st.orderIndices[i]];
      return '<div class="cb-option"><b>'+escapeHtml(g.name)+' block — '+fmt(g.perms.length)+' internal orders</b>'+
        '<small>The outside block stays in the SAME shelf spot.</small><div class="cb-books">'+order.map(book).join("")+'</div>'+
        '<small>Example '+(st.orderIndices[i]+1)+' of '+fmt(g.perms.length)+' · '+chain(g.books.length)+' = '+g.books.length+'!</small>'+
        '<p class="cb-copy">Why '+g.books.length+'!? First book: '+g.books.length+' choices. After choosing it, '+(g.books.length-1)+' remain for the second position. Continue until the final book is forced.</p>'+
        '<details class="cb-alternate"><summary>See every one of the '+fmt(g.perms.length)+' different '+escapeHtml(g.name)+' orders</summary>'+
          '<div class="cb-order-list cb-order-list-scroll" role="list">'+g.perms.map(function(order){return orderChip(order);}).join("")+'</div></details>'+
        '<div class="cb-actions"><button type="button" class="cb-button primary" data-cb-action="swap" data-index="'+i+'">↻ Change '+escapeHtml(g.name)+' order</button></div>'+
        '<small>'+(st.didSwap[i]?'✓ You made a different legal shelf.':'Try swapping these books at least once.')+'</small></div>';
    }).join("");
    return '<h3 class="cb-title">3. Keep the outside shelf still. Change the books INSIDE</h3>'+
      '<p class="cb-question">If a group stays together, can its books change order?</p>'+
      '<p class="cb-copy">YES! Watch what happens when you swap books inside a band: the band has not moved, but the finished shelf is different. So outside arrangements alone are not the answer.</p>'+
      '<div class="cb-figure"><span class="cb-fig-title">The SAME outside order, with real books inside</span>'+
      viewOutside(spec,objects,st,true)+'</div>'+
      '<div class="cb-option-grid">'+options+'</div>'+
      '<div class="cb-nudge"><strong>Count the inside options for ONE fixed outside order.</strong> '+
      spec.groups.map(function(g){return escapeHtml(g.name)+': '+g.books.length+'! = '+fmt(g.perms.length);}).join('; ')+
      '. We need an order inside <em>each</em> block, so every choice for the first block can combine with every choice for the others.</div>'+
      '<div class="cb-count">'+spec.groups.map(function(g){return fmt(g.perms.length);}).join(' × ')+
        ' = '+fmt(spec.insideWays)+' different complete shelves per outside order</div>'+
      '<p class="cb-shortcut">'+(allReady?'✓ You have changed the books inside every group.':'Try changing every group once, while leaving the outside order alone.')+'</p>';
  }
  function sampleInsideCombinations(spec,max) {
    var options=spec.groups.map(function(g){return g.perms.slice(0,Math.min(2,g.perms.length));});
    var combo=[[]];
    options.forEach(function(opts){
      combo=combo.flatMap(function(a){return opts.map(function(b){return a.concat([b]);});});
    });
    return combo.slice(0,max);
  }
  function insideTable(spec,ids) {
    if(spec.groups.length===2 && spec.insideWays<=24) {
      var g0=spec.groups[0],g1=spec.groups[1];
      var head='<thead><tr><th scope="col">'+escapeHtml(g0.name)+'</th>'+
        g1.perms.map(function(o){return '<th scope="col">'+escapeHtml(o.join(" "))+'</th>';}).join("")+'</tr></thead>';
      var rows=g0.perms.map(function(a){
        return '<tr><th scope="row">'+escapeHtml(a.join(" "))+'</th>'+
          g1.perms.map(function(b){
            return '<td>'+miniShelf(fullLabels(spec,ids,[a,b]))+'</td>';
          }).join("")+'</tr>';
      }).join("");
      return '<div class="cb-figure"><span class="cb-fig-title">ONE outside order — ALL '+spec.insideWays+' real shelves</span>'+
        '<p class="cb-copy">Read across: hold the '+escapeHtml(g0.name)+' order still and try every '+escapeHtml(g1.name)+' order. Then change the '+escapeHtml(g0.name)+' order and repeat. Each cell is a different finished shelf.</p>'+
        '<div class="cb-matrix-scroller"><table class="cb-matrix">'+head+'<tbody>'+rows+'</tbody></table></div>'+
        '<div class="cb-tag">Exactly '+spec.insideWays+' different complete shelves here</div></div>';
    }
    var samples=sampleInsideCombinations(spec,8);
    return '<div class="cb-figure"><span class="cb-fig-title">A few complete shelves for ONE fixed outside order</span>'+
      '<p class="cb-copy">These '+samples.length+' are just examples, NOT the entire list of '+fmt(spec.insideWays)+'.</p>'+
      '<div class="cb-card-row">'+samples.map(function(combo,i){
        return '<div class="cb-stat"><span>Example '+(i+1)+'</span>'+miniShelf(fullLabels(spec,ids,combo))+'</div>';
      }).join("")+'</div>'+
      '<p class="cb-copy">Counting every inside combination gives '+spec.groups.map(function(g){return g.books.length+'!';}).join(' × ')+
      ' = '+fmt(spec.insideWays)+' different finished shelves <em>for this one outside order</em>.</p></div>';
  }
  function scenePair(st) {
    var spec=st.spec,ids=outsideVariant(st);
    var outside=spec.outerWays,inside=spec.insideWays;
    var seen=spec.groups.map(function(g){return fmt(g.perms.length);});
    var formula=[spec.n+'!'].concat(spec.groups.map(function(g){return g.books.length+'!';})).join(" × ");
    var rows=outside<=6?Array.from({length:outside},function(_,i){return i+1;}):[1,2,3,outside];
    var branchRows=rows.map(function(x,idx){
      return '<div class="cb-branch"><strong>Outside arrangement #'+fmt(x)+'</strong><span>'+fmt(inside)+' complete shelves</span></div>'+
        ((idx===2 && outside>6)?'<div class="cb-copy" style="text-align:center">⋮ same '+fmt(inside)+' options for every other outside order ⋮</div>':'');
    }).join("");
    return '<h3 class="cb-title">4. Repeat the inside choices for EVERY outside arrangement</h3>'+
      '<p class="cb-question">You found '+fmt(outside)+' outside orders, and '+fmt(inside)+' inside combinations for each one. How many WHOLE shelves are there?</p>'+
      '<p class="cb-copy">Choose ONE outside order first. For that order, change the books inside the bands in all possible ways. Then pick a different outside order and do it all again.</p>'+
      '<div class="cb-figure"><span class="cb-fig-title">Outside arrangement example '+(st.outerVariant?'B':'A')+'</span>'+
      viewOutside(spec,ids,st,true)+
      '<div class="cb-actions"><button type="button" class="cb-button primary" data-cb-action="other-outer">↔ Move the blocks to a NEW outside order</button></div>'+
      '<p class="cb-shortcut">The outside layout changes, but it still has '+fmt(inside)+' possible inside combinations.</p></div>'+
      insideTable(spec,ids)+
      '<div class="cb-figure"><span class="cb-fig-title">'+fmt(outside)+' groups of '+fmt(inside)+' complete shelves</span><div class="cb-branch-list">'+branchRows+'</div>'+
      '<div class="cb-nudge"><strong>Multiplication is repeated addition:</strong> '+fmt(inside)+' + '+fmt(inside)+
      ' + ··· ('+fmt(outside)+' equal groups) = '+fmt(outside)+' × '+fmt(inside)+'.</div>'+
      '<div class="cb-count">'+fmt(outside)+' × '+fmt(inside)+' = '+fmt(spec.answer)+'</div></div>'+
      '<div class="cb-why"><strong>Why NOT add '+fmt(outside)+' + '+seen.join(" + ")+'?</strong> Because an outside order alone is not a finished shelf, and an inside order alone is not a finished shelf. You need BOTH choices to create one complete arrangement. Every outside order combines with every inside order.</div>'+
      '<div class="cb-card-row"><div class="cb-stat"><b>'+spec.n+'! = '+fmt(outside)+'</b><span>Different outside layouts</span></div>'+
      spec.groups.map(function(g){return '<div class="cb-stat"><b>'+g.books.length+'! = '+fmt(g.perms.length)+'</b><span>'+escapeHtml(g.name)+' orders inside one band</span></div>';}).join("")+'</div>'+
      '<div class="cb-answer">'+formula+' = '+fmt(spec.answer)+'</div>'+
      '<div class="cb-recall"><strong>Quick memory check</strong>'+
      '<p>Why are we multiplying instead of adding the numbers above?</p>'+
      '<div class="cb-actions"><button type="button" class="cb-button" data-cb-action="recall-wrong">Because multiplication gives a bigger number</button>'+
      '<button type="button" class="cb-button primary" data-cb-action="recall-correct">Because every outside order pairs with each inside order</button></div>'+
      '<div class="cb-response" role="status" aria-live="polite">'+escapeHtml(st.recall)+'</div></div>'+
      '<div class="cb-nudge"><strong>Remember the story:</strong> BAND the required books → FILL the outside positions → SWAP inside each band → PAIR every outside choice with every inside choice.</div>';
  }
  function canAdvance(st) {
    if(st.stage===0) return st.bandCount===st.spec.groups.length;
    if(st.stage===1) return st.placed.length===st.spec.n;
    if(st.stage===2) return st.didSwap.every(Boolean);
    return false;
  }
  function stageHeading(st) {
    if(st.stage===0)return "Make the bands";
    if(st.stage===1)return "Fill the outside";
    if(st.stage===2)return "Swap inside";
    return "Pair every choice";
  }
  function render(st,root,focusControl,action) {
    var moving = !reducedMotion && ["band","reset-bands","pick","undo","fill","clear-placements","swap","other-outer"].indexOf(action)>=0;
    var oldPositions=new Map();
    if(moving && root.querySelectorAll) {
      root.querySelectorAll(".cb-book[data-cb-label]").forEach(function(el) {
        if(!oldPositions.has(el.dataset.cbLabel))oldPositions.set(el.dataset.cbLabel,el.getBoundingClientRect());
      });
    }
    var content=[sceneBand,sceneOutside,sceneInside,scenePair][st.stage](st);
    var progress=Array.from({length:4},function(_,i){return '<span class="'+(i<=st.stage?'on':'')+'"></span>';}).join("");
    root.innerHTML='<div class="cb-shell"><div class="cb-progress"><strong>WHY IT WORKS · STEP '+(st.stage+1)+' OF 4</strong><div class="cb-dots" aria-hidden="true">'+progress+'</div></div>'+
      '<p class="cb-step-title">'+stageHeading(st)+'</p>'+
      '<div aria-live="polite">'+content+'</div>'+
      '<div class="cb-controls"><button type="button" class="cb-button" data-cb-action="prev" '+(st.stage===0?'disabled':'')+'>← Previous step</button>'+
      (st.stage===3?'<span class="cb-tag">✓ You reached the answer</span>':
      '<button type="button" class="cb-button primary" data-cb-action="next" '+(!canAdvance(st)?'disabled':'')+'>'+
      ['Next: fill the positions →','Next: swap inside →','Next: count complete shelves →'][st.stage]+'</button>')+
      '<button type="button" class="cb-button" data-cb-action="restart">↺ Replay from start</button></div></div>';
    if(moving && oldPositions.size) {
      var seenLabels=new Set();
      root.querySelectorAll(".cb-book[data-cb-label]").forEach(function(el){
        var label=el.dataset.cbLabel;
        if(seenLabels.has(label))return;
        seenLabels.add(label);
        var before=oldPositions.get(label);
        if(!before || !el.animate)return;
        var after=el.getBoundingClientRect();
        var dx=before.left-after.left,dy=before.top-after.top;
        if(Math.abs(dx)+Math.abs(dy)<3)return;
        el.animate([
          {transform:"translate("+dx+"px,"+dy+"px)",opacity:.75},
          {transform:"translate(0px,0px)",opacity:1}
        ],{duration:720,easing:"cubic-bezier(.18,.72,.25,1)"});
      });
    }
    if(focusControl) {
      var control=root.querySelector('[data-cb-action="'+focusControl+'"]');
      if(control && !control.disabled) control.focus({preventScroll:true});
    }
  }
  function attach(root,spec) {
    var st=freshState(spec);
    render(st,root);
    root.addEventListener("click",function(event) {
      var node=event.target.closest("[data-cb-action]");
      if(!node || !root.contains(node)) return;
      var action=node.dataset.cbAction,focus=null;
      if(action==="band"){
        st.bandCount=Math.min(spec.groups.length,st.bandCount+1);
        focus="band";
      }else if(action==="reset-bands"){
        st.bandCount=0;
        focus="band";
      }else if(action==="pick"){
        var id=node.dataset.id;
        if(st.placed.indexOf(id)<0 && getObj(spec,id))st.placed.push(id);
      }else if(action==="undo"){
        st.placed.pop();focus="undo";
      }else if(action==="fill"){
        st.placed=st.placed.concat(spec.objects.map(function(o){return o.id;}).filter(function(id){return st.placed.indexOf(id)<0;}));
        focus="next";
      }else if(action==="clear-placements"){
        st.placed=[];focus="fill";
      }else if(action==="factorial-next"){
        st.factorialLevel=Math.min(4,st.factorialLevel+1);focus="factorial-next";
      }else if(action==="factorial-prev"){
        st.factorialLevel=Math.max(0,st.factorialLevel-1);focus="factorial-next";
      }else if(action==="factorial-restart"){
        st.factorialLevel=0;st.factorialBranch=0;focus="factorial-next";
      }else if(action==="factorial-branch"){
        var branchIndex=Number(node.dataset.index);
        if(Number.isInteger(branchIndex) && branchIndex>=0 && branchIndex<spec.n)st.factorialBranch=branchIndex;
      }else if(action==="swap"){
        var i=Number(node.dataset.index);
        if(Number.isInteger(i) && i>=0 && i<spec.groups.length){
          st.orderIndices[i]=(st.orderIndices[i]+1)%spec.groups[i].perms.length;
          st.didSwap[i]=true;focus="swap";
        }
      }else if(action==="other-outer"){
        st.outerVariant=st.outerVariant===0?1:0;focus="other-outer";
      }else if(action==="recall-correct"){
        st.recall="✓ Exactly. For every outside layout, there are all the inside variations — like rows and columns in a grid.";
        focus="recall-correct";
      }else if(action==="recall-wrong"){
        st.recall="Try again: we multiply even when the answer is small. The reason is that every complete shelf combines multiple choices.";
        focus="recall-wrong";
      }else if(action==="next"){
        if(canAdvance(st) && st.stage<3){st.stage++; focus="prev";}
      }else if(action==="prev"){
        st.stage=Math.max(0,st.stage-1);focus="next";
      }else if(action==="restart"){
        st=freshState(spec);focus="band";
      }else return;
      render(st,root,focus,action);
      if(action==="next"||action==="prev"||action==="restart"){
        var heading=root.querySelector(".cb-progress");
        if(heading) heading.scrollIntoView({behavior:reducedMotion?"auto":"smooth",block:"nearest"});
      }
    });
  }
  var main=document.getElementById("why-tutor");
  if(main)attach(main,specs[0]);
  specs.forEach(function(spec) {
    var card=document.getElementById(spec.id);
    if(!card)return;
    var solution=card.querySelector(".solution");
    if(!solution)return;
    var root=document.createElement("div");
    root.className="cb-lesson";
    root.setAttribute("aria-label","Interactive counting explanation");
    solution.insertBefore(root,solution.querySelector(".steps"));
    var written=document.createElement("details");
    written.className="cb-written";
    written.innerHTML="<summary>Read the original written calculation</summary>";
    [".steps",".formula",".note"].forEach(function(selector){
      var old=solution.querySelector(selector);
      if(old)written.appendChild(old);
    });
    solution.appendChild(written);
    attach(root,spec);
  });
})();
