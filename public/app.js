import {PEOPLE,WORLDS,OUTCOMES,resultBand,buildStory,portrait,portraitCard,worldImage,cinematicImage} from './story.js';
import {TRACKS, activeTrack} from './soundtrack.js';
import {voiceCue} from './voice-cues.js';
import {ambienceMarkup,initializeWorldInteractions,configureMotion} from './world-ambience.js';
const $ = s => document.querySelector(s);
const app = $('#app');
const names = Object.fromEntries(PEOPLE.map(p=>[p.id,p.name]));
const clean = t => String(t??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initialPrefs=()=>{try{return JSON.parse(localStorage.getItem('v7:prefs'))||{}}catch{return {}}};
const pref=Object.assign({effects:true,music:true,voices:true,motion:true,volume:0.27,auto:true},initialPrefs());
pref.volume=Number.isFinite(Number(pref.volume))?Math.min(1,Math.max(0,Number(pref.volume))):0.27;
const state={screen:'home',worldMusicSelected:false,mode:'creator',name:'',avatar:'bear',theme:'forest',friendName:'',friendAvatar:'panda',bank:[],chosen:[],cursor:0,correct:null,custom:false,challenge:null,challengeId:'',ownerToken:'',attemptId:'',accessToken:'',answerIndex:0,score:0,answerStatus:null,answerPending:false,shotIndex:0,timer:0,paused:false,lineVersion:0,typePos:0,story:null,leaders:[],stats:null,gender:'',completed:false,visitorStatus:'new',customPictures:[null,null,null,null],customBusy:false};
let audioCtx=null,worldAudio=null,worldKey='',audioBlocked=false,audioPlayVersion=0,autoplayTimeout=null,toastTimeout=null;
let voiceNodes=[],voiceTimer=null,voiceGeneration=0;
initializeWorldInteractions();
configureMotion(pref.motion!==false);
const COPYRIGHT='جميع الحقوق محفوظة — 𝑴𝒖𝒔𝒂 𝑨𝒍-𝑨𝒉𝒎𝒂𝒅';
const storePrefs=()=>localStorage.setItem('v7:prefs',JSON.stringify(pref));
// Procedural, royalty-free UI cues: distinct tap, select, advance, upload, success and error motifs.
let audioUnlocked=false,lastHoverSound=0;
function ping(kind='click'){
  if(!pref.effects)return;
  try{
    audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==='suspended')audioCtx.resume();
    const now=audioCtx.currentTime;
    const cues={
      click:[[390,520,.075,'sine'],[640,540,.053,'triangle']],
      soft:[[570,650,.068,'sine']],
      toggle:[[440,660,.105,'sine'],[660,880,.12,'triangle']],
      back:[[440,330,.09,'sine'],[330,280,.105,'triangle']],
      select:[[490,740,.11,'sine'],[740,980,.17,'triangle']],
      next:[[392,523,.12,'sine'],[523,784,.21,'sine']],
      upload:[[440,622,.12,'triangle'],[660,880,.19,'sine']],
      correct:[[523,783,.14,'sine'],[784,1046,.22,'sine'],[1046,1318,.30,'triangle']],
      wrong:[[330,240,.19,'triangle'],[220,160,.27,'sine']],
      reveal:[[392,784,.19,'sine'],[587,1174,.35,'triangle']],
      hover:[[625,645,.045,'sine']]
    };
    (cues[kind]||cues.click).forEach(([from,to,duration,wave],i)=>{
      const offset=i*(kind==='correct'?.07:.045),osc=audioCtx.createOscillator(),gain=audioCtx.createGain(),t=now+offset;
      osc.type=wave;osc.frequency.setValueAtTime(from,t);osc.frequency.exponentialRampToValueAtTime(to,t+duration);
      gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(Math.max(.001,pref.volume*(kind==='hover'?.028:.095)),t+.012);
      gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
      osc.connect(gain).connect(audioCtx.destination);osc.start(t);osc.stop(t+duration+.01);
    });
  }catch{}
}

