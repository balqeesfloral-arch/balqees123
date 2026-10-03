/* Balqees Floral PWA notification worker — provider agnostic. */
self.addEventListener('install',event=>{self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim());});

self.addEventListener('push',event=>{
  let payload={};
  try{payload=event.data?.json?.()||{};}catch{payload={body:event.data?.text?.()||''};}
  const title=payload.title||payload.title_ar||'بلقيس الورد';
  const options={
    body:payload.body||payload.body_ar||'',
    icon:'/favicon.svg',badge:'/favicon.svg',
    tag:payload.group_key||payload.tag||payload.notification_id||'balqees-notification',
    renotify:Boolean(payload.renotify),
    data:{url:payload.deep_link||payload.action_url||'/portal/notifications',notification_id:payload.notification_id||null},
    silent:Boolean(payload.silent),
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const url=event.notification?.data?.url||'/portal/notifications';
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){
      try{
        const target=new URL(url,self.location.origin).href;
        if('focus' in client){await client.focus();if('navigate' in client)await client.navigate(target);return;}
      }catch{/* fall through */}
    }
    if(self.clients.openWindow)return self.clients.openWindow(url);
  })());
});
