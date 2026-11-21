/* Visual-first counting lessons for the AMC 8 book arrangement practice.
   Deliberately show whole shelves, not abstract factor labels. */
(function () {
  "use strict";
  var lab = document.getElementById("why-counting");
  if (!lab) return;
  var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function byId(id) { return document.getElementById(id); }
  function factorial(n) { var r = 1; for (var i = 2; i <= n; i++) r *= i; return r; }
  function commas(n) { return n.toLocaleString("en-US"); }
  function descending(n) { return Array.from({length:n},function(_,i){return n-i;}).join(" × "); }
  function permutation(items) {
    if (items.length === 0) return [[]];
    return items.flatMap(function(item,idx){
      return permutation(items.filter(function(_,j){return j !== idx;})).map(function(tail){return [item].concat(tail);});
    });
  }
  function classFor(label) {
    if (/^F/.test(label)) return "";
    if (/^(J|H|C)/.test(label)) return "blue";
    if (/^(I|N|P)/.test(label)) return "gold";
    return "green";
  }
  function miniBook(label) { return '<span class="why-mini-book ' + classFor(label) + '">' + label + '</span>'; }
  function miniBooks(labels) { return '<span class="why-mini-books">' + labels.map(miniBook).join("") + '</span>'; }
  function putText(id, s) { byId(id).textContent = s; }
  function counterButtons(prefix, step, max, captions) {
    var previous = byId(prefix + "-prev"), next = byId(prefix + "-next");
    previous.disabled = step <= 0;
    next.disabled = step >= max;
    next.textContent = step < max ? captions[step] : "Completed ✓";
    putText(prefix + "-step", "Step " + (step+1) + " of " + (max+1));
  }
  var tabs = Array.from(document.querySelectorAll(".why-tab"));
  function openTab(name) {
    tabs.forEach(function(tab) {
      var on = tab.dataset.tab === name;
      tab.setAttribute("aria-pressed", on ? "true" : "false");
      byId("why-panel-" + tab.dataset.tab).hidden = !on;
    });
  }
  tabs.forEach(function (tab) { tab.addEventListener("click", function(){openTab(tab.dataset.tab);}); });
  document.querySelectorAll("[data-why-next]").forEach(function(btn) {
    btn.addEventListener("click",function(){openTab(btn.dataset.whyNext);lab.scrollIntoView({behavior:"smooth",block:"start"});});
  });
  openTab("block");

  /* 1: Four physical books. Preserve DOM elements so CSS left transitions
     visibly move and exchange books instead of fading in new explanations. */
  var groupStep = 0;
  var positions = [
    {F1:0,J1:70,F2:140,J2:210},
    {F1:0,F2:55,J1:140,J2:210},
    {J1:0,F1:70,F2:125,J2:220},
    {J1:0,F2:70,F1:125,J2:220}
  ];
  var groupLines = [
    "F1 and F2 are separated by J1. This arrangement does NOT satisfy “stay together.”",
    "Move F2 beside F1, and wrap a band around them. Now [F1 F2] is ONE outside object, while J1 and J2 are two more.",
    "Move the WHOLE [F1 F2] block past J1. The two French books move as a unit, so they remain neighbors.",
    "Now swap F1 and F2 INSIDE the band. The band stays intact, but this is a different valid shelf! We must count inside orders too."
  ];
  var groupButtonLabels = ["Make a block →","Move the block →","Swap inside the block →"];
  function renderGroup() {
    Object.keys(positions[groupStep]).forEach(function(label){
      byId("physical-" + label).style.left = positions[groupStep][label] + "px";
    });
    var band = byId("physical-band");
    band.style.left = groupStep <= 1 ? "-6px" : "64px";
    band.style.opacity = groupStep > 0 ? "1" : "0";
    byId("physical-caption").textContent = groupLines[groupStep];
    byId("physical-band-label").textContent =
      groupStep === 0 ? "Different books · no grouping yet" :
      groupStep === 1 ? "3 outside objects: [F1 F2], J1, J2" :
      "3 outside objects — the French pair remains a block";
    var status = byId("physical-validity");
    status.className = "why-state" + (groupStep === 0 ? " invalid" : "");
    status.textContent = groupStep === 0 ? "✗ French books separated" : "✓ French books stay together";
    counterButtons("block", groupStep, 3, groupButtonLabels);
  }
  byId("block-next").addEventListener("click", function(){groupStep=Math.min(3,groupStep+1);renderGroup();});
  byId("block-prev").addEventListener("click", function(){groupStep=Math.max(0,groupStep-1);renderGroup();});
  byId("block-reset").addEventListener("click", function(){groupStep=0;renderGroup();});
  renderGroup();

  /* 2: A real permutation tree, displaying all six complete arrangements.
     Students see 3 branches, then 2 under EVERY branch, then a final forced choice. */
  var factorialStep = 0;
  var objects = ["F-block","J1","J2"];
  var factorialLines = [
    "First position: pick any of the 3 different objects. Those are three separate branches.",
    "After EACH first choice, there are exactly 2 different objects left for position 2. So each of the 3 branches splits into two.",
    "The third spot is forced: only 1 object remains. Follow each path to see all 6 complete orders, with no repeats.",
    "The logic scales: with 4 objects it is 4 × 3 × 2 × 1 = 24. Adding gives 4 + 3 + 2 + 1 = 10, which is wrong."
  ];
  var factorialButtonLabels = ["Show the two branches for each first choice →","Fill the final spot and count all six →","Try four objects →"];
  function shortObject(s) {return s === "F-block" ? "[F]" : s;}
  function renderFactorial() {
    byId("factorial-explain").textContent = factorialLines[factorialStep];
    byId("factorial-tree").innerHTML = objects.map(function(first,i) {
      var rest = objects.filter(function(x){return x !== first;});
      var outcomes = rest.map(function(second,j){
        var last = rest.find(function(x){return x!==second;});
        var shown = factorialStep === 0 ? "?" :
          factorialStep === 1 ? shortObject(first) + " → " + shortObject(second) + " → ?" :
          shortObject(first) + " → " + shortObject(second) + " → " + shortObject(last);
        return '<div class="why-tree-leaf why-fade-in" style="--delay:'+(i*100+j*70)+'ms">' +
          '<small>' + (factorialStep === 0 ? "Next choices hidden" : "Path " + (i*2+j+1)) +
          '</small><strong>' + shown + '</strong></div>';
      }).join("");
      return '<div class="why-tree-row"><div class="why-tree-first"><span>' +
        shortObject(first) + '</span><small>1st choice</small></div>' +
        '<div class="why-tree-branches">' + outcomes + '</div></div>';
    }).join("");
    byId("factorial-equation").textContent = factorialStep < 2 ?
      (factorialStep === 0 ? "3 possible starts" : "3 first choices × 2 second choices = 6 partial paths") :
      "3 × 2 × 1 = 3! = 6 complete arrangements";
    byId("factorial-four").hidden = factorialStep !== 3;
    counterButtons("factorial",factorialStep,3,factorialButtonLabels);
  }
  byId("factorial-next").addEventListener("click", function(){factorialStep=Math.min(3,factorialStep+1);renderFactorial();});
  byId("factorial-prev").addEventListener("click", function(){factorialStep=Math.max(0,factorialStep-1);renderFactorial();});
  byId("factorial-reset").addEventListener("click", function(){factorialStep=0;renderFactorial();});
  renderFactorial();

  /* 3: Cartesian product using 12 ACTUAL complete shelves.
     6 positions of [F1 F2], J1, J2; 2 possible orders inside F block. */
  var productStep = 0;
  var outside = permutation(["F","J1","J2"]);
  var productLines = [
    "First, treat [F1 F2] as a single block. That block, J1, and J2 give 3! = 6 possible OUTSIDE layouts. Each row is one.",
    "Keep F1 before F2 inside each outside layout. That creates 6 different full shelves (the left column).",
    "Reverse the two French books inside EACH outside layout. Now there are 6 MORE shelves (the right column). Count all 12.",
    "For EVERY one of the 6 outside layouts, there are 2 inside orders. Six rows with two shelves per row: 6 × 2 = 12. No shelf is missed or counted twice."
  ];
  var productButtonLabels = ["Put F1 F2 into every outside layout →","Also put F2 F1 into every layout →","Explain why not addition →"];
  function completeShelf(order,reversed) {
    var labels = [];
    order.forEach(function(part) {
      if (part==="F") labels.push.apply(labels, reversed ? ["F2","F1"] : ["F1","F2"]);
      else labels.push(part);
    });
    return miniBooks(labels);
  }
  function renderProduct() {
    putText("product-explain",productLines[productStep]);
    var tbody = byId("product-table-body");
    tbody.innerHTML = outside.map(function(order,i){
      var label = order.map(function(x){return x==="F"?"[F block]":x;}).join(" · ");
      return '<tr class="why-fade-in" style="--delay:'+(i*65)+'ms">' +
        '<th scope="row"><strong>#'+(i+1)+'</strong><div>'+label+'</div></th>' +
        '<td class="'+(productStep<1?"placeholder":"")+'">' + (productStep>=1?completeShelf(order,false):"—")+'</td>' +
        '<td class="'+(productStep<2?"placeholder":"")+'">' + (productStep>=2?completeShelf(order,true):"—")+'</td></tr>';
    }).join("");
    putText("product-equation",productStep===0 ? "6 outside layouts; inside still undecided" :
      productStep===1 ? "6 × 1 = 6 complete shelves so far" :
      "6 outside × 2 inside = 12 complete shelves");
    byId("product-rules").hidden = productStep !== 3;
    counterButtons("product", productStep, 3, productButtonLabels);
  }
  byId("product-next").addEventListener("click",function(){productStep=Math.min(3,productStep+1);renderProduct();});
  byId("product-prev").addEventListener("click",function(){productStep=Math.max(0,productStep-1);renderProduct();});
  byId("product-reset").addEventListener("click",function(){productStep=0;renderProduct();});
  renderProduct();

  /* 4: Apply exactly the same demonstrations to the existing three quizzes.
     No hard-coded answer changes. Existing questions and scoring remain intact. */
  var specs = [
    {id:"question-1", blocks:[
      {name:"French",books:["F1","F2","F3"]},
      {name:"Italian",books:["I1","I2"]}
    ],singles:["J1","J2","J3"],answer:1440},
    {id:"question-2", blocks:[
      {name:"Science",books:["S1","S2"]},
      {name:"Novels",books:["N1","N2","N3","N4","N5"]}
    ],singles:["H1","H2","H3"],answer:28800},
    {id:"question-3", blocks:[
      {name:"Mathematics",books:["M1","M2","M3"]},
      {name:"Physics",books:["P1","P2","P3"]},
      {name:"Chemistry",books:["C1","C2","C3","C4"]}
    ],singles:[],answer:5184}
  ];
  var walks = [];
  function outsideObjects(spec) {
    return spec.blocks.map(function(g,i){return {type:"block",group:g,id:"block"+i};})
      .concat(spec.singles.map(function(s){return {type:"single",id:s};}));
  }
  function groupedObject(obj,reverse,delay) {
    if (obj.type === "single") {
      return '<span class="walk2-single" style="--delay:'+(delay||0)+'ms">'+miniBook(obj.id)+'</span>';
    }
    var group = obj.group;
    var arr = reverse ? group.books.slice().reverse() : group.books;
    return '<span class="walk2-block" style="--delay:'+(delay||0)+'ms"><small>'+group.name+' block</small>'+
      miniBooks(arr)+'</span>';
  }
  function outsideVisual(list, reverseFirst) {
    return '<div class="walk2-shelf">' + list.map(function(obj,i){
      return groupedObject(obj,reverseFirst && obj.type==="block" && obj===list.find(function(e){return e.type==="block";}),i*65);
    }).join("")+'</div>';
  }
  function walkContent(state) {
    var spec = state.spec;
    var stage = state.step;
    var objects = outsideObjects(spec);
    var outerN = objects.length, outerWays = factorial(outerN);
    var insideWays = spec.blocks.reduce(function(acc,g){return acc*factorial(g.books.length);},1);
    var lastSequence = objects.slice().reverse();
    var original = state.original;
    var formula = [outerN+"!"].concat(spec.blocks.map(function(g){return g.books.length+"!";})).join(" × ");
    var heading, description, visual;
    if (stage===0) {
      heading = "Start with the actual books";
      description = "All books have different labels. Some must be neighbors, but they are still different books. Count only arrangements that obey the rule.";
      visual = '<div class="walk2-shelf">'+original.map(function(label,i){return '<span class="walk2-single" style="--delay:'+(i*65)+'ms">'+miniBook(label)+'</span>';}).join("")+'</div>'+
        '<span class="why-state">'+original.length+' different books</span>';
    } else if (stage===1) {
      heading = "Make one movable block for each required group";
      description = "Put a pretend rubber band around each required group. Count the band as ONE object when moving things on the shelf. The books inside the band are still free to swap later.";
      visual = outsideVisual(objects,false)+
        '<div class="walk2-math">'+spec.blocks.length+' blocks + '+spec.singles.length+' single books = '+outerN+' outside objects</div>';
    } else if (stage===2) {
      heading = "Rearrange the outside objects WITHOUT breaking the bands";
      description = "Notice that moving a band never splits it. The entire group goes to another spot. Each different outside order gives a new arrangement of the big objects.";
      visual = '<strong>Outside order A</strong>'+outsideVisual(objects,false)+
        '<strong>Outside order B</strong>'+outsideVisual(lastSequence,false)+
        '<div class="walk2-math">'+outerN+' movable objects</div><p class="walk2-note">We count how many outside orders exist next. We are NOT done yet, because inside orders also matter.</p>';
    } else if (stage===3) {
      heading = "Why exactly "+outerN+"! outside orders?";
      description = "Choose the first outside object: "+outerN+" options. Once chosen, that object cannot be reused. So the next spot has "+(outerN-1)+" choices, then fewer, until 1 remains. Every choice branches into the remaining choices.";
      visual = '<div class="walk2-choicebar">' + Array.from({length:outerN},function(_,i){
        return '<div class="walk2-choice" style="--delay:'+(i*80)+'ms">'+(outerN-i)+'<small>spot '+(i+1)+'</small></div>';
      }).join("")+'</div><div class="walk2-math">'+descending(outerN)+' = '+outerN+'! = '+commas(outerWays)+'</div>'+
        '<p class="walk2-note">Each first choice leads to ('+(outerN-1)+')! ways to finish. For example, '+outerN+' × '+(outerN-1)+'! = '+commas(outerWays)+'. <button class="why-lesson-link" type="button" data-open-why="factorial">See the complete 3-object tree</button></p>';
    } else if (stage===4) {
      heading = "Unwrap each band: count INSIDE orders";
      description = "Keep the band in its outside position. Now swap the different books inside it. For each block with k different books there are k choices, then k−1, down to 1: that is k!.";
      visual = '<div class="walk2-inside">'+spec.blocks.map(function(g){
        return '<div class="walk2-inside-one"><strong>'+g.name+' — '+g.books.length+'! = '+commas(factorial(g.books.length))+' orders</strong>'+
          '<small>One order:</small>'+miniBooks(g.books)+
          '<small>Another order, same band:</small>'+miniBooks(g.books.slice().reverse())+
          '<small>'+descending(g.books.length)+' = '+g.books.length+'!</small></div>';
      }).join("")+'</div><div class="walk2-math">Inside combinations per outside order = '+spec.blocks.map(function(g){return g.books.length+'!';}).join(' × ')+
        ' = '+commas(insideWays)+'</div>';
    } else {
      heading = "Pair EVERY outside order with EVERY inside choice";
      description = "Fix just one outside order. You already get "+commas(insideWays)+" complete shelves from the different orders inside its blocks. The SAME number is possible for each of the "+commas(outerWays)+" outside orders.";
      visual = '<div class="walk2-product-rows">'+
        '<div class="walk2-product-row"><strong>Outside order #1</strong> → '+commas(insideWays)+' inside choices</div>'+
        '<div class="walk2-product-row"><strong>Outside order #2</strong> → '+commas(insideWays)+' inside choices</div>'+
        '<div class="walk2-product-row"><strong>… through #'+commas(outerWays)+'</strong> → '+commas(insideWays)+' inside choices each</div></div>'+
        '<p>Two complete shelves with the SAME outside order but different inside books:</p>'+
        outsideVisual(objects,false)+outsideVisual(objects,true)+
        '<div class="walk2-math">'+commas(outerWays)+' outside × '+commas(insideWays)+' inside = '+commas(spec.answer)+'</div>'+
        '<p><strong>Full formula:</strong> '+formula+' = '+commas(spec.answer)+'. We <strong>multiply</strong> because we choose an outside order <em>AND</em> an inside order. <button type="button" class="why-lesson-link" data-open-why="product">See every combination in the small example</button></p>';
    }
    return '<div class="walk2-scene"><h3>'+heading+'</h3><p>'+description+'</p>'+visual+'</div>';
  }
  function stopWalk(state) {
    if (state.timer !== null) {clearInterval(state.timer);state.timer=null;}
  }
  function renderWalk(state, focusClass) {
    var s = state.step, panel=state.panel;
    panel.innerHTML = '<div class="walk2-top"><span>SEE WHY · STEP '+(s+1)+' / 6</span><span class="walk2-dots" aria-hidden="true">'+
      Array.from({length:6},function(_,i){return '<span class="'+(i<=s?'on':'')+'"></span>';}).join("")+'</span></div>'+
      '<div aria-live="polite">'+walkContent(state)+'</div>'+
      '<div class="walk2-buttons">'+
      '<button type="button" class="walk2-button prev" '+(s===0?'disabled':'')+'>← Previous</button>'+
      '<button type="button" class="walk2-button next" '+(s===5?'disabled':'')+'>Next →</button>'+
      '<button type="button" class="walk2-button play">'+(state.timer===null?'▶ Play':'Ⅱ Pause')+'</button>'+
      '<button type="button" class="walk2-button replay">↺ Replay</button>'+
      '</div><span class="why-micro">Ask the learner: “What exactly are we choosing at this step?”</span>';
    function changeStep(number,cls){
      stopWalk(state);
      state.step=Math.max(0,Math.min(5,number));
      renderWalk(state,cls);
    }
    panel.querySelector(".prev").addEventListener("click",function(){changeStep(s-1,"prev");});
    panel.querySelector(".next").addEventListener("click",function(){changeStep(s+1,"next");});
    panel.querySelector(".replay").addEventListener("click",function(){changeStep(0,"next");});
    panel.querySelector(".play").addEventListener("click",function(){
      if (state.timer!==null) {stopWalk(state);renderWalk(state,"play");return;}
      if (state.step===5) state.step=0;
      state.timer=setInterval(function(){
        if (!state.details.open || state.details.hidden) {stopWalk(state);renderWalk(state);return;}
        state.step=Math.min(5,state.step+1);
        if (state.step===5) stopWalk(state);
        renderWalk(state);
      },reducedMotion?5000:4200);
      renderWalk(state,"play");
    });
    if (focusClass) {
      var focusEl = panel.querySelector("." + focusClass);
      if (focusEl && !focusEl.disabled) focusEl.focus({preventScroll:true});
    }
  }
  specs.forEach(function(spec) {
    var card=byId(spec.id), details=card.querySelector(".solution");
    var original=Array.from(card.querySelectorAll(".shelf .book"),function(b){return b.textContent.trim();});
    var panel=document.createElement("div");
    panel.className="walk2";
    panel.setAttribute("aria-label","Interactive explanation of book arrangements");
    details.insertBefore(panel,details.querySelector(".steps"));
    var written=document.createElement("details");
    written.className="walk2-written";
    var summary=document.createElement("summary");
    summary.textContent="Show the written calculation";
    written.appendChild(summary);
    [".steps",".formula",".note"].forEach(function(selector){
      var el=details.querySelector(selector);
      if(el) written.appendChild(el);
    });
    details.appendChild(written);
    var state={spec:spec,panel:panel,details:details,original:original,step:0,timer:null};
    walks.push(state);
    renderWalk(state);
    details.addEventListener("toggle",function(){if(!details.open){stopWalk(state);renderWalk(state);}});
    card.querySelector(".retry").addEventListener("click",function(){stopWalk(state);state.step=0;renderWalk(state);});
  });
  byId("reset-all").addEventListener("click",function(){
    walks.forEach(function(state){stopWalk(state);state.step=0;renderWalk(state);});
  });
  document.addEventListener("click",function(event){
    var button=event.target.closest("[data-open-why]");
    if(!button)return;
    openTab(button.dataset.openWhy);
    lab.scrollIntoView({behavior:"smooth",block:"start"});
  });
})();