function worldChime(world){
 if(!pref.effects)return;
 try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();
 const tunes={forest:[523.25,659.25,783.99],ocean:[392,493.88,659.25],vampire:[293.66,349.23,440],classic:[440,554.37,659.25]};
 (tunes[world]||tunes.forest).forEach((f,i)=>{const t=audioCtx.currentTime+i*.095,o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(pref.volume*.08,t+.017);g.gain.exponentialRampToValueAtTime(.0001,t+.31);o.connect(g).connect(audioCtx.destination);o.start(t);o.stop(t+.32)})
 }catch{}
}
// One persistent audio element prevents overlapping home and world soundtracks.
// Playback may require a user gesture on mobile browsers; music remains a user preference.
function currentSoundtrack(){return activeTrack(state)}
function musicButtonHtml(){
  const context=currentSoundtrack()==='home'?'الواجهة':'العالم';
  const playing=pref.music&&!audioBlocked;
  const caption=!pref.music?`♫ تشغيل موسيقى ${context}`:audioBlocked?'♫ اضغط لتشغيل الموسيقى':`♫ موسيقى ${context} تعمل`;
  const label=!pref.music?`تشغيل موسيقى ${context}`:audioBlocked?'تشغيل الموسيقى بعد موافقتك':`إيقاف موسيقى ${context}`;
  return `<button class="sound-toggle ${playing?'is-on':''}" data-action="toggle-music" aria-label="${label}" aria-pressed="${playing}">${caption}</button>`;
}
function refreshMusicButton(){
  const old=$('.sound-toggle');
  if(old){const keepFocus=document.activeElement===old;old.outerHTML=musicButtonHtml();if(keepFocus)$('.sound-toggle')?.focus()}
}
function configureAudio(){
  if(!worldAudio){worldAudio=new Audio();worldAudio.loop=true;worldAudio.preload='auto'}
  const track=currentSoundtrack();
  if(worldKey!==track){
    worldAudio.pause();worldKey=track;worldAudio.src=TRACKS[track];worldAudio.load();
    audioBlocked=false;
  }
  worldAudio.volume=pref.volume*.65;
  if(!pref.music){++audioPlayVersion;worldAudio.pause();audioBlocked=false;refreshMusicButton();return}
  // Don't repeatedly attempt blocked autoplay; allow the next deliberate tap to retry.
  if(audioBlocked&&!audioUnlocked){refreshMusicButton();return}
  const attempt=++audioPlayVersion;
  try{
    const operation=worldAudio.play();
    operation?.then(()=>{
      if(attempt===audioPlayVersion){audioBlocked=false;refreshMusicButton()}
    }).catch(error=>{
      if(attempt===audioPlayVersion){audioBlocked=error?.name==='NotAllowedError';refreshMusicButton()}
    });
  }catch(error){audioBlocked=error?.name==='NotAllowedError'}
  refreshMusicButton();
}
// Expressive but nonverbal: a unique musical phrase for each of the five characters
// in each of the six endings. Short music ducking keeps every phrase audible.
function stopSpeech(){
  ++voiceGeneration;
  clearTimeout(voiceTimer);voiceTimer=null;
  for(const osc of voiceNodes){try{osc.stop()}catch{}}
  voiceNodes=[];
  if(worldAudio)worldAudio.volume=Math.min(1,Math.max(0,Number(pref.volume)||0)*.65);
}
function murmur(character,mood='steady'){
  stopSpeech();
  if(!pref.voices||!audioUnlocked)return;
  try{
    audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==='suspended')audioCtx.resume();
    const cue=voiceCue(character,mood),start=audioCtx.currentTime;
    const level=Math.min(1,Math.max(0,Number(pref.volume)||0));
    if(worldAudio&&pref.music)worldAudio.volume=level*.32;
    for(const note of cue.notes){
      const osc=audioCtx.createOscillator(),gain=audioCtx.createGain(),t=start+note.start;
      osc.type=note.wave;
      osc.frequency.setValueAtTime(note.from,t);
      osc.frequency.linearRampToValueAtTime(note.to,t+note.duration);
      const peak=Math.max(.0002,level*note.loudness*.16);
      gain.gain.setValueAtTime(.0001,t);
      gain.gain.linearRampToValueAtTime(peak,t+.022);
      gain.gain.exponentialRampToValueAtTime(.0001,t+note.duration);
      osc.connect(gain).connect(audioCtx.destination);
      voiceNodes.push(osc);osc.start(t);osc.stop(t+note.duration+.008);
    }
    const generation=voiceGeneration;
    voiceTimer=setTimeout(()=>{if(generation===voiceGeneration)stopSpeech()},Math.ceil((cue.length+.18)*1000));
  }catch{stopSpeech()}
}
function toast(message){const node=$('#toast');node.textContent=message;node.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>node.classList.remove('show'),3500)}
function info(t){return `<div class="eyebrow">✦ ${clean(t)} ✦</div>`}
function worldTitle(){return WORLDS.find(w=>w.id===state.theme)?.name||'الغابة'}
function header(){return `<header class="headbar"><button class="brand" data-action="home">✦ قدّيش بتعرفني؟ V7</button><span class="pill">حكاية صداقتك في 4 عوالم</span><div class="sound-bar">${musicButtonHtml()}<button class="small-link" data-action="settings">⚙ الإعدادات</button></div></header>`}
function scenery(){return `<div class="scenic" style="background-image:url('${worldImage(state.theme)}')"></div>${ambienceMarkup(state.theme)}<div class="float-lights"></div>`}
function layout(body,{bare=false}={}){
  app.dataset.world=state.theme;
  app.innerHTML=scenery()+header()+(bare?body:`<div class="container">${body}</div>`)+`<footer class="site-credit" aria-label="حقوق التصميم والبرمجة"><span class="credit-star" aria-hidden="true">✦</span><span>${COPYRIGHT}</span><span class="credit-star" aria-hidden="true">✦</span></footer>`;
  configureMotion(pref.motion!==false);
  configureAudio();
}
function personCard(p,selected,action){return `<button type="button" aria-label="اختر ${p.name}" class="avatar-card ${p.id===selected?'active':''}" data-action="${action}" data-value="${p.id}" aria-pressed="${p.id===selected}"><img src="${portraitCard(p.id)}" srcset="/assets/characters/${p.id}-card-384.webp 384w, ${portraitCard(p.id)} 1024w" sizes="(max-width: 600px) 45vw, (max-width: 820px) 29vw, 18vw" alt="بطاقة ${p.name} الأصلية كاملة" width="1024" height="1536" loading="lazy" decoding="async"/></button>`}
function worldCard(w,selected,action){return `<button type="button" data-world="${w.id}" class="world-card ${w.id===selected?'active':''}" data-action="${action}" data-value="${w.id}" aria-pressed="${w.id===selected}"><img src="${worldImage(w.id)}" alt="${w.name}" loading="lazy"/><span class="world-card-effect" aria-hidden="true"></span><strong>${w.name}</strong></button>`}
function home(){state.screen='home';state.lineVersion++;clearTimeout(state.typeTimer);stopSpeech();clearTimeout(autoplayTimeout);layout(`<div class="hero-wrap"><section class="hero-frame" data-world="${state.theme}" aria-label="الواجهة الرسمية المعتمدة"><img class="hero-art" src="/assets/official-home.png" alt="واجهة قدّيش بتعرفني؟ تضم الشخصيات الخمس والعوالم الأربعة" />${ambienceMarkup(state.theme,{compact:true})}${PEOPLE.map((p,i)=>`<button aria-label="اختيار ${p.name}" title="${p.name}" class="hero-hover ${state.avatar===p.id?'selected':''}" style="left:${[9,28,43,59,77][i]}%;top:34%;width:${[16,15,16,15,17][i]}%;height:35%" data-action="hero-person" data-value="${p.id}"></button>`).join('')}${WORLDS.map((w,i)=>`<button aria-label="اختيار عالم ${w.name}" title="${w.name}" class="hero-hover ${state.theme===w.id?'selected':''}" style="left:${[20.2,35.5,52,69][i]}%;top:68%;width:15%;height:15%" data-action="hero-world" data-value="${w.id}"></button>`).join('')}<button class="hero-action" style="left:24%;top:84%;width:15%;height:12%" aria-label="الإعدادات" data-action="settings"></button><button class="hero-action" style="left:40%;top:83%;width:24%;height:15%" aria-label="ابدأ التحدي" data-action="create"></button><button class="hero-action" style="left:66%;top:83%;width:18%;height:15%" aria-label="إنشاء اختبار" data-action="create"></button></section><div class="home-picker" aria-label="اختر شخصيتك وعالمك"><div class="picker-label">✦ الشخصية المختارة: <strong>${names[state.avatar]}</strong></div><div class="picker-avatars">${PEOPLE.map(p=>`<button class="picker-avatar ${p.id===state.avatar?'active':''}" data-action="hero-person" data-value="${p.id}" aria-label="اختيار ${p.name}" aria-pressed="${p.id===state.avatar}"><img src="/assets/characters/${p.id}-card-384.webp" alt="" width="384" height="576" loading="lazy" decoding="async"/><span>${p.name}</span></button>`).join('')}</div><div class="picker-label">✦ اختر العالم: <strong>${worldTitle()}</strong></div><div class="picker-worlds">${WORLDS.map(w=>`<button data-world="${w.id}" class="picker-world ${w.id===state.theme?'active':''}" data-action="hero-world" data-value="${w.id}" aria-pressed="${w.id===state.theme}"><img src="${worldImage(w.id)}" alt=""/><span class="world-card-effect" aria-hidden="true"></span><span>${w.name}</span></button>`).join('')}</div></div><div class="hero-actions"><button class="btn green" data-action="create">ابدأ التحدي ✦</button><button class="btn" data-action="create">أنشئ اختبارك</button><button class="btn blue" data-action="join">أدخل رابط صديق</button><button class="btn soft" data-action="settings">الإعدادات</button></div><div class="hero-bottom"><button class="btn green" data-action="create">ابدأ التحدي</button><button class="btn pink" data-action="create">إنشاء اختبار</button><button class="btn blue" data-action="join">عندي رابط صديق</button></div></div>`,{bare:true});}
function beginCreate(){state.worldMusicSelected=true;state.screen='setup';state.chosen=[];state.cursor=0;state.custom=false;state.answerStatus=null;setup()}
function setup(){state.screen='setup';layout(`<div class="panel">${info('خطوتك الأولى')}<h1>اختر شخصيتك وعالمك ✨</h1><p class="muted">رح ترافق شخصيتك رفقاتك طول المغامرة، وعالمك رح يظهر عند كل شخص يدخل رابطك.</p><div class="field"><label for="owner-name">شو اسمك؟</label><input class="input" id="owner-name" maxlength="32" placeholder="اسم صاحب التحدي" value="${clean(state.name)}" autocomplete="nickname"/></div><h3 class="selector-heading">الشخصية التي تمثلك</h3><div class="avatars">${PEOPLE.map(p=>personCard(p,state.avatar,'select-person')).join('')}</div><h3 class="selector-heading">اختر عالم قصتك</h3><div class="world-strip">${WORLDS.map(w=>worldCard(w,state.theme,'select-world')).join('')}</div><div class="btn-group"><button class="btn green" data-action="start-building">التالي: أسئلتي ←</button><button class="btn soft" data-action="home">رجوع</button></div></div>`);}
function selectedQuestion(){return state.bank[state.cursor]}
// The creator sees their own name in every illustrated prompt. Saved challenges
// contain the resolved text, so friends and server data remain consistent.
function questionLabel(q){return String(q?.text||'').replaceAll('{name}',state.name.trim()||'صاحب التحدي')}
function questionCard(q,answer,mode){const artKey=q.artKey||q.id;const images=/^(p-|v2-)/.test(artKey||'') && !q.noArt;
  return `<div class="answers">${q.options.map((option,i)=>{const personal=q.imageData?.[i]||q.imageUrls?.[i];const src=personal||(images?`/assets/answers/${artKey}-${i}.webp`:'');return `<button type="button" class="answer ${answer===i?(state.answerStatus&&!state.answerStatus.correct?'wrong':'chosen'):''}" data-action="${mode==='creator'?'choose-correct':'answer'}" data-value="${i}" ${state.answerStatus?'disabled':''}>${src?`<img loading="lazy" src="${clean(src)}" alt="${clean(option)}"/>`:`<div class="answer-art">${clean(option)}</div>`}<span>${clean(option)}</span><span class="answer-check" aria-hidden="true">✓</span></button>`}).join('')}</div>`
}
function builder(){state.screen='builder';const q=selectedQuestion();if(!q){review();return}const count=state.chosen.length;layout(`<div class="question-layout cinematic-quiz"><aside class="guide-card quiz-actors" style="--scene-image:url('${cinematicImage(state.theme,'meeting')}')"><img src="${portrait(state.avatar)}" alt="${names[state.avatar]}"/><div class="speech">اختار الإجابة الصح عنك… وخلينا نشوف إذا رفقاتك بيعرفوها!</div></aside><section class="panel quiz-panel">${info('مرحلة إنشاء التحدي')}<div class="quiz-world-stamp">${worldTitle()} ✦ ${WORLDS.find(w=>w.id===state.theme)?.desc}</div><div class="row" style="justify-content:space-between;align-items:center"><span class="counter">${count}/10 أسئلة</span><span class="tiny muted">السؤال المقترح ${Math.min(state.cursor+1,state.bank.length)} من ${state.bank.length}</span></div><div class="progress" style="margin:12px 0 20px"><i style="width:${count*10}%"></i></div><h2 class="quiz-title">${clean(questionLabel(q))}</h2>${questionCard(q,null,'creator')}<div class="btn-group"><button class="btn soft" data-action="skip">تخطَّ السؤال ←</button><button class="btn blue" data-action="custom">أضف سؤال شخصي</button><button class="btn soft" data-action="setup">العودة</button></div><p class="note">20 سؤالًا شخصيًا مصوّرًا عن تفضيلاتك وعاداتك، اختر منها 10 فقط. الإجابة التي تختارها تصبح الصحيحة عند صديقك.</p></section></div>`);}
function review(){state.screen='review';layout(`<div class="panel" style="max-width:870px;margin:auto">${info('جاهز للمشاركة')}<h1>راجع أسئلتك العشرة</h1><p class="muted">اختبار ${clean(state.name)} داخل عالم ${worldTitle()} — شخصية ${names[state.avatar]}</p><ol class="review-list">${state.chosen.map((q,i)=>`<li><span><b>${i+1}.</b> ${clean(q.text)}</span><b>${clean(q.options[q.correctIndex])}${q.imageData?.length?' 🖼 4 صور':''}</b></li>`).join('')}</ol><div class="btn-group"><button class="btn green" data-action="publish">أنشئ الرابط الفريد 🔗</button><button class="btn soft" data-action="restart-questions">غيّر الأسئلة</button></div></div>`);}
function share(){state.screen='share';const url=`${location.origin}/play/${state.challengeId}`;layout(`<div class="panel" style="max-width:820px;margin:auto;text-align:center"><div class="wood">🎉 تم إنشاء التحدي بنجاح!</div><h1 style="margin-top:20px">اختبار ${clean(state.name)}</h1><p>عالم ${worldTitle()} • شخصية ${names[state.avatar]} • 10 أسئلة</p><div class="share-url" id="share-link">${clean(url)}</div><div class="btn-group"><button class="btn pink" data-action="copy-link">نسخ الرابط</button><button class="btn green" data-action="share-whatsapp">واتساب</button><button class="btn blue" data-action="share-system">مشاركة</button><button class="btn" data-action="preview">معاينة الاختبار</button></div><div class="btn-group"><button class="btn gold" data-action="stats">إحصائيات التحدي</button><button class="btn soft" data-action="home">الرئيسية</button></div><p class="note">مفتاح الإدارة محفوظ بهذا المتصفح فقط. احتفظ بنسخة آمنة منه ولا ترسلها للأصدقاء.</p><button class="btn soft" data-action="copy-admin">نسخ مفتاح الإدارة الخاص</button></div>`);}
function landing(){state.screen='landing';const ch=state.challenge;state.theme=ch.theme;
 const already=state.visitorStatus!=='new';
 layout(`<div class="panel" style="max-width:980px;margin:auto;text-align:center">${info('رسالة من صديقك')}<h1>قدّيش بتعرف ${clean(ch.name)}؟ ✨</h1><p class="muted">${clean(ch.name)} يدعوك لعالم ${worldTitle()}! 10 أسئلة عن ذوقه وتفاصيل حياته، وشخصيتكما تظهر بالنهاية.</p><div class="friend-rules"><span>✦ 10 أسئلة شخصية</span><span>✦ 4 اختيارات لكل سؤال</span><span>✦ محاولة واحدة لكل متصفح</span><span>✦ اسمك ونتيجتك في لوحة المتصدرين</span></div>${already?`<div class="visitor-banner" role="status">${state.visitorStatus==='completed'?'أكملت هذا التحدي سابقًا من هذا المتصفح. نتيجتك محفوظة بلوحة المتصدرين.':'بدأت تحديًا بهذا المتصفح من قبل. إذا فقدت بيانات المحاولة فلا يمكن إنشاء محاولة جديدة؛ استخدم الجلسة الأصلية.'}</div>`:''}<div class="row friend-intro-hero" style="align-items:center;justify-content:center"><div class="friend-owner-portrait"><img src="${portrait(ch.avatar)}" data-portrait-fallback="${ch.avatar}" alt="الشخصية الكاملة لصاحب التحدي ${clean(ch.name)}" decoding="async" /></div><div class="field" style="min-width:230px;text-align:right"><label for="friend-name">شو اسمك؟</label><input id="friend-name" maxlength="32" class="input" placeholder="اكتب اسمك" value="${clean(state.friendName)}" autocomplete="nickname"/><p class="note">10 أسئلة · محاولة واحدة فقط · عالم ${worldTitle()}</p></div></div><h3 class="selector-heading">اختر شخصيتك اللي رح تحكي مع صاحب التحدي بالنهاية</h3><div class="avatars">${PEOPLE.map(p=>personCard(p,state.friendAvatar,'friend-person')).join('')}</div><div class="btn-group">${already?`<button class="btn green" data-action="resume-friend">${state.visitorStatus==='completed'?'شاهد نتيجتك المحفوظة':'استكمل محاولتك السابقة'} ↪</button>`:`<button class="btn green" data-action="start-friend">ابدأ التحدي ✦</button>`}<button class="btn blue" data-action="leaders">لوحة المتصدرين</button></div></div>`);}
