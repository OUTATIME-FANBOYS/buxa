/*
 * The app's one toast lives in @buxa/middleware (providers/ToastView): UiProvider renders every toast through it, and a page can
 * render one directly. This file keeps the web app's import path.
 */
export { ToastView as Toast, TOAST_MS } from '@buxa/middleware/providers/ToastView';
