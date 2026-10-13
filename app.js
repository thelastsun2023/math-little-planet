/* No modules or remote dependencies: works directly with file:// and WebView. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const modes = {'10-add': {limit:10,op:'+',label:'10 以内加法'},'10-sub':{limit:10,op:'−',label:'10 以内减法'},'100-add':{limit:100,op:'+',label:'100 以内加法'},'100-sub':{limit:100,op:'−',positive:true,label:'100 以内减法'},'20-sub':{limit:20,op:'−',positive:true,label:'20 以内减法'},'10-mul':{limit:10,op:'×',label:'10 以内乘法'},'100-div':{limit:100,op:'÷',label:'100 以内除法'}};
  const state = {mode:null,questions:[],index:0,input:'',locked:false,correct:0,wrong:0,finished:false};
  const random = max => Math.floor(Math.random() * (max + 1));
  const speechSupported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  let speechSequence = 0;
  let autoNext=null;
  const now=()=>performance.now();
  const duration=ms=>`${(ms/1000).toFixed(1)} 秒`;
  function cancelAdvance(){clearTimeout(autoNext);autoNext=null;}
  function updateTime(){
    $('question-time').textContent=`本题 ${duration(!state.mode?0:state.locked?state.times[state.index]:now()-state.questionStarted)}`;
    $('total-time').textContent=`总计 ${duration(!state.mode?0:(state.finished?state.ended:now())-state.started)}`;
  }
  function advance(){if(!state.locked||state.finished||!state.mode)return;cancelAdvance();if(state.index===19)finish();else{state.index++;renderQuestion();}}
  function scheduleAdvance(){
    const index=state.index,started=state.started;
    $('next-hint').textContent=state.index===19?'3 秒后自动查看成绩':'3 秒后自动进入下一题';
    autoNext=setTimeout(()=>{if(state.started===started&&state.index===index&&state.locked&&!state.finished)advance();},3000);
  }
  function englishNumber(value) {
    const ones=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
    const tens=['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
    const n=Number(value);
    if(n<20)return ones[n];
    if(n<100)return tens[Math.floor(n/10)]+(n%10?' '+ones[n%10]:'');
    return n===100?'one hundred':String(n);
  }
  function speak(zh, en, complete) {
    const sequence=++speechSequence;
    if(!speechSupported){if(complete)complete();return;}
    window.speechSynthesis.cancel();
    const lang=$('voice-language').value;
    if(lang==='off'){if(complete)complete();return;}
    const utterance=new SpeechSynthesisUtterance(lang==='zh-CN'?zh:en.replace(/\b\d+\b/g,englishNumber));
    utterance.lang=lang; utterance.rate=.85;
    const voices=window.speechSynthesis.getVoices();
    const voice=voices.find(v=>v.lang===lang)||voices.find(v=>v.lang.startsWith(lang.slice(0,2)));
    if(voice)utterance.voice=voice;
    let completed=false;
    const done=()=>{if(!completed&&sequence===speechSequence){completed=true;if(complete)complete();}};
    utterance.onend=done;
    utterance.onerror=e=>{if(sequence===speechSequence){if(e.error!=='interrupted' && e.error!=='canceled')$('voice-note').textContent='朗读暂不可用，请检查设备语音包';done();}};
    utterance.onstart=()=>{$('voice-note').textContent='';};
    try{window.speechSynthesis.speak(utterance);}catch{done();}
  }
  function readQuestion() {
    if(!state.mode || state.finished)return;
    if(state.locked&&state.lastCorrect){cancelAdvance();speak('真棒，做对了！','Great job! You got it right!',scheduleAdvance);return;}
    const q=state.questions[state.index];
    const words={'+':['加','plus'],'−':['减','minus'],'×':['乘以','times'],'÷':['除以','divided by']};
    speak(`${q.a}${words[q.op][0]}${q.b}等于多少？`,`${q.a} ${words[q.op][1]} ${q.b} equals what?`);
  }
  function generate(mode) {
    const {limit,op,positive} = modes[mode];
    return Array.from({length:20},()=>{
      if(op==='×'){const a=1+random(9),b=1+random(9);return {a,b,op,answer:a*b};}
      if(op==='÷'){const b=1+random(limit-1),answer=1+random(Math.floor(limit/b)-1);return {a:b*answer,b,op,answer};}
      if(positive){const a=1+random(limit-1),b=random(a-1);return {a,b,op,answer:a-b};}
      const a=random(limit), b=random(op==='+' ? limit-a : a);
      return {a,b,op,answer:op==='+' ? a+b : a-b};
    });
  }
  function keyboardDisabled(disabled) { document.querySelectorAll('[data-key]').forEach(b=>b.disabled=disabled); }
  function start(mode) {
    cancelAdvance();
    Object.assign(state,{mode,questions:generate(mode),index:0,input:'',locked:false,correct:0,wrong:0,finished:false});
    state.started=now();state.times=[];state.outcomes=[];
    document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});
    $('practice').hidden=false; $('results').hidden=true; $('mode-label').textContent=modes[mode].label; renderQuestion();
  }
  function renderQuestion() {
    cancelAdvance();state.questionStarted=now();
    state.input=''; state.locked=false;
    const q=state.questions[state.index];
    $('screen').className='screen'; $('counter').textContent=`第 ${state.index+1} / 20 题`;
    $('progress-fill').style.width=`${state.index/20*100}%`;
    $('screen-state').textContent='LET’S GO'; $('equation').textContent=`${q.a} ${q.op} ${q.b} =`;
    $('input').textContent='?'; $('feedback').textContent='想一想，答案是多少？'; $('next-hint').textContent='按 ＝ 核对答案'; keyboardDisabled(false); readQuestion();
  }
  // Parse arithmetic without eval. Operators are available for expression answers.
  function evaluate(text) {
    const tokens=text.replace(/×/g,'*').replace(/−/g,'-').replace(/÷/g,'/').match(/\d+|[+*/-]/g);
    if(!tokens || !/^\d+(?:[+*/−×÷-]\d+)*$/.test(text)) return null;
    let total=0,term=Number(tokens[0]),sign=1;
    for(let i=1;i<tokens.length;i+=2){const op=tokens[i],n=Number(tokens[i+1]);if(op==='*')term*=n;else if(op==='/'){if(n===0)return null;term/=n;}else{total+=sign*term;sign=op==='+'?1:-1;term=n;}}
    const result=total+sign*term;return Number.isFinite(result)?result:null;
  }
  function score(reveal) {
    if(!state.mode || state.locked || state.finished)return;
    const value=evaluate(state.input),q=state.questions[state.index];
    if(!reveal && value===null){$('feedback').textContent=state.input?'请补全算式，再按 ＝':'先输入答案，再按 ＝';return;}
    const correct=!reveal && Math.abs(value-q.answer)<1e-9;
    state.locked=true; if(correct)state.correct++;else state.wrong++;
    state.lastCorrect=correct;state.times[state.index]=now()-state.questionStarted;state.outcomes[state.index]=correct;updateTime();
    $('screen').className=`screen ${correct?'correct':'wrong'}`;
    $('screen-state').textContent=correct?'WELL DONE':'KEEP GOING';
    if(reveal)$('input').textContent=String(q.answer);
    $('feedback').textContent=correct?'答对啦！真棒 ✦':reveal?'正确答案已显示，本题记为错误':`再接再厉！正确答案是 ${q.answer}`;
    $('next-hint').textContent=state.index===19?'点击显示屏，查看成绩 →':'点击显示屏，进入下一题 →';
    $('progress-fill').style.width=`${(state.index+1)/20*100}%`; keyboardDisabled(true);
    if(correct){$('next-hint').textContent='语音结束后 3 秒自动继续';speak('真棒，做对了！','Great job! You got it right!',scheduleAdvance);}
    else if(reveal)speak(`正确答案是${q.answer}，本题记为错误。`, `The answer is ${q.answer}. This question counts as incorrect.`);
    else speak(`哎呀，做错了。正确答案是${q.answer}。再试试，你可以的！`,`Oops, that was incorrect. The answer is ${q.answer}. Keep trying!`);
  }
  function finish() {
    cancelAdvance();state.ended=now();
    state.finished=true; $('practice').hidden=true;$('results').hidden=false;
    updateTime();
    const answerTime=state.times.reduce((sum,time)=>sum+time,0);
    $('answer-total').textContent=duration(answerTime);$('round-total').textContent=duration(state.ended-state.started);$('average-time').textContent=duration(answerTime/20);
    $('time-details').replaceChildren(...state.questions.map((q,i)=>{const row=document.createElement('tr');[String(i+1),`${q.a} ${q.op} ${q.b}`,state.outcomes[i]?'正确':'错误',duration(state.times[i])].forEach(text=>{const cell=document.createElement('td');cell.textContent=text;row.appendChild(cell);});return row;}));
    $('correct-count').textContent=state.correct; $('wrong-count').textContent=state.wrong;
    $('correct-rate').textContent=`${state.correct*5}%`; $('wrong-rate').textContent=`${state.wrong*5}%`;
    $('result-message').textContent=state.correct===20?'全对！你是今天的口算小明星 ✦':`完成了${modes[state.mode].label}，继续练习会越来越熟练。`;
    speak(`练习完成！你答对了${state.correct}题。继续加油！`,`Practice complete! You got ${state.correct} questions right. Keep it up!`);
  }
  function key(key) {
    if(!state.mode || state.locked || state.finished)return;
    if(key==='=')return score(false);if(key==='answer')return score(true);
    if(key==='clear')state.input='';else if(key==='back')state.input=state.input.slice(0,-1);
    else if(state.input.length<18){if(/^\d$/.test(key))state.input+=key;else if(state.input && /\d$/.test(state.input))state.input+=key;}
    $('input').textContent=state.input||'?';$('feedback').textContent='输入完成后，按 ＝ 核对';
  }
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>start(b.dataset.mode)));
  document.querySelectorAll('[data-key]').forEach(b=>b.addEventListener('click',()=>key(b.dataset.key)));
  $('screen').addEventListener('click',advance);
  $('restart').addEventListener('click',()=>start(state.mode));
  $('choose').addEventListener('click',()=>{state.mode=null;state.finished=false;$('results').hidden=true;$('practice').hidden=false;document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});$('counter').textContent='20 题小挑战';$('mode-label').textContent='选择新模式，继续出发';$('progress-fill').style.width='0';$('screen').className='screen';$('screen-state').textContent='READY';$('equation').textContent='你好，小星星！';$('input').textContent='选择上方模式开始';$('feedback').textContent='每一次练习都是进步';$('next-hint').textContent='每次练习 20 题';keyboardDisabled(true);});
  document.addEventListener('keydown',e=>{if(e.ctrlKey||e.altKey||e.metaKey||e.target.closest('[data-mode],#restart,#choose'))return;const map={Enter:'=',Backspace:'back',Delete:'clear','-':'−','*':'×','/':'÷'};if(e.key===' ' && state.locked){e.preventDefault();$('screen').click();}else if(/^\d$/.test(e.key)||map[e.key]||e.key==='+'){e.preventDefault();key(map[e.key]||e.key);}});
  keyboardDisabled(true);
  $('reset-page').addEventListener('click',()=>{
    cancelAdvance();++speechSequence;
    if(speechSupported)window.speechSynthesis.cancel();
    window.location.reload();
  });
  setInterval(updateTime,100);
  $('read-question').addEventListener('click',readQuestion);
  $('voice-language').addEventListener('change',()=>{if(speechSupported)window.speechSynthesis.cancel();$('voice-note').textContent='';readQuestion();});
  $('choose').addEventListener('click',()=>{cancelAdvance();++speechSequence;if(speechSupported)window.speechSynthesis.cancel();updateTime();});
  if(!speechSupported){$('voice-language').value='off';$('voice-language').disabled=true;$('read-question').disabled=true;$('voice-note').textContent='此浏览器不支持语音朗读';}
})();
