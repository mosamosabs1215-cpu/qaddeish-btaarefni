import tempfile, subprocess, os, time, json, pathlib, urllib.request
from playwright.sync_api import sync_playwright
PROJECT=pathlib.Path(__file__).resolve().parents[1]
PORT='35678'; url=f'http://127.0.0.1:{PORT}'
server=subprocess.Popen(['node','server.mjs'],cwd=PROJECT,env={**os.environ,'PORT':PORT,'DATA_DIR':tempfile.mkdtemp(prefix='v7-browser-db-')},stdout=subprocess.PIPE,stderr=subprocess.PIPE)
try:
    for i in range(70):
        try:
            urllib.request.urlopen(url,timeout=1);break
        except:time.sleep(.1)
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        for width in (390,1280):
            context=browser.new_context(viewport={'width':width,'height':844 if width==390 else 850},device_scale_factor=1)
            page=context.new_page();errors=[]
            page.on('pageerror',lambda e: errors.append(str(e)))
            page.goto(url,wait_until='networkidle');page.screenshot(path=str(PROJECT/f'preview-home-{width}.png'),full_page=True)
            page.get_by_role('button',name='أنشئ اختبارك').first.click() if width==1280 else page.locator('.hero-actions [data-action=create]').first.click()
            page.locator('#owner-name').fill('موسى')
            page.locator('[data-action=select-person][data-value=witch]').click()
            page.locator('[data-action=select-world][data-value=ocean]').click()
            assert page.locator('#owner-name').input_value()=='موسى'
            page.locator('[data-action=start-building]').click()
            for q in range(10):
                page.locator('[data-action=choose-correct]').first.click()
            assert page.get_by_text('راجع أسئلتك العشرة').count()==1
            page.locator('[data-action=publish]').click()
            page.wait_for_selector('#share-link');play_link=page.locator('#share-link').inner_text();assert '/play/' in play_link
            page.screenshot(path=str(PROJECT/f'preview-share-{width}.png'),full_page=True)
            friend=browser.new_context(viewport={'width':width,'height':844 if width==390 else 850})
            fp=friend.new_page(); fp.on('pageerror',lambda e: errors.append('friend: '+str(e)))
            fp.goto(play_link);fp.wait_for_selector('#friend-name');fp.locator('#friend-name').fill('ليلى');fp.locator('[data-action=friend-person][data-value=cat]').click()
            assert fp.locator('#friend-name').input_value()=='ليلى';fp.locator('[data-action=start-friend]').click()
            for q in range(10):
                fp.locator('[data-action=answer]').first.click()
                fp.locator('[data-action=next-answer]').click()
            fp.wait_for_selector('.story-stage');fp.screenshot(path=str(PROJECT/f'preview-story-{width}.png'),full_page=True)
            assert fp.locator('.actor').count()==2
            assert fp.locator('.actor.owner').get_attribute('src').endswith('witch-master.png')
            assert fp.locator('.actor.friend').get_attribute('src').endswith('cat-master.png')
            for j in range(4):fp.locator('[data-action=story-next]').click()
            assert fp.locator('.story-board strong').inner_text().endswith('/10')
            fp.screenshot(path=str(PROJECT/f'preview-ending-{width}.png'),full_page=True)
            fp.locator('[data-action=story-next]').click()
            assert fp.get_by_text('شارك النتيجة').count()==1
            assert not errors,errors
            print('PASS viewport',width,'score',fp.locator('body').inner_text().split('/10')[0][-8:])
            friend.close();context.close()
        browser.close()
finally:
    server.terminate()
