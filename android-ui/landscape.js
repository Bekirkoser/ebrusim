'use strict';
// Android-only studio layout. The iPhone and website UI remain independent.
(() => {
    const root = document.documentElement;
    root.classList.add('ebru-android-landscape');
    const tr = () => EbruI18n.language === 'tr';
    const words = {
        tr: { gallery:'Galeri', settings:'İşlemler', close:'Kapat', size:'Damla boyutu', radius:'Etki alanı', flow:'Akış', swirl:'Girdap', quality:'Kalite', balanced:'Dengeli', detail:'Detaylı', light:'Pil tasarrufu', paused:'Suyu duraklat', clear:'Tuvali temizle', clearPrompt:'Tuval temizlensin mi? Önce mevcut çalışmanı kaydet.', colors:'Renkler', paper:'Kağıt rengi', about:'Hakkında ve gizlilik', help:'Nasıl kullanılır?', paint:'Damla ayarları', water:'Akış ayarları', canvas:'Tuval', preferences:'Tercihler', language:'Dil' },
        en: { gallery:'Gallery', settings:'Actions', close:'Close', size:'Drop size', radius:'Effect radius', flow:'Flow', swirl:'Swirl', quality:'Quality', balanced:'Balanced', detail:'Detailed', light:'Battery saver', paused:'Pause water', clear:'Clear canvas', clearPrompt:'Clear the canvas? Save your artwork first.', colors:'Colors', paper:'Paper color', about:'About & privacy', help:'How to use', paint:'Paint settings', water:'Flow settings', canvas:'Canvas', preferences:'Preferences', language:'Language' }
    };
    const text = key => words[tr() ? 'tr' : 'en'][key];
    const icons = {
        gallery:'<rect x="3" y="3" width="7" height="7" rx="1.8"/><rect x="14" y="3" width="7" height="7" rx="1.8"/><rect x="3" y="14" width="7" height="7" rx="1.8"/><rect x="14" y="14" width="7" height="7" rx="1.8"/>',
        save:'<path d="M12 3v12m-4-4 4 4 4-4M5 17v4h14v-4"/>',
        share:'<path d="M12 15V3m-4 4 4-4 4 4M5 11v10h14V11"/>',
        record:'<rect x="3" y="6" width="12" height="12" rx="2"/><path d="m15 10 6-3v10l-6-3"/>',
        settings:'<path d="M4 6h3m6 0h7M4 18h7m6 0h3M10 3v6M14 15v6"/><path d="M4 12h10m4 0h2"/><circle cx="16" cy="12" r="2"/>',
        paint:'<path d="M12 2C9 7 5 10 5 15a7 7 0 0 0 14 0c0-5-4-8-7-13Z"/><path d="M8 15c0 2 1 3 3 3"/>',
        water:'<path d="M3 8c3-5 6 5 9 0s6 5 9 0M3 16c3-5 6 5 9 0s6 5 9 0"/>',
        close:'<path d="m6 6 12 12M18 6 6 18"/>',
        pause:'<path d="M8 5v14M16 5v14"/>',
        play:'<path d="m8 5 11 7-11 7Z"/>',
        picker:'<path d="m15 3 6 6-3 3-6-6 3-3ZM12 8l-8 8-1 5 5-1 8-8"/>'
    };
    const svg = key => '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[key]+'</svg>';
    const makeButton = (label, icon, className='') => {
        const el=document.createElement('button'); el.type='button'; el.className=className;
        el.setAttribute('aria-label',label); el.title=label; el.innerHTML=svg(icon); return el;
    };
    const studio=window.EbruStudio;
    const help=document.querySelector('.ebru-info-overlay');
    const helpButton=document.querySelector('.ebru-info-button');
    const language=document.querySelector('.ebru-language');
    help.classList.remove('is-open'); help.setAttribute('aria-hidden','true');
    helpButton.setAttribute('aria-expanded','false'); document.body.insertBefore(language,help);

    const bar=document.createElement('header'); bar.className='pc-toolbar';
    const actions=document.querySelector('.ebru-app-toolbar');
    const tools=document.createElement('nav'); tools.className='pc-tools'; tools.setAttribute('aria-label',tr()?'Boyama araçları':'Painting tools');
    const brand=document.createElement('span');brand.className='pc-brand';
    const brandLogo=document.createElement('img');brandLogo.src='./android-ui/ebrusim-logo.png';brandLogo.alt='';brandLogo.width=24;brandLogo.height=24;brandLogo.draggable=false;
    const brandName=document.createElement('span');brandName.textContent='ebrusim.art';brand.append(brandLogo,brandName);
    bar.append(actions,brand,tools); document.body.append(bar);
    function decorate(el) {
        const key=el.dataset.mobileKey; if(!icons[key])return;
        const label=el.textContent; el.title=label; el.setAttribute('aria-label',label);
        const caption=document.createElement('span');caption.className='pc-action-label';caption.textContent=key==='gallery'?text('gallery'):label;
        const icon=document.createElement('span');icon.className='pc-action-icon';icon.innerHTML=svg(key);
        el.replaceChildren(icon,caption);
    }
    actions.querySelectorAll('[data-mobile-key]').forEach(decorate);
    new MutationObserver(records=>{
        new Set(records.map(r=>r.target.closest?.('[data-mobile-key]')).filter(Boolean)).forEach(el=>{if(!el.querySelector('.pc-action-label'))decorate(el);});
    }).observe(actions,{childList:true,subtree:true,characterData:true});
    const settings=makeButton(text('settings'),'settings','pc-tool');
    settings.setAttribute('aria-controls','pc-settings');settings.setAttribute('aria-expanded','false');
    actions.insertBefore(settings,actions.children[1]);
    const paint=makeButton(text('paint'),'paint','pc-tool');
    const water=makeButton(text('water'),'water','pc-tool');
    const color=makeButton(text('colors'),'paint','pc-color-button');color.replaceChildren();
    color.setAttribute('aria-controls','pc-colors');color.setAttribute('aria-expanded','false');
    const toggle=document.querySelector('.ebru-ui-toggle');
    if(toggle)toggle.classList.add('pc-visibility');
    tools.append(paint,water);if(toggle)tools.append(toggle);tools.append(color);

    const panel=document.createElement('aside');panel.id='pc-settings';panel.className='pc-panel pc-settings';panel.hidden=true;
    document.body.append(panel);
    const palette=document.querySelector('.ebru-color-palette');
    const closePanel=()=>{panel.hidden=true;[settings,paint,water].forEach(b=>b.setAttribute('aria-expanded','false'));};
    const closeColors=()=>{if(document.body.classList.contains('pc-colors-open'))document.body.classList.remove('pc-colors-open');color.setAttribute('aria-expanded','false');};
    const closeAll=()=>{closePanel();closeColors();};
    let railInputs={};
    function label(el,key){el.setAttribute('aria-label',text(key));el.title=text(key);}
    function sectionTitle(key){const title=document.createElement('h3');title.textContent=text(key);panel.append(title);}
    function syncRange(input){
        const min=Number(input.min),max=Number(input.max),value=Number(input.value);
        const progress=max>min?Math.max(0,Math.min(100,(value-min)/(max-min)*100)):0;
        input.style.setProperty('--pc-fill',progress+'%');
        const output=input.closest('label')?.querySelector('.pc-rail-readout');
        if(output)output.textContent=(input.dataset.pcProperty==='DROP_SIZE'?Math.round(value):Math.round(value*100))+'%';
    }
    function range(key,property,min,max,step){
        const row=document.createElement('label');row.className='pc-setting-row';
        const heading=document.createElement('div');const name=document.createElement('span');name.textContent=text(key);
        const value=document.createElement('output');value.textContent=config[property];heading.append(name,value);
        const input=document.createElement('input');input.type='range';input.min=min;input.max=max;input.step=step;input.value=config[property];input.dataset.pcProperty=property;input.setAttribute('aria-label',text(key));syncRange(input);
        input.addEventListener('input',()=>{config[property]=Number(input.value);value.textContent=input.value;syncRange(input);if(railInputs[property]){railInputs[property].value=input.value;syncRange(railInputs[property]);}});
        row.append(heading,input);panel.append(row);
    }
    const pause=makeButton(text('paused'),'pause','pc-pause');
    const updatePause=()=>{if(!studio)return;pause.innerHTML=svg(config.PAUSED?'play':'pause');pause.setAttribute('aria-pressed',String(config.PAUSED));};
    pause.addEventListener('click',()=>{if(!studio)return;config.PAUSED=!config.PAUSED;updatePause();});
    function renderPanel(mode='all'){
        panel.dataset.mode=mode;panel.replaceChildren();panel.setAttribute('aria-label',text(mode==='paint'?'paint':mode==='water'?'water':'settings'));
        const head=document.createElement('header');const title=document.createElement('h2');title.textContent=text(mode==='paint'?'paint':mode==='water'?'water':'settings');
        const close=makeButton(text('close'),'close');close.addEventListener('click',closePanel);head.append(title,close);panel.append(head);
        if(studio){
            if(mode==='all'||mode==='paint'){sectionTitle('paint');range('size','DROP_SIZE',25,200,5);range('radius','SPLAT_RADIUS',.01,1,.01);}
            if(mode==='all'||mode==='water'){sectionTitle('water');range('flow','VELOCITY_DISSIPATION',0,4,.1);range('swirl','CURL',0,50,1);}
            if(mode==='all'){
                sectionTitle('canvas');
                const paperLabel=document.createElement('label');paperLabel.className='pc-inline-setting';paperLabel.textContent=text('paper');
                const paper=document.createElement('input');paper.type='color';paper.value='#'+['r','g','b'].map(k=>Math.round(config.BACK_COLOR[k]).toString(16).padStart(2,'0')).join('');paper.setAttribute('aria-label',text('paper'));
                paper.addEventListener('input',()=>{const v=parseInt(paper.value.slice(1),16);config.BACK_COLOR={r:(v>>16)&255,g:(v>>8)&255,b:v&255};});paperLabel.append(paper);panel.append(paperLabel);
                const qualityLabel=document.createElement('label');qualityLabel.className='pc-inline-setting';qualityLabel.textContent=text('quality');
                const quality=document.createElement('select');quality.setAttribute('aria-label',text('quality'));
                [[256,'light'],[512,'balanced'],[1024,'detail']].forEach(([value,key])=>{const o=document.createElement('option');o.value=value;o.textContent=text(key);quality.append(o);});quality.value=config.DYE_RESOLUTION;
                quality.addEventListener('change',()=>{config.DYE_RESOLUTION=Number(quality.value);initFramebuffers();});qualityLabel.append(quality);panel.append(qualityLabel);
                const clear=document.createElement('button');clear.className='pc-text-action pc-destructive';clear.textContent=text('clear');clear.addEventListener('click',()=>{if(confirm(text('clearPrompt'))){studio.clear();closePanel();}});panel.append(clear);
            }
        }
        if(mode==='all'){
            sectionTitle('preferences');
            const locale=document.createElement('div');locale.className='pc-inline-setting';const localeTitle=document.createElement('span');localeTitle.textContent=text('language');locale.append(localeTitle,language);panel.append(locale);
            const guide=document.createElement('button');guide.className='pc-text-action';guide.textContent=text('help');guide.addEventListener('click',()=>{closePanel();helpButton.click();});panel.append(guide);
            const about=document.createElement('button');about.className='pc-text-action';about.textContent=text('about');about.addEventListener('click',()=>{closePanel();document.querySelector('.ebru-app-about').click();});panel.append(about);
        }
    }
    function openPanel(mode){
        const same=!panel.hidden&&panel.dataset.mode===mode;closeAll();if(same)return;
        renderPanel(mode);panel.hidden=false;(mode==='paint'?paint:mode==='water'?water:settings).setAttribute('aria-expanded','true');
    }
    settings.addEventListener('click',()=>openPanel('all'));paint.addEventListener('click',()=>openPanel('paint'));water.addEventListener('click',()=>openPanel('water'));

    if(palette){
        palette.id='pc-colors';palette.classList.add('pc-panel');
        const head=document.createElement('header');const title=document.createElement('h2');title.textContent=text('colors');title.dataset.pcText='colors';
        const close=makeButton(text('close'),'close');close.addEventListener('click',closeColors);const hex=document.createElement('output');hex.className='pc-color-hex';
        head.append(title,hex,close);palette.prepend(head);
        const custom=palette.querySelector('.ebru-custom-color-label');const customText=custom?.querySelector('span');
        if(custom){custom.innerHTML=svg('picker');if(customText)custom.append(customText);}
        color.addEventListener('click',()=>{const open=document.body.classList.contains('pc-colors-open');closeAll();if(!open){document.body.classList.add('pc-colors-open');color.setAttribute('aria-expanded','true');}});
    } else color.disabled=true;
    function syncColor(){const hex=getComputedStyle(root).getPropertyValue('--ebru-paint-color').trim()||'#c94b3c';color.style.setProperty('--chosen-color',hex);const code=palette?.querySelector('.pc-color-hex');if(code)code.textContent=hex.toUpperCase();color.title=text('colors')+' · '+hex.toUpperCase();}
    new MutationObserver(syncColor).observe(root,{attributes:true,attributeFilter:['style']});syncColor();

    const rail=document.createElement('aside');rail.className='pc-sidebar';rail.setAttribute('aria-label',tr()?'Hızlı ayarlar':'Quick adjustments');
    if(studio){
        const addRail=(key,property,min,max,step)=>{
            const row=document.createElement('label');row.className='pc-rail-control';
            const name=document.createElement('span');name.className='pc-sr-only';name.textContent=text(key);name.dataset.pcText=key;
            const input=document.createElement('input');input.type='range';input.min=min;input.max=max;input.step=step;input.value=config[property];input.dataset.pcProperty=property;input.setAttribute('aria-label',text(key));input.dataset.pcKey=key;
            const readout=document.createElement('output');readout.className='pc-rail-readout';
            input.addEventListener('input',()=>{config[property]=Number(input.value);syncRange(input);panel.querySelectorAll('[data-pc-property="'+property+'"]').forEach(field=>{field.value=input.value;syncRange(field);const output=field.closest('label').querySelector('output');if(output)output.textContent=input.value;});});
            railInputs[property]=input;row.append(name,readout,input);rail.append(row);syncRange(input);
        };
        addRail('size','DROP_SIZE',25,200,5);rail.append(pause);addRail('radius','SPLAT_RADIUS',.01,1,.01);updatePause();document.body.append(rail);
    }
    const syncHidden=()=>{
        const hidden=document.body.classList.contains('ebru-ui-hidden');
        if(hidden)closeAll();
        if(toggle){toggle.classList.toggle('pc-restore',hidden);if(hidden)document.body.append(toggle);else tools.insertBefore(toggle,color);}
    };
    new MutationObserver(syncHidden).observe(document.body,{attributes:true,attributeFilter:['class']});
    syncHidden();
    document.querySelector('body > canvas')?.addEventListener('pointerdown',closeAll,{passive:true});
    window.addEventListener('keydown',event=>{if(event.key==='Escape')closeAll();});
    const dialog=document.querySelector('.ebru-app-dialog');
    if(dialog){
        new MutationObserver(()=>{
            const video=dialog.querySelector(':scope > video');dialog.classList.toggle('pc-video-dialog',!!dialog.querySelector('video'));
            const credits=dialog.querySelector('.ebru-credits');if(credits?.textContent.includes('Ebrusim 1.0.0'))credits.textContent=credits.textContent.replace('Ebrusim 1.0.0','Ebrusim 1.3.2');
            if(!video)return;
            const layout=document.createElement('div');layout.className='pc-video-layout';const media=document.createElement('div');media.className='pc-video-surface';media.append(video);
            const actions=document.createElement('section');actions.className='pc-video-actions';Array.from(dialog.children).filter(el=>el.tagName!=='HEADER').forEach(el=>actions.append(el));
            layout.append(media,actions);dialog.append(layout);
        }).observe(dialog,{childList:true});
        new MutationObserver(()=>{if(dialog.open)closeAll();}).observe(dialog,{attributes:true,attributeFilter:['open']});
    }
    const originalBack=EbruNative.closeOverlay;
    EbruNative.closeOverlay=()=>{if(!panel.hidden||document.body.classList.contains('pc-colors-open')){closeAll();return true;}return originalBack?.()||false;};
    window.addEventListener('ebru-language-change',()=>{
        closeAll();label(settings,'settings');label(paint,'paint');label(water,'water');label(color,'colors');label(pause,'paused');
        rail.querySelectorAll('[data-pcText]').forEach(el=>{el.textContent=text(el.dataset.pcText);});
        rail.querySelectorAll('[data-pcKey]').forEach(el=>{el.setAttribute('aria-label',text(el.dataset.pcKey));});
        palette?.querySelectorAll('[data-pcText]').forEach(el=>{el.textContent=text(el.dataset.pcText);});syncColor();
    });
})();