function playing(){state.screen='playing';const q=state.challenge.questions[state.answerIndex];if(!q){launchStory(state.score);return}layout(`<div class="question-layout cinematic-quiz"><aside class="guide-card duo-guide quiz-actors" style="--scene-image:url('${cinematicImage(state.theme,'reply')}')"><img class="owner-mini" src="${portrait(state.challenge.avatar)}" alt="${clean(state.challenge.name)}"/><img src="${portrait(state.friendAvatar)}" alt="${names[state.friendAvatar]}"/><div class="speech">${state.answerStatus?(state.answerStatus.correct?'جواب ممتاز! واضح إنك صاحبه عن جد!':'أوووه! معلومة جديدة… كمل المغامرة!'):'فكّر منيح… صاحبك مستني يشوف الجواب!'}</div></aside><section class="panel quiz-panel">${info('تحدّي '+state.challenge.name)}<div class="quiz-world-stamp">✦ ${worldTitle()} • اختبر معرفتك الحقيقية ✦</div><div class="row" style="justify-content:space-between;align-items:center"><span class="counter">السؤال ${state.answerIndex+1} / 10</span><span class="counter">${state.score} نقاط</span></div><div class="progress" style="margin:12px 0 20px"><i style="width:${state.answerIndex*10}%"></i></div><h2 class="quiz-title">${clean(q.text)}</h2>${questionCard(q,null,'friend')}<div id="response-message" aria-live="polite"></div><div class="btn-group">${state.answerStatus?`<button class="btn green" data-action="next-answer">${state.answerIndex===9?'شاهد النهاية السينمائية':'السؤال التالي ←'}</button>`:''}</div></section></div>`);}
function launchStory(score,{preview=false}={}){state.completed=true;state.screen='story';state.score=score;state.preview=preview;state.story=buildStory({score,ownerName:state.challenge?.name||state.name,friendName:state.friendName||'رفيقي'});state.shotIndex=0;state.paused=false;state.typePos=0;renderStory();}
function renderStory(){
  state.screen='story';
  const beat=state.story[state.shotIndex],out=OUTCOMES[resultBand(state.score)],ch=state.challenge||{name:state.name,avatar:state.avatar},owner=ch.avatar,friend=state.friendAvatar;
  const sceneName=clean(beat.label),mood=clean(beat.mood),effect=clean(beat.effect);
  // All characters remain ORIGINAL full-body master PNGs; portrait selection uses cards elsewhere.
  layout(`<div class="story-stage cinematic-transition round08-stage round09-stage" id="story-stage" data-shot="${beat.shot}" data-world="${state.theme}" data-mood="${mood}" data-effect="${effect}" data-beat="${state.shotIndex}" style="background-image:url('${cinematicImage(state.theme,beat.id)}')" aria-label="اللقطة ${state.shotIndex+1} من 5 — ${sceneName}"><div class="story-atmosphere" aria-hidden="true"></div><div class="cinema-light" aria-hidden="true"></div><div class="story-top"><span class="wood scene-heading">${sceneName} • ${worldTitle()}</span><span class="pill" dir="ltr">${state.shotIndex+1} / 5</span></div><div class="story-people"><img class="actor owner" src="${portrait(owner)}" alt="شخصية ${clean(ch.name)} كاملة التفاصيل" decoding="async" data-portrait-fallback="${owner}"/><img class="actor friend" src="${portrait(friend)}" alt="شخصية ${clean(state.friendName||'الصديق')} كاملة التفاصيل" decoding="async" data-portrait-fallback="${friend}"/></div><div class="story-bubble ${beat.speaker==='owner'?'owner':'friend'}"><small class="dialog-speaker">${beat.speaker==='owner'?clean(ch.name):clean(state.friendName||'الصديق')}</small><span id="story-line" aria-live="polite"></span></div><div class="story-board ${state.shotIndex>=3?'shown':''}"><small>${clean(out.title)}</small><strong>${state.score}/10</strong>${state.shotIndex===4?'<small>✦ نهاية المغامرة ✦</small>':''}</div><div class="story-caption"><span>✦ ${clean(beat.caption)}</span><span>حكاية ${clean(ch.name)} و${clean(state.friendName||'الصديق')}</span></div></div><div class="scene-controls"><div class="btn-group" style="margin:0"><button class="btn blue" data-action="story-next">${state.shotIndex<4?'المشهد التالي ←':'عرض النتيجة'}</button><button class="btn soft" data-action="story-pause" aria-pressed="${state.paused}">${state.paused?'استئناف':'إيقاف مؤقت'}</button><button class="btn gold" data-action="story-skip">تخطي المشاهد</button></div><div class="dots" aria-label="تقدم المشاهد">${state.story.map((x,i)=>`<i class="${i===state.shotIndex?'active':''}" aria-label="لقطة ${i+1}"></i>`).join('')}</div></div>`);
  const line=$('#story-line');let j=state.typePos||0;const text=beat.text;const generation=++state.lineVersion;
  if(!state.paused)murmur(beat.speaker==='owner'?owner:friend,beat.mood);
  line.textContent=text.slice(0,j);
  const step=()=>{if(generation!==state.lineVersion||state.screen!=='story'||state.paused)return;
    j=Math.min(text.length,j+3);state.typePos=j;line.textContent=text.slice(0,j);
    if(j<text.length)state.typeTimer=setTimeout(step,32);
  };
  if(state.typeTimer)clearTimeout(state.typeTimer);
  if(!state.paused){
    if(!pref.motion||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){j=text.length;state.typePos=j;line.textContent=text;}
    else step();
  }
  if(state.shotIndex<4){const next=new Image();next.src=cinematicImage(state.theme,state.story[state.shotIndex+1].id)}
  clearTimeout(autoplayTimeout);
  if(pref.auto&&!state.paused){autoplayTimeout=setTimeout(()=>{if(state.screen==='story'&&!state.paused)nextStory()},Math.max(4300,text.length*45+2200))}
}
function nextStory(){clearTimeout(autoplayTimeout);clearTimeout(state.typeTimer);stopSpeech();state.lineVersion++;
  if(state.shotIndex<4){state.shotIndex++;state.typePos=0;ping('click');renderStory()}else finishStory()}
