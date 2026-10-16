const $ = (s,ctx=document) => ctx.querySelector(s);
const esc = x => String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const avatars = ['😎','🥳','🤠','🦄','🐼','🦊','🐸','👑','🐱','🤖','😼','🧙'];
const themes = [{id:'sunny',name:'شمسي',color:'#ffe384'},{id:'lavender',name:'بنفسجي',color:'#b3a2ff'},{id:'aqua',name:'نعناعي',color:'#a7ebea'},{id:'peach',name:'خوخي',color:'#ffd0c5'}];
const goodLines=['يا سلام! شكلك حافظه أكثر من حاله 😂','إجابة صح! عندك أرشيف سري عنه؟','ممتاز! الصداقة لسا بخير.','نقطة إلك يا محقق كونان!','واو! هذه إجابة الأصدقاء الأصليين 👀','صح! مين سرب لك الإجابة؟','يا عيني على هالمعرفة!','الصداقة عندك معتمدة رسميًا ✅','إجابة من ذهب! ✨','واضح إنك مو زائر عابر!'];
const badLines=['يا ساتر! أنت متأكد إنكم أصحاب؟ 😂','غلط! راجع ملفات الصداقة عندك.','واضح إنك كنت غايب عن آخر تحديث.','الصدمة وصلت حتى للسيرفر!','معلوماتك عنه تحتاج صيانة عاجلة.','يا خسارة الثقة! بس كمّل 😅','معلش، لساتك بتتعلم!','طيب جرب تتعرّف عليه مرة ثانية 😂','أوف! نحتاج اجتماعًا عاجلًا.','ماشي... بنعتبرها زلة صداقة.'];
const ranks=[
  {min:15,icon:'👑',title:'الأسطورة المطلقة',desc:'هذا مو صديق… هذا نسخة احتياطية من ذاكرتك! يعرف عنك أشياء يمكن أنت ناسيها.'},
  {min:13,icon:'💖',title:'توأم الروح',desc:'شخص يعرفك بطريقة مريبة شوي… بس من النوع الحلو!'},
  {min:10,icon:'🔥',title:'صديق من العيار الثقيل',desc:'واضح إن الصداقة بينكم إلها تاريخ… بس لسا عنده شوية أسرار يكتشفها.'},
  {min:7,icon:'🛠️',title:'الصديق قيد التحديث',desc:'مو سيئ أبدًا… بس في كم حلقة من حياتك فاتته.'},
  {min:4,icon:'🤨',title:'مين حضرتك؟',desc:'في معرفة بينكم أكيد… بس شكلها النسخة التجريبية المجانية!'},
  {min:0,icon:'🚨',title:'مشروع حظر مؤجل',desc:'نطالب بفتح تحقيق عاجل في هذه الصداقة! زر الحظر عم يراقب الوضع من بعيد 😂'}
];
const finaleQuips=[
 ['إنت مو حافظ أجوبته وبس… غالبًا بتعرف شو رح يقول قبل ما يحكي!','إذا عملنا امتحان رسمي بالصداقة، أنت رئيس لجنة التصحيح.','14 سؤال سهل… بس الـ15؟ جبتهم كلهم. ممنوع تفتخر كثير!','حتى ذاكرته الشخصية عم تسألك عن الأسرار!'],
 ['شوي وبتصير تكمّل جُمَله بدل عنه.','بدك بس سؤالين زيادة وتاخد لقب شريك الذاكرة.','الصداقة عندكم بدها مسلسل من 8 مواسم!','معرفة ممتازة… وتفاصيل صغيرة رح تكمل الصورة.'],
 ['يعني بتعرفه منيح… ومبين إنك بتسمع لما يحكي!','النقاط بتحكي عن علاقة حقيقية، مو بس لايكات.','محقق ممتاز، بس لسا في ملفات سرية 😎','قدّمت أداءً يستاهل قهوة على حسابه.'],
 ['إجاباتك معقولة… بس بدنا تحديث جديد للملف!','مو غريب عنه، ولا أنت موسوعة أسراره.','عندك فرصة تكمل موسم التعارف القادم!','نص الطريق تقريبًا… وحياة جديدة للمحقق.'],
 ['يا ترى انتو أصحاب ولا بس واقفين بنفس الصورة؟ 😂','ما رح نصادر بطاقة الصداقة… حاليًا.','في مجال للتطوير قبل الامتحان النهائي.','صاحبك بده جلسة تعريف من أول وجديد!'],
 ['التحقيق انتهى… وما حدا رح يخبره إنك اخترت هالإجابات 🤫','لا تخاف، زر الحظر كوميدي وما بيشتغل هون 😂','ابدأ بسؤاله شو بيحب يشرب… ومشي الحال.','حتى الروبوت تبعنا صار يطلب تفسير!']
];
const freshDraft=()=>({name:'',avatar:'😎',theme:'sunny',questions:[]});
let draft;try { draft={...freshDraft(),...JSON.parse(localStorage.getItem('qm_draft')||'{}')}; if(!Array.isArray(draft.questions)) draft.questions=[]; } catch {draft=freshDraft();}
let bank=[], step=0, answerIndex=0, category='الكل', search='', customOpen=false;
let custom={text:'',options:['','','','']};
let quiz=null, attempt=null, player={name:'',avatar:'😎'}, reaction=null, busy=false, stats=null, leaders=null, ownerInput='', statsError='', contentError='';
let soundOn=localStorage.getItem('qm_sound')==='true';
const save=()=>localStorage.setItem('qm_draft',JSON.stringify(draft));
const app=$('#app');
function alertToast(s){const el=$('#toast');el.textContent=s;el.classList.add('show');clearTimeout(alertToast.t);alertToast.t=setTimeout(()=>el.classList.remove('show'),3100);}
function path(){return location.pathname.split('/').filter(Boolean);}
const shareUrl=id=>location.origin+'/q/'+id;
function questionForFriend(text,name){
 if(text==='شو لوني المفضل؟') return `شو لون ${name} المفضل؟`;
 if(text==='شو أكتر أكلة بحبها؟') return `شو أكتر أكلة بيحبها ${name}؟`;
 if(text==='شو فصلي المفضل؟') return `شو فصل ${name} المفضل؟`;
 if(text==='شو الحيوان المفضل عندي؟') return `شو الحيوان المفضل عند ${name}؟`;
 if(text==='شو رياضتي المفضلة؟') return `شو رياضة ${name} المفضلة؟`;
 if(text==='شو مشروبي اليومي المفضل؟') return `شو مشروب ${name} اليومي المفضل؟`;
 return `لو ${name} سألك: «${text}»`;
}
const ownerLink=(id,key)=>location.origin+'/dashboard/'+id+'#key='+encodeURIComponent(key);
function glyph(){return `<div class="mascot"><div class="mascot-ear ear-left"></div><div class="mascot-ear ear-right"></div><div class="mascot-body"></div><div class="mascot-eye left"></div><div class="mascot-eye right"></div><div class="mascot-cheek left"></div><div class="mascot-cheek right"></div><div class="mascot-mouth"></div><div class="mascot-arm left"></div><div class="mascot-arm right"></div><div class="mascot-foot left"></div><div class="mascot-foot right"></div></div>`;}
const header=()=>`<header class="site-header container"><a class="brand" href="/" data-link><span class="brand-mark">🤪</span><span>قدّيش بتعرفني<span style="color:#8057e8">؟</span></span></a><div class="header-actions"><a href="/#how" class="header-link" data-home-how>كيف بتلعب؟</a><button class="btn btn-sm btn-ghost" data-action="sound" title="تشغيل أو كتم الصوت">${soundOn?'🔊':'🔇'}</button><a class="btn btn-sm btn-purple" href="/create" data-link>✨ أنشئ تحديك</a></div></header>`;
const footer=()=>`<footer class="site-footer container"><span>صُنع بحب وبكمية ضحك مش طبيعية 💜</span><span>خصوصيتك مهمة: لا تشارك معلومات شخصية حساسة داخل الأسئلة.</span></footer>`;
function shell(inner,cl='inner-page',theme=''){return `<main class="page ${cl} ${theme?'theme-'+esc(theme):''}">${header()}${inner}${footer()}</main>`;}
function loading(){app.innerHTML=shell(`<section class="loading"><div class="spinner"></div><p>عم نرتّب الكواليس… لحظة 🎭</p></section>`);}
function fail(message){app.innerHTML=shell(`<div class="container"><div class="stage-shell stage-panel" style="text-align:center;margin-top:70px"><div style="font-size:70px">😵</div><h2>أوبس! في شي مو تمام</h2><p class="hint">${esc(message)}</p><div class="ready-buttons"><a href="/" class="btn btn-purple" data-link>رجوع للرئيسية</a><button class="btn" data-action="reload">حاول مرة ثانية</button></div></div></div>`);}
function go(url){history.pushState({},'',url);step=url==='/create'?0:step;reaction=null;window.scrollTo({top:0,behavior:'instant'});loadRoute();}
async function request(url,opts={}){const r=await fetch(url,{...opts,headers:{...(opts.body?{'Content-Type':'application/json'}:{}),...(opts.headers||{})}});let d;try{d=await r.json();}catch{throw new Error('تعذر الاتصال بالخادم. جرّب مرة ثانية.');}if(!r.ok){const e=new Error(d.message||'تعذر تنفيذ العملية.');e.status=r.status;e.code=d.code;throw e;}return d;}
function home(){return shell(`<div class="hero-wrap"><div class="container hero"><div class="hero-copy"><span class="eyebrow">🎉 تحدّي الأصدقاء صار أحلى!</span><h1>قدّيش <span class="pop">بتعرفني؟</span><br>يا محقق! 🕵️</h1><p class="hero-description">15 سؤال عنك، رابط خاص فيك، ورفقاتك على المحك! <strong>اكتشف مين حافظ تفاصيلك ومين لازم يراجع مادة الصداقة 😂</strong></p><div class="hero-cta"><a class="btn btn-lg btn-purple" href="/create" data-link>🚀 أنشئ تحديك هلق <span>←</span></a><a href="#how" class="btn btn-lg btn-outline">🎯 كيف بتلعب؟</a></div><div class="hero-proof"><div class="proof-avatars"><span>😎</span><span>🤠</span><span>🥳</span><span>😻</span></div><span>تحديات شخصية وضحك ونتائج غير متوقعة ✨</span></div></div><div class="hero-art"><div class="art-blob"></div>${glyph()}<div class="floating-sticker sticker-top">🏆 15 من 15؟ يا أسطورة!</div><div class="floating-sticker sticker-bottom">💜 مين بيعرفك أكثر؟</div><div class="floating-sticker sticker-star">⭐</div><div class="floating-sticker sticker-heart">💕</div><div class="dot dot-1"></div><div class="dot dot-2"></div><div class="dot dot-3"></div><div class="squiggle">〰</div></div></div></div><section id="how" class="wave-divider"><div class="container"><div class="section-title"><span class="tag">سهولة + مرح + شوية فضايح</span><h2>3 خطوات… وبلّش التحقيق! 🔍</h2><p>دقيقتين منك، وضحك كثير من رفقاتك.</p></div><div class="how-grid"><div class="how-card"><span class="how-num">01</span><div class="how-emoji">🧠</div><h3>اختار 15 سؤال عنك</h3><p>أكتر من 200 سؤال جاهز، أو اكتب أسئلتك الخاصة وحدد الإجابة الصح.</p></div><div class="how-card"><span class="how-num">02</span><div class="how-emoji">🔗</div><h3>انسخ رابطك الخاص</h3><p>رابط مستقل إلك لحالك، ابعته على واتساب أو لأي حدا بتتحداه.</p></div><div class="how-card"><span class="how-num">03</span><div class="how-emoji">🏆</div><h3>راقب مين بيفوز</h3><p>أصحابك بيجاوبوا وبتشوف النتائج والمتصدرين والإحصائيات!</p></div></div></div></section><section class="end-band"><h2>جاهز تكشف الحقيقة؟ 🤪</h2><p>لا تلمنا إذا اكتشفت إن أقرب رفيق إلك ما بيعرف لونك المفضل!</p><a href="/create" class="btn btn-lg btn-yellow" data-link>يلا نبلّش! 🚀</a></section>`,'home-page');}
function wizardHead(title,description){return `<div class="inner-heading"><span class="eyebrow">🎈 استوديو التحديات</span><h1>${title}</h1><p>${description}</p><div class="wizard-dots">${[0,1,2,3].map(i=>`<span class="wizard-dot ${i===step?'active':i<step?'done':''}"></span>`).join('')}</div></div>`;}
const avatarPicker=(current,mode)=>`<div class="avatar-grid">${avatars.map(a=>`<button type="button" class="avatar-option ${current===a?'selected':''}" data-action="avatar-${mode}" data-avatar="${a}" aria-label="اختيار ${a}" aria-pressed="${current===a}">${a}</button>`).join('')}</div>`;
function creator(){let main='';
 if(step===0)main=`<div class="container">${wizardHead('عرّفنا على أسطورة التحدّي! 😎','أول شي خلّينا نجهّز شخصيتك. شو الاسم اللي بدك أصحابك يشوفوه؟')}<div class="stage-shell stage-panel"><h2>أهلا بالزعيم! 👋</h2><p class="hint">ما رح نطلب منك إيميل. بس اختار اسم وصورة رمزية وثيم.</p><label class="field-label" for="creator-name">شو اسمك أو لقبك؟</label><input id="creator-name" class="text-field" maxlength="32" placeholder="مثلاً: موسى" value="${esc(draft.name)}" autocomplete="off"><p class="field-help">رح يظهر اسمك على تحدي رفقاتك.</p><div style="height:18px"></div><label class="field-label">اختار شخصيتك الكرتونية</label>${avatarPicker(draft.avatar,'creator')}<div style="height:20px"></div><label class="field-label">لون عالمك ✨</label><div class="theme-grid">${themes.map(t=>`<button class="theme-swatch ${draft.theme===t.id?'selected':''}" style="background:${t.color}" data-action="theme" data-theme="${t.id}" aria-label="${t.name}" title="${t.name}"></button>`).join('')}</div><div class="stage-actions"><small class="tiny-text">🔒 رح تقدر تحفظ مفتاح الاستعادة بعد النشر.</small><button class="btn btn-purple" data-action="step-next">التالي: اختار أسئلتك ←</button></div></div></div>`;
 else if(step===1)main=createBank();
 else if(step===2)main=answersBuilder();
 else main=reviewBuilder();
 return shell(main,'inner-page',draft.theme);
}
function createBank(){const cs=['الكل',...new Set(bank.map(x=>x.category))];const filtered=bank.filter(q=>(category==='الكل'||q.category===category)&&(!search||q.text.includes(search)||q.category.includes(search)));const picked=new Set(draft.questions.map(x=>x.id));return `<div class="container question-bank">${wizardHead('اختار أسئلتك الـ15! 🎯','من 210 أسئلة متنوّعة. اختار اللي بيعبر عنك، أو أضف سؤال من عندك.')}<div class="bank-toolbar"><input id="bank-search" type="search" class="text-field" placeholder="🔎 دوّر على سؤال..." value="${esc(search)}" aria-label="بحث بالأسئلة"><span class="selected-counter">اخترت <b>${draft.questions.length}</b> / 15</span><button class="btn btn-sm btn-mint" data-action="custom-toggle">✏️ سؤال خاص</button></div>${customOpen?customForm():''}<div class="category-row">${cs.map(c=>`<button data-action="category" data-cat="${esc(c)}" class="category-chip ${category===c?'selected':''}">${c==='الكل'?'🌍 ':bank.find(q=>q.category===c)?.emoji||''} ${esc(c)}</button>`).join('')}</div>${draft.questions.length?`<div class="selected-strip"><strong>📌 أسئلتك المختارة (${draft.questions.length}) — اضغط × لإزالة سؤال</strong><div class="selected-list">${draft.questions.map((q,i)=>`<span class="selected-pill">${i+1}. ${esc(q.text.slice(0,35))}<button data-action="move-up" data-id="${esc(q.id)}" title="تقديم السؤال" ${i===0?'disabled':''}>↑</button><button data-action="move-down" data-id="${esc(q.id)}" title="تأخير السؤال" ${i===draft.questions.length-1?'disabled':''}>↓</button><button data-action="remove" data-id="${esc(q.id)}" title="إزالة السؤال">×</button></span>`).join('')}</div></div>`:''}<div class="bank-grid">${filtered.map(q=>`<button type="button" class="bank-card ${picked.has(q.id)?'picked':''}" data-action="pick" data-id="${q.id}"><small>${q.emoji} ${esc(q.category)}</small><h3>${esc(q.text)}</h3><div class="bank-card-bottom"><small>${q.options.length} خيارات جاهزة</small><span class="pick-icon">${picked.has(q.id)?'✓':'+'}</span></div></button>`).join('')||'<div class="empty-state">🔍 ما لقينا سؤال مطابق… جرّب كلمة ثانية!</div>'}</div><div class="bank-bottom"><button class="btn" data-action="step-back">→ رجوع</button><div class="right-actions"><button class="btn btn-sm btn-outline" data-action="random-picks">🎲 اقترح أسئلة عشوائية</button> <button class="btn btn-purple" data-action="step-next" ${draft.questions.length!==15?'disabled':''}>التالي: حدّد إجاباتك ← (${draft.questions.length}/15)</button></div></div></div>`;}
function customForm(){return `<div class="custom-box"><h3>✍️ سؤال من تأليفك!</h3><label for="custom-text">اكتب السؤال (مثلاً: وين التقينا أول مرة؟)</label><input class="text-field" id="custom-text" maxlength="145" placeholder="سؤالك المضحك أو الشخصي..." value="${esc(custom.text)}"><div style="height:12px"></div><label>خيارات الإجابة — اكتب من خيارين إلى 6</label><div class="custom-grid">${custom.options.map((v,i)=>`<input class="text-field" data-custom-option="${i}" maxlength="70" placeholder="الخيار ${i+1}" value="${esc(v)}">`).join('')}</div><div class="stage-actions"><button class="btn btn-sm" data-action="custom-more" ${custom.options.length>=6?'disabled':''}>+ أضف خيار</button><div class="right-actions"><button class="btn btn-sm btn-ghost" data-action="custom-toggle">إلغاء</button><button class="btn btn-sm btn-purple" data-action="custom-save">✓ أضف السؤال</button></div></div><small class="tiny-text">الأسئلة الخاصة تظهر في تحديك فقط. حدد إجابتها الصحيحة بالمرحلة الجاي.</small></div>`;}
function answersBuilder(){if(draft.questions.length!==15){step=1;return createBank();}const q=draft.questions[answerIndex];return `<div class="container">${wizardHead('أنت المدير… مين بيعرف الصح؟ 🧠','حدّد الجواب الصحيح عنك لكل سؤال. أصحابك رح يحاولوا يتوقعوه.')}<div class="stage-shell stage-panel"><div class="answer-header"><span>🎯 السؤال ${answerIndex+1} من 15</span><span>${draft.questions.filter(x=>Number.isInteger(x.correctIndex)).length} إجابات جاهزة ✅</span></div><div class="progress-track"><div class="progress-fill" style="width:${((answerIndex+1)/15)*100}%"></div></div><div class="question-emblem">${q.emoji||'✨'}</div><p class="question-intro">اضغط على إجابتك أنت، مو إجابة رفقاتك!</p><h2 class="question-title">${esc(q.text)}</h2><div class="option-grid">${q.options.map((v,i)=>`<button class="option ${q.correctIndex===i?'chosen':''}" data-action="correct" data-index="${i}"><span class="letter">${String.fromCharCode(65+i)}</span>${esc(v)}${q.correctIndex===i?' <span style="margin-right:auto">✅</span>':''}</button>`).join('')}</div><div class="answer-actions"><button class="btn btn-sm" data-action="answer-back">→ السابق</button><button class="btn btn-purple" data-action="answer-next" ${!Number.isInteger(q.correctIndex)?'disabled':''}>${answerIndex===14?'مراجعة التحدي 🎉':'السؤال التالي ←'}</button></div></div></div>`;}
function reviewBuilder(){const complete=draft.questions.length===15&&draft.questions.every(q=>Number.isInteger(q.correctIndex));return `<div class="container">${wizardHead('خلصنا! جاهز تفضح رفقاتك؟ 🤩','راجع أسئلتك قبل ما ننشر الرابط النهائي.')}<div class="stage-shell stage-panel"><div class="review-item" style="background:#fff6d2;margin-bottom:10px"><span style="font-size:40px">${esc(draft.avatar)}</span><div class="review-content"><strong>اختبار ${esc(draft.name)}</strong><span>15 سؤالًا جاهزًا — لون عالمك: ${esc(themes.find(t=>t.id===draft.theme)?.name||'شمسي')}</span></div><span class="review-check">✅</span></div><h2>📋 أسئلتك وإجاباتها</h2><div class="review-list">${draft.questions.map((q,i)=>`<div class="review-item"><span class="review-number">${i+1}</span><div class="review-content"><strong>${esc(q.text)}</strong><span>جوابك: ${Number.isInteger(q.correctIndex)?'✅ '+esc(q.options[q.correctIndex]):'⚠️ غير محدد'}</span></div><span class="review-check">${Number.isInteger(q.correctIndex)?'✓':'!'}</span></div>`).join('')}</div><div class="notice">🔒 عند النشر، رح يثبت ترتيب الأسئلة والإجابات للمنافسة العادلة. إذا بدك تغيرها لاحقًا أنشئ تحديًا جديدًا.</div><div class="stage-actions"><button class="btn" data-action="step-back">→ تعديل الإجابات</button><button class="btn btn-lg btn-purple" data-action="publish" ${!complete?'disabled':''}>🚀 انشر تحديّ الخاص!</button></div></div></div>`;}
const getOwner = id => new URLSearchParams(location.hash.slice(1)).get('key') || localStorage.getItem('qm_owner_'+id) || '';
function ready(id){const key=getOwner(id),link=shareUrl(id);return shell(`<div class="container"><div class="stage-shell stage-panel ready-panel" style="margin-top:45px"><div class="ready-orbit">🎉</div><h1>مبروووك! التحدّي صار جاهز!</h1><p>جهّز الرفقات… التحقيق بدأ رسميًا! 🕵️</p><div class="link-display">${esc(link)}</div><div class="ready-buttons"><button class="btn btn-purple" data-action="copy" data-copy="share">🔗 انسخ الرابط</button><button class="btn btn-yellow" data-action="share">📲 شاركه مع أصحابك</button><a class="btn" href="/q/${encodeURIComponent(id)}" data-link>👀 شوف التحدي</a><a class="btn btn-mint" href="/dashboard/${encodeURIComponent(id)}" data-link>📊 إحصائياتي</a></div><div class="owner-warning"><strong>🔐 مهم: لا تضيّع مفتاح الإدارة!</strong>رابط التحدّي العام آمن للمشاركة، لكن لوحة إحصائياتك تحتاج رابط إدارة خاص لا ترسله لأصحابك.${key?`<div style="margin-top:12px"><button class="btn btn-sm btn-outline" data-action="copy" data-copy="owner">🔑 انسخ رابط إدارتي السري</button></div>`:'<p>مفتاح الإدارة غير موجود على هذا الجهاز.</p>'}</div></div></div>`);}
function quizIntro(){return shell(`<div class="container"><section class="quiz-stage stage-panel quiz-intro" style="margin-top:32px"><div class="avatar-big">${esc(quiz.avatar)}</div><span class="eyebrow">🎭 تحدي ${esc(quiz.name)}</span><h1>بتفكّر حالك بتعرف <span style="color:#7751de">${esc(quiz.name)}</span>؟</h1><p>قدّامك 15 سؤال… يا بتثبت إنك أسطورة بالصداقات يا بتنكشف على حقيقتك 😂</p><div class="name-form"><label class="field-label" for="player-name">شو اسمك يا محقق؟</label><input class="text-field" id="player-name" maxlength="32" placeholder="اكتب اسمك أو لقبك" value="${esc(player.name)}" autocomplete="off"><label class="field-label" style="margin-top:17px">اختار وجهك قبل المواجهة</label>${avatarPicker(player.avatar,'player')}<button class="btn btn-lg btn-purple btn-block" style="margin-top:25px" data-action="play">🤠 يلا نشوف كم بعرفك!</button><p class="tiny-text" style="text-align:center;font-size:12px;margin-top:12px">محاولة رسمية واحدة لكل متصفح. رح يظهر اسمك ونتيجتك بلوحة المتصدرين.</p></div></section></div>`,'inner-page',quiz.theme);}
function quizPlay(){const pos=attempt.currentIndex;const q=quiz.questions[pos];if(!q)return quizResult();return shell(`<div class="container"><div class="inner-heading"><span class="eyebrow">🕵️ تحدي ${esc(quiz.name)}</span><h1>يلا ورّينا شطارتك! 🤔</h1><p>فكّر منيح… كل نقطة بتقربك من لقب الأسطورة!</p></div><div class="quiz-stage stage-panel quiz-question-wrap"><div class="answer-header"><span>السؤال ${pos+1} من 15</span><span>${esc(attempt.score)} نقطة ⭐</span></div><div class="progress-track"><div class="progress-fill" style="width:${(pos/15)*100}%"></div></div><div class="question-emblem">${['🎯','🔮','🎨','😼','🚀','💖','🎵','🧠','🍕','🎮','🌈','😎','🏆','✨','👑'][pos]}</div><p class="challenge-pretitle">السؤال ${pos+1} عن ${esc(quiz.name)}</p><h2 class="question-title">${esc(questionForFriend(q.text,quiz.name))}</h2><div class="option-grid">${q.options.map((v,i)=>`<button class="option ${reaction&&reaction.choice===i?(reaction.correct?'correct':'wrong'):''}" data-action="answer" data-index="${i}" ${busy?'disabled':''}><span class="letter">${String.fromCharCode(65+i)}</span>${esc(v)}</button>`).join('')}</div>${reaction?`<div class="quiz-reaction ${reaction.correct?'win':'lose'}">${esc(reaction.line)}</div>`:''}<p class="tiny-text" style="text-align:center;margin-top:19px">${busy?'عم نحفظ جوابك وننتقل للسؤال التالي…':'اختار جواب واحد، وما في رجعة! 😅'}</p></div></div>`,'inner-page quiz-scene scene-'+(pos%5),quiz.theme);}
function quizResult(){const rankIndex=ranks.findIndex(r=>attempt.score>=r.min);const result=ranks[rankIndex];const percent=Math.round(attempt.score/15*100);const quip=finaleQuips[rankIndex][[...(attempt.id||'1234')].reduce((n,c)=>n+c.charCodeAt(0),0)%4];return shell(`<div class="container"><div class="stage-shell stage-panel" style="text-align:center;margin-top:36px;position:relative"><div class="result-emblem">${result.icon}</div><span class="eyebrow">🎉 انتهى التحقيق!</span><div class="result-score">${attempt.score}<small>/15</small></div><h1 class="result-title">${result.title}</h1><p class="result-subtitle">${result.desc}<span style="display:block;color:#5d4999;font-weight:800">${esc(quip)}</span></p><span class="result-ribbon">${percent}% من الإجابات صحيحة ✨</span><div class="result-meter progress-track"><div class="progress-fill" style="width:${percent}%"></div></div><p class="hint">${esc(player.name||attempt.name)}، كيف حسّيت بنتيجتك عند ${esc(quiz.name)}؟ 😂</p><div class="ready-buttons"><a href="/leaderboard/${encodeURIComponent(quiz.id)}" data-link class="btn btn-purple">🏆 شوف المتصدرين</a><button class="btn btn-yellow" data-action="share-result">📲 شارك نتيجتك</button><button class="btn btn-mint" data-action="save-result">🖼️ بطاقة النتيجة</button><a href="/create" data-link class="btn">✨ أنشئ تحديك أنت</a></div></div></div>`,'inner-page',quiz.theme);}
function leaderboardPage(id){const rows=leaders?.leaders||[];const top=rows.slice(0,3);return shell(`<div class="container"><div class="inner-heading"><span class="eyebrow">🏆 قاعة مشاهير الصداقة</span><h1>مين بيعرف ${esc(quiz?.name||'صاحب التحدّي')} أكثر؟</h1><p>النتائج الحقيقية… وحجة «ما كنت مركز» غير مقبولة 😂</p></div><div class="leaders-panel stage-panel">${rows.length?`<div class="podium">${[1,0,2].map(idx=>{const p=top[idx];return `<div class="podium-item"><div class="podium-avatar">${p?esc(p.avatar):'❔'}</div><div class="podium-name">${p?esc(p.name):'بانتظار بطل'}</div><div class="podium-step ${idx===0?'first':idx===1?'second':'third'}">${['🥇','🥈','🥉'][idx]}<small>${p?p.score+'/15':'—'}</small></div></div>`;}).join('')}</div><h2 style="margin-top:0">🎖️ قائمة الشرف</h2><div class="leader-list">${rows.map((r,i)=>`<div class="leader-row"><span class="leader-rank">#${i+1}</span><span class="leader-avatar">${esc(r.avatar)}</span><span class="leader-name">${esc(r.name)}</span><span class="leader-score">${r.score}/15 ⭐</span></div>`).join('')}</div>`:`<div style="text-align:center;padding:50px 0"><div style="font-size:75px">🏜️</div><h2>لسا ما حدا دخل التحدي!</h2><p class="hint">مين رح يكون أول بطل؟</p></div>`}<div class="ready-buttons" style="margin-top:24px"><a href="/q/${encodeURIComponent(id)}" class="btn btn-purple" data-link>🎯 جرّب التحدّي</a><a href="/" class="btn" data-link>🏠 الرئيسية</a></div></div></div>`);}
function dashboardPage(id){if(!stats){return shell(`<div class="container"><div class="stage-shell stage-panel" style="margin-top:60px;text-align:center"><div style="font-size:65px">🔐</div><h1>لوحة قائد التحدّي</h1><p class="hint">أدخل مفتاح الإدارة السري حتى تشوف إحصائياتك. المفتاح وصلك بعد إنشاء التحدّي.</p><input class="text-field" id="owner-key" placeholder="مفتاح الإدارة" value="${esc(ownerInput)}" style="max-width:430px;direction:ltr" autocomplete="off"><p style="color:#d55f6f">${esc(statsError)}</p><button class="btn btn-purple" data-action="owner-login">افتح الإحصائيات 🔓</button></div></div>`);}const d=stats.stats,all=d.participants||[],finished=all.filter(a=>a.completed_at),bars=d.byQuestion||[];return shell(`<div class="container"><div class="inner-heading"><span class="eyebrow">📊 غرفة قيادة الرفقات</span><h1>إحصائيات تحدّيك ✨</h1><p>هون رح تشوف مين عرفك عنجد… ومين فضح حاله!</p></div><div class="stage-shell" style="max-width:1000px"><div class="dashboard-actions"><a href="/ready/${encodeURIComponent(id)}" data-link class="btn btn-sm">🔗 رابط المشاركة</a><a href="/leaderboard/${encodeURIComponent(id)}" data-link class="btn btn-sm">🏆 المتصدرون</a><button class="btn btn-sm btn-mint" data-action="refresh-stats">🔄 تحديث</button><button class="btn btn-sm btn-outline" data-action="copy" data-copy="owner">🔐 نسخ رابط الإدارة</button></div><div class="stats-grid">${[['👀',d.views,'مرات فتح التحدي'],['🎮',d.started,'بدأوا اللعب'],['🏁',d.finished,'أكملوا'],['🥇',d.best+'/15','أفضل نتيجة'],['📈',d.average+'/15','متوسط النتائج'],['👑',d.perfect,'علامة كاملة']].map(([icon,value,label])=>`<div class="stat-tile"><div class="stat-icon">${icon}</div><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`).join('')}</div><section class="dash-section"><h3>🎯 أصعب وأسهل الأسئلة</h3><p class="hint">النسبة المئوية للمشاركين الذين أجابوا صح على كل سؤال.</p><div class="chart-list">${bars.map(q=>`<div class="chart-item"><span title="${esc(q.text)}">${q.position+1}. ${esc(q.text.slice(0,30))}${q.text.length>30?'…':''}</span><div class="chart-track"><div class="chart-fill" style="width:${q.total?Math.round(q.correct/q.total*100):0}%"></div></div><strong>${q.total?Math.round(q.correct/q.total*100):0}%</strong></div>`).join('')}</div></section><section class="dash-section"><h3>👥 آخر المشاركين</h3>${all.length?all.slice(0,25).map(p=>`<div class="dash-row"><span>${esc(p.avatar)} ${esc(p.name)} ${!p.completed_at?'(لسا عم يجاوب)':''}</span><span>${p.completed_at?p.score+'/15':'—'}</span></div>`).join(''):'<p class="hint">لسا ما شارك حدا. ابعت الرابط وبلّش التحدي!</p>'}</section><section class="dash-section"><h3>📉 توزيع العلامات</h3><div class="chart-list">${Array.from({length:16},(_,n)=>{const count=d.distribution.find(x=>x.score===n)?.count||0;return `<div class="chart-item"><span>${n}/15</span><div class="chart-track"><div class="chart-fill" style="width:${d.finished?count/d.finished*100:0}%"></div></div><strong>${count}</strong></div>`;}).join('')}</div></section><section class="danger-zone"><h3 style="margin:0 0 7px">⚙️ التحكم بالتحدّي</h3><p class="hint">حالة الرابط: <strong>${d.active?'شغّال ✅':'متوقف مؤقتًا ⏸️'}</strong></p><div class="ready-buttons" style="justify-content:flex-start"><button class="btn btn-sm" data-action="toggle-active">${d.active?'⏸️ إيقاف الرابط مؤقتًا':'▶️ إعادة تشغيل الرابط'}</button><button class="btn btn-sm btn-pink" data-action="delete-challenge">🗑️ حذف التحدّي نهائيًا</button></div></section></div></div>`);}
async function loadRoute(){const p=path();contentError='';if(p.length===0){app.innerHTML=home();return;}if(p[0]==='create'){app.innerHTML=creator();return;}if(p[0]==='ready'&&p[1]){app.innerHTML=ready(p[1]);return;}if(['q','leaderboard','dashboard'].includes(p[0])&&p[1]){
 loading(); try {
  if(p[0]==='dashboard'){const key=getOwner(p[1]);if(key){try {stats=await request('/api/challenges/'+encodeURIComponent(p[1])+'/stats',{headers:{Authorization:'Bearer '+key}});localStorage.setItem('qm_owner_'+p[1],key);}catch(e){stats=null;statsError=e.message;}}else {stats=null;statsError='';}app.innerHTML=dashboardPage(p[1]);return;}
  quiz=await request('/api/challenges/'+encodeURIComponent(p[1]));
  if(p[0]==='leaderboard'){leaders=await request('/api/challenges/'+encodeURIComponent(p[1])+'/leaderboard');app.innerHTML=leaderboardPage(p[1]);return;}
  const saved=localStorage.getItem('qm_attempt_'+p[1]);attempt=null;reaction=null;
  if(saved){try{const d=JSON.parse(saved);const rec=await request('/api/attempts/'+encodeURIComponent(d.id),{headers:{Authorization:'Bearer '+d.accessToken}});attempt={...rec,accessToken:d.accessToken};player.name=attempt.name;player.avatar=attempt.avatar;}catch{localStorage.removeItem('qm_attempt_'+p[1]);}}
  app.innerHTML=attempt?(attempt.finished?quizResult():quizPlay()):quizIntro();return;
 }catch(e){fail(e.message);return;}}
 fail('الصفحة المطلوبة مو موجودة.');}
