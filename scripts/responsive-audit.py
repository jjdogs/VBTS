"""
Responsive audit for Verse Blocks: loads the built app at eight screen sizes and checks layout
rules, then checks floating panels on a narrow window, docking again when it widens, and
rotating a phone.
Exits with code 1 if anything fails.
"""
import asyncio, json
from playwright.async_api import async_playwright
import os, sys
# Usage: python3 scripts/responsive-audit.py [path/to/index.html]   (default: dist/index.html)
URL='file://' + os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'dist/index.html')
SIZES=[('phone',375,812,True,1),('phone-land',812,375,True,1),('tablet',768,1024,True,1),('tablet-land',1024,768,True,1),
       ('laptop',1280,720,False,1),('laptop-200%',640,360,False,2),('desktop',1920,1080,False,1),('ultrawide',2560,1080,False,1)]
MEASURE = """()=>{
 const vw=innerWidth, vh=innerHeight, o={};
 o.overflow = Math.max(document.documentElement.scrollWidth - vw, document.documentElement.scrollHeight - vh);
 const H=document.querySelector('body > header'); o.headerH = Math.round(H.getBoundingClientRect().height);
 const items=[...H.children].filter(e=>e.offsetParent); const mids=items.map(e=>{const r=e.getBoundingClientRect();return r.top+r.height/2});
 o.headerRows = Math.max(...mids)-Math.min(...mids) > 12 ? 2 : 1;
 o.clipped = items.filter(e=>{const r=e.getBoundingClientRect();return r.right>vw+1||r.left<-1}).length;
 const coarse = matchMedia('(pointer: coarse)').matches;
 o.smallTouch = coarse ? [...document.querySelectorAll('body > header button, .panel-head button, .activity-bar button, #bottomNav button, .editor-bar button, #statusbar button, .lesson-dot, .cat, .lesson-actions button')]
   .filter(e=>e.offsetParent && getComputedStyle(e).visibility!=='hidden').map(e=>{const r=e.getBoundingClientRect();return [(e.textContent.trim()||e.getAttribute('aria-label')||'').slice(0,14),Math.round(r.width),Math.round(r.height)]}).filter(([,w,h])=>w<44||h<44) : [];
 const bp=document.getElementById('blocksPane').getBoundingClientRect(), cp=document.getElementById('codePane').getBoundingClientRect();
 o.blocks=[Math.round(bp.width),Math.round(bp.height)]; o.code=[Math.round(cp.width),Math.round(cp.height)];
 const cb=document.querySelector('.editor-bar'); o.codeBarOverflow = cb.offsetParent ? cb.scrollWidth - cb.clientWidth : 0;
 o.split = document.body.dataset.split; o.view = document.body.dataset.view;
 o.docked=[...document.querySelectorAll('.side:not([hidden]):not(.floating) > .panel')].map(p=>p.dataset.panel);
 o.floating=[...document.querySelectorAll('.side.floating:not([hidden]) > .panel')].map(p=>p.dataset.panel);
 o.minFont = Math.min(...[...document.querySelectorAll('body *')].filter(e=>e.offsetParent && [...e.childNodes].some(n=>n.nodeType===3 && n.textContent.trim())).map(e=>parseFloat(getComputedStyle(e).fontSize)));
 return o;}"""
fails=[]
def check(name, cond, msg):
    if not cond: fails.append(f'{name}: {msg}')