function finishStory(){clearTimeout(autoplayTimeout);clearTimeout(state.typeTimer);state.lineVersion++;stopSpeech();state.screen='result';const out=OUTCOMES[resultBand(state.score)];layout(`<div class="panel" style="max-width:860px;text-align:center;margin:auto"><div class="wood">${state.preview?'معاينة تجريبية — ':''}${clean(out.title)}</div><div style="font-size:clamp(65px,12vw,115px);font-weight:900;color:#b67532;text-shadow:1px 3px #fff">${state.score}<span style="font-size:.5em">/10</span></div><p style="font-size:20px;font-weight:900">${clean(out.closing)}</p><p class="muted">في عالم ${worldTitle()} — حكاية ${clean(state.challenge?.name||state.name)} و${clean(state.friendName||'الصديق')}</p><div class="btn-group"><button class="btn pink" data-action="share-result">شارك النتيجة</button><button class="btn blue" data-action="leaders">المتصدرون</button><button class="btn green" data-action="create">أنشئ تحديك أنت</button></div></div>`)}
async function leaders(){state.screen='leaders';try{const id=state.challengeId||state.challenge?.id;if(!id)throw Error('لا يوجد تحدٍّ بعد.');const data=await request(`/api/challenges/${id}/leaderboard`);state.leaders=data.leaders;}catch(e){toast(e.message);return}layout(`<div class="panel" style="max-width:780px;margin:auto">${info('تنافس الأصدقاء')}<h1>لوحة المتصدرين 🏆</h1>${state.leaders.length?`<table class="rank-table"><thead><tr><th>المركز</th><th>الصديق</th><th>الشخصية</th><th>النتيجة</th></tr></thead><tbody>${state.leaders.map(p=>`<tr><td>${p.rank}</td><td>${clean(p.name)}</td><td>${names[p.avatar]||'—'}</td><td><b>${p.score}/10</b></td></tr>`).join('')}</tbody></table>`:`<div class="empty">لسه ما في نتائج مسجلة. أول صديق يخلص التحدي رح يظهر هون!</div>`}<div class="btn-group"><button class="btn blue" data-action="back-from-leaders">رجوع</button><button class="btn green" data-action="create">أنشئ تحديك</button></div></div>`)}
function renderParticipants(items){
  if(!items?.length)return '<tr><td colspan="4" class="empty">لم يدخل أي صديق التحدي بعد.</td></tr>';
  return items.map(p=>`<tr><td><strong>${clean(p.name)}</strong></td><td>${clean(names[p.avatar]||'—')}</td><td><span class="participant-tag ${p.completed_at?'finished':'pending'}">${p.completed_at?'أكمل التحدي':'يجيب الآن ('+p.current_index+'/10)'}</span></td><td><b>${p.completed_at?p.score+'/10':'—'}</b></td></tr>`).join('');
}
let statsRefreshTimer=null;
async function refreshStatsQuietly(){
  if(state.screen!=='stats'||!state.challengeId)return;
  try{
    const token=localStorage.getItem(`v7:owner:${state.challengeId}`)||state.ownerToken;
    const data=await request(`/api/challenges/${state.challengeId}/stats`,{token});
    if(state.screen!=='stats')return;
    state.stats=data.stats;
    const list=$('#stats-participants');if(list)list.innerHTML=renderParticipants(data.stats.participants);
    const numbers=document.querySelectorAll('[data-stat-metric]');
    for(const el of numbers){const v=data.stats[el.dataset.statMetric];el.textContent=(v??0)+(el.dataset.statMetric==='average'?'/10':'');}
    if($('#stats-updated'))$('#stats-updated').textContent='آخر تحديث: '+new Date().toLocaleTimeString('ar-SY');
  }catch{}
}
async function stats(){const id=state.challengeId;if(!id){toast('أنشئ اختبارًا أولًا');return}const token=localStorage.getItem(`v7:owner:${id}`)||state.ownerToken;if(!token){toast('مفتاح الإدارة غير متاح بهذا المتصفح.');return}try{const data=await request(`/api/challenges/${id}/stats`,{token});state.stats=data.stats}catch(e){toast(e.message);return}state.screen='stats';clearInterval(statsRefreshTimer);statsRefreshTimer=setInterval(refreshStatsQuietly,12000);const s=state.stats;layout(`<div class="panel" style="max-width:890px;margin:auto">${info('الإدارة الخاصة')}<h1>إحصائيات تحدّي ${clean(state.name||state.challenge?.name)}</h1><div class="mini-stats"><div class="stat"><b data-stat-metric="views">${s.views}</b>زيارة</div><div class="stat"><b data-stat-metric="started">${s.started}</b>محاولة</div><div class="stat"><b data-stat-metric="finished">${s.finished}</b>إكمال</div><div class="stat"><b data-stat-metric="average">${s.average}/10</b>المتوسط</div></div><h3 style="margin-top:22px">أسماء الأصدقاء المشاركين ونتائجهم 🏆</h3><p class="note">كل اسم يدخل المحاولة يظهر هنا، وتُعتمد نتيجته وترتيبه بمجرد إكمال الأسئلة العشرة. يتم تحديث القائمة كل 12 ثانية أثناء فتح هذه الصفحة.</p><div class="stats-participant-wrap"><table class="rank-table" aria-live="polite"><thead><tr><th>اسم الصديق</th><th>الشخصية</th><th>الحالة</th><th>النتيجة</th></tr></thead><tbody id="stats-participants">${renderParticipants(s.participants)}</tbody></table></div><p class="note" id="stats-updated">آخر تحديث: الآن</p><div class="btn-group"><button class="btn blue" data-action="refresh-stats">تحديث الإحصائيات الآن ↻</button></div><h3 style="margin-top:22px">الأسئلة التي احتاجت معرفة أكثر</h3><table class="rank-table"><thead><tr><th>السؤال</th><th>إجابات صحيحة</th><th>المحاولات</th></tr></thead><tbody>${s.byQuestion.map(q=>`<tr><td>${clean(q.text)}</td><td>${q.correct}</td><td>${q.total}</td></tr>`).join('')}</tbody></table><div class="btn-group"><button class="btn ${s.active?'soft':'green'}" data-action="toggle-active">${s.active?'تعطيل رابط التحدي':'إعادة تفعيل التحدي'}</button><button class="btn blue" data-action="leaders">المتصدرون</button><button class="btn gold" data-action="share-page">المشاركة</button></div></div>`)}
function settings(){const old=$('.overlay');if(old)old.remove();document.body.insertAdjacentHTML('beforeend',`<div class="overlay" id="modal"><div class="panel"><h2>إعدادات الرحلة ⚙</h2><div class="field"><label><input type="checkbox" data-pref="effects" ${pref.effects?'checked':''}/> المؤثرات الصوتية</label><label><input type="checkbox" data-pref="music" ${pref.music?'checked':''}/> موسيقى الخلفية (الواجهة الرئيسية ثم العالم المختار)</label><label><input type="checkbox" data-pref="voices" ${pref.voices?'checked':''}/> همهمات الشخصيات الخمس (من دون كلام)</label><label><input type="checkbox" data-pref="motion" ${pref.motion?'checked':''}/> حركة العوالم والتفاعلات البصرية</label><label><input type="checkbox" data-pref="auto" ${pref.auto?'checked':''}/> انتقال اللقطات تلقائيًا</label></div><div class="field"><label for="sound-volume">مستوى الصوت</label><input id="sound-volume" type="range" data-pref="volume" min="0" max="1" step="0.05" value="${pref.volume}" /></div><p class="note">تتحدث الشخصيات بالفقاعات المكتوبة فقط، ولكل شخصية همهمتها المميزة. قد يمنع المتصفح تشغيل الموسيقى تلقائيًا حتى تضغط أحد أزرار الصفحة. ويمكنك إيقافها أو تشغيلها في أي وقت.</p><div class="btn-group"><button class="btn green" data-action="close-settings">تم</button></div></div></div>`)}
function customModal(){
 state.customPictures=[null,null,null,null];state.customBusy=false;
 document.body.insertAdjacentHTML('beforeend',`<div class="overlay" id="custom-modal"><form class="panel custom-editor" id="custom-form"><h2>سؤال شخصي من عندك ✨</h2><p class="note">اكتب سؤالك وأربعة خيارات، ويمكنك إضافة أربع صور من جهازك، صورة لكل خيار. تُقصّ وتُضغط الصور تلقائيًا قبل حفظها، ولا تظهر إجابتك الصحيحة للصديق.</p><div class="field"><label for="custom-text">نص السؤال</label><input id="custom-text" class="input" required minlength="6" maxlength="145" placeholder="شو أكثر شي بيفرّحني؟"/></div><div class="custom-photo-grid">${[0,1,2,3].map(i=>`<div class="custom-photo-slot"><label for="custom-opt-${i}">الخيار ${i+1}</label><input id="custom-opt-${i}" class="input custom-option" required maxlength="70" placeholder="الاختيار ${i+1}"/><label class="photo-upload" for="custom-photo-${i}" id="photo-label-${i}"><span id="photo-preview-${i}" class="photo-preview">🖼️</span><span>ارفع صورة الخيار ${i+1}</span></label><input type="file" class="photo-file" id="custom-photo-${i}" data-photo-index="${i}" accept="image/jpeg,image/png,image/webp" aria-label="صورة الخيار ${i+1}"/><button type="button" class="remove-photo" data-action="remove-photo" data-value="${i}" hidden id="remove-photo-${i}">حذف الصورة ✕</button></div>`).join('')}</div><p id="photo-help" class="note" aria-live="polite">اختياري: يمكنك ترك الصور الأربع فارغة أو رفع صورة لكل خيار. الحد 5MB للصورة الأصلية.</p><div class="field"><label for="custom-correct">الإجابة الصحيحة</label><select class="input" id="custom-correct">${[0,1,2,3].map(i=>`<option value="${i}">الخيار ${i+1}</option>`).join('')}</select></div><div class="btn-group"><button class="btn green" id="submit-custom" type="submit">أضف السؤال</button><button class="btn soft" type="button" data-action="close-custom">إلغاء</button></div></form></div>`);
}
function showPhoto(i){const target=$(`#photo-preview-${i}`),data=state.customPictures[i];if(!target)return;target.innerHTML=data?`<img src="${data}" alt="معاينة الصورة ${i+1}" />`:'🖼️';$(`#remove-photo-${i}`).hidden=!data;$(`#photo-label-${i}`)?.classList.toggle('uploaded',!!data)}
async function compressPicture(file){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('اختر صورة JPG أو PNG أو WebP فقط.');
 if(file.size>5_000_000)throw Error('الصورة الأصلية أكبر من 5MB.');
 const blobUrl=URL.createObjectURL(file);
 try{
  const img=new Image();img.src=blobUrl;await img.decode();
  if(img.naturalWidth<32||img.naturalHeight<32)throw Error('الصورة صغيرة جدًا.');
  const canvas=document.createElement('canvas');canvas.width=420;canvas.height=294;
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)throw Error('المتصفح لا يدعم تجهيز الصور.');
  const scale=Math.max(canvas.width/img.naturalWidth,canvas.height/img.naturalHeight);
  const width=img.naturalWidth*scale,height=img.naturalHeight*scale;
  ctx.fillStyle='#f6e6c6';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(img,(canvas.width-width)/2,(canvas.height-height)/2,width,height);
  let result=canvas.toDataURL('image/webp',.78);
  if(!result.startsWith('data:image/webp;'))result=canvas.toDataURL('image/jpeg',.75);
  if(result.length>245000)result=canvas.toDataURL('image/jpeg',.60);
  if(result.length>245000)throw Error('الصورة كبيرة بعد الضغط؛ جرّب صورة أبسط.');
  return result;
 }finally{URL.revokeObjectURL(blobUrl)}
}
function join(){document.body.insertAdjacentHTML('beforeend',`<div class="overlay" id="join-modal"><form id="join-form" class="panel" style="max-width:560px"><h2>معك رابط صديقك؟ 🔗</h2><p class="note">الصق رابط التحدي، وسنأخذك إلى صفحته لاختيار شخصيتك والإجابة على 10 أسئلة.</p><label for="join-link">رابط الصديق</label><input id="join-link" class="input" required placeholder="https://example.com/play/…" autocomplete="off" dir="ltr"/><div class="btn-group"><button type="submit" class="btn green">افتح التحدي</button><button type="button" class="btn soft" data-action="close-join">إلغاء</button></div></form></div>`)}
async function request(url,{method='GET',data,token}={}){const res=await fetch(url,{method,credentials:'same-origin',headers:{...(data?{'Content-Type':'application/json'}:{}),...(token?{'Authorization':'Bearer '+token}:{})},...(data?{body:JSON.stringify(data)}:{})});let json={};try{json=await res.json()}catch{}if(!res.ok)throw Error(json.message||`خطأ الخادم (${res.status})`);return json}
function updatePair(){if(state.screen==='home')home();else if(state.screen==='setup')setup();else if(state.screen==='landing')landing()}
async function choice(i){if(state.chosen.length>=10)return;if(state.chosen.some(q=>q.id===selectedQuestion().id)){toast('السؤال مضاف');return}const q=selectedQuestion();state.chosen.push({...q,text:questionLabel(q),correctIndex:i});ping('correct');if(state.chosen.length===10){review();return}state.cursor=(state.cursor+1)%state.bank.length;let loops=0;while(state.chosen.some(x=>x.id===selectedQuestion()?.id)&&++loops<=state.bank.length){state.cursor=(state.cursor+1)%state.bank.length}builder()}
async function friendAnswer(index){if(state.answerStatus||state.answerPending)return;state.answerPending=true;const q=state.challenge.questions[state.answerIndex];try{const r=await request(`/api/attempts/${state.attemptId}/answer`,{method:'POST',token:state.accessToken,data:{position:state.answerIndex,choice:index}});state.answerStatus=r;state.score+=r.correct?1:0;ping(r.correct?'correct':'wrong');playing();document.querySelectorAll('.answer').forEach((el,i)=>{el.disabled=true;if(i===index)el.classList.add(r.correct?'chosen':'wrong');if(i===r.correctIndex)el.classList.add('chosen')});$('#response-message').innerHTML=`<p class="${r.correct?'status':'error'}">${r.correct?'صح! برافو عليك ✦':`مو تمام! الجواب الصحيح: ${clean(q.options[r.correctIndex])}`}</p>`;if(pref.auto)autoplayTimeout=setTimeout(()=>{if(state.screen==='playing'&&state.answerStatus)advanceFriend()},1700)}catch(e){toast(e.message)}finally{state.answerPending=false}}
function advanceFriend(){clearTimeout(autoplayTimeout);stopSpeech();const finished=state.answerIndex===9;state.answerIndex++;state.answerStatus=null;if(finished){launchStory(state.score)}else playing()}
async function boot(){try{state.bank=await (await fetch('/questions.json')).json()}catch{state.bank=[]}const path=location.pathname.split('/').filter(Boolean);if(path[0]==='play'&&path[1]){try{state.challengeId=path[1];state.challenge=await request('/api/challenges/'+encodeURIComponent(path[1]));state.name=state.challenge.name;state.avatar=state.challenge.avatar;state.theme=state.challenge.theme;const session=localStorage.getItem('v7:attempt:'+state.challengeId);if(session){try{const stored=JSON.parse(session);const a=await request(`/api/attempts/${stored.id}`,{token:stored.token});state.attemptId=a.id;state.accessToken=stored.token;state.friendName=a.name;state.friendAvatar=a.avatar;state.answerIndex=a.currentIndex;state.score=a.score;if(a.finished){state.completed=true;state.preview=false;finishStory();return}playing();return}catch{localStorage.removeItem('v7:attempt:'+state.challengeId)}}try{const status=await request(`/api/challenges/${state.challengeId}/my-status`);state.visitorStatus=status.status}catch{}landing()}catch(e){layout(`<div class="panel"><h1>الرابط غير متاح</h1><p class="error">${clean(e.message)}</p><button class="btn" data-action="home">الرئيسية</button></div>`)}}else if(path[0]==='owner'&&path[1]){state.challengeId=path[1];state.ownerToken=localStorage.getItem('v7:owner:'+path[1])||'';try{state.challenge=await request('/api/challenges/'+path[1]);state.name=state.challenge.name;state.avatar=state.challenge.avatar;state.theme=state.challenge.theme;await stats()}catch(e){toast(e.message);home()}}else home()}
// One event delegation layer; no inert controls.
document.addEventListener('click',async e=>{const el=e.target.closest('[data-action]');if(!el)return;const action=el.dataset.action,value=el.dataset.value;audioUnlocked=true;if(audioBlocked&&action!=='toggle-music')configureAudio();const cue=['hero-person','select-person','friend-person','hero-world','select-world','choose-correct'].includes(action)?'select':['next-answer','story-next','skip','create','start-building'].includes(action)?'next':['publish','start-friend'].includes(action)?'reveal':action==='toggle-music'?'toggle':['settings','close-settings'].includes(action)?'soft':['home','back-from-leaders'].includes(action)?'back':'click';ping(cue);try{switch(action){
case'home':history.pushState({},'', '/');state.worldMusicSelected=false;home();break;
case'create':beginCreate();break;
case'hero-person':state.avatar=value;home();toast('اخترت '+names[value]);break;
case'hero-world':state.worldMusicSelected=true;state.theme=value;home();worldChime(value);toast('العالم المختار: '+worldTitle());break;
case'select-person':state.avatar=value;setup();break;
case'select-world':state.worldMusicSelected=true;state.theme=value;setup();worldChime(value);break;
case'friend-person':state.friendAvatar=value;landing();break;
case'setup':setup();break;
case'settings':settings();break;
case'toggle-music':if(!pref.music)pref.music=true;else if(!audioBlocked)pref.music=false;audioBlocked=false;storePrefs();configureAudio();break;
case'join':join();break;
case'close-settings':$('#modal')?.remove();break;
case'start-building':state.name=$('#owner-name').value.trim();if(state.name.length<2){toast('اكتب اسمًا من حرفين على الأقل');break}if(!state.bank.length){toast('تعذّر تحميل بنك الأسئلة');break}builder();break;
case'choose-correct':await choice(Number(value));break;
case'skip':state.cursor=(state.cursor+1)%state.bank.length;{let n=0;while(state.chosen.some(q=>q.id===selectedQuestion().id)&&n++<state.bank.length)state.cursor=(state.cursor+1)%state.bank.length;}builder();break;
case'custom':customModal();break;
case'close-custom':$('#custom-modal')?.remove();break;
case'remove-photo':state.customPictures[Number(value)]=null;showPhoto(Number(value));ping('click');break;
case'close-join':$('#join-modal')?.remove();break;
case'restart-questions':state.chosen=[];state.cursor=0;builder();break;
case'publish':{el.disabled=true;try{const r=await request('/api/challenges',{method:'POST',data:{name:state.name,avatar:state.avatar,theme:state.theme,questions:state.chosen}});state.challengeId=r.id;state.ownerToken=r.ownerToken;localStorage.setItem('v7:owner:'+r.id,r.ownerToken);history.replaceState({},'', '/owner/'+r.id);share()}catch(e){toast(e.message);el.disabled=false}break}
case'copy-admin':await navigator.clipboard.writeText(state.ownerToken);toast('انسخ المفتاح في مكان آمن ولا ترسله لأحد');break;
case'copy-link':await navigator.clipboard.writeText(location.origin+'/play/'+state.challengeId);toast('تم نسخ الرابط!');break;
case'share-whatsapp':window.open('https://wa.me/?text='+encodeURIComponent(`تعال جرّب تحدّي ${state.name}: ${location.origin}/play/${state.challengeId}`),'_blank','noopener');break;
case'share-system':{const url=location.origin+'/play/'+state.challengeId;if(navigator.share)await navigator.share({title:'قدّيش بتعرفني؟',url});else{await navigator.clipboard.writeText(url);toast('تم نسخ الرابط')}}break;
case'preview':{const ch=await request('/api/challenges/'+state.challengeId);state.challenge=ch;state.friendName='صديقك';state.friendAvatar='panda';launchStory(8,{preview:true});break}
case'resume-friend':{
  const r=await request(`/api/challenges/${state.challengeId}/resume`,{method:'POST'});
  state.attemptId=r.id;state.accessToken=r.accessToken;state.friendName=r.name;state.friendAvatar=r.avatar;
  state.answerIndex=r.currentIndex;state.score=r.score;
  localStorage.setItem('v7:attempt:'+state.challengeId,JSON.stringify({id:r.id,token:r.accessToken}));
  if(r.finished){state.completed=true;state.preview=false;finishStory()}else playing();
  break;
}
case'start-friend':{if(state.visitorStatus!=='new'){toast('لديك محاولة مسجلة. شاهد لوحة المتصدرين.');break}const name=$('#friend-name').value.trim();if(name.length<2){toast('اكتب اسمك أولاً');break}state.friendName=name;el.disabled=true;try{const r=await request(`/api/challenges/${state.challengeId}/attempts`,{method:'POST',data:{name,avatar:state.friendAvatar}});state.attemptId=r.id;state.accessToken=r.accessToken;state.answerIndex=0;state.score=0;localStorage.setItem('v7:attempt:'+state.challengeId,JSON.stringify({id:r.id,token:r.accessToken}));playing()}catch(e){if(/محاولة رسمية سابقة/.test(e.message)){toast('هذه اللعبة تسمح بمحاولة واحدة لكل متصفح. اسمك يظهر بعد إكمال الإجابات.');await leaders()}else{toast(e.message);el.disabled=false}}break}
case'answer':await friendAnswer(Number(value));break;
case'next-answer':advanceFriend();break;
case'story-next':nextStory();break;
case'story-pause':state.paused=!state.paused;if(state.paused){clearTimeout(autoplayTimeout);clearTimeout(state.typeTimer);stopSpeech()}renderStory();break;
case'story-skip':finishStory();break;

case'leaders':await leaders();break;
case'back-from-leaders':if(state.preview||state.ownerToken)share();else if(state.completed)finishStory();else landing();break;
case'stats':await stats();break;
case'refresh-stats':await refreshStatsQuietly();toast('تم تحديث أسماء المشاركين');break;
case'toggle-active':await request(`/api/challenges/${state.challengeId}`,{method:'PATCH',token:state.ownerToken||localStorage.getItem('v7:owner:'+state.challengeId),data:{active:!state.stats.active}});await stats();break;
case'share-page':share();break;
case'share-result':{const t=`عرفت ${state.challenge?.name||state.name} وجبت ${state.score}/10 في قدّيش بتعرفني؟`;if(navigator.share)await navigator.share({text:t,url:location.origin+'/play/'+state.challengeId});else{await navigator.clipboard.writeText(t+' '+location.origin+'/play/'+state.challengeId);toast('تم نسخ النتيجة!')}break}
}}catch(e){if(e?.name!=='AbortError')toast(e.message||'حدث خطأ، حاول مجددًا')}});
document.addEventListener('change',async e=>{
 const target=e.target;
 if(target.matches('[data-photo-index]')){
   const i=Number(target.dataset.photoIndex),file=target.files?.[0];
   if(!file)return;
   state.customBusy=true;
   const button=$('#submit-custom');if(button){button.disabled=true;button.textContent='جاري تجهيز الصورة…'}
   try{state.customPictures[i]=await compressPicture(file);showPhoto(i);ping('upload');$('#photo-help').textContent='تُحفظ الصور الأربع مع السؤال عند إنشاء رابط التحدي.'}catch(error){toast(error.message);target.value=''}
   finally{state.customBusy=false;if(button){button.disabled=false;button.textContent='أضف السؤال'}}
   return;
 }
 if(!target.dataset.pref)return;const p=target.dataset.pref;pref[p]=target.type==='checkbox'?target.checked:Number(target.value);storePrefs();if(p==='motion')configureMotion(pref.motion);if(p==='voices'&&!pref.voices)stopSpeech();if(p==='music'||p==='volume')configureAudio()});
