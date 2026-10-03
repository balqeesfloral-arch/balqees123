export const PORTAL_DISPLAY_DEFAULTS = {
  theme:'system', accent_preset:'olive', density:'balanced', font_scale:'medium', interface_style:'luxury',
  reduced_motion:false, decorations:'balanced', glass_effect:'balanced', background_motion:'subtle',
  card_style:'soft', sidebar_mode:'auto', homepage_mode:'mixed', number_style:'latin', display_profile:'custom',
  high_contrast:false, clear_borders:false, reduce_transparency:false, larger_touch_targets:false,
  performance_mode:'auto', image_loading:'auto', date_system:'dual', time_format:'24h', timezone:'Asia/Riyadh',
  widget_order:['attention','operations','insights','milestones','recent'], widget_visibility:{attention:true,operations:true,insights:true,milestones:true,recent:true},
};

export const DISPLAY_PROFILES = {
  executive:{density:'comfortable',interface_style:'luxury',decorations:'balanced',glass_effect:'balanced',background_motion:'subtle',card_style:'soft',homepage_mode:'visual',font_scale:'medium'},
  operations:{density:'compact',interface_style:'calm',decorations:'light',glass_effect:'light',background_motion:'static',card_style:'flat',homepage_mode:'operational',font_scale:'medium'},
  finance:{density:'compact',interface_style:'calm',decorations:'none',glass_effect:'light',background_motion:'static',card_style:'flat',homepage_mode:'operational',font_scale:'small'},
  minimal:{density:'balanced',interface_style:'calm',decorations:'none',glass_effect:'light',background_motion:'static',card_style:'flat',homepage_mode:'mixed',font_scale:'medium',reduce_transparency:true},
};

const ACCENTS={
  olive:['#48634f','#c4ab72'], gold:['#8d7040','#cdb47a'], forest:['#254c38','#a6b39f'], sand:['#826f52','#d7c39a'], hotel:['#56615d','#b8beb9']
};
/* v10.45 raises the baseline because the portal previously rendered many
   micro-labels at 5–10px. The CSS layer multiplies this scale consistently. */
const FONT={small:1,medium:1.08,large:1.18,xlarge:1.3};

export function normalizePortalDisplay(value={}){
  const merged={...PORTAL_DISPLAY_DEFAULTS,...(value||{})};
  return {
    ...merged,
    widget_order:Array.isArray(value?.widget_order)&&value.widget_order.length?value.widget_order:PORTAL_DISPLAY_DEFAULTS.widget_order,
    widget_visibility:value?.widget_visibility&&typeof value.widget_visibility==='object'?{...PORTAL_DISPLAY_DEFAULTS.widget_visibility,...value.widget_visibility}:{...PORTAL_DISPLAY_DEFAULTS.widget_visibility},
  };
}

function tuneImages(node,p){
  if(!node?.querySelectorAll)return;
  node.querySelectorAll('img').forEach((img)=>{
    img.decoding='async';
    if(p.image_loading==='data_saver'){
      img.loading='lazy';
      img.fetchPriority='low';
    }else if(p.image_loading==='auto'){
      if(!img.closest('.client-partnership-scene,.client-partnership-hero'))img.loading='lazy';
      img.removeAttribute('fetchpriority');
    }else{
      img.removeAttribute('loading');
      img.removeAttribute('fetchpriority');
    }
  });
}

export function applyPortalAppearance(node, raw={}){
  if(!node)return ()=>{};
  const p=normalizePortalDisplay(raw);
  const media=window.matchMedia?.('(prefers-color-scheme: dark)');
  const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let observer;
  const render=()=>{
    const theme=p.theme==='system'?(media?.matches?'dark':'light'):p.theme;
    node.dataset.portalTheme=theme;
    node.dataset.portalAccent=p.accent_preset;
    node.dataset.portalDensity=p.density;
    node.dataset.portalStyle=p.interface_style;
    node.dataset.portalDecorations=p.decorations;
    node.dataset.portalGlass=p.glass_effect;
    node.dataset.portalBackgroundMotion=p.background_motion;
    node.dataset.portalCard=p.card_style;
    node.dataset.portalSidebar=p.sidebar_mode;
    node.dataset.portalHomepage=p.homepage_mode;
    node.dataset.portalNumber=p.number_style;
    node.dataset.portalDateSystem=p.date_system;
    node.dataset.portalTimeFormat=p.time_format;
    node.dataset.portalTimezone=p.timezone;
    node.dataset.portalPerformance=p.performance_mode;
    node.dataset.portalImageLoading=p.image_loading;
    node.dataset.portalContrast=p.high_contrast?'high':'normal';
    node.dataset.portalBorders=p.clear_borders?'clear':'soft';
    node.dataset.portalTransparency=p.reduce_transparency?'reduced':'normal';
    node.dataset.portalTouch=p.larger_touch_targets?'large':'normal';
    node.dataset.portalMotion=(p.reduced_motion||reduce?.matches)?'reduced':'normal';
    const accent=ACCENTS[p.accent_preset]||ACCENTS.olive;
    node.style.setProperty('--portal-accent',accent[0]);
    node.style.setProperty('--portal-accent-soft',accent[1]);
    node.style.setProperty('--portal-font-scale',String(FONT[p.font_scale]||FONT.medium));
    node.style.setProperty('--portal-density',p.density==='compact'?'.9':p.density==='comfortable'?'1.1':'1');
    node.style.setProperty('--portal-motion-scale',(p.reduced_motion||reduce?.matches)?'0':'1');
    node.style.setProperty('--portal-glass-blur',p.reduce_transparency?'0px':p.glass_effect==='clear'?'24px':p.glass_effect==='light'?'8px':'16px');
    tuneImages(node,p);
  };
  render();
  media?.addEventListener?.('change',render);
  reduce?.addEventListener?.('change',render);
  if(typeof MutationObserver!=='undefined'){
    observer=new MutationObserver((records)=>{
      if(records.some(r=>r.addedNodes?.length))tuneImages(node,p);
    });
    observer.observe(node,{subtree:true,childList:true});
  }
  return ()=>{
    media?.removeEventListener?.('change',render);
    reduce?.removeEventListener?.('change',render);
    observer?.disconnect();
  };
}
