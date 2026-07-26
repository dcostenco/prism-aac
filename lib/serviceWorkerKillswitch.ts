export function buildServiceWorkerKillswitchScript(version: string): string {
  return `
(function(){
  try {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      navigator.serviceWorker.getRegistrations().then(function(regs){
        regs.forEach(function(r){ r.unregister(); });
      });
      if (typeof caches !== 'undefined') {
        caches.keys().then(function(keys){
          keys.forEach(function(k){ caches.delete(k); });
        });
      }
      return;
    }

    var reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function() {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });

    var KEY = 'prism-aac-sw-killswitch';
    var V = ${JSON.stringify(version)};
    if (window.localStorage.getItem(KEY) === V) return;
    window.localStorage.setItem(KEY, V);

    var registrations = navigator.serviceWorker.getRegistrations();
    var cacheKeys = typeof caches === 'undefined' ? Promise.resolve([]) : caches.keys();
    Promise.all([registrations, cacheKeys])
      .then(function(results){
        var regs = results[0];
        var runtimeKeys = results[1].filter(function(k){
          return !k.includes('precache') && !k.includes('serwist');
        });

        if (regs.length === 0 && runtimeKeys.length === 0) return false;

        return Promise.all(
          regs.map(function(r){ return r.unregister(); })
            .concat(runtimeKeys.map(function(k){ return caches.delete(k); })),
        ).then(function(){ return true; });
      })
      .then(function(didReset){
        if (didReset) window.location.reload();
      })
      .catch(function(){});
  } catch (e) {}
})();
`;
}
