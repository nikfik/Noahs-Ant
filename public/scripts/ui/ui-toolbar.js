(function () {
  function initToolbarButtons(container, options = {}) {
    const toolbar = container || document
    const selector = options.selector || '.tb-btn'
    const activeClass = options.activeClass || 'active'
    const onChange = options.onChange || null

    const buttons = toolbar.querySelectorAll(selector)

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        buttons.forEach((item) => item.classList.toggle(activeClass, item === button))

        if (onChange) {
          onChange(button)
        }
      })
    })

    return buttons
  }

  window.UiToolbar = {
    initToolbarButtons,
  }
})()
