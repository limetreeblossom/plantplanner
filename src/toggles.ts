export function applyRingsToggle(body: HTMLElement, checked: boolean): void {
  body.classList.toggle('hide-rings', !checked);
}

export function applyGridToggle(body: HTMLElement, checked: boolean): void {
  body.classList.toggle('hide-grid', !checked);
}

export function applyBgToggle(body: HTMLElement, checked: boolean): void {
  body.classList.toggle('hide-bg', !checked);
}

export function applyFlowersToggle(body: HTMLElement, checked: boolean): void {
  body.classList.toggle('hide-flowers', !checked);
}

export function applyTreesToggle(body: HTMLElement, checked: boolean): void {
  body.classList.toggle('hide-trees', !checked);
}