document.addEventListener('submit',e=>{
 if(e.target.id==='join-form'){
  e.preventDefault();const value=$('#join-link').value.trim();let id=value;
  try{if(value.includes('://')){const u=new URL(value);id=u.pathname.match(/^\/play\/([A-Za-z0-9_-]{6,40})\/?$/)?.[1]||''}}catch{id=''}
  if(!/^[A-Za-z0-9_-]{6,40}$/.test(id)){toast('الرابط غير صحيح. انسخ رابط /play/ كاملًا.');return}
  location.href='/play/'+encodeURIComponent(id);return;
 }
 if(e.target.id!=='custom-form')return;e.preventDefault();const text=$('#custom-text').value.trim(),options=[...document.querySelectorAll('.custom-option')].map(i=>i.value.trim()),correctIndex=Number($('#custom-correct').value);if(text.length<6||options.some(v=>!v)||new Set(options).size!==4){toast('تأكد من السؤال واختلاف الخيارات الأربعة');return}if(state.customBusy){toast('انتظر حتى تنتهي معالجة الصور.');return}
const images=state.customPictures;
if(images.some(Boolean)&&!images.every(Boolean)){toast('ارفع الصور الأربع كاملة، أو اتركها جميعًا فارغة.');return}
state.bank.splice(state.cursor,0,{id:'custom-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),category:'شخصي',text,options,noArt:!images.every(Boolean),...(images.every(Boolean)?{imageData:[...images]}:{})});const q=state.bank[state.cursor];state.chosen.push({...q,text:questionLabel(q),correctIndex});$('#custom-modal')?.remove();state.cursor++;if(state.chosen.length===10)review();else builder()});
document.addEventListener('input',e=>{if(e.target.id==='owner-name')state.name=e.target.value;if(e.target.id==='friend-name')state.friendName=e.target.value});
// Quiet interface hover cues become available only after the first deliberate interaction.
document.addEventListener('pointerover',e=>{const button=e.target.closest('button[data-action]');if(!audioUnlocked||!button||!pref.effects)return;const now=Date.now();if(now-lastHoverSound>150){lastHoverSound=now;ping('hover')}});
window.addEventListener('popstate',()=>location.reload());boot();

// CSP-safe fallback: an error changes only the file format, never the character identity.
document.addEventListener('error',event=>{
  const img=event.target, character=img?.dataset?.portraitFallback;
  if(!character||!PEOPLE.some(p=>p.id===character)||img.dataset.fallbackAttempted)return;
  img.dataset.fallbackAttempted='1';
  img.src=`/assets/characters/${character}-restored.webp`;
},true);
