(function () {
  'use strict';

  function normalize(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function initLearnSearch() {
    var input = document.getElementById('learnSearchInput');
    var clear = document.getElementById('learnSearchClear');
    var status = document.getElementById('learnSearchStatus');
    var quickTags = Array.prototype.slice.call(document.querySelectorAll('[data-search-term]'));
    var cards = Array.prototype.slice.call(document.querySelectorAll('.content-card'));
    if (!input || !clear || !status || !cards.length) return;

    function derivedTerms(card) {
      var href = String(card.getAttribute('href') || '');
      var text = String(card.textContent || '');
      var solidTerms = [
        'triangular-pyramid',
        'quadrangular-pyramid',
        'triangular-prism',
        'quadrangular-prism',
        'cone',
        'cylinder',
        'rectangular-cuboid',
        'cube',
        'conical-frustum'
      ];
      var isSolid = solidTerms.some(function (term) {
        return href.indexOf('/' + term + '/') !== -1 || text.indexOf('solid.') !== -1;
      });
      if (isSolid) return ' 空間図形 立体図形 3d solid';
      if (href.indexOf('/geometry/') !== -1) return ' 平面図形 2d';
      return '';
    }

    var searchableCards = cards.map(function (card) {
      return {
        node: card,
        haystack: normalize([
          card.textContent,
          card.getAttribute('href'),
          derivedTerms(card)
        ].join(' '))
      };
    });

    function render() {
      var query = normalize(input.value);
      var terms = query ? query.split(' ').filter(Boolean) : [];
      var visible = 0;
      searchableCards.forEach(function (entry) {
        var matched = terms.every(function (term) {
          return entry.haystack.indexOf(term) !== -1;
        });
        entry.node.hidden = !matched;
        if (matched) visible += 1;
      });
      clear.hidden = !query;
      quickTags.forEach(function (tag) {
        var term = normalize(tag.getAttribute('data-search-term'));
        tag.setAttribute('aria-pressed', Boolean(query && term === query) ? 'true' : 'false');
      });
      status.textContent = query
        ? visible + '件 / ' + searchableCards.length + '件'
        : searchableCards.length + '件';
    }

    input.addEventListener('input', render);
    clear.addEventListener('click', function () {
      input.value = '';
      input.focus();
      render();
    });
    quickTags.forEach(function (tag) {
      tag.setAttribute('aria-pressed', 'false');
      tag.addEventListener('click', function () {
        input.value = tag.getAttribute('data-search-term') || '';
        input.focus();
        render();
      });
    });
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLearnSearch);
  } else {
    initLearnSearch();
  }
})();
