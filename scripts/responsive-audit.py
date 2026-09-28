"""
Responsive audit for Verse Blocks (Phase 3.5): loads the built app at eight screen sizes and
checks layout rules, then checks make-room, restore-on-widen and rotating a phone.
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
 o.smallTouch = coarse ? [...document.querySelectorAll('body > header button, .panel-head button, #activityBar button, .code-bar button, .seg button, .lesson-dot, .cat, .lesson-actions button')]
   .filter(e=>e.offsetParent && getComputedStyle(e).visibility!=='hidden').map(e=>{const r=e.getBoundingClientRect();return [(e.textContent.trim()||e.getAttribute('aria-label')||'').slice(0,14),Math.round(r.width),Math.round(r.height)]}).filter(([,w,h])=>w<44||h<44) : [];
 const bp=document.getElementById('blocksPane').getBoundingClientRect(), cp=document.getElementById('codePane').getBoundingClientRect();
 o.blocks=[Math.round(bp.width),Math.round(bp.height)]; o.code=[Math.round(cp.width),Math.round(cp.height)];
 const cb=document.querySelector('.code-bar'); o.codeBarOverflow = cb.offsetParent ? cb.scrollWidth - cb.clientWidth : 0;
 o.split = document.body.dataset.split; o.view = document.body.dataset.view;
 o.pinned=[...document.querySelectorAll('.dock > .panel')].map(p=>p.dataset.panel); o.bar=[...document.querySelectorAll('#activityBar .ab')].map(b=>b.dataset.panel+(b.classList.contains('tucked')?'*':''));
 o.toolboxCompact = document.getElementById('panel-toolbox').classList.contains('compact');
 o.minFont = Math.min(...[...document.querySelectorAll('body *')].filter(e=>e.offsetParent && [...e.childNodes].some(n=>n.nodeType===3 && n.textContent.trim())).map(e=>parseFloat(getComputedStyle(e).fontSize)));
 return o;}"""
fails=[]
def check(name, cond, msg):
    if not cond: fails.append(f'{name}: {msg}')
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for name,w,h,touch,zoom in SIZES:
            ctx=await b.new_context(viewport={'width':w,'height':h}, has_touch=touch, is_mobile=touch and w<900, device_scale_factor=zoom, color_scheme='dark')
            pg=await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(URL); await pg.wait_for_timeout(1200)
            await pg.click('.seg button[data-view="split"]'); await pg.wait_for_timeout(300)
            m=await pg.evaluate(MEASURE); 
            print(f'{name:12} split={m["split"]:6} blocks={m["blocks"]} code={m["code"]} header={m["headerH"]} pinned={m["pinned"]} bar={m["bar"]} compact={m["toolboxCompact"]} minFont={m["minFont"]}')
            check(name, m['overflow']<=1, f'page scrolls by {m["overflow"]}px')
            check(name, m['headerRows']==1, f'header wraps to two rows ({m["headerH"]}px)')
            check(name, m['clipped']==0, 'header item clipped')
            check(name, not m['smallTouch'], f'small touch targets {m["smallTouch"][:4]}')
            check(name, m['blocks'][0]>=280 and m['blocks'][1]>=170, f'blocks too small {m["blocks"]}')
            check(name, m['code'][0]>=240 and m['code'][1]>=140, f'code too small {m["code"]}')
            check(name, m['codeBarOverflow']<=1, 'code bar overflows')
            check(name, m['minFont']>=11, f'text {m["minFont"]}px')
            for dlg,btn in [('tmplDlg','#tmplBtn'),('projDlg','#projBtn')]:
                if await pg.is_visible(btn): await pg.click(btn)
                else:
                    await pg.click('#moreBtn'); await pg.click('.panel-menu button:has-text("%s")' % ('Templates' if dlg=='tmplDlg' else 'Project'))
                await pg.wait_for_timeout(250)
                fit=await pg.evaluate(f"()=>{{const d=document.getElementById('{dlg}');const r=d.getBoundingClientRect();return d.open && r.top>=-1 && r.left>=-1 && r.bottom<=innerHeight+1 && r.right<=innerWidth+1}}")
                check(name, fit, f'{dlg} does not fit or did not open')
                await pg.keyboard.press('Escape'); await pg.wait_for_timeout(150)
            check(name, not errs, f'errors {errs}')
            await ctx.close()
        # --- behavior: make room restores when the window widens ---
        ctx=await b.new_context(viewport={'width':1024,'height':768}); pg=await ctx.new_page(); await pg.goto(URL); await pg.wait_for_timeout(1200)
        await pg.click('.seg button[data-view="split"]'); await pg.wait_for_timeout(200)
        narrow=await pg.evaluate(MEASURE)
        await pg.set_viewport_size({'width':1920,'height':1080}); await pg.wait_for_timeout(400)
        wide=await pg.evaluate(MEASURE)
        saved=await pg.evaluate("()=>JSON.parse(localStorage.getItem('verse-blocks:layout:v1')||'null')")
        print('make room @1024:', narrow['pinned'], narrow['bar'], 'compact', narrow['toolboxCompact'], '| @1920:', wide['pinned'], wide['bar'], 'compact', wide['toolboxCompact'], '| saved layout touched:', saved is not None)
        check('make-room', sorted(wide['pinned'])==['learn','toolbox'] and not wide['toolboxCompact'], 'did not restore when widened')
        check('make-room', saved is None, 'auto make-room changed the saved layout')
        # switching to Blocks view needs less room: panels come back at 1024
        await pg.set_viewport_size({'width':1024,'height':768}); await pg.wait_for_timeout(300)
        await pg.click('.seg button[data-view="blocks"]'); await pg.wait_for_timeout(300)
        bv=await pg.evaluate(MEASURE); print('1024 in Blocks view:', bv['pinned'], bv['bar'], 'compact', bv['toolboxCompact'])
        await ctx.close()
        # --- behavior: rotating a phone switches split direction ---
        ctx=await b.new_context(viewport={'width':390,'height':844}, has_touch=True, is_mobile=True); pg=await ctx.new_page(); await pg.goto(URL); await pg.wait_for_timeout(1200)
        await pg.click('.seg button[data-view="split"]'); await pg.wait_for_timeout(200)
        s1=await pg.evaluate("()=>document.body.dataset.split")
        await pg.set_viewport_size({'width':844,'height':390}); await pg.wait_for_timeout(400)
        s2=await pg.evaluate("()=>document.body.dataset.split")
        print('rotate phone: portrait', s1, '-> landscape', s2); check('rotate', s1=='column' and s2=='row', f'{s1}->{s2}')
        await ctx.close(); await b.close()
    print('\nRESULT:', 'ALL CHECKS PASS' if not fails else f'{len(fails)} failures'); [print(' -', f) for f in fails]
    if fails: sys.exit(1)
asyncio.run(main())
