(function () {
  function init(containerId = 'events-module') {
    const host = document.getElementById(containerId)
    if (!host) return

    host.innerHTML = `
      <div class="module-card events-card">
        <h4>Ostatnie zdarzenia</h4>
        <ul class="events-list">
          <li class="event-empty">Brak zdarzeń</li>
        </ul>
      </div>
    `
  }

  window.WorkspaceEventsModule = {
    init,
  }
})()
