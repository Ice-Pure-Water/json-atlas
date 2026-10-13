export const THEME_STORAGE_KEY = 'json-atlas-theme';
export const THEME_CHOICES = ['system', 'light', 'dark'];

export function mountThemeControls({
  select = null,
  buttons = [],
  root = document.body,
  storage = window.localStorage,
  media = window.matchMedia('(prefers-color-scheme: dark)'),
} = {}) {
  let choice = storage.getItem(THEME_STORAGE_KEY);
  if (!THEME_CHOICES.includes(choice)) choice = 'system';

  const apply = (next, persist = true) => {
    if (!THEME_CHOICES.includes(next)) return;
    choice = next;
    if (persist) storage.setItem(THEME_STORAGE_KEY, choice);
    const dark = choice === 'dark' || (choice === 'system' && media.matches);
    root.classList.toggle('theme-dark', dark);
    root.dataset.theme = choice;
    select?.setAttribute('value', choice);
    if (select) select.value = choice;
    buttons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.themeChoice === choice));
    });
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', dark ? '#171c19' : '#f4f5f2');
  };

  const onSelect = () => apply(select.value);
  const onMediaChange = () => {
    if (choice === 'system') apply('system', false);
  };
  select?.addEventListener('change', onSelect);
  const onButtonClick = (event) => apply(event.currentTarget.dataset.themeChoice);
  buttons.forEach((button) => button.addEventListener('click', onButtonClick));
  media.addEventListener('change', onMediaChange);
  apply(choice, false);

  return {
    get choice() {
      return choice;
    },
    set: apply,
    destroy() {
      select?.removeEventListener('change', onSelect);
      buttons.forEach((button) => button.removeEventListener('click', onButtonClick));
      media.removeEventListener('change', onMediaChange);
    },
  };
}