function refresh(){app.innerHTML=creator();}
function saveAnswersStep(){save();refresh();window.scrollTo({top:0,behavior:'smooth'});}
function beep(success=true){if(!soundOn)return;try{const ctx=new (window.AudioContext||window.webkitAudioContext)();const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.value=success?720:230;gain.gain.value=.035;osc.connect(gain).connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.14);osc.onended=()=>ctx.close();}catch{}}
async function copyText(str){try{await navigator.clipboard.writeText(str);alertToast('تم النسخ! ابعته وافتحوا التحقيق 📋');}catch{window.prompt('انسخ الرابط من هنا:',str);}}
function selectedBy(id){return draft.questions.findIndex(q=>q.id===id);}
function handleClickSync(action,btn){if(action==='sound'){soundOn=!soundOn;localStorage.setItem('qm_sound',String(soundOn));alertToast(soundOn?'الصوت شغّال 🎵':'تم كتم الأصوات 🔇');loadRoute();return true;}
 if(action==='reload'){loadRoute();return true;}
 if(action==='avatar-creator'){draft.avatar=btn.dataset.avatar;save();refresh();return true;}
 if(action==='avatar-player'){player.avatar=btn.dataset.avatar;app.innerHTML=quizIntro();return true;}
 if(action==='theme'){draft.theme=btn.dataset.theme;save();refresh();return true;}
 if(action==='step-next'){
  if(step===0&&draft.name.trim().length<2){alertToast('اكتب اسمك أول شي يا أسطورة 😎');return true;}
  if(step===1&&draft.questions.length!==15){alertToast('اختار 15 سؤال بالضبط 🎯');return true;}
  step=Math.min(step+1,3);answerIndex=0;saveAnswersStep();return true;
 }
 if(action==='step-back'){step=Math.max(0,step-1);if(step===2)answerIndex=14;saveAnswersStep();return true;}
 if(action==='category'){category=btn.dataset.cat;refresh();return true;}
 if(action==='pick'){
  const id=btn.dataset.id;const ix=selectedBy(id);
  if(ix>=0)draft.questions.splice(ix,1);
  else if(draft.questions.length>=15){alertToast('وصلت 15 سؤال! احذف سؤال لتبدّله 🧩');return true;}
  else{const q=bank.find(x=>x.id===id);if(q)draft.questions.push({...q,correctIndex:null});}
  save();refresh();return true;
 }
 if(action==='move-up'||action==='move-down'){const i=selectedBy(btn.dataset.id),j=i+(action==='move-up'?-1:1);if(i>=0&&j>=0&&j<draft.questions.length){[draft.questions[i],draft.questions[j]]=[draft.questions[j],draft.questions[i]];save();refresh();}return true;}
 if(action==='remove'){draft.questions=draft.questions.filter(x=>x.id!==btn.dataset.id);save();refresh();return true;}
 if(action==='custom-toggle'){customOpen=!customOpen;refresh();return true;}
 if(action==='custom-more'){if(custom.options.length<6){custom.options.push('');refresh();}return true;}
 if(action==='custom-save'){
  if(draft.questions.length>=15)return alertToast('القائمة مكتملة. احذف سؤالًا أولًا.'),true;
  const options=custom.options.map(s=>s.trim()).filter(Boolean);const name=custom.text.trim();
  if(name.length<6)return alertToast('خلّي السؤال أطول شوي (6 أحرف على الأقل).'),true;
  if(options.length<2||options.length>6||new Set(options).size!==options.length)return alertToast('اكتب من خيارين لـ6 خيارات مختلفة.'),true;
  if(draft.questions.some(q=>q.text===name))return alertToast('هذا السؤال موجود عندك من قبل.'),true;
  draft.questions.push({id:'custom-'+crypto.randomUUID(),category:'سؤال خاص',emoji:'✍️',text:name,options,correctIndex:null});custom={text:'',options:['','','','']};customOpen=false;save();refresh();alertToast('انضاف سؤالك الخاص! ✨');return true;
 }
 if(action==='random-picks'){
  if(draft.questions.length===15)return alertToast('كل الأسئلة جاهزة! 🎉'),true;
  const available=bank.filter(q=>selectedBy(q.id)<0).sort(()=>Math.random()-.5);
  for(const q of available.slice(0,Math.min(5,15-draft.questions.length)))draft.questions.push({...q,correctIndex:null});
  save();refresh();alertToast('أضفنا شوية أسئلة عشوائية 🎲');return true;
 }
 if(action==='correct'){draft.questions[answerIndex].correctIndex=Number(btn.dataset.index);save();refresh();return true;}
 if(action==='answer-back'){if(answerIndex>0)answerIndex--;else step=1;saveAnswersStep();return true;}
 if(action==='answer-next'){if(!Number.isInteger(draft.questions[answerIndex].correctIndex))return alertToast('اختار إجابتك الصحيحة أولًا!'),true;if(answerIndex===14)step=3;else answerIndex++;saveAnswersStep();return true;}
 return false;}
