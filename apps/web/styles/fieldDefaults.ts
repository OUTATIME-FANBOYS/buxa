/*
 * The default look of every input, select and textarea in the app. These are element selectors rather than classes, so they
 * reach plain fields and fields rendered by shared components. They sit on <body> as variants, so the portals (dialogs,
 * menus, popovers) get them too.
 *
 * Utilities live in a Tailwind layer, and the app's unlayered CSS (base.css: input, select and textarea reset to
 * `color: inherit`) beats a layered utility. So a rule that must win over that reset is forced (!).
 */
export const FIELD_DEFAULTS = [
  // Inputs and selects: the field box, its height, and the border that the hover and focus states change.
  'buxa:[&_:is(input,select)]:w-full buxa:[&_:is(input,select)]:bg-[var(--surface)] buxa:[&_:is(input,select)]:border buxa:[&_:is(input,select)]:border-[var(--control)] buxa:[&_:is(input,select)]:rounded-[var(--r-1)] buxa:[&_:is(input,select)]:px-[var(--s3)] buxa:[&_:is(input,select)]:py-0 buxa:[&_:is(input,select)]:h-[var(--control-h)] buxa:[&_:is(input,select)]:[transition:border-color_0.15s]',
  // Textareas: the same box, padded and sized for lines of text, and resizable down the page only.
  'buxa:[&_textarea]:w-full buxa:[&_textarea]:bg-[var(--surface)] buxa:[&_textarea]:border buxa:[&_textarea]:border-[var(--control)] buxa:[&_textarea]:rounded-[var(--r-1)] buxa:[&_textarea]:px-[var(--s3)] buxa:[&_textarea]:py-[var(--s2)] buxa:[&_textarea]:h-auto buxa:[&_textarea]:resize-y buxa:[&_textarea]:leading-[1.5] buxa:[&_textarea]:[transition:border-color_0.15s]',
  'buxa:[&_:is(input,select,textarea):hover]:border-[var(--text-2)]',
  // One ring on focus: the outline. The border keeps its colour, so a focused field never shows two frames.
  'buxa:[&_:is(input,select,textarea):focus-visible]:[outline:2px_solid_var(--accent)] buxa:[&_:is(input,select,textarea):focus-visible]:[outline-offset:-1px]',
  // Checkboxes and radio buttons: the native control at 16px, in the accent colour.
  'buxa:[&_input[type=checkbox]]:w-[16px] buxa:[&_input[type=checkbox]]:h-[16px] buxa:[&_input[type=checkbox]]:[accent-color:var(--accent)] buxa:[&_input[type=checkbox]]:p-0 buxa:[&_input[type=checkbox]]:flex-none',
  'buxa:[&_input[type=radio]]:w-[16px] buxa:[&_input[type=radio]]:h-[16px] buxa:[&_input[type=radio]]:[accent-color:var(--accent)] buxa:[&_input[type=radio]]:p-0 buxa:[&_input[type=radio]]:flex-none',
  'buxa:[&_:is(input,select):disabled]:bg-[var(--surface-3)] buxa:[&_:is(input,select):disabled]:text-[var(--text-2)]!',
  // An error is the red border alone: the focus ring is dropped while the field is invalid, so the two never stack.
  'buxa:[&_:is(input,select,textarea)[aria-invalid=true]]:border-[var(--crit)]!',
  'buxa:[&_:is(input,select,textarea)[aria-invalid=true]:focus-visible]:[outline:none]!',
  // Selects: no native arrow; the app's chevron sits at the right, and the text stops short of it.
  'buxa:[&_select]:[appearance:none] buxa:[&_select]:pr-[28px]! buxa:[&_select]:bg-[url(data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%2712%27%20height=%2712%27%20viewBox=%270%200%2024%2024%27%20fill=%27none%27%20stroke=%27%23888%27%20stroke-width=%272.5%27%20stroke-linecap=%27round%27%3E%3Cpath%20d=%27M6%209l6%206%206-6%27/%3E%3C/svg%3E)] buxa:[&_select]:bg-no-repeat buxa:[&_select]:[background-position:right_10px_center]',
].join(' ');
