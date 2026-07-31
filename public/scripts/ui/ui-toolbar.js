(function () {
  function renderIcon(button) {
    const iconSlot = button.querySelector('.tb-icon')
    if (!iconSlot) return

    const type = button.dataset.iconType || 'emoji'
    const value = button.dataset.iconValue || ''
    const src = button.dataset.iconSrc || ''
    const alt = button.dataset.iconAlt || button.querySelector('.tb-label')?.textContent || ''

    if (type === 'image') {
      iconSlot.innerHTML = `<img src="${src}" alt="${alt}" />`
      return
    }

    if (type === 'svg') {
      iconSlot.innerHTML = button.dataset.iconSvg || ''
      return
    }

    iconSlot.textContent = value
  }

  function initToolbarButtons(container, options = {}) {
    const toolbar = container || document
    const selector = options.selector || '.tb-btn'
    const activeClass = options.activeClass || 'active'
    const onChange = options.onChange || null

    const buttons = toolbar.querySelectorAll(selector)

    buttons.forEach((button) => {
      renderIcon(button)

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
    renderIcon,
  }
})()
