#!/usr/bin/env python3
"""Reproducible local personal-preference question bank and illustrated option assets for V7.
The icons are legible without baked-in labels: the live accessible Arabic option text stays in HTML.
"""
import json, math, random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'public/assets/answers'
ASSETS.mkdir(parents=True,exist_ok=True)
QUESTIONS=[
 ('p-01','ذوقي','🎨','شو اللون المفضّل عند {name}؟',['الأحمر','الأزرق','الأسود','الأخضر'],['#e94949','#308af5','#282a43','#35a86f']),
 ('p-02','ذوقي','🥹','شو الإيموجي اللي بتشوفه أكتر برسائل {name}؟',['القلب الأبيض 🤍','وجه الضحك 😂','الوجه المتأثر 🥹','الوجه الواثق 😎'],['🤍','😂','🥹','😎']),
 ('p-03','يومياتي','💰','وين غالبًا بيروح مصروف {name}؟',['الأكل والمطاعم','اللبس والأحذية','الألعاب والتقنية','الطلعات والمشاوير'],['🍔','👟','🎮','🎡']),
 ('p-04','تواصل','💬','كيف عادةً بتوصلك رسائل {name}؟',['رسائل طويلة','رسائل قصيرة','رسائل صوتية','مكالمات صوتية'],['📜','💬','🎤','📞']),
 ('p-05','مشاعر','🌧️','وقت الحزن، شو أقرب تصرف لشخصية {name}؟',['الابتعاد والهدوء','الحديث مع شخص مقرّب','سماع الموسيقى','الخروج للمشي'],['🌙','🤝','🎧','🚶']),
 ('p-06','مشاعر','😤','عند الزعل، كيف بتكون ردة فعل {name}؟',['الصمت','المواجهة مباشرة','أخذ وقت على انفراد','الكتابة عن المشاعر'],['🤐','🗣️','🚪','✍️']),
 ('p-07','مشاعر','😟','شو أكتر فكرة بتخوف {name}؟',['خسارة شخص عزيز','الفشل','الوحدة','المستقبل المجهول'],['💔','📉','🌑','🕰️']),
 ('p-08','الخيال والذوق','🌍','لو {name} اختار يعيش مغامرة خيالية، بأي عالم بيحب يكون؟',['الغابة السحرية','المحيط والجزر','قلعة مصاصي الدماء','القرية الكلاسيكية'],['🌳','🌊','🦇','🏰']),
 ('p-09','مغامرات','🏇','شو وسيلة الركوب الأقرب لقلب {name}؟',['الخيل','الدراجة النارية','السيارة','الدراجة الهوائية'],['🐎','🏍️','🚗','🚲']),
 ('p-10','ترفيه','🎮','كيف بيحب {name} يقضي وقت الفراغ؟',['متابعة أنمي أو مسلسل','مشاهدة فيلم','اللعب','الطلعة مع الأصحاب'],['📺','🎬','🎮','🎡']),
 ('p-11','ترفيه','🎞️','أي نوع أفلام هو الأقرب لذوق {name}؟',['الرعب','الخيال والفانتازيا','الأكشن','الكوميديا'],['👻','🐉','⚔️','🤣']),
 ('p-12','ذكريات','📺','أي كرتون أقرب لذكريات {name}؟',['سبونج بوب','توم وجيري','المحقق كونان','غامبول'],['🧽','🐱','🔎','🐟']),
 ('p-13','ذكريات','🧸','شو اللعبة اللي كان {name} يحبها بالطفولة؟',['الغميضة','كرة القدم','سباق السيارات','ألعاب الفيديو'],['🙈','⚽','🏎️','🎮']),
 ('p-14','ذوقي','🍽️','شو الأكلة اللي ممكن يختارها {name} بلا تردد؟',['شاورما','بيتزا','برغر','معكرونة'],['🌯','🍕','🍔','🍝']),
 ('p-15','ذوقي','🥤','شو المشروب المفضّل عند {name}؟',['الشاي','القهوة','العصير','المشروبات الغازية'],['🍵','☕','🧃','🥤']),
 ('p-16','ذوقي','🍫','لو قدّمت حلوى لـ{name}، شو الأرجح يختار؟',['شوكولاتة','كيك','بوظة','وافل'],['🍫','🍰','🍦','🧇']),
 ('p-17','مغامرات','🌍','أي طلعة بتعجب {name} أكتر؟',['البحر والشاطئ','الجبال والطبيعة','قعدة بمقهى هادئ','مدينة ألعاب'],['🏖️','⛰️','☕','🎡']),
 ('p-18','يومياتي','☀️','شو أول شي غالبًا بيعمله {name} بعد ما يصحى؟',['يمسك الجوال','يشرب مي','يفطر','يرجع ينام شوي'],['📱','💧','🥐','💤']),
 ('p-19','صداقة','🤝','شو أهم شي عند {name} بالصداقة؟',['الثقة','الصراحة','الاهتمام','الوفاء'],['🤝','🗣️','💕','🛡️']),
 ('p-20','صداقة','💝','شو الشي اللي بيفرّح {name} بيوم صعب؟',['رسالة من القلب','ضحكة مع صديق','أكلة أو حلوى مفضلة','وقت هادئ لحاله'],['💌','😄','🍰','🍃']),
]
assert len(QUESTIONS)==20
palette=[('#cdf6e3','#a8e6ff','#5383bd'),('#f6dbf5','#c7edff','#8c5ac8'),('#ffead6','#fff9cb','#ca9160'),('#d0e9ff','#dde9ff','#5b82cf')]
emoji_font=ImageFont.truetype('/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf',109)
for qindex,(id,category,emoji,text,options,symbols) in enumerate(QUESTIONS):
    assert len(options)==len(set(options))==4
    for i,symbol in enumerate(symbols):
        rng=random.Random(qindex*59+i*31)
        c1,c2,accent=palette[(qindex+i)%4]
        from PIL import ImageColor
        start=ImageColor.getrgb(c1);end=ImageColor.getrgb(c2)
        img=Image.new('RGB',(640,440))
        pix=img.load()
        for y in range(440):
            ratio=y/439
            rgb=tuple(round(start[j]*(1-ratio)+end[j]*ratio) for j in range(3))
            for x in range(640):pix[x,y]=rgb
        d=ImageDraw.Draw(img,'RGBA')
        d.ellipse((-120,-150,260,200),fill=(255,255,255,65))
        d.ellipse((415,230,780,540),fill=(255,255,255,65))
        for j in range(14):
            x=rng.randint(35,605);y=rng.randint(45,410);r=rng.choice([3,5,8])
            d.ellipse((x-r,y-r,x+r,y+r),fill=(255,255,255,185))
        # Gold-trim fantasy game tile with pastel inner disk.
        d.rounded_rectangle((17,17,623,423),radius=43,outline=(153,106,52,150),width=8)
        d.rounded_rectangle((26,26,614,414),radius=36,outline=(255,253,213,210),width=5)
        d.ellipse((178,53,465,341),fill=(255,255,255,120),outline=(255,245,190,255),width=8)
        if id=='p-01':
            base=ImageColor.getrgb(symbol)
            d.ellipse((231,103,412,284),fill=(*base,255),outline=(255,255,255,255),width=9)
            d.ellipse((253,119,338,172),fill=(255,255,255,78))
        else:
            # Noto Color Emoji: render in color, center glyph by bounding box.
            symbol=symbol.replace('\ufe0f','')
            try:
                bounds=d.textbbox((0,0),symbol,font=emoji_font,embedded_color=True)
                xx=320-(bounds[2]-bounds[0])//2-bounds[0]
                yy=195-(bounds[3]-bounds[1])//2-bounds[1]
                d.text((xx,yy),symbol,font=emoji_font,embedded_color=True)
            except Exception:
                d.ellipse((258,140,384,266),fill=(216,170,89,255))
        # Gem crest, star sparkles.
        d.polygon([(320,21),(339,43),(320,65),(301,43)],fill=(255,231,132,250),outline=(182,131,64,230))
        d.polygon([(91,85),(99,99),(91,113),(83,99)],fill=(255,255,255,245))
        d.polygon([(550,342),(558,356),(550,370),(542,356)],fill=(255,255,255,245))
        img.save(ASSETS/f'{id}-{i}.webp',format='WEBP',quality=86,method=6)

bank=[{'id':id,'category':category,'emoji':emoji,'text':text,'options':options} for id,category,emoji,text,options,symbols in QUESTIONS]
(ROOT/'public/questions.json').write_text(json.dumps(bank,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Built',len(bank),'questions,',len(bank)*4,'option illustrations in',ASSETS)