async function doAction(action,btn){const p=path(),id=p[1];if(handleClickSync(action,btn))return;
 if(action==='publish'){
  if(busy)return;busy=true;btn.disabled=true;btn.textContent='⏳ عم ننشر تحدّيك...';
  try{const d=await request('/api/challenges',{method:'POST',body:JSON.stringify(draft)});localStorage.setItem('qm_owner_'+d.id,d.ownerToken);draft=freshDraft();save();busy=false;go('/ready/'+d.id);}catch(e){busy=false;btn.disabled=false;btn.textContent='🚀 انشر تحديّ الخاص!';alertToast(e.message);}return;
 }
 if(action==='copy'){const val=btn.dataset.copy==='owner'?ownerLink(id,getOwner(id)):shareUrl(id);return copyText(val);}
 if(action==='share'||action==='share-result'){
  const msg=action==='share-result'?`طلعت نتيجتي ${attempt?.score}/15 في تحدّي ${quiz?.name}! بتقدر تجيب أعلى مني؟ 😂`:`قديش بتعرفني؟ 😏 15 سؤال عم يستنوك… ورّيني شطارتك 😂`;
  const url=shareUrl(action==='share-result'?quiz.id:id);
  if(navigator.share){try{await navigator.share({title:'قدّيش بتعرفني؟',text:msg,url});}catch{}}else await copyText(msg+' '+url);return;
 }
 if(action==='save-result'){
  if(!attempt||!quiz)return;
  const r=ranks.find(v=>attempt.score>=v.min);
  const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=1200;
  const c=canvas.getContext('2d');const grad=c.createLinearGradient(0,0,1000,1200);
  grad.addColorStop(0,'#efe7ff');grad.addColorStop(1,'#fff1c5');c.fillStyle=grad;c.fillRect(0,0,1000,1200);
  c.fillStyle='#ffffff';c.strokeStyle='#29213e';c.lineWidth=10;c.beginPath();c.roundRect(65,65,870,1060,45);c.fill();c.stroke();
  c.textAlign='center';c.direction='rtl';c.fillStyle='#312847';
  c.font='bold 51px Changa, sans-serif';c.fillText('قدّيش بتعرفني؟ 🎉',500,230);
  c.font='150px sans-serif';c.fillText(r.icon,500,425);
  c.fillStyle='#7851df';c.font='900 150px Nunito, sans-serif';c.fillText(attempt.score+'/15',500,630);
  c.fillStyle='#312847';c.font='bold 54px Changa, sans-serif';c.fillText(r.title,500,745);
  c.font='bold 31px Changa, sans-serif';c.fillText('المشارك: '+attempt.name,500,850);
  c.fillText('تحدّي: '+quiz.name,500,920);
  c.fillStyle='#705c92';c.font='26px Changa, sans-serif';c.fillText('فيك تجيب أعلى مني؟ 😏',500,1020);
  const link=document.createElement('a');link.download='qaddeish-result-'+attempt.score+'-15.png';link.href=canvas.toDataURL('image/png');link.click();alertToast('جهّزنا بطاقة نتيجتك 🖼️');return;
 }
 if(action==='play'){
  if(busy)return;const name=player.name.trim();if(name.length<2)return alertToast('شو اسمك يا محقق؟ اكتب حرفين على الأقل.');
  busy=true;btn.disabled=true;
  try{const d=await request('/api/challenges/'+id+'/attempts',{method:'POST',body:JSON.stringify({name,avatar:player.avatar})});localStorage.setItem('qm_attempt_'+id,JSON.stringify({id:d.id,accessToken:d.accessToken}));attempt={...d,name,avatar:player.avatar,finished:false};app.innerHTML=quizPlay();window.scrollTo({top:0,behavior:'smooth'});}catch(e){alertToast(e.code==='ALREADY_PLAYED'?'عندك محاولة سابقة بهالمتصفح. جرّب ترجع لنفس الجهاز اللي بلشت فيه.':e.message);btn.disabled=false;}busy=false;return;
 }
 if(action==='answer'){
  if(busy||reaction||!attempt)return;const position=attempt.currentIndex,choice=Number(btn.dataset.index);
  busy=true;
  try{const d=await request('/api/attempts/'+attempt.id+'/answer',{method:'POST',headers:{Authorization:'Bearer '+attempt.accessToken},body:JSON.stringify({position,choice})});
   const lines=d.correct?goodLines:badLines;reaction={correct:d.correct,choice,line:lines[Math.floor(Math.random()*lines.length)]};beep(d.correct);app.innerHTML=quizPlay();
   setTimeout(()=>{attempt.currentIndex=d.nextIndex;attempt.score+=d.correct?1:0;attempt.finished=d.finished;if(d.finished)attempt.score=d.score;reaction=null;busy=false;app.innerHTML=d.finished?quizResult():quizPlay();window.scrollTo({top:0,behavior:'smooth'});},1100);
  }catch(e){busy=false;alertToast(e.message);await loadRoute();}return;
 }
 if(action==='owner-login'){const key=ownerInput.trim();if(!key)return alertToast('أدخل مفتاح الإدارة أولًا.');localStorage.setItem('qm_owner_'+id,key);await loadRoute();return;}
 if(action==='refresh-stats'){await loadRoute();alertToast('تحدّثت الإحصائيات 🔄');return;}
 if(action==='toggle-active'){
  if(!stats)return;try{const next=!stats.stats.active;await request('/api/challenges/'+id,{method:'PATCH',headers:{Authorization:'Bearer '+getOwner(id)},body:JSON.stringify({active:next})});stats.stats.active=next;app.innerHTML=dashboardPage(id);alertToast(next?'رجع الرابط يشتغل! ✅':'توقف استقبال مشاركات جديدة مؤقتًا.');}catch(e){alertToast(e.message);}return;
 }
 if(action==='delete-challenge'){
  if(!confirm('متأكد من حذف التحدّي وجميع النتائج نهائيًا؟ لا يمكن التراجع.'))return;
  try{await request('/api/challenges/'+id,{method:'DELETE',headers:{Authorization:'Bearer '+getOwner(id)}});localStorage.removeItem('qm_owner_'+id);alertToast('انحذف التحدّي ونتائجه.');go('/');}catch(e){alertToast(e.message);}return;
 }
}
document.addEventListener('click',async e=>{
 const link=e.target.closest('a[data-link]');if(link){e.preventDefault();go(link.getAttribute('href'));return;}
 const homehow=e.target.closest('[data-home-how]');if(homehow){e.preventDefault();go('/');setTimeout(()=>$('#how')?.scrollIntoView({behavior:'smooth'}),100);return;}
 const btn=e.target.closest('[data-action]');if(btn){e.preventDefault();try{await doAction(btn.dataset.action,btn);}catch(ex){alertToast(ex.message||'صار خطأ، جرّب مرة ثانية.');}}
});
document.addEventListener('input',e=>{
 const t=e.target;
 if(t.id==='creator-name'){draft.name=t.value;save();}
 else if(t.id==='player-name')player.name=t.value;
 else if(t.id==='owner-key')ownerInput=t.value;
 else if(t.id==='bank-search'){
  search=t.value;const pos=t.selectionStart;refresh();const target=$('#bank-search');target?.focus();try{target?.setSelectionRange(pos,pos);}catch{}
 }
 else if(t.id==='custom-text')custom.text=t.value;
 else if(t.hasAttribute('data-custom-option'))custom.options[Number(t.dataset.customOption)]=t.value;
});
window.addEventListener('popstate',()=>loadRoute());
window.addEventListener('hashchange',()=>{if(path().length===0&&location.hash==='#how')$('#how')?.scrollIntoView({behavior:'smooth'});});
(async function init(){try{bank=await fetch('/questions.json').then(r=>{if(!r.ok)throw Error();return r.json();});await loadRoute();if(location.hash==='#how')setTimeout(()=>$('#how')?.scrollIntoView(),100);}catch(e){fail('تعذر تحميل بنك الأسئلة. تحقق من الاتصال بالخادم.');}})();
