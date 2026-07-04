/**
 * @jest-environment jsdom
 */
function changeThemeColor(newColorCode) {
  document.documentElement.style.setProperty('--main-theme-color', newColorCode);
}

describe('Testy systemu personalizacji UI', () => {
  
  test('Zmiana koloru w :root według podanego kodu HEX', () => {
    // 1. Wywołujemy funkcję z przykładowym kolorem
    changeThemeColor('#ff0000');

    // 2. Sprawdzamy, czy wirtualne drzewo DOM zapisało tę zmienną CSS
    const activeColor = document.documentElement.style.getPropertyValue('--main-theme-color');
    
    // 3. Asercja - czy wynik zgadza się z oczekiwaniem
    expect(activeColor).toBe('#ff0000');
  });

});