(() => {
const host=document.querySelector('ae-market-orbit');
if (!host) return;
let root=host.shadowRoot;
if (!root) {
  root=host.attachShadow({mode:'open'});
  root.append(host.querySelector('template').content.cloneNode(true));
}

const cards=[...root.querySelectorAll('li')],main=root.querySelector('main'),mobile=matchMedia('(max-width:760px)'),reduce=matchMedia('(prefers-reduced-motion:reduce)'),motion=root.querySelector('#motion'),list=root.querySelector('ul');
const replay=root.querySelector('#replay');
const track=root.querySelector('.ring ellipse');
const emblem=root.querySelector('.emblem');
const words=[...root.querySelectorAll('[data-fa]')];
words.forEach(word=>word.dataset.en=word.textContent);
const entrance=1.8, beat=4.6;
let paused=reduce.matches, fa=false, elapsed=paused?entrance:0, previous=null, frame=0;
const clamp=value=>Math.max(0,Math.min(1,value));
function ease(value){
  const t=clamp(value);
  return t*t*(3-2*t);
}
function draw(){
  const journey=Math.max(0,elapsed-entrance)/beat;
  const step=Math.floor(journey), phase=journey-step;
  // Each camera move eases into a hold, then the next department advances.
  const rotation=(step+ease(phase/.75))*Math.PI/3;
  const hold=ease((phase-.55)/.23)*(1-ease((phase-.90)/.10));
  track.style.strokeDashoffset=1-ease(elapsed/1.6);
  cards.forEach((card,i)=>{
    const arrival=ease((elapsed-i*.10)/1.16);
    const angle=(i-2)*Math.PI/3+rotation-(1-arrival)*.32;
    const depth=(1+Math.sin(angle))/2;
    const focus=Math.pow(depth,5)*hold;
    if(!mobile.matches){
      card.style.left=(50+(37+2*(1-arrival))*Math.cos(angle))+'%';
      card.style.top=(50+(34+2*(1-arrival))*Math.sin(angle))+'%';
    }
    const lift=(1-arrival)*21;
    const rock=reduce.matches?0:(1-arrival)*(i%2?5:-5)+focus*Math.sin(i+1)*3;
    const scale=mobile.matches?1:(.84+.22*depth+.15*focus);
    card.firstElementChild.style.transform=reduce.matches?'none':'translateY('+lift+'px) rotate('+rock+'deg) scale('+(scale*(.9+.1*arrival))+')';
    card.firstElementChild.style.opacity=.25+.75*arrival;
  });
}
function tick(now){
  if(previous!==null) elapsed+=Math.min(now-previous,100)/1000;
  previous=now;
  draw();
  if(!mobile.matches||elapsed<entrance) frame=requestAnimationFrame(tick);
  else {paused=true;update();}
}
function update(){
  cancelAnimationFrame(frame);previous=null;
  draw();
  motion.textContent=paused?(fa?'ادامه':'Play'):(fa?'توقف':'Pause');
  // After the mobile entrance, photos are browsed by native horizontal swipe.
  motion.hidden=mobile.matches&&elapsed>=entrance;
  if(!paused&&!document.hidden&&(!mobile.matches||elapsed<entrance)) frame=requestAnimationFrame(tick);
}
motion.onclick=()=>{paused=!paused;update()};
replay.onclick=()=>{elapsed=reduce.matches?entrance:0;paused=reduce.matches;list.scrollLeft=0;update()};
reduce.onchange=()=>{paused=reduce.matches;elapsed=Math.max(entrance,elapsed);update()};
mobile.onchange=update;
document.addEventListener('visibilitychange',update);
function syncLanguage(){
  fa=document.documentElement.lang.startsWith('fa') || document.documentElement.dir==='rtl';
  emblem.alt=fa?'افغان ایتس':'Afghan Eats';
  words.forEach(word=>word.textContent=fa?word.dataset.fa:word.dataset.en);
  host.setAttribute('aria-label',fa?'بخش‌های فروشگاه':'Marketplace departments');
  list.setAttribute('aria-label',fa?'بخش‌ها':'Departments');
  update();
}
new MutationObserver(syncLanguage).observe(document.documentElement,{attributes:true,attributeFilter:['lang','dir']});
syncLanguage();
})();
