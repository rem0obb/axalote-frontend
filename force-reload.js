// Add this to force browser cache invalidation
const timestamp = Date.now();
console.log(`🔄 Force reload at ${timestamp}`);

// Force reload without cache
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
    }
  });
}

// Clear all storage
localStorage.clear();
sessionStorage.clear();

// Force hard reload
window.location.reload(true);