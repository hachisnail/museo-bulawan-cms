// Umami Analytics loader
// Reads config injected by the server into <head> data-attributes and
// dynamically appends the Umami tracking script so env vars stay dynamic.
(function () {
  var head = document.head;
  var url = head.getAttribute('data-umami-url');
  var id  = head.getAttribute('data-umami-id');
  if (!url || !id) return;
  var s = document.createElement('script');
  s.defer = true;
  s.src = url + '/script.js';
  s.setAttribute('data-website-id', id);
  head.appendChild(s);
})();