async def main():
    async with async_playwright() as p:
        exe=os.environ.get('CHROMIUM_PATH')  # optional: a Chromium to use instead of Playwright's own
        b=await p.chromium.launch(**({'executable_path': exe} if exe else {}))
        for name,w,h,touch,zoom in SIZES:
            ctx=await b.new_context(viewport={'width':w,'height':h}, has_touch=touch, is_mobile=touch and w<900, device_scale_factor=zoom, color_scheme='dark')
            pg=await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(URL); await pg.wait_for_timeout(1200)
            await pg.click('.view-switch button[data-view="split"]'); await pg.wait_for_timeout(300)
            m=await pg.evaluate(MEASURE)
            print(f'{name:12} split={m["split"]:6} blocks={m["blocks"]} code={m["code"]} header={m["headerH"]} docked={m["docked"]} floating={m["floating"]} minFont={m["minFont"]}')
            check(name, m['overflow']<=1, f'page scrolls by {m["overflow"]}px')
            check(name, m['headerRows']==1, f'header wraps to two rows ({m["headerH"]}px)')
            check(name, m['clipped']==0, 'header item clipped')
            check(name, not m['smallTouch'], f'small touch targets {m["smallTouch"][:4]}')
            check(name, m['blocks'][0]>=280 and m['blocks'][1]>=170, f'blocks too small {m["blocks"]}')
            check(name, m['code'][0]>=240 and m['code'][1]>=140, f'code too small {m["code"]}')
            check(name, m['codeBarOverflow']<=1, 'editor bar overflows')
            check(name, m['minFont']>=11, f'text {m["minFont"]}px')
            for dlg in ['tmplDlg','projDlg']:
                if dlg=='projDlg': await pg.click('#shareBtn')
                else: await pg.click('#moreBtn'); await pg.click('.panel-menu button:has-text("templates")')
                await pg.wait_for_timeout(250)
                fit=await pg.evaluate(f"()=>{{const d=document.getElementById('{dlg}');const r=d.getBoundingClientRect();return d.open && r.top>=-1 && r.left>=-1 && r.bottom<=innerHeight+1 && r.right<=innerWidth+1}}")
                check(name, fit, f'{dlg} does not fit or did not open')
                await pg.keyboard.press('Escape'); await pg.wait_for_timeout(150)
            check(name, not errs, f'errors {errs}')
            await ctx.close()
        # --- behavior: on a narrow window the right panel floats, and docks again when it widens ---
        ctx=await b.new_context(viewport={'width':1024,'height':768}); pg=await ctx.new_page(); await pg.goto(URL); await pg.wait_for_timeout(1200)
        await pg.click('.view-switch button[data-view="split"]'); await pg.wait_for_timeout(200)
        await pg.click('#barRight .ab[data-panel="appearance"]'); await pg.wait_for_timeout(300)
        narrow=await pg.evaluate(MEASURE)
        await pg.set_viewport_size({'width':1920,'height':1080}); await pg.wait_for_timeout(400)
        wide=await pg.evaluate(MEASURE)
        print('make room @1024:', narrow['docked'], 'floating', narrow['floating'], '| @1920:', wide['docked'], 'floating', wide['floating'])
        check('make-room', narrow['floating']==['appearance'] and narrow['docked']==['toolbox'], 'right panel did not float on a narrow window')
        check('make-room', sorted(wide['docked'])==['appearance','toolbox'] and not wide['floating'], 'did not dock again when widened')
        await ctx.close()
        # --- behavior: rotating a phone switches split direction ---
        ctx=await b.new_context(viewport={'width':390,'height':844}, has_touch=True, is_mobile=True); pg=await ctx.new_page(); await pg.goto(URL); await pg.wait_for_timeout(1200)
        await pg.click('.view-switch button[data-view="split"]'); await pg.wait_for_timeout(200)
        s1=await pg.evaluate("()=>document.body.dataset.split")
        await pg.set_viewport_size({'width':844,'height':390}); await pg.wait_for_timeout(400)
        s2=await pg.evaluate("()=>document.body.dataset.split")
        print('rotate phone: portrait', s1, '-> landscape', s2); check('rotate', s1=='column' and s2=='row', f'{s1}->{s2}')
        await ctx.close(); await b.close()
    print('\nRESULT:', 'ALL CHECKS PASS' if not fails else f'{len(fails)} failures'); [print(' -', f) for f in fails]
    if fails: sys.exit(1)
asyncio.run(main())
