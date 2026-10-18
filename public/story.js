/** V7 illustrated endings: one immutable set of five beats per result band.
 * Words/score/both avatars are live DOM content, never text baked into an image.
 */
export const PEOPLE = Object.freeze([
  {id:'bear',name:'الدب',mini:'الدب المغامر'},
  {id:'panda',name:'الباندا',mini:'الباندا اللطيف'},
  {id:'witch',name:'الساحرة',mini:'الساحرة المرحة'},
  {id:'cat',name:'القطة السارقة',mini:'القطة السارقة'},
  {id:'lunar',name:'فارس القمر',mini:'فارس القمر'}
]);
export const WORLDS = Object.freeze([
  {id:'forest',name:'الغابة',desc:'شلالات وعصافير وضوء الشمس',accent:'#80cb46',sound:'همسات الغابة'},
  {id:'ocean',name:'المحيط',desc:'أمواج ونوارس وشاطئ مسحور',accent:'#4ac8f0',sound:'أنفاس البحر'},
  {id:'vampire',name:'قلعة مصاصي الدماء',desc:'قمر وخفافيش وأضواء غامضة',accent:'#c38dfb',sound:'نسيم القلعة'},
  {id:'classic',name:'الزمن الجميل',desc:'قرية قديمة وفوانيس وورود',accent:'#f1bc68',sound:'أجراس القرية'}
]);
export const resultBand = score => score===10?0:score>=8?1:score>=6?2:score>=4?3:score>=2?4:5;
export const OUTCOMES = [
  {title:'أسطورة الصداقة',color:'#ffe58f',mood:'legend',a:'مستحيل! عرفت كل الأسرار؟!',b:'يبدو إنك بتعرفني أكتر مني!',closing:'هاي صداقة من العيار الأسطوري!'},
  {title:'الصديق الذهبي',color:'#fff0ae',mood:'gold',a:'يا سلام! تقريبًا ما فاتك شي!',b:'لسه في كم سر صغير بيناتنا!',closing:'صديق ذهبي وقريب من اللقب الأكبر!'},
  {title:'صديق على الطريق',color:'#b9ecb1',mood:'steady',a:'مو بطّال أبدًا!',b:'بس في كم حلقة من حياتي فاتتك!',closing:'الصداقة مكملة ولسه في مغامرات.'},
  {title:'الصداقة تحت المراجعة',color:'#f8d291',mood:'review',a:'لحظة… نص المعلومات ضايع؟',b:'يعني لازم نحكي مع بعض أكتر!',closing:'دورة أسرار صغيرة وبتصير الأمور تمام.'},
  {title:'مطلوب للتحقيق',color:'#ffb286',mood:'detective',a:'مين أنت؟ وليش بتعرف شوي بس؟',b:'اعطيني فرصة ثانية، بوعدك أركز!',closing:'فريق التحقيق فتح الملف… بالضحك طبعًا!'},
  {title:'إنذار أحمر',color:'#ff9895',mood:'alarm',a:'ولا جواب تقريبًا؟! شو صار؟',b:'واضح لازم نبلّش نتعرف من جديد!',closing:'إنذار كوميدي: الصداقة بحاجة تحديث!'}
];
// Round 08: six independently authored five-panel finales. Text is kept separate
// from world plates and untouched source portraits; no character is generated.
export const FINALE_SCRIPTS = Object.freeze([
  [ // 10 / 10 — legend
    ['لحظة اللقاء','owner','wide','glimmer','يا {friend}… لا تقلي إنك كشفت أسراري كلها!','الدهشة الأولى'],
    ['نظرة اندهاش','friend','closer','spark','حتى التفاصيل اللي كنت مفكر إنك ناسيها… بتذكرها!','ذكرى مشتركة'],
    ['ترقّب ساحر','owner','dramatic','aurora','خليني أشوف النتيجة بعيني… يا لطيف!','صمت قبل المفاجأة'],
    ['النتيجة الأسطورية','owner','reveal','burst','{score} من 10! أنت مو بس صديق… أنت موسوعة أسراري!','انفجار ذهبي من الفرح'],
    ['عهد الصداقة','friend','finale','celebrate','يا {owner}، أجمل شي إن ذكرياتنا صارت حكاية ما بتننسى.','ختام أسطوري دافئ']
  ],
  [ // 8-9 / 10 — gold
    ['اللقاء السعيد','owner','wide','glimmer','يا {friend}، شكلك جاي واثق كتير من حالك!','ابتسامة أولى'],
    ['اعتراف لطيف','friend','closer','spark','بعترف… في سؤالين خلّوني أفكّر مرتين!','ضحكة بين الأصدقاء'],
    ['اللحظة الحاسمة','owner','dramatic','lantern','طيب افتح لوحة النتيجة… خلينا نشوف.','ترقّب ووميض'],
    ['النجمة الذهبية','owner','reveal','burst','{score} من 10! قريب جدًا من الكمال يا صديقي الذهبي!','إشراقة ذهبية'],
    ['موعد جديد','friend','finale','celebrate','المرة الجاية رح أعرف آخر سرّ… ووعد إن نضحك أكتر!','صداقة تزداد قربًا']
  ],
  [ // 6-7 / 10 — steady
    ['لقاء دافئ','owner','wide','warm','أهلين يا {friend}، تعال نحكي عن اللي بتعرفه عني.','بداية ودّية'],
    ['حيرة خفيفة','friend','closer','lantern','بعض الأجوبة عرفتهم فورًا… والباقي لخبطوني!','تفكير ومصارحة'],
    ['صوت الذكريات','owner','dramatic','warm','مو مشكلة، كل جواب فتح باب لذكرى جديدة.','تذكّر جميل'],
    ['كشف الطريق','owner','reveal','glimmer','{score} من 10… بداية حلوة ولسه قدامنا حكايات!','نور أمل'],
    ['خطوة أخرى','friend','finale','warm','المهم نضل نحكي ونسمع بعض… والباقي بيجي لحاله.','رفقة مستمرة']
  ],
  [ // 4-5 / 10 — review
    ['موعد المراجعة','owner','wide','lantern','يا {friend}، حسّيت إن في كم معلومة طارت منك!','نظرة مستغربة'],
    ['دفاع مضحك','friend','closer','comic','مو أنا السبب… الأسئلة كانت عاملة حالها سهلة!','موقف كوميدي'],
    ['جلسة توضيح','owner','dramatic','lantern','طيب قبل ما نحكم… خلينا نشوف الرقم.','لحظة الحساب'],
    ['ملف الصداقة','owner','reveal','comic','{score} من 10! بدنا جلسة حكي أطول مع فنجان شي!','مراجعة مرحة'],
    ['اتفاق لطيف','friend','finale','warm','اتفقنا… المرة الجاية بسألك أنا وبنشوف مين بينسى!','ختام ضاحك']
  ],
  [ // 2-3 / 10 — detective
    ['فتح التحقيق','owner','wide','mystery','يا {friend}، في شي غريب صار بأجوبتك…','ملف مجهول'],
    ['المشتبه الأول','friend','closer','comic','قبل التحقيق، بدي محامي… أو تلميح صغير!','فوضى لطيفة'],
    ['الأدلة تظهر','owner','dramatic','mystery','كل الأدلة موجودة… والنتيجة رح تحكي!','ضوء كاشف'],
    ['الحكم المرح','owner','reveal','comic','{score} من 10! تم فتح ملف تدريب عاجل على أسراري!','ختم التحقيق'],
    ['وعد جديد','friend','finale','warm','رح أستجوب ذكرياتنا وحدة وحدة… وبنرجع أقوى!','مصالحة مرحة']
  ],
  [ // 0-1 / 10 — alarm, affectionate rather than humiliating
    ['لقاء صامت','owner','wide','mist','يا {friend}… حسّيت إن في بيناتنا أسرار لسه ما انحكت.','هدوء غامض'],
    ['حيرة الصديق','friend','closer','mist','يمكن توترت… ويمكن في كتير شغلات لازم أعرفها.','نظرة مترددة'],
    ['انتظار الجواب','owner','dramatic','mystery','خدها ببساطة. النتيجة مو مقياس لكل صداقتنا.','صمت حنون'],
    ['ظهور الإنذار','owner','reveal','red','{score} من 10… إنذار صغير لذكرياتنا، مو لنهايتنا!','وميض أحمر خافت'],
    ['بداية جديدة','friend','finale','warm','يا {owner}، لسه في وقت نتعرف أكتر… نبلّش من هون.','أمل بين الظلال']
  ]
]);
export function buildStory({score,ownerName,friendName}) {
  const band=resultBand(score), rows=FINALE_SCRIPTS[band];
  return rows.map(([label,speaker,shot,effect,text,caption],index)=>({
    id:['meeting','reply','suspense','reveal','finale'][index],label,speaker,shot,effect,caption,
    mood:OUTCOMES[band].mood,
    text:text.replaceAll('{friend}',friendName).replaceAll('{owner}',ownerName).replaceAll('{score}',String(score))
  }));
}
// Master characters come from the approved illustrated cards, repaired from their source pixels.
// Do not use the previous partially erased cutouts: several had missing feet and details.
export const portrait = id => `/assets/characters/${PEOPLE.some(p => p.id === id) ? id : 'bear'}-master.png`;
export const portraitCard = id => `/assets/characters/${PEOPLE.some(p => p.id === id) ? id : 'bear'}-card.webp`;
export const worldImage = id => `/assets/worlds/${id}.webp`;

export const cinematicImage=(world,beat)=>`/assets/cinematics/${['forest','ocean','vampire','classic'].includes(world)?world:'forest'}/${['meeting','reply','suspense','reveal','finale'].includes(beat)?beat:'meeting'}.webp`;
